import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TextOverlaySpec } from '../types/models';
import { TextOverlayRenderer } from './TextOverlayRenderer';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  caption?: string;
  overlays?: TextOverlaySpec[];
  overlayLayoutName?: string;
  overlayPanelCount?: number;
  onClose: () => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  src, alt = "Image preview", caption, overlays, overlayLayoutName, overlayPanelCount, onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  
  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setImgSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = -e.deltaY;
    const zoomFactor = 1.1;
    const newScale = delta > 0 ? scale * zoomFactor : scale / zoomFactor;
    
    // Cap zoom
    setScale(Math.min(Math.max(newScale, 1), 10));
    
    // Reset offset if scale returns to 1
    if (newScale <= 1) {
      setOffset({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4
        bg-black/95 backdrop-blur-md overflow-hidden"
      onClick={onClose}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className="absolute top-6 right-6 z-[110] flex gap-4 items-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[10px] text-white/50 font-mono uppercase tracking-[0.2em] bg-black/60 px-3 py-1.5 rounded-full border border-white/10">
          Scroll to Zoom • Drag to Pan ({Math.round(scale * 100)}%)
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 backdrop-blur-md
            border border-white/20 rounded-full text-white
            hover:bg-white/20 hover:scale-110 transition-all
            flex items-center justify-center text-lg active:scale-95"
        >
          ✕
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex flex-col items-center justify-center transition-transform duration-75 ease-out select-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        <div className="relative inline-block border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            draggable={false}
            className="max-w-[85vw] max-h-[85vh] object-contain rounded-xs"
          />
          {overlays && imgSize && (
            <TextOverlayRenderer 
              overlays={overlays}
              panelWidth={imgSize.width}
              panelHeight={imgSize.height}
              layoutName={overlayLayoutName}
              panelCount={overlayPanelCount}
            />
          )}
        </div>
        {caption && scale === 1 && (
          <p className="absolute -bottom-8 left-0 right-0 text-[10px] text-white/60 font-mono text-center
            uppercase tracking-widest pointer-events-none">
            {caption}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ImageLightbox;
