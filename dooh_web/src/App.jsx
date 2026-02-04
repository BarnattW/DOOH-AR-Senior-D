import { useRef, useEffect, useState } from "react";
import { useCamera, Camera } from "./components/camera/Camera";
import { useDetector, BUILDING_CLASSES } from "./components/ai/Detector";
import { drawAROverlay } from "./components/ar/AROverlay";
import { useGeolocation } from "./hooks/useGeolocation";
import { isNearLandmark } from "./geolocation";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000; // tune later

export default function App() {
  const canvasRef = useRef(null);
  const isDetectingRef = useRef(false);

  const [lastDetections, setLastDetections] = useState([]);

  const { videoRef, streamRef, isRunning, startWebcam, stopWebcam } =
    useCamera();
  const { session, detect } = useDetector();

  /* ==============================
     GEOLOCATION GATING
  ============================== */

  const { coords, loading: geoLoading, error: geoError } = useGeolocation();

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
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };

    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [isRunning, videoRef]);

  /* ==============================
     OVERLAY DRAW LOOP
     (boxes only, NOT video)
  ============================== */

  useEffect(() => {
    if (!isRunning || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let rafId;

    const drawOverlay = () => {
      const iw = canvas.width || 640;
      const ih = canvas.height || 480;

      ctx.clearRect(0, 0, iw, ih);

      if (lastDetections.length > 0) {
        const scale = Math.min(iw / 640, ih / 480);
        ctx.lineWidth = Math.max(2, 3 * scale);
        ctx.font = `${Math.max(14, 18 * scale)}px monospace`;

        for (const d of lastDetections) {
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
          lastDetections.map((d) => [
            d.box.x1,
            d.box.y1,
            d.box.x2,
            d.box.y2,
            d.confidence,
            d.classId,
          ])
        );
      }

      rafId = requestAnimationFrame(drawOverlay);
    };

    rafId = requestAnimationFrame(drawOverlay);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, lastDetections]);

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
        <div className="relative w-full sm:max-w-2xl">
          <Camera videoRef={videoRef} />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
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
    </div>
  );
}
