import { useRef, useEffect, useState } from "react";
import { useCamera, Camera } from "./components/camera/Camera";
import { useDetector, BUILDING_CLASSES } from "./components/ai/Detector";
import { drawAROverlay } from "./components/ar/AROverlay";
import {
  HtmlAROverlay,
  DEFAULT_IMAGE,
  DEFAULT_ANIMATED_IMAGE,
} from "./components/ar/HtmlAROverlay";
import { useGeolocation } from "./hooks/useGeolocation";
import { isNearLandmark } from "./geolocation";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000; // tune later

export default function App() {
  const canvasRef = useRef(null);
  const isDetectingRef = useRef(false);
  const lastDetectionsRef = useRef([]);

  const [lastDetections, setLastDetections] = useState([]);
  const [mockLocation, setMockLocation] = useState(false);
  const [overlayMode, setOverlayMode] = useState("color");
  const [overlayImageUrl, setOverlayImageUrl] = useState(DEFAULT_IMAGE);
  const [overlayAnimatedUrl, setOverlayAnimatedUrl] = useState(
    DEFAULT_ANIMATED_IMAGE
  );
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  const { videoRef, streamRef, isRunning, startWebcam, stopWebcam } =
    useCamera();
  const { session, detect } = useDetector();

  /* ==============================
     GEOLOCATION GATING
  ============================== */

  const { coords, loading: geoLoading, error: geoError } = useGeolocation(mockLocation);

  const near = (() => {
    if (!coords) return null;
    return isNearLandmark(
      {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
      },
      EMPIRE_STATE,
      RADIUS_M
    );
  })();

  /* ==============================
     SYNC CANVAS SIZE TO VIDEO
  ============================== */

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const onMeta = () => {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      setFrameSize({ width, height });
    };

    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [isRunning, videoRef]);

  /* ==============================
     OVERLAY DRAW LOOP (frame-based, synced to video)
  ============================== */

  useEffect(() => {
    if (!isRunning || !canvasRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frameId;

    const drawOverlay = () => {
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
          detections.map((d) => [
            d.box.x1,
            d.box.y1,
            d.box.x2,
            d.box.y2,
            d.confidence,
            d.classId,
          ])
        );
      }

      // Frame-based: sync to video frames when available, else RAF
      if (typeof video.requestVideoFrameCallback === "function") {
        frameId = video.requestVideoFrameCallback(drawOverlay);
      } else {
        frameId = requestAnimationFrame(drawOverlay);
      }
    };

    // Start loop
    if (typeof video.requestVideoFrameCallback === "function") {
      frameId = video.requestVideoFrameCallback(drawOverlay);
    } else {
      frameId = requestAnimationFrame(drawOverlay);
    }

    return () => {
      if (typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isRunning]);

  /* ==============================
     DETECTION LOOP
     (interval, NOT RAF)
  ============================== */

  useEffect(() => {
    if (!isRunning || !session) return;

    const DETECT_EVERY_MS = 150; // ~6-7 fps inference

    const id = setInterval(async () => {
      if (isDetectingRef.current) return;
      if (!videoRef.current) return;

      isDetectingRef.current = true;

      try {
        const detections = await detect(videoRef.current, canvasRef, null);

        const formatted = detections
          .filter(([x1, y1, x2, y2, conf]) => conf >= 0.6)
          .slice(0, 1)
          .map(([x1, y1, x2, y2, conf, classId]) => ({
            box: { x1, y1, x2, y2 },
            confidence: conf,
            classId,
            label:
              classId !== undefined
                ? BUILDING_CLASSES[classId] || `Building ${classId}`
                : "Unknown",
          }));

        lastDetectionsRef.current = formatted;
        setLastDetections(formatted);
      } catch (e) {
        console.error(e);
      } finally {
        isDetectingRef.current = false;
      }
    }, DETECT_EVERY_MS);

    return () => clearInterval(id);
  }, [isRunning, session, detect]);

  /* ==============================
     UI
  ============================== */

  const canStart =
    !!session && !isRunning && !geoLoading && !geoError && !!near?.ok;

  const handleStart = async () => {
    if (!coords || !near?.ok) return;
    await startWebcam();
  };

  return (
    <div className="bg-gray-900 text-gray-100 font-sans text-center pt-4 sm:pt-8 min-h-screen pb-4">
      {/* Mock location toggle */}
      <div className="px-4 flex items-center justify-center gap-2 mb-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
          <input
            type="checkbox"
            checked={mockLocation}
            onChange={(e) => setMockLocation(e.target.checked)}
            className="rounded"
          />
          Use mock location (for local testing)
        </label>
      </div>

      {/* Status */}
      <div className="px-4 text-sm text-gray-200 mb-2">
        {geoLoading && <div>Getting location…</div>}
        {geoError && <div className="text-red-300">Location error: {geoError}</div>}
        {coords && near && (
          <div>
            Distance: {Math.round(near.distance)}m · Accuracy: ±
            {Math.round(coords.accuracy)}m ·{" "}
            {near.ok ? "✅ Near landmark" : `❌ ${near.reason}`}
          </div>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl mb-4">🏙️ Building Detector</h1>

      {/* VIDEO + OVERLAY */}
      <div className="flex justify-center">
        <div
          className="relative w-full sm:max-w-2xl overflow-hidden"
          style={{ transform: "translateZ(0)", willChange: "transform" }}
        >
          <Camera videoRef={videoRef} />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: "translateZ(0)" }}
          />
          <HtmlAROverlay
            detections={lastDetections}
            frameWidth={frameSize.width}
            frameHeight={frameSize.height}
            mode={overlayMode}
            imageUrl={overlayImageUrl}
            animatedUrl={overlayAnimatedUrl}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-3 justify-center">
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="px-4 py-2 bg-blue-500 rounded disabled:bg-gray-600"
        >
          Start Webcam
        </button>

        <button
          onClick={stopWebcam}
          disabled={!isRunning}
          className="px-4 py-2 bg-blue-500 rounded disabled:bg-gray-600"
        >
          Stop Webcam
        </button>
      </div>

      <div className="mt-3 px-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button
          onClick={() => setOverlayMode("color")}
          className={`px-3 py-1 rounded border ${
            overlayMode === "color"
              ? "bg-cyan-500 border-cyan-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          Color Overlay
        </button>
        <button
          onClick={() => setOverlayMode("image")}
          className={`px-3 py-1 rounded border ${
            overlayMode === "image"
              ? "bg-cyan-500 border-cyan-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          Image Overlay
        </button>
        <button
          onClick={() => setOverlayMode("animated-image")}
          className={`px-3 py-1 rounded border ${
            overlayMode === "animated-image"
              ? "bg-cyan-500 border-cyan-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          Animated Image
        </button>
        <button
          onClick={() => setOverlayMode("pulse")}
          className={`px-3 py-1 rounded border ${
            overlayMode === "pulse"
              ? "bg-cyan-500 border-cyan-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          Pulse FX
        </button>
        <button
          onClick={() => setOverlayMode("cube-3d")}
          className={`px-3 py-1 rounded border ${
            overlayMode === "cube-3d"
              ? "bg-cyan-500 border-cyan-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          3D Cube
        </button>
        {overlayMode === "image" && (
          <input
            type="url"
            value={overlayImageUrl}
            onChange={(e) => setOverlayImageUrl(e.target.value)}
            placeholder="https://your-image-url"
            className="px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-100 w-full sm:w-96"
          />
        )}
        {overlayMode === "animated-image" && (
          <input
            type="url"
            value={overlayAnimatedUrl}
            onChange={(e) => setOverlayAnimatedUrl(e.target.value)}
            placeholder="https://your-gif-or-webp-url"
            className="px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-100 w-full sm:w-96"
          />
        )}
      </div>
    </div>
  );
}
