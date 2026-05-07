import { useRef, useState, useEffect, useCallback } from "react";
import { useArStore } from "./store/arStore";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetectorMode } from "./hooks/useDetectorMode";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { usePixiOverlay } from "./hooks/usePixiOverlay";
import { DetectionOverlay } from "./components/ar/DetectionOverlay";
import { usePhotoLibrary } from "./hooks/usePhotoLibrary";
import { isNearLandmark } from "./util/geolocation";
import { FILTERS, DEFAULT_FILTER_ID } from "./filters";
import LocationStatus from "./components/LocationStatus";
import CameraControls from "./components/CameraControls";
import FilterPicker from "./components/FilterPicker";
import PhotoLibrary from "./components/PhotoLibrary";
import PostcardEditor from "./components/PostcardEditor";
import StartPanel from "./components/StartPanel";
import LockOnOverlay from "./components/LockOnOverlay";
import TutorialCard from "./components/onboarding/TutorialCard";
import ModelToggle from "./components/ModelToggle";
import DebugOverlay from "./components/DebugOverlay";

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


  // ── PixiJS overlay ────────────────────────────────────────────────────────
  usePixiOverlay({
    canvasRef: pixiCanvasRef,
    videoRef,
    isRunning,
    lastDetectionsRef,
    activeFilterRef,
  });

  // ── Tutorial ──────────────────────────────────────────────────────────────
  // 0=point, 1=glitching, 2=explore filters, 3=done
  const [tutorialStep, setTutorialStep] = useState(() => {
    const stored = localStorage.getItem("dooh_onboarded");
    console.log("[tutorial] init — localStorage dooh_onboarded:", stored);
    return stored === "true" ? 3 : 0;
  });

  const skipTutorial = useCallback(() => {
    console.trace("[tutorial] skipTutorial called");
    localStorage.setItem("dooh_onboarded", "true");
    setTutorialStep(3);
  }, []);

  // debug
  useEffect(() => {
    console.log("[tutorial] tutorialStep changed →", tutorialStep);
  }, [tutorialStep]);

  useEffect(() => {
    console.log("[tutorial] detections changed, length:", detections.length, "| tutorialStep:", tutorialStep);
  }, [detections, tutorialStep]);

  // Step 0 → 1: first positive detection
  useEffect(() => {
    console.log("[tutorial] 0→1 effect: tutorialStep:", tutorialStep, "| detections.length:", detections.length);
    if (tutorialStep !== 0 || detections.length === 0) return;
    console.log("[tutorial] firing setTutorialStep(1)");
    setTutorialStep(1);
  }, [detections, tutorialStep]);


  // Step 2 → 3: user picks any filter
  const prevFilterIdRef = useRef(activeFilterId);
  useEffect(() => {
    if (tutorialStep !== 2) return;
    if (activeFilterId !== prevFilterIdRef.current) skipTutorial();
    prevFilterIdRef.current = activeFilterId;
  }, [activeFilterId, tutorialStep, skipTutorial]);

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
    isRunning: isRunning && !isOverlayOpen,
    session,
    videoRef,
    canvasRef: pixiCanvasRef,
    detect,
    onDetections: handleDetections,
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
            }}
          />

          {/* Detection overlay with clickable "Learn more" buttons */}
          <DetectionOverlay detections={detections} containerRef={pixiCanvasRef} />

          {/* Lock-on typewriter overlay during glitching/lost states */}
          {isRunning && <LockOnOverlay arState={arState} />}

          {/* Optional debug overlay (?debug=1) */}
          <DebugOverlay statsRef={statsRef} model={detectionMode} sessionUrl={session?.url} />

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
          </div>

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
                <FilterPicker activeId={activeFilterId} onSelect={setActiveFilterId} pulsing={tutorialStep === 2} />
                <CameraControls
                  onStart={startWebcam}
                  onStop={stopWebcam}
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

          {/* Step 0 — corner brackets + point card */}
          {tutorialStep === 0 && isRunning && (
            <>
              <div className="pointer-events-none absolute inset-0 z-20">
                <div className="absolute top-20 left-5 w-9 h-9 border-l-2 border-t-2 border-white/50 rounded-tl animate-pulse" />
                <div className="absolute top-20 right-5 w-9 h-9 border-r-2 border-t-2 border-white/50 rounded-tr animate-pulse" />
                <div className="absolute bottom-48 left-5 w-9 h-9 border-l-2 border-b-2 border-white/50 rounded-bl animate-pulse" />
                <div className="absolute bottom-48 right-5 w-9 h-9 border-r-2 border-b-2 border-white/50 rounded-br animate-pulse" />
              </div>
              <TutorialCard
                title="Point at a building"
                description="Aim your camera at the Empire State Building, Hudson Yards, or One World Trade Center."
              />
            </>
          )}

          {/* Step 1 — building detected, AR locking on */}
          {tutorialStep === 1 && isRunning && (
            <TutorialCard
              title="Building detected!"
              description="The AR is locking on. Hold steady while the effect activates."
              onNext={() => setTutorialStep(2)}
            />
          )}

          {/* Step 2 — filter glow + explore card */}
          {tutorialStep === 2 && isRunning && (
            <TutorialCard
              title="Try a filter"
              description="Swipe the filter strip below and tap one to apply an AR effect to the building."
              position="bottom"
              onNext={skipTutorial}
            />
          )}
        </div>
      </div>
    </div>
  );
}
