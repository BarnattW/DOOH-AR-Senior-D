import { useRef, useState, useEffect } from "react";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetector } from "./components/ai/Detector";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { usePixiOverlay } from "./hooks/usePixiOverlay";
import { isNearLandmark } from "./util/geolocation";
import { FILTERS, DEFAULT_FILTER_ID } from "./filters";
import LocationStatus from "./components/LocationStatus";
import CameraControls from "./components/CameraControls";
import FilterPicker from "./components/FilterPicker";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000;

export default function App() {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const pixiCanvasRef     = useRef(null);
  const lastDetectionsRef = useRef([]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const { videoRef, isRunning, startWebcam, stopWebcam } = useCamera();

  // ── Detection ─────────────────────────────────────────────────────────────
  const { session, detect } = useDetector();
  const [mockLocation, setMockLocation] = useState(false);
  const { coords, loading: geoLoading, error: geoError } = useGeolocation(mockLocation);

  const near = coords
    ? isNearLandmark(
        { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        EMPIRE_STATE,
        RADIUS_M
      )
    : null;

  // ── Active filter — state drives UI, ref drives render loop (zero re-renders) ──
  const [activeFilterId, setActiveFilterId] = useState(DEFAULT_FILTER_ID);
  const activeFilterRef = useRef(FILTERS.find(f => f.id === DEFAULT_FILTER_ID));

  useEffect(() => {
    const f = FILTERS.find(f => f.id === activeFilterId);
    if (f) activeFilterRef.current = f;
  }, [activeFilterId]);

  // ── PixiJS overlay ────────────────────────────────────────────────────────
  usePixiOverlay({
    canvasRef: pixiCanvasRef,
    videoRef,
    isRunning,
    lastDetectionsRef,
    activeFilterRef,
  });

  // ── Detection loop ────────────────────────────────────────────────────────
  useDetectionLoop({
    isRunning,
    session,
    videoRef,
    canvasRef: pixiCanvasRef,
    detect,
    onDetections: (formatted) => {
      lastDetectionsRef.current = formatted;
    },
  });

  const canStart = !!session && !isRunning && !geoLoading && !geoError && !!near?.ok;

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

      <LocationStatus coords={coords} near={near} geoLoading={geoLoading} geoError={geoError} />

      <h1 className="text-2xl sm:text-3xl mb-4">🏙️ Building Detector</h1>

      {/* Camera container */}
      <div className="flex justify-center">
        <div
          className="relative w-full sm:max-w-2xl overflow-hidden rounded-lg bg-black"
          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        >
          {/* Hidden video — kept in DOM as PixiJS VideoResource texture source */}
          <Camera videoRef={videoRef} hidden />

          {/* PixiJS renders video + pixel effects + decorations here */}
          <canvas
            ref={pixiCanvasRef}
            className="w-full h-auto block"
            style={{ maxHeight: '70vh' }}
          />

          {/* Filter picker pinned to bottom of camera view */}
          {isRunning && (
            <FilterPicker activeId={activeFilterId} onSelect={setActiveFilterId} />
          )}
        </div>
      </div>

      <CameraControls
        onStart={handleStart}
        onStop={stopWebcam}
        canStart={canStart}
        isRunning={isRunning}
      />
    </div>
  );
}
