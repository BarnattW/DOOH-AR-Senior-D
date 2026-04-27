import { useDetector as useApiDetector } from "../components/ai/Detector";
import { useWorkerDetector } from "./useWorkerDetector";

/**
 * Runs both detector hooks (valid under Rules of Hooks) and returns the active pair.
 * Local inference runs in a Web Worker to keep the main thread free.
 * @param {"api" | "local"} mode
 */
export function useDetectorMode(mode) {
  const api = useApiDetector();
  const local = useWorkerDetector();
  const isApi = mode === "api";
  // Fall back to local when API session is unavailable (no WS URL or not connected)
  const useLocal = !isApi || !api.session;
  return {
    session: useLocal ? local.session : api.session,
    detect: useLocal ? local.detect : api.detect,
  };
}
