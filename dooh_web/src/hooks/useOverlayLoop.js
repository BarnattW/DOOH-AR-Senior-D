import { useEffect, useRef } from "react";
import { drawAROverlay } from "../components/ar/AROverlay";

const LERP_SPEED = 0.7; // 0 = never moves, 1 = instant snap

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Draws bounding boxes and AR overlay onto the canvas, synced to video frames.
 * Box positions are lerped each frame for smooth movement between detections.
 */
export function useOverlayLoop({ canvasRef, videoRef, isRunning, lastDetectionsRef }) {
  // Tracks the currently-displayed (smoothed) box per classId
  const displayedBoxesRef = useRef({});

  useEffect(() => {
    if (!isRunning || !canvasRef.current || !videoRef.current) return;

    // Reset smoothed boxes when camera restarts
    displayedBoxesRef.current = {};

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frameId;

    const draw = () => {
      const detections = lastDetectionsRef.current;
      const iw = canvas.width || 640;
      const ih = canvas.height || 480;

      ctx.clearRect(0, 0, iw, ih);

      if (detections.length > 0) {
        const scale = Math.min(iw / 640, ih / 480);
        ctx.lineWidth = Math.max(2, 3 * scale);
        ctx.font = `${Math.max(14, 18 * scale)}px monospace`;

        // Track which classIds are still active this frame
        const activeIds = new Set();

        for (const d of detections) {
          const { x1, y1, x2, y2 } = d.box;
          const id = d.classId ?? "unknown";
          activeIds.add(id);

          const prev = displayedBoxesRef.current[id];

          if (!prev) {
            // First time seeing this detection — snap immediately
            displayedBoxesRef.current[id] = { x1, y1, x2, y2, confidence: d.confidence, label: d.label, classId: d.classId };
          } else {
            // Lerp toward the new target position
            prev.x1 = lerp(prev.x1, x1, LERP_SPEED);
            prev.y1 = lerp(prev.y1, y1, LERP_SPEED);
            prev.x2 = lerp(prev.x2, x2, LERP_SPEED);
            prev.y2 = lerp(prev.y2, y2, LERP_SPEED);
            prev.confidence = d.confidence;
            prev.label = d.label;
          }
        }

        // Remove smoothed boxes for detections that disappeared
        for (const id of Object.keys(displayedBoxesRef.current)) {
          if (!activeIds.has(Number(id)) && !activeIds.has(id)) {
            delete displayedBoxesRef.current[id];
          }
        }

        // Draw the smoothed boxes
        const smoothed = Object.values(displayedBoxesRef.current);

        for (const b of smoothed) {
          const { x1, y1, x2, y2, label, confidence } = b;

          ctx.strokeStyle = "red";
          ctx.fillStyle = "red";
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          const text = `${label} ${(confidence * 100).toFixed(1)}%`;
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(x1, y1 - 20, textWidth + 8, 20);
          ctx.fillStyle = "white";
          ctx.fillText(text, x1 + 4, y1 - 4);
        }

        drawAROverlay(
          ctx,
          smoothed.map((b) => [b.x1, b.y1, b.x2, b.y2, b.confidence, b.classId])
        );
      }

      if (typeof video.requestVideoFrameCallback === "function") {
        frameId = video.requestVideoFrameCallback(draw);
      } else {
        frameId = requestAnimationFrame(draw);
      }
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      frameId = video.requestVideoFrameCallback(draw);
    } else {
      frameId = requestAnimationFrame(draw);
    }

    return () => {
      if (typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isRunning, canvasRef, videoRef, lastDetectionsRef]);
}