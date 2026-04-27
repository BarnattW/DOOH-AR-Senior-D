import { create } from "zustand";
import { letterbox, nms } from "../components/ai/DetectorOld";

const LETTERBOX_SIZE = 640;
const TOP_K = 200;
const CONF_THRESH = 0.55;

const sigmoid = (x) => {
  if (x < -10) return 0;
  if (x > 10) return 1;
  return 1.0 / (1.0 + Math.exp(-x));
};

let nextId = 0;

export const useDetectorStore = create((set, get) => ({
  worker: null,
  ready: false,
  pending: new Map(),

  init() {
    if (get().worker) return;

    const worker = new Worker(
      new URL("../workers/detector.worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = ({ data }) => {
      if (data.type === "ready") {
        console.log("[worker] model ready");
        set({ ready: true });
      } else if (data.type === "error") {
        console.error("[worker] init error:", data.message);
      } else if (data.type === "result") {
        const { pending } = get();
        const entry = pending.get(data.id);
        if (entry) {
          pending.delete(data.id);
          if (data.error) console.error("[detect] worker inference error:", data.error);
          entry.resolve(data);
        }
      }
    };

    worker.onerror = (e) => console.error("[worker] uncaught error:", e);
    set({ worker });
  },

  async detect(imageElement) {
    const { worker, ready, pending } = get();
    if (!ready || !worker || !imageElement) return [];

    const iw = imageElement.videoWidth || imageElement.width;
    const ih = imageElement.videoHeight || imageElement.height;
    if (!iw || !ih) return [];

    const { data, ratio, dx, dy } = letterbox(imageElement);
    const w = LETTERBOX_SIZE;
    const h = LETTERBOX_SIZE;
    const imgData = new Float32Array(3 * h * w);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      imgData[j]             = data[i]     / 255.0;
      imgData[w * h + j]     = data[i + 1] / 255.0;
      imgData[2 * w * h + j] = data[i + 2] / 255.0;
    }

    const id = nextId++;
    const result = await new Promise((resolve) => {
      pending.set(id, { resolve });
      worker.postMessage({ type: "infer", imgData, id }, [imgData.buffer]);
    });

    if (!result.outputData || result.error) return [];

    const { outputData: dataArr, dims } = result;
    const numPred = dims[2];

    const candidates = [];
    for (let i = 0; i < numPred; i++) {
      const maxRaw = Math.max(
        dataArr[4 * numPred + i],
        dataArr[5 * numPred + i],
        dataArr[6 * numPred + i]
      );
      if (maxRaw > -1.0) candidates.push({ idx: i, score: maxRaw });
    }
    candidates.sort((a, b) => b.score - a.score);

    const boxes = [];
    for (const c of candidates.slice(0, TOP_K)) {
      const i = c.idx;
      const x    = dataArr[0 * numPred + i];
      const y    = dataArr[1 * numPred + i];
      const wBox = dataArr[2 * numPred + i];
      const hBox = dataArr[3 * numPred + i];

      const scores = [
        sigmoid(dataArr[4 * numPred + i]),
        sigmoid(dataArr[5 * numPred + i]),
        sigmoid(dataArr[6 * numPred + i]),
      ];
      const classId = scores.indexOf(Math.max(...scores));
      const conf = scores[classId];

      if (conf > CONF_THRESH) {
        boxes.push([
          Math.max(0,  (x - wBox / 2 - dx) / ratio),
          Math.max(0,  (y - hBox / 2 - dy) / ratio),
          Math.min(iw, (x + wBox / 2 - dx) / ratio),
          Math.min(ih, (y + hBox / 2 - dy) / ratio),
          conf,
          classId,
        ]);
      }
    }

    return nms(boxes);
  },
}));

// Kick off worker immediately on module import
useDetectorStore.getState().init();
