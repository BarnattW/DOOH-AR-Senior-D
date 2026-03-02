import { useEffect } from "react";
import { drawAROverlay } from "../components/ar/AROverlay";

/**
 * Draws bounding boxes and AR overlay onto the canvas, synced to video frames.
 */
export function useOverlayLoop({ canvasRef, videoRef, isRunning, lastDetectionsRef }) {
  useEffect(() => {
    if (!isRunning || !canvasRef.current || !videoRef.current) return;

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

        for (const d of detections) {
          const { x1, y1, x2, y2 } = d.box;

          ctx.strokeStyle = "red";
          ctx.fillStyle = "red";
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

          const label = `${d.label} ${(d.confidence * 100).toFixed(1)}%`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillRect(x1, y1 - 20, textWidth + 8, 20);
          ctx.fillStyle = "white";
          ctx.fillText(label, x1 + 4, y1 - 4);
        }

        drawAROverlay(
          ctx,
          detections.map((d) => [d.box.x1, d.box.y1, d.box.x2, d.box.y2, d.confidence, d.classId])
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