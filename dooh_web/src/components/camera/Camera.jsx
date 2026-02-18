import { useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);

  const startWebcam = async () => {
    if (isRunning || streamRef.current) return;
    try {
      // Request rear camera (back camera) on mobile devices
      // Use ideal width/height to get better aspect ratio on mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // 'environment' = rear camera, 'user' = front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 24 }, // smoother camera feed
        },
      });
      streamRef.current = stream;

      // Apply 3x zoom if supported (mobile devices)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        if (capabilities.zoom) {
          const maxZoom = capabilities.zoom.max || 1;
          const zoomLevel = Math.min(3.0, maxZoom); // 3x zoom, but don't exceed max
          try {
            await videoTrack.applyConstraints({
              advanced: [{ zoom: zoomLevel }],
            });
            console.log(`Applied ${zoomLevel}x zoom`);
          } catch (zoomErr) {
            console.warn("Could not apply zoom:", zoomErr);
          }
        }
      }
      
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.playsInline = true;

        videoEl.onloadedmetadata = async () => {
          try {
            await videoEl.play();
          } finally {
            setIsRunning(true);
          }
        };
      }
    } catch (err) {
      console.error("Error accessing webcam: ", err);
      alert("Failed to access webcam. Please check permissions and try again.");
    }
  };

  const stopWebcam = () => {
    setIsRunning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  return {
    videoRef,
    streamRef,
    isRunning,
    startWebcam,
    stopWebcam,
  };
}

export function Camera({ videoRef }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full sm:max-w-2xl h-auto rounded-lg"
      style={{
        maxHeight: "70vh",
        objectFit: "contain",
        transform: "translateZ(0)", // GPU layer for smoother playback
        willChange: "transform",
      }}
    />
  );
}
