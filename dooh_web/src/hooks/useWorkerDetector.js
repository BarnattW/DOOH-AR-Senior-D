import { useDetectorStore } from "../store/detectorStore";

export function useWorkerDetector() {
  const ready = useDetectorStore((s) => s.ready);
  const detect = useDetectorStore((s) => s.detect);

  return { session: ready ? true : null, detect };
}
