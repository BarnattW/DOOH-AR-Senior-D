import { useRef, useState, useEffect } from "react";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetectorMode } from "./hooks/useDetectorMode";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { usePixiOverlay } from "./hooks/usePixiOverlay";
import { DetectionOverlay } from "./components/ar/DetectionOverlay";
import { isNearLandmark } from "./util/geolocation";
import { FILTERS, DEFAULT_FILTER_ID } from "./filters";
import LocationStatus from "./components/LocationStatus";
import CameraControls from "./components/CameraControls";
import FilterPicker from "./components/FilterPicker";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000;
const AR_CONFIRM_HOLD_MS = 2200;

export default function App() {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const pixiCanvasRef     = useRef(null);
  const lastDetectionsRef = useRef([]);
  const latestRawDetectionsRef = useRef([]);
  const holdTimerRef = useRef(null);
  const [rawDetections, setRawDetections] = useState([]);
  const [detections, setDetections] = useState([]); // Confirmed detections for AR
  const [pendingLabel, setPendingLabel] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [hasCompletedIntroPrompt, setHasCompletedIntroPrompt] = useState(false);

  // ── Camera ────────────────────────────────────────────────────────────────
  const { videoRef, isRunning, startWebcam, stopWebcam, zoom, setZoom, zoomCaps } = useCamera();

  // ── Detection: API (Vercel proxy) vs local ONNX ───────────────────────────
  const [detectionMode, setDetectionMode] = useState("api"); // "api" | "local"
  const { session, detect } = useDetectorMode(detectionMode);
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

  useEffect(() => {
    lastDetectionsRef.current = detections;
  }, [detections]);

  useEffect(() => {
    latestRawDetectionsRef.current = rawDetections;
  }, [rawDetections]);

  useEffect(() => {
    const nextDetection = rawDetections[0];
    const nextLabel = nextDetection?.label ?? null;

    if (hasCompletedIntroPrompt) {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (pendingLabel !== null) setPendingLabel(null);
      if (holdProgress !== 0 && holdProgress !== 1) setHoldProgress(1);
      if (detections !== rawDetections) setDetections(rawDetections);
      return;
    }

    if (!nextLabel) {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (pendingLabel !== null) setPendingLabel(null);
      if (holdProgress !== 0) setHoldProgress(0);
      if (detections.length > 0) setDetections([]);
      return;
    }

    if (detections[0]?.label === nextLabel) {
      if (detections !== rawDetections) setDetections(rawDetections);
      if (pendingLabel !== null) setPendingLabel(null);
      if (holdProgress !== 1) setHoldProgress(1);
      return;
    }

    if (pendingLabel !== nextLabel) {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }

      const startedAt = Date.now();
      setPendingLabel(nextLabel);
      setHoldProgress(0);
      setDetections([]);

      holdTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / AR_CONFIRM_HOLD_MS);
        setHoldProgress(progress);

        if (elapsed >= AR_CONFIRM_HOLD_MS) {
          clearInterval(holdTimerRef.current);
          holdTimerRef.current = null;
          setHasCompletedIntroPrompt(true);
          setPendingLabel(null);
          setDetections((current) => {
            const latestDetections = latestRawDetectionsRef.current;
            const latestLabel = latestDetections[0]?.label;
            return latestLabel === nextLabel ? latestDetections : current;
          });
        }
      }, 100);
    }
  }, [rawDetections, pendingLabel, detections, holdProgress, hasCompletedIntroPrompt]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

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
      setRawDetections(formatted);
    },
  });

  const canStart = !isRunning;
  const detectionReady = !!session && !geoLoading && !geoError && !!near?.ok;
  const showHoldPrompt = !hasCompletedIntroPrompt && !!pendingLabel && detections.length === 0;

  const handleStart = async () => {
    await startWebcam();
  };

  return (
    <div className="h-screen overflow-hidden bg-black text-white supports-[height:100dvh]:h-[100dvh]">
      <div className="mx-auto flex h-full w-full items-center justify-center overflow-hidden sm:px-4 sm:py-6">
        <div
          className="relative isolate w-full overflow-hidden bg-black sm:max-w-2xl sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-2xl sm:shadow-black/50"
          style={{ transform: "translateZ(0)", willChange: "transform" }}
        >
          {/* Hidden video — kept in DOM as PixiJS VideoResource texture source */}
          <Camera videoRef={videoRef} hidden />

          {/* PixiJS appends its own canvas here — see usePixiOverlay */}
          <div
            ref={pixiCanvasRef}
            className="relative h-[100dvh] w-full overflow-hidden bg-black sm:h-[78vh] sm:min-h-[680px]"
            style={{
              transform: !zoomCaps && zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "center center",
            }}
          />

          {/* Detection overlay with clickable "Learn more" buttons */}
          <DetectionOverlay detections={detections} containerRef={pixiCanvasRef} />

          {showHoldPrompt && (
            <div className="pointer-events-none absolute inset-x-4 top-1/2 z-20 -translate-y-1/2 sm:inset-x-8">
              <div className="mx-auto max-w-sm rounded-3xl border border-white/15 bg-black/65 px-5 py-5 text-center shadow-2xl backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/55">
                  Hold Camera Steady
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  Keep the building centered for a moment
                </div>
                <div className="mt-2 text-sm leading-6 text-white/75">
                  Point your phone at {pendingLabel} and hold still while we lock the AR effect.
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-100"
                    style={{ width: `${Math.round(holdProgress * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.28em] text-white/45">
                  Stabilizing AR
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-35% to-black/75" />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/55">
                  Building Detector
                </div>
                <div className="mt-1 text-sm text-white/90">
                  {isRunning ? "Live camera" : "Ready to start"}
                </div>
              </div>
              <div className="pointer-events-auto max-w-[min(100%,19rem)] rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/85">
                  <div className="flex items-center gap-2 text-white/75">
                    <span className="text-white/45">Detection</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="detectionMode"
                        checked={detectionMode === "api"}
                        onChange={() => setDetectionMode("api")}
                        disabled={isRunning}
                        className="rounded-full"
                      />
                      API
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="detectionMode"
                        checked={detectionMode === "local"}
                        onChange={() => setDetectionMode("local")}
                        disabled={isRunning}
                        className="rounded-full"
                      />
                      Local
                    </label>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-white/75">
                    <input
                      type="checkbox"
                      checked={mockLocation}
                      onChange={(e) => setMockLocation(e.target.checked)}
                      className="rounded"
                    />
                    Mock location
                  </label>
                </div>
                <div className="mt-2 text-xs text-white/80">
                  <LocationStatus coords={coords} near={near} geoLoading={geoLoading} geoError={geoError} />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3">
            {isRunning && (
              <FilterPicker activeId={activeFilterId} onSelect={setActiveFilterId} />
            )}

            <CameraControls
              onStart={handleStart}
              onStop={stopWebcam}
              canStart={canStart}
              isRunning={isRunning}
              zoom={zoom}
              onZoom={setZoom}
              zoomCaps={zoomCaps}
              className="pointer-events-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8 sm:pb-8"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
