import { useEffect } from "react";
import { useDetector as useApiDetector } from "../components/ai/Detector";
import { useWorkerDetector } from "./useWorkerDetector";
import { useDetectorStore } from "../store/detectorStore";

const API_GRACE_MS = 3000; // wait this long for WS to connect before starting worker

export function useDetectorMode(mode) {
  const api = useApiDetector();
  const local = useWorkerDetector();

  const apiAvailable = mode === "api" && !!api.session;

  useEffect(() => {
    if (apiAvailable) return; // server is up, no need for worker

    if (mode === "local") {
      // User explicitly chose local — start immediately
      useDetectorStore.getState().init();
      return;
    }

    // API mode but server not yet connected — give it a grace period
    const t = setTimeout(() => {
      useDetectorStore.getState().init();
    }, API_GRACE_MS);

    return () => clearTimeout(t);
  }, [mode, apiAvailable]);

  return apiAvailable
    ? { session: api.session, detect: api.detect }
    : { session: local.session, detect: local.detect };
}
