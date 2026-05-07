import { useEffect, useRef } from "react";

/**
 * Two-finger pinch-to-zoom on a target element. rAF-throttled.
 * Suppresses iOS Safari gesture events to avoid double-handling.
 */
export function usePinchZoom({ targetRef, zoom, setZoom, zoomCaps, enabled = true }) {
  const zoomRef = useRef(zoom);
  const setZoomRef = useRef(setZoom);
  const zoomCapsRef = useRef(zoomCaps);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { setZoomRef.current = setZoom; }, [setZoom]);
  useEffect(() => { zoomCapsRef.current = zoomCaps; }, [zoomCaps]);

  useEffect(() => {
    if (!enabled) return;
    const el = targetRef.current;
    if (!el) return;

    const pointers = new Map();
    let startDist = 0;
    let startZoom = 1;
    let pendingZoom = null;
    let rafId = 0;

    const flush = () => {
      rafId = 0;
      if (pendingZoom == null) return;
      const caps = zoomCapsRef.current;
      const min = caps?.min ?? 1;
      const max = caps?.max ?? 5;
      const clamped = Math.min(max, Math.max(min, pendingZoom));
      pendingZoom = null;
      setZoomRef.current?.(clamped);
    };

    const distance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        startDist = distance() || 1;
        startZoom = zoomRef.current ?? 1;
      }
    };

    const onPointerMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && startDist > 0) {
        pendingZoom = startZoom * (distance() / startDist);
        if (!rafId) rafId = requestAnimationFrame(flush);
      }
    };

    const onPointerUp = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDist = 0;
    };

    const suppress = (e) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("gesturestart", suppress);
    el.addEventListener("gesturechange", suppress);
    el.addEventListener("gestureend", suppress);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("gesturestart", suppress);
      el.removeEventListener("gesturechange", suppress);
      el.removeEventListener("gestureend", suppress);
    };
  }, [enabled, targetRef]);
}
