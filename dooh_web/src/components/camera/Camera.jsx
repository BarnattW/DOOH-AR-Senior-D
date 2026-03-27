import { useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [zoom, setZoomState] = useState(1);
  // { min, max } if hardware zoom is supported, null otherwise
  const [zoomCaps, setZoomCaps] = useState(null);

  const startWebcam = async () => {
    if (isRunning || streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 24 },
        },
      });
      streamRef.current = stream;

      // Detect hardware zoom capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        if (caps.zoom) {
          setZoomCaps({ min: caps.zoom.min ?? 1, max: caps.zoom.max ?? 1 });
        } else {
          setZoomCaps(null);
        }
      }

      setZoomState(1);

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
    setZoomState(1);
    setZoomCaps(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const setZoom = async (level) => {
    const clamped = Math.max(1, level);
    setZoomState(clamped);

    // Apply hardware zoom if supported
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && zoomCaps) {
        const hwLevel = Math.min(Math.max(clamped, zoomCaps.min), zoomCaps.max);
        try {
          await videoTrack.applyConstraints({ advanced: [{ zoom: hwLevel }] });
        } catch (e) {
          console.warn("Could not apply hardware zoom:", e);
        }
      }
    }
  };

  return {
    videoRef,
    streamRef,
    isRunning,
    startWebcam,
    stopWebcam,
    zoom,
    setZoom,
    zoomCaps,
  };
}

// hidden=true keeps the element in the DOM (needed as a texture source for PixiJS)
// but removes it from the visual layout.
export function Camera({ videoRef, hidden }) {
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={hidden ? { display: 'none' } : undefined}
    />
  );
}
