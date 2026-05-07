import { useEffect, useRef } from "react";

export function usePinchZoom({ targetRef, zoom, setZoom, setZoomImmediate, zoomCaps, enabled = true }) {
  const zoomRef = useRef(zoom);
  const setZoomRef = useRef(setZoom);
  const setZoomImmediateRef = useRef(setZoomImmediate);
  const zoomCapsRef = useRef(zoomCaps);
  const enabledRef = useRef(enabled);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { setZoomRef.current = setZoom; }, [setZoom]);
  useEffect(() => { setZoomImmediateRef.current = setZoomImmediate; }, [setZoomImmediate]);
  useEffect(() => { zoomCapsRef.current = zoomCaps; }, [zoomCaps]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Always attach — enabled only gates whether we act on the gesture
  useEffect(() => {
    console.log("[pinch] hook mounted, enabled:", enabled);

    let startDist = 0;
    let startZoom = 1;
    let rafId = 0;
    let pendingZoom = null;
    let active = false;

    const clamp = (val) => {
      const caps = zoomCapsRef.current;
      const min = caps?.min ?? 1;
      const max = caps?.max ?? 5;
      return Math.min(max, Math.max(min, val));
    };

    const flush = () => {
      rafId = 0;
      if (pendingZoom == null) return;
      const clamped = clamp(pendingZoom);
      pendingZoom = null;
      setZoomImmediateRef.current?.(clamped);
    };

    const getTouchDist = (touches) => {
      const a = touches[0], b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e) => {
      console.log("[pinch] window touchstart, fingers:", e.touches.length, "enabled:", enabledRef.current);
      if (!enabledRef.current) return;
      if (e.touches.length === 2) {
        active = true;
        startDist = getTouchDist(e.touches) || 1;
        startZoom = zoomRef.current ?? 1;
        console.log("[pinch] pinch start — dist:", startDist.toFixed(0), "zoom:", startZoom);
      }
    };

    const onTouchMove = (e) => {
      if (!active || e.touches.length !== 2) return;
      e.preventDefault();
      pendingZoom = startZoom * (getTouchDist(e.touches) / startDist);
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2 && active) {
        active = false;
        startDist = 0;
        // Apply hardware zoom once at the end using current zoom state
        setZoomRef.current?.(zoomRef.current);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);  // mount once only
}
