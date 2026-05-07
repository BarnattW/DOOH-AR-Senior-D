import { useRef, useState, useEffect, useCallback } from "react";
import { useArStore } from "./store/arStore";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetectorMode } from "./hooks/useDetectorMode";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { useMotionGate } from "./hooks/useMotionGate";
import { usePixiOverlay } from "./hooks/usePixiOverlay";
import { usePinchZoom } from "./hooks/usePinchZoom";
import { DetectionOverlay } from "./components/ar/DetectionOverlay";
import { usePhotoLibrary } from "./hooks/usePhotoLibrary";
import { isNearLandmark } from "./util/geolocation";
import { FILTERS, DEFAULT_FILTER_ID } from "./filters";
import CameraControls from "./components/CameraControls";
import FilterPicker from "./components/FilterPicker";
import PhotoLibrary from "./components/PhotoLibrary";
import PostcardEditor from "./components/PostcardEditor";
import StartPanel from "./components/StartPanel";
import LockOnOverlay from "./components/LockOnOverlay";
import HelpButton from "./components/HelpButton";
import TutorialFlow from "./components/onboarding/TutorialFlow";
import ModelToggle from "./components/ModelToggle";
import DebugOverlay from "./components/DebugOverlay";
import LocationStatus from "./components/LocationStatus";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000;

export default function App() {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const pixiCanvasRef     = useRef(null);
  const lastDetectionsRef = useRef([]);

  // ── AR state (idle → glitching → tracking → idle) ────────────────────────
  const arState      = useArStore((s) => s.arState);
  const detections   = useArStore((s) => s.detections);
  const onDetections = useArStore((s) => s.onDetections);

  // ── Camera ────────────────────────────────────────────────────────────────
  const { videoRef, isRunning, startWebcam, stopWebcam, zoom, setZoom, zoomCaps } = useCamera();
  useEffect(() => { startWebcam(); }, []);

  // ── Detection: original / strong WS endpoints, or local ONNX ──────────────
  const [detectionMode, setDetectionMode] = useState("original"); // "original" | "strong" | "local"

  // Stats for optional debug overlay (?debug=1). Refs so 60 FPS render isn't disturbed.
  const statsRef = useRef({ fps: 0, latencyMs: null });
  const fpsFramesRef = useRef(0);
  const fpsLastRef = useRef(performance.now());

  const handleLatency = useCallback((ms) => {
    statsRef.current.latencyMs = ms;
  }, []);

  const { session, detect } = useDetectorMode(detectionMode, { onLatency: handleLatency });

  useEffect(() => {
    console.log(`[App] model selected: ${detectionMode}`);
  }, [detectionMode]);

  // Video-frame FPS sampler for the debug overlay. Uses requestVideoFrameCallback
  // so it tracks actually-displayed video frames, independent of React renders
  // and detection cadence.
  useEffect(() => {
    if (!isRunning) return;
    const video = videoRef.current;
    if (!video || !("requestVideoFrameCallback" in video)) return;
    let handle;
    const tick = (now) => {
      fpsFramesRef.current += 1;
      const elapsed = now - fpsLastRef.current;
      if (elapsed >= 500) {
        statsRef.current.fps = (fpsFramesRef.current * 1000) / elapsed;
        fpsFramesRef.current = 0;
        fpsLastRef.current = now;
      }
      handle = video.requestVideoFrameCallback(tick);
    };
    handle = video.requestVideoFrameCallback(tick);
    return () => { if (handle) video.cancelVideoFrameCallback(handle); };
  }, [isRunning, videoRef]);
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
    const f = arState === "glitching"
      ? FILTERS.find(f => f.id === "glitch")
      : FILTERS.find(f => f.id === activeFilterId);
    if (f) activeFilterRef.current = f;
  }, [arState, activeFilterId]);

  // ── Pinch-to-zoom ─────────────────────────────────────────────────────────
  usePinchZoom({
    targetRef: pixiCanvasRef,
    zoom,
    setZoom,
    zoomCaps,
    enabled: isRunning,
  });

  // ── PixiJS overlay ────────────────────────────────────────────────────────
  usePixiOverlay({
    canvasRef: pixiCanvasRef,
    videoRef,
    isRunning,
    lastDetectionsRef,
    activeFilterRef,
  });

  // ── Tutorial ──────────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem("dooh_onboarded") !== "true"
  );

  const finishTutorial = useCallback(() => {
    localStorage.setItem("dooh_onboarded", "true");
    setShowTutorial(false);
  }, []);

  // ── Motion gate — skip detections while phone is moving ──────────────────
  const isMovingRef = useMotionGate();

  const {
    photos,
    latestPhoto,
    isLibraryOpen,
    capturePhoto,
    addPhoto,
    openLibrary,
    closeLibrary,
  } = usePhotoLibrary({
    canvasContainerRef: pixiCanvasRef,
    zoom,
    zoomCaps,
  });

  const [postcardPhoto, setPostcardPhoto] = useState(null);

  const handleCapture = useCallback(() => {
    capturePhoto({
      detectedBuilding: lastDetectionsRef.current[0]?.label ?? null,
      filterLabel: FILTERS.find((f) => f.id === activeFilterId)?.label ?? null,
      locationLabel: near ? "New York City, NY" : null,
    });
  }, [capturePhoto, activeFilterId, near]);

  // ── Detection loop ────────────────────────────────────────────────────────
  const handleDetections = useCallback((formatted) => {
    lastDetectionsRef.current = formatted; // direct write — no render cycle, Pixi reads immediately
    onDetections(formatted);               // store for arState machine + React UI
  }, [onDetections]);

  // Pause camera and halt detection while gallery or postcard editor is open
  const isOverlayOpen = isLibraryOpen || !!postcardPhoto;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isRunning) return;
    if (isOverlayOpen) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isOverlayOpen, isRunning, videoRef]);

  useDetectionLoop({
    isRunning: isRunning && !isOverlayOpen && !showTutorial,
    session,
    videoRef,
    canvasRef: pixiCanvasRef,
    detect,
    onDetections: handleDetections,
    isMovingRef,
  });

  const canStart = !isRunning;

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
              touchAction: "none",
            }}
          />

          <DetectionOverlay detections={detections} containerRef={pixiCanvasRef} />

          {isRunning && <LockOnOverlay arState={arState} />}

          {isRunning && <HelpButton />}

          {/* Optional debug overlay (?debug=1) */}
          <DebugOverlay statsRef={statsRef} model={detectionMode} sessionUrl={session?.url} />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-35% to-black/75" />

          {/* <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/55">
                  Building Detector
                </div>
                <div className="mt-1 text-sm text-white/90">
                  {isRunning ? "Live camera" : "Ready to start"}
                </div>
              </div>
              {isRunning && (
                <div className="pointer-events-auto flex max-w-[min(100%,17rem)] flex-col gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
                    {detectionMode === "local" ? "Local detection" : `Model: ${detectionMode}`}
                  </div>
                  <ModelToggle mode={detectionMode} onMode={setDetectionMode} compact />
                  <div className="text-xs text-white/80">
                    <LocationStatus coords={coords} near={near} geoLoading={geoLoading} geoError={geoError} />
                  </div>
                </div>
              )}
            </div>
          </div> */}

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3">
            {!isRunning && (
              <StartPanel
                canStart={canStart}
                detectionMode={detectionMode}
                onDetectionMode={setDetectionMode}
                mockLocation={mockLocation}
                onMockLocation={setMockLocation}
                coords={coords}
                near={near}
                geoLoading={geoLoading}
                geoError={geoError}
                modelReady={!!session}
                onStart={startWebcam}
              />
            )}

            {isRunning && (
              <>
                <FilterPicker activeId={activeFilterId} onSelect={setActiveFilterId} />
                <CameraControls
                  onStart={startWebcam}
                  onCapture={handleCapture}
                  lastPhoto={latestPhoto}
                  onOpenLibrary={openLibrary}
                  canStart={canStart}
                  isRunning={isRunning}
                  zoom={zoom}
                  onZoom={setZoom}
                  zoomCaps={zoomCaps}
                  className="pointer-events-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8 sm:pb-8"
                />
              </>
            )}
          </div>

          {isLibraryOpen && (
            <PhotoLibrary
              photos={photos}
              onClose={closeLibrary}
              onPostcard={(photo) => {
                closeLibrary();
                setPostcardPhoto(photo);
              }}
            />
          )}

          {postcardPhoto && (
            <PostcardEditor
              photo={postcardPhoto}
              onClose={() => setPostcardPhoto(null)}
              onSaveToLibrary={(blob) => {
                addPhoto(blob, {
                  detectedBuilding: postcardPhoto.detectedBuilding,
                  filterLabel: "Postcard",
                  locationLabel: postcardPhoto.locationLabel,
                });
              }}
            />
          )}

          {showTutorial && <TutorialFlow onDone={finishTutorial} />}
        </div>
      </div>
    </div>
  );
}
