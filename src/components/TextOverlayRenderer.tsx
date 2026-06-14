import React, { useEffect, useRef, useCallback } from 'react';
import { TextOverlaySpec } from '../types/models';
import { getRegion, Region } from '../constants/layout.constants';
import {
  FONT_FAMILY,
  FONT_FAMILY_SC,
  FONT_SIZE,
  LINE_HEIGHT,
  PAD_X,
  PAD_Y,
  BALLOON_MIN_W,
  MARGIN,
  TAIL_H,
  MAX_W_FRAC,
  COL_BALLOON_FILL,
  COL_BALLOON_STROKE,
  COL_BALLOON_TEXT,
  COL_NARRATOR_FILL,
  COL_NARRATOR_TEXT,
  COL_LOCATION_FILL,
  COL_LOCATION_TEXT
} from '../constants/lettering.constants';

// ── Canvas word-wrap ─────────────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ── Draw a single balloon ─────────────────────────────────────────────────
function drawBalloon(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: string,
  region: Region,
  pageW: number,
  pageH: number,
  chained: boolean,
  chainOffsetY: number   // px: vertical offset within the corner for chaining
): number {            // returns the balloon height consumed
  const rLeft   = region.left   * pageW;
  const rTop    = region.top    * pageH;
  const rWidth  = region.width  * pageW;
  const rHeight = region.height * pageH;

  ctx.font = `700 ${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';

  const maxW = rWidth * MAX_W_FRAC - PAD_X * 2;
  const lines = wrapText(ctx, text.toUpperCase(), maxW);
  const textW  = Math.max(...lines.map(l => ctx.measureText(l).width));
  const bw     = Math.max(textW + PAD_X * 2, BALLOON_MIN_W);
  const bh     = lines.length * LINE_HEIGHT + PAD_Y * 2;

  // X position: clamp within panel region
  let bx: number;
  if (position.includes('right')) {
    bx = rLeft + rWidth - bw - MARGIN;
  } else {
    bx = rLeft + MARGIN;
  }
  // Clamp so balloon doesn't overflow image width
  bx = Math.max(MARGIN, Math.min(bx, pageW - bw - MARGIN));

  // Y position: top or bottom of panel region + chainOffset
  let by: number;
  if (position.includes('bottom')) {
    // Bottom: stack upward — start from bottom and go up as chain grows
    by = rTop + rHeight - MARGIN - TAIL_H - bh - chainOffsetY;
  } else {
    by = rTop + MARGIN + chainOffsetY;
  }
  // Clamp vertically
  by = Math.max(rTop + MARGIN, Math.min(by, rTop + rHeight - bh - MARGIN));

  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const rx = bw / 2 + 4;
  const ry = bh / 2 + 3;

  // Tail (only on last balloon in chain)
  if (!chained) {
    const tailBaseX = position.includes('right') ? bx + bw * 0.72 : bx + bw * 0.28;
    const tailTipX  = position.includes('right') ? tailBaseX + 10  : tailBaseX - 10;
    
    // If balloon is at the top, tail points DOWN from the bottom of the balloon
    // If balloon is at the bottom, tail points UP from the top of the balloon
    const tailTipY  = position.includes('bottom') ? by - TAIL_H : by + bh + TAIL_H;
    
    ctx.beginPath();
    ctx.moveTo(tailBaseX - 5, position.includes('bottom') ? by : by + bh);
    ctx.lineTo(tailTipX, tailTipY);
    ctx.lineTo(tailBaseX + 5, position.includes('bottom') ? by : by + bh);
    ctx.closePath();
    ctx.fillStyle = COL_BALLOON_FILL;
    ctx.fill();
    ctx.strokeStyle = COL_BALLOON_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Oval
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = COL_BALLOON_FILL;
  ctx.fill();
  ctx.strokeStyle = COL_BALLOON_STROKE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.fillStyle = COL_BALLOON_TEXT;
  ctx.font = `700 ${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const textStartY = by + PAD_Y;
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + bw / 2, textStartY + i * LINE_HEIGHT);
  });

  return bh + 4;  // height consumed (for chaining)
}

// ── Draw a caption bar ───────────────────────────────────────────────────
function drawCaptionBar(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: string,
  color: string | undefined,
  region: Region,
  pageW: number,
  pageH: number,
  stackOffset: number   // px: vertical offset for stacking multiple bars
): number {
  const rLeft  = region.left  * pageW;
  const rTop   = region.top   * pageH;
  const rWidth = region.width * pageW;

  const isThought  = style === 'thought-bar';
  const isNarrator = style === 'narrator';
  const isInternal = style === 'internal';
  const isFloating = style === 'floating';

  const fill = isThought  ? (color ?? '#6B2D0F')
             : isNarrator ? COL_NARRATOR_FILL
             : isInternal ? '#FFFFFF'
             : isFloating ? 'transparent'
             : COL_LOCATION_FILL;
  const textCol = isThought  ? '#FFFFFF'
               : isNarrator ? COL_NARRATOR_TEXT
               : isInternal ? '#000000'
               : isFloating ? '#FFFFFF'
               : COL_LOCATION_TEXT;

  const font = isThought || isInternal
    ? `400 ${FONT_SIZE}px ${FONT_FAMILY}`
    : `700 ${FONT_SIZE}px ${FONT_FAMILY_SC}`;
  ctx.font = font;

  const inset  = 8;
  const barW   = rWidth - inset * 2;
  const maxW   = barW - PAD_X * 2;
  const lines  = wrapText(ctx, text.toUpperCase(), maxW);
  const barH   = lines.length * LINE_HEIGHT + PAD_Y * 2;

  const barX = rLeft + inset;
  const barY = rTop  + inset + stackOffset;

  if (!isFloating) {
    // Fill
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Floating text gets a subtle shadow for legibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }

  // Text
  ctx.fillStyle = textCol;
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const letterSpacing = isNarrator ? '0.06em' : '0.01em';  // note: canvas has no letterSpacing in older browsers
  lines.forEach((line, i) => {
    ctx.fillText(line, barX + PAD_X, barY + PAD_Y + i * LINE_HEIGHT);
  });

  if (isFloating) {
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  return barH + 4;
}

// ── Component ────────────────────────────────────────────────────────────
interface Props {
  overlays: TextOverlaySpec[];
  panelWidth: number;
  panelHeight: number;
  layoutName?: string;
  panelCount?: number;
}

export const TextOverlayRenderer: React.FC<Props> = ({
  overlays, panelWidth, panelHeight, layoutName, panelCount
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || panelWidth <= 0 || panelHeight <= 0) return;

    canvas.width  = panelWidth;
    canvas.height = panelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, panelWidth, panelHeight);

    const maxIdx = Math.max(0, ...overlays.map(o => o.panelIndex ?? 0));
    const total  = panelCount ?? maxIdx + 1;

    // ── Caption bars ──────────────────────────────────────────────────────
    const bars = overlays.filter(o => o.kind !== 'balloon');
    // Group by panel, track stack offset per panel
    const barOffsets: Record<number, number> = {};
    for (const bar of bars) {
      const pIdx  = bar.panelIndex ?? 0;
      const region = getRegion(layoutName, pIdx, total);
      const offset = barOffsets[pIdx] ?? 0;
      const consumed = drawCaptionBar(
        ctx, bar.text, bar.style, bar.color,
        region, panelWidth, panelHeight, offset
      );
      barOffsets[pIdx] = offset + consumed;
    }

    // ── Speech balloons ───────────────────────────────────────────────────
    const balloons = overlays.filter(o => o.kind === 'balloon');
    // Group by panel+position for chaining
    type BalloonGroup = { overlays: TextOverlaySpec[]; chainOffset: number };
    const groups: Record<string, BalloonGroup> = {};
    for (const b of balloons) {
      const key = `${b.panelIndex ?? 0}:${b.position}`;
      if (!groups[key]) groups[key] = { overlays: [], chainOffset: 0 };
      groups[key].overlays.push(b);
    }
    for (const key of Object.keys(groups)) {
      const [idxStr, pos] = key.split(':');
      const pIdx   = parseInt(idxStr, 10);
      const region = getRegion(layoutName, pIdx, total);
      let chainOffset = 0;
      const group  = groups[key].overlays;
      
      // If position is bottom, we want the first chunk to be drawn highest (last in the array)
      // and the last chunk to be drawn lowest (first in the array, with chainOffset=0)
      const drawOrder = pos.includes('bottom') ? [...group].reverse() : group;
      
      drawOrder.forEach((b) => {
        const consumed = drawBalloon(
          ctx, b.text, pos, region,
          panelWidth, panelHeight,
          b.chained ?? false,
          chainOffset
        );
        chainOffset += consumed + 2;
      });
    }
  }, [overlays, panelWidth, panelHeight, layoutName, panelCount]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  // Redraw when Patrick Hand loads (font may not be ready on first render)
  useEffect(() => {
    document.fonts.ready.then(() => {
      drawAll();
    });
  }, [drawAll]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        pointerEvents: 'none',
        width:         '100%',
        height:        '100%',
      }}
    />
  );
};
