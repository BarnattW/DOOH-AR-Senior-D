import { useEffect } from "react";
import { useDetector as useApiDetector } from "../components/ai/Detector";
import { useWorkerDetector } from "./useWorkerDetector";
import { useDetectorStore } from "../store/detectorStore";

const API_GRACE_MS = 3000; // wait this long for WS to connect before falling back to worker

// mode: "original" | "strong" | "local"
export function useDetectorMode(mode, opts = {}) {
  const isLocal = mode === "local";
  const apiModel = isLocal ? "original" : mode;
  const api = useApiDetector(apiModel, { onLatency: opts.onLatency });
  const local = useWorkerDetector();

  const apiAvailable = !isLocal && !!api.session;

  useEffect(() => {
    if (apiAvailable) return; // server is up, no need for worker

    if (isLocal) {
      useDetectorStore.getState().init();
      return;
    }

    // API mode but server not yet connected — give it a grace period before warming worker
    const t = setTimeout(() => {
      useDetectorStore.getState().init();
    }, API_GRACE_MS);

    return () => clearTimeout(t);
  }, [mode, apiAvailable, isLocal]);

  return apiAvailable
    ? { session: api.session, detect: api.detect }
    : { session: local.session, detect: local.detect };
}
