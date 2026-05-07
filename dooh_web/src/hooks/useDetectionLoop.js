import { useEffect, useRef } from "react";
import { BUILDING_CLASSES } from "../constants/buildings";

const MIN_CONFIDENCE = 0.55;
const MAX_DETECTIONS = 1;
const DETECTION_HOLD_MS = 150;
const DETECTION_MAX_AGE_MS = 800;

const supportsRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;

export function useDetectionLoop({ isRunning, session, videoRef, canvasRef, detect, onDetections, isMovingRef }) {
  const latestRequestId = useRef(0);
  const lastStableDetectionsRef = useRef([]);
  const lastDetectionAtRef = useRef(0);

  useEffect(() => {
    if (!isRunning || !session) return;

    let cancelled = false;
    let staleTimer = null;
    let rvcHandle = null;

    const runDetection = async () => {
      if (cancelled || !videoRef.current?.videoWidth) {
        scheduleNext();
        return;
      }

      if (isMovingRef?.current) {
        if (lastStableDetectionsRef.current.length > 0) {
          clearTimeout(staleTimer);
          lastStableDetectionsRef.current = [];
          lastDetectionAtRef.current = 0;
          onDetections([]);
        }
        scheduleNext();
        return;
      }

      const requestId = ++latestRequestId.current;

      try {
        const raw = await detect(videoRef.current, canvasRef, null);

        if (cancelled || requestId !== latestRequestId.current) return;

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
        } else {
          const timeSinceLastDetection = Date.now() - lastDetectionAtRef.current;
          if (lastStableDetectionsRef.current.length > 0 && timeSinceLastDetection < DETECTION_HOLD_MS) {
            onDetections(lastStableDetectionsRef.current);
          } else {
            lastStableDetectionsRef.current = [];
            onDetections([]);
          }
        }
      } catch (e) {
        console.error(e);
      }

      if (!cancelled) scheduleNext();
    };

    const scheduleNext = () => {
      const video = videoRef.current;
      if (!video || cancelled) return;
      if (supportsRVFC) {
        // fires exactly when a new video frame is available — always fresh, never duplicate
        rvcHandle = video.requestVideoFrameCallback(runDetection);
      } else {
        requestAnimationFrame(runDetection);
      }
    };

    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(staleTimer);
      if (supportsRVFC && rvcHandle && videoRef.current) {
        videoRef.current.cancelVideoFrameCallback(rvcHandle);
      }
      lastStableDetectionsRef.current = [];
      lastDetectionAtRef.current = 0;
    };
  }, [isRunning, session, videoRef, canvasRef, detect, onDetections]);
}
