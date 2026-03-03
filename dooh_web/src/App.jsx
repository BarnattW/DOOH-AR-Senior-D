import { useRef, useState } from "react";
import { Camera, useCamera } from "./components/camera/Camera";
import { useDetector as useOldDetector } from "./components/ai/DetectorOld";
import { useDetector } from "./components/ai/Detector";
import { useGeolocation } from "./hooks/useGeolocation";
import { useDetectionLoop } from "./hooks/useDetectionLoop";
import { useOverlayLoop } from "./hooks/useOverlayLoop";
import { useCanvasSync } from "./hooks/useCanvasSync";
import { isNearLandmark } from "./util/geolocation";
import LocationStatus from "./components/LocationStatus";
import CameraControls from "./components/CameraControls";

const EMPIRE_STATE = { lat: 40.748817, lng: -73.985428 };
const RADIUS_M = 5000;

export default function App() {
  const canvasRef = useRef(null);
  const lastDetectionsRef = useRef([]);
  const [lastDetections, setLastDetections] = useState([]); // for any react components that need to access the last detections
  const [mockLocation, setMockLocation] = useState(false);

  const { videoRef, isRunning, startWebcam, stopWebcam } = useCamera();
  const { session, detect } = useOldDetector();
  const { coords, loading: geoLoading, error: geoError } = useGeolocation(mockLocation);

  const near = coords
    ? isNearLandmark(
        { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        EMPIRE_STATE,
        RADIUS_M
      )
    : null;

  // Sync canvas dimensions to video
  useCanvasSync({ videoRef, canvasRef, isRunning });

  // Draw bounding boxes + AR overlay on each video frame
  useOverlayLoop({ canvasRef, videoRef, isRunning, lastDetectionsRef });

  // Run inference on an interval
  useDetectionLoop({
    isRunning,
    session,
    videoRef,
    canvasRef,
    detect,
    onDetections: (formatted) => {
      console.log(formatted)
      lastDetectionsRef.current = formatted;
      setLastDetections(formatted);
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

      {/* Video + overlay */}
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