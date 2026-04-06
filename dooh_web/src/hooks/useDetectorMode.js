import { useDetector as useApiDetector } from "../components/ai/Detector";
import { useDetector as useLocalDetector } from "../components/ai/DetectorOld";

/**
 * Runs both detector hooks (valid under Rules of Hooks) and returns the active pair.
 * @param {"api" | "local"} mode
 */
export function useDetectorMode(mode) {
  const api = useApiDetector();
  const local = useLocalDetector();
  const isApi = mode === "api";
  return {
    session: isApi ? api.session : local.session,
    detect: isApi ? api.detect : local.detect,
  };
}
