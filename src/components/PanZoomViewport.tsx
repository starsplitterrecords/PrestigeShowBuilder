import React, { useCallback, useEffect, useRef, useState } from 'react';
 
// PanZoomViewport — DA-089
// Wraps the full desktop workspace in a fit-to-width pan/zoom surface so the
// whole app is usable on a small screen (e.g. a phone turned sideways): it
// fits to width by default, and lets you zoom in and pan to inspect any part.
//
// Design notes:
// - The inner content is rendered at a FIXED logical width (designWidth) and
//   scaled with CSS transform, so the desktop three-column layout never has to
//   reflow to a tiny viewport — it just shrinks to fit, then you zoom in.
// - On large screens (>= designWidth) it behaves as a pass-through at scale 1
//   with panning disabled, so desktop use is unchanged.
// - Pinch-zoom (two-pointer), ctrl/⌘+wheel zoom, and drag-to-pan when zoomed
//   past the fit scale. Plain clicks/taps pass through to the app untouched.
 
interface Props {
 children: React.ReactNode;
 /** Logical width the desktop UI is designed for. */
 designWidth?: number;
 /** Enable the wrapper. When false, renders children directly (pass-through). */
 enabled?: boolean;
}
 
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
 
export default function PanZoomViewport({ children, designWidth = 1280, enabled = true }: Props) {
 const frameRef = useRef<HTMLDivElement>(null);
 const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
 const [scale, setScale] = useState(1);
 const [tx, setTx] = useState(0);
 const [ty, setTy] = useState(0);
 const [userZoomed, setUserZoomed] = useState(false);
 
 // fit scale = frame width / design width, capped at 1 (never upscale on desktop)
 const fitScale = frameSize.w > 0 ? Math.min(1, frameSize.w / designWidth) : 1;
 const isLargeScreen = frameSize.w >= designWidth;
 
 // Measure the frame.
 useEffect(() => {
   const el = frameRef.current;
   if (!el) return;
   const ro = new ResizeObserver(entries => {
     const r = entries[0].contentRect;
     setFrameSize({ w: r.width, h: r.height });
   });
   ro.observe(el);
   return () => ro.disconnect();
 }, []);
 
 // Reset to fit when the frame size changes and the user hasn't manually zoomed
 // (this is what makes a phone rotation re-fit automatically).
 useEffect(() => {
   if (!userZoomed) {
     setScale(fitScale);
     setTx(Math.max(0, (frameSize.w - designWidth * fitScale) / 2));
     setTy(0);
   }
 }, [fitScale, frameSize.w, designWidth, userZoomed]);
 
 const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
 
 const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
   setUserZoomed(true);
   setScale(prev => {
     const next = clampScale(prev * factor);
     // zoom toward a point (default: frame center)
     const ox = originX ?? frameSize.w / 2;
     const oy = originY ?? frameSize.h / 2;
     setTx(px => ox - (ox - px) * (next / prev));
     setTy(py => oy - (oy - py) * (next / prev));
     return next;
   });
 }, [frameSize.w, frameSize.h]);
 
 const resetFit = useCallback(() => {
   setUserZoomed(false);
   setScale(fitScale);
   setTx(Math.max(0, (frameSize.w - designWidth * fitScale) / 2));
   setTy(0);
 }, [fitScale, frameSize.w, designWidth]);
 
 // ctrl/cmd + wheel = zoom; plain wheel passes through to inner scroll.
 const onWheel = useCallback((e: React.WheelEvent) => {
   if (!enabled || isLargeScreen) return;
   if (e.ctrlKey || e.metaKey) {
     e.preventDefault();
     const rect = frameRef.current!.getBoundingClientRect();
     zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
   }
 }, [enabled, isLargeScreen, zoomBy]);
 
 // Pointer panning + pinch.
 const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
 const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
 const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
 
 const onPointerDown = (e: React.PointerEvent) => {
   if (!enabled || isLargeScreen) return;
   pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
   if (pointers.current.size === 1 && scale > fitScale + 0.001) {
     // begin pan only when zoomed in past fit (so normal use isn't hijacked)
     panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
   }
 };
 
 const onPointerMove = (e: React.PointerEvent) => {
   if (!enabled || isLargeScreen) return;
   if (!pointers.current.has(e.pointerId)) return;
   pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
 
   if (pointers.current.size === 2) {
     const pts = Array.from(pointers.current.values());
     const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
     if (!pinchStart.current) {
       pinchStart.current = { dist, scale };
     } else {
       setUserZoomed(true);
       const next = clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist));
       setScale(next);
     }
     panStart.current = null;
   } else if (panStart.current) {
     setTx(panStart.current.tx + (e.clientX - panStart.current.x));
     setTy(panStart.current.ty + (e.clientY - panStart.current.y));
   }
 };
 
 const endPointer = (e: React.PointerEvent) => {
   pointers.current.delete(e.pointerId);
   if (pointers.current.size < 2) pinchStart.current = null;
   if (pointers.current.size === 0) panStart.current = null;
 };
 
 if (!enabled) return <>{children}</>;
 
 const panning = scale > fitScale + 0.001;
 
 return (
   <div
     ref={frameRef}
     onWheel={onWheel}
     onPointerDown={onPointerDown}
     onPointerMove={onPointerMove}
     onPointerUp={endPointer}
     onPointerCancel={endPointer}
     style={{
       position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
       touchAction: isLargeScreen ? 'auto' : 'none',
     }}
   >
     <div
       style={{
         width: designWidth,
         height: isLargeScreen ? '100%' : `${100 / scale}%`,
         transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
         transformOrigin: '0 0',
         // when zoomed in, let pan take over; otherwise normal pointer behavior
         cursor: panning ? 'grab' : 'default',
       }}
     >
       {children}
     </div>
 
     {/* zoom controls — only when the wrapper is actually doing something */}
     {!isLargeScreen && (
       <div
         style={{
           position: 'absolute', right: 10, bottom: 10, zIndex: 60,
           display: 'flex', gap: 6, alignItems: 'center',
           background: 'rgba(7,7,7,0.85)', border: '1px solid rgba(255,255,255,0.12)',
           borderRadius: 8, padding: '5px 7px', backdropFilter: 'blur(4px)',
         }}
       >
         <button onClick={() => zoomBy(1 / 1.2)} style={zBtn} aria-label="Zoom out">−</button>
         <span style={{ color: '#bbb', fontSize: 11, fontFamily: 'ui-monospace, monospace', minWidth: 38, textAlign: 'center' }}>
           {Math.round(scale * 100)}%
         </span>
         <button onClick={() => zoomBy(1.2)} style={zBtn} aria-label="Zoom in">+</button>
         <button onClick={resetFit} style={{ ...zBtn, width: 'auto', padding: '0 8px', fontSize: 10, letterSpacing: '0.08em' }} aria-label="Fit to width">FIT</button>
       </div>
     )}
   </div>
 );
}
 
const zBtn: React.CSSProperties = {
 width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.14)',
 background: 'rgba(255,255,255,0.06)', color: '#eee', fontSize: 15, fontWeight: 700,
 cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};
