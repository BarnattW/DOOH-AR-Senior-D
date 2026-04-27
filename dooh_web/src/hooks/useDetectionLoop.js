import { useEffect, useRef } from "react";
import { BUILDING_CLASSES } from "../constants/buildings";

const DETECT_EVERY_MS = 50;
const MIN_CONFIDENCE = 0.55;
const MAX_DETECTIONS = 1;
const DETECTION_HOLD_MS = 150;
// Force-clear detections if no fresh positive arrives within this window.
// Set to ~1.5x inference time so one missed frame doesn't flicker, but the
// box doesn't ghost for an entire extra inference cycle.
const DETECTION_MAX_AGE_MS = 5000;

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
  const lastStableDetectionsRef = useRef([]);
  const lastDetectionAtRef = useRef(0);

  useEffect(() => {
    console.log(`[loop] effect — isRunning:${isRunning} hasSession:${!!session}`);
    if (!isRunning || !session) return;

    console.log("[loop] starting interval");
    let staleTimer = null;

    const id = setInterval(async () => {
      const hasVideo = !!videoRef.current;
      const vw = videoRef.current?.videoWidth;
      const vh = videoRef.current?.videoHeight;
      console.log(`[loop] tick — busy:${isDetectingRef.current} hasVideo:${hasVideo} dims:${vw}x${vh}`);
      if (isDetectingRef.current || !videoRef.current) return;
      isDetectingRef.current = true;

      // Stamp this inference — if a newer one finishes first, discard this result
      const requestId = ++latestRequestId.current;

      try {
        console.log("[loop] calling detect...");
        const raw = await detect(videoRef.current, canvasRef, null);
        console.log("[loop] detect returned", raw?.length, "boxes");

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

        if (formatted.length > 0) {
          clearTimeout(staleTimer);
          lastStableDetectionsRef.current = formatted;
          lastDetectionAtRef.current = Date.now();
          onDetections(formatted);
          // Wall-clock safety net: clear if no fresh detection within MAX_AGE
          staleTimer = setTimeout(() => {
            lastStableDetectionsRef.current = [];
            onDetections([]);
          }, DETECTION_MAX_AGE_MS);
          return;
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
      } finally {
        isDetectingRef.current = false;
      }
    }, DETECT_EVERY_MS);

    return () => {
      clearInterval(id);
      clearTimeout(staleTimer);
      lastStableDetectionsRef.current = [];
      lastDetectionAtRef.current = 0;
    };
  }, [isRunning, session, videoRef, canvasRef, detect, onDetections]);
}
