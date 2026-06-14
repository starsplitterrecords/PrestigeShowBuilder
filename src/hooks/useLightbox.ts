import { useState, useCallback } from "react";
import { TextOverlaySpec } from "../types/models";

export interface LightboxState {
  src: string | null;
  caption?: string;
  overlays?: TextOverlaySpec[];
  layoutName?: string;
  panelCount?: number;
}

export function useLightbox() {
  const [lightbox, setLightbox] = useState<LightboxState>({ src: null });

  const openLightbox = useCallback((
    src: string,
    opts?: Omit<LightboxState, "src">
  ) => {
    setLightbox({ src, ...opts });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox({ src: null });
  }, []);

  return { lightbox, openLightbox, closeLightbox };
}
