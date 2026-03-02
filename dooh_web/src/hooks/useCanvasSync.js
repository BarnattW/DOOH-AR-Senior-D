import { useEffect } from "react";

/**
 * Keeps canvas dimensions in sync with the video element's natural size.
 */
export function useCanvasSync({ videoRef, canvasRef, isRunning }) {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const onMeta = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };

    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [isRunning, videoRef, canvasRef]);
}