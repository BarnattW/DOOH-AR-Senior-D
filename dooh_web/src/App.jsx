import { useRef, useState, useEffect, useCallback } from "react";
import { useArStore } from "./store/arStore";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetectorMode } from "./hooks/useDetectorMode";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { useMotionGate } from "./hooks/useMotionGate";
import { usePixiOverlay } from "./hooks/usePixiOverlay";
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
import TutorialFlow from "./components/onboarding/TutorialFlow";

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
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem("dooh_onboarded") !== "true"
  );

  const finishTutorial = useCallback(() => {
    localStorage.setItem("dooh_onboarded", "true");
    setShowTutorial(false);
  }, []);

  // ── Motion gate — skip detections while phone is moving ──────────────────
  const isMovingRef = useMotionGate();

  // ── Detection loop ────────────────────────────────────────────────────────
  const handleDetections = useCallback((formatted) => {
    lastDetectionsRef.current = formatted;
    onDetections(formatted);
  }, [onDetections]);

  useDetectionLoop({
    isRunning,
    session,
    videoRef,
    canvasRef: pixiCanvasRef,
    detect,
    onDetections: handleDetections,
    isMovingRef,
  });

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

          <DetectionOverlay detections={detections} containerRef={pixiCanvasRef} />

          {isRunning && <LockOnOverlay arState={arState} />}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-35% to-black/75" />

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
