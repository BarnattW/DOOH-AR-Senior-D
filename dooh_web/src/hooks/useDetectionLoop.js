import { useEffect, useRef } from "react";
import { BUILDING_CLASSES } from "../components/ai/Detector";

const DETECT_EVERY_MS = 50; // ~30fps — viable with WebGPU, falls back gracefully on WASM
const MIN_CONFIDENCE = 0.6;
const MAX_DETECTIONS = 1;

/**
 * Runs object detection on an interval and calls onDetections with formatted results.
 *
 * Uses a "latest wins" pattern — if inference takes longer than the interval,
 * any result that isn't the most recent is silently discarded. This prevents
 * stale detections from drawing out-of-order boxes.
 */
export function useDetectionLoop({ isRunning, session, videoRef, canvasRef, detect, onDetections }) {
  const isDetectingRef = useRef(false);
  const latestRequestId = useRef(0);

  useEffect(() => {
    if (!isRunning || !session) return;

    const id = setInterval(async () => {
      if (isDetectingRef.current || !videoRef.current) return;
      isDetectingRef.current = true;

      // Stamp this inference — if a newer one finishes first, discard this result
      const requestId = ++latestRequestId.current;

      try {
        const raw = await detect(videoRef.current, canvasRef, null);

        // A newer inference already completed — this result is stale, drop it
        if (requestId !== latestRequestId.current) return;

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

        onDetections(formatted);
      } catch (e) {
        console.error(e);
      } finally {
        isDetectingRef.current = false;
      }
    }, DETECT_EVERY_MS);

    return () => clearInterval(id);
  }, [isRunning, session, videoRef, canvasRef, detect, onDetections]);
}