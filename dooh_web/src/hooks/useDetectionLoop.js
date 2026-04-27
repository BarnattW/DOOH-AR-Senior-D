import { useEffect, useRef } from "react";
import { BUILDING_CLASSES } from "../constants/buildings";

const MIN_CONFIDENCE = 0.55;
const MAX_DETECTIONS = 1;
const DETECTION_HOLD_MS = 150;
const DETECTION_MAX_AGE_MS = 2500;

/**
 * Runs object detection as fast as the model allows (tight async loop, no idle gap).
 * Uses a "latest wins" pattern — stale results are silently discarded.
 */
export function useDetectionLoop({ isRunning, session, videoRef, canvasRef, detect, onDetections }) {
  const latestRequestId = useRef(0);
  const lastStableDetectionsRef = useRef([]);
  const lastDetectionAtRef = useRef(0);

  useEffect(() => {
    if (!isRunning || !session) return;

    let cancelled = false;
    let staleTimer = null;

    (async () => {
      while (!cancelled) {
        if (!videoRef.current?.videoWidth) {
          await new Promise((r) => setTimeout(r, 16));
          continue;
        }

        const requestId = ++latestRequestId.current;

        try {
          const raw = await detect(videoRef.current, canvasRef, null);

          if (cancelled || requestId !== latestRequestId.current) continue;

          const formatted = raw
            .filter(([, , , , conf]) => conf >= MIN_CONFIDENCE)
            .slice(0, MAX_DETECTIONS)
            .map(([x1, y1, x2, y2, conf, classId]) => ({
              box: { x1, y1, x2, y2 },
              confidence: conf,
              classId,
              label: classId !== undefined
                ? BUILDING_CLASSES[classId] ?? `Building ${classId}`
                : "Unknown",
            }));

          if (formatted.length > 0) {
            clearTimeout(staleTimer);
            lastStableDetectionsRef.current = formatted;
            lastDetectionAtRef.current = Date.now();
            onDetections(formatted);
            staleTimer = setTimeout(() => {
              lastStableDetectionsRef.current = [];
              onDetections([]);
            }, DETECTION_MAX_AGE_MS);
            continue;
          }

          const timeSinceLastDetection = Date.now() - lastDetectionAtRef.current;
          if (
            lastStableDetectionsRef.current.length > 0 &&
            timeSinceLastDetection < DETECTION_HOLD_MS
          ) {
            onDetections(lastStableDetectionsRef.current);
          } else {
            lastStableDetectionsRef.current = [];
            onDetections([]);
          }
        } catch (e) {
          console.error(e);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(staleTimer);
      lastStableDetectionsRef.current = [];
      lastDetectionAtRef.current = 0;
    };
  }, [isRunning, session, videoRef, canvasRef, detect, onDetections]);
}
