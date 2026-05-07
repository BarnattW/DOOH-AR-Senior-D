import { useEffect, useRef } from "react";

// Pause detections when acceleration exceeds this (m/s²)
const DEFAULT_THRESHOLD = 3;
// Keep "moving" state for this long after the last spike
const COOLDOWN_MS = 400;

export function useMotionGate(threshold = DEFAULT_THRESHOLD) {
  const isMovingRef = useRef(false);
  const lastAboveRef = useRef(0);
  const prevGravRef = useRef(null);

  useEffect(() => {
    const onMotion = (e) => {
      let mag = null;

      const a = e.acceleration;
      if (a && (a.x !== null || a.y !== null || a.z !== null)) {
        // Preferred: linear acceleration with gravity removed
        const x = a.x ?? 0, y = a.y ?? 0, z = a.z ?? 0;
        mag = Math.sqrt(x * x + y * y + z * z);
      } else {
        // Fallback: diff consecutive samples to cancel constant gravity
        const ag = e.accelerationIncludingGravity;
        if (ag) {
          const cur = { x: ag.x ?? 0, y: ag.y ?? 0, z: ag.z ?? 0 };
          const prev = prevGravRef.current;
          if (prev) {
            const dx = cur.x - prev.x, dy = cur.y - prev.y, dz = cur.z - prev.z;
            mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
          }
          prevGravRef.current = cur;
        }
      }

      if (mag !== null && mag > threshold) {
        lastAboveRef.current = Date.now();
      }
      isMovingRef.current = Date.now() - lastAboveRef.current < COOLDOWN_MS;
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [threshold]);

  return isMovingRef;
}
