import { useState, useEffect } from "react";
import { BUILDING_CLASSES } from "../../constants/buildings";

let ort = null;
let ortPromise = null;
let sessionSingleton = null;
let sessionPromise = null;

const NUM_FEATURES = 39;
const LETTERBOX_SIZE = 640;
const TOP_K = 200;
const CONF_THRESH = 0.6;

// Must match package.json `onnxruntime-web` version (WASM files load from CDN)
const ORT_WASM_VERSION = "1.22.0";
const WASM_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WASM_VERSION}/dist/`;

let lbCanvas = null;
let lbCtx = null;

function initLetterboxCanvas() {
  if (!lbCanvas) {
    lbCanvas = document.createElement("canvas");
    lbCanvas.width = LETTERBOX_SIZE;
    lbCanvas.height = LETTERBOX_SIZE;
    lbCtx = lbCanvas.getContext("2d", { willReadFrequently: true });
  }
}

export const letterbox = (img, newShape = LETTERBOX_SIZE) => {
  initLetterboxCanvas();
  lbCtx.fillStyle = "rgb(114,114,114)";
  lbCtx.fillRect(0, 0, newShape, newShape);

  const srcW = img.videoWidth || img.naturalWidth || img.width;
  const srcH = img.videoHeight || img.naturalHeight || img.height;

  if (!srcW || !srcH) {
    return { data: new Uint8ClampedArray(newShape * newShape * 4), ratio: 1, dx: 0, dy: 0 };
  }

  const ratio = Math.min(newShape / srcW, newShape / srcH);
  const newW = Math.round(srcW * ratio);
  const newH = Math.round(srcH * ratio);
  const dx = Math.round((newShape - newW) / 2);
  const dy = Math.round((newShape - newH) / 2);

  lbCtx.drawImage(img, 0, 0, srcW, srcH, dx, dy, newW, newH);
  const imageData = lbCtx.getImageData(0, 0, newShape, newShape);
  return { data: imageData.data, ratio, dx, dy };
};

export const nms = (boxes, iouThresh = 0.5, maxDetections = 1) => {
  if (boxes.length === 0) return [];
  boxes.sort((a, b) => b[4] - a[4]);
  const keep = [];
  const areas = new Float32Array(boxes.length);
  for (let i = 0; i < boxes.length; i++) {
    const [x1, y1, x2, y2] = boxes[i];
    areas[i] = (x2 - x1) * (y2 - y1);
  }

  for (let i = 0; i < boxes.length && keep.length < maxDetections; i++) {
    const [x1, y1, x2, y2] = boxes[i];
    let shouldKeep = true;
    for (let j = 0; j < keep.length; j++) {
      const keptIdx = keep[j];
      const [kx1, ky1, kx2, ky2] = boxes[keptIdx];
      const interX1 = Math.max(x1, kx1);
      const interY1 = Math.max(y1, ky1);
      const interX2 = Math.min(x2, kx2);
      const interY2 = Math.min(y2, ky2);
      const inter = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
      const union = areas[i] + areas[keptIdx] - inter;
      if (union > 0 && inter / union > iouThresh) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) keep.push(i);
  }
  return keep.map((idx) => boxes[idx]);
};

async function loadOrtOnce() {
  if (ort) return ort;
  if (ortPromise) return ortPromise;

  ortPromise = (async () => {
    // Bundled from npm — avoids broken CDN paths (e.g. 1.19.x esm URL 404)
    const ortModule = await import("onnxruntime-web");
    ort = ortModule.default ?? ortModule;
    ort.env.wasm.wasmPaths = WASM_CDN_BASE;
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency ?? 1);
    return ort;
  })();

  return ortPromise;
}

async function loadSessionOnce() {
  if (sessionSingleton) return sessionSingleton;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const ortMod = await loadOrtOnce();
    console.log("⏳ Loading YOLO ONNX model (local)...");

    const s = await ortMod.InferenceSession.create("/trio_finetuned_32.onnx", {
      executionProviders: ["webgpu", "wasm"],
    });

    console.log("✅ Model loaded:", s.inputNames, "→", s.outputNames);
    sessionSingleton = s;
    return s;
  })();

  return sessionPromise;
}

export function useDetector() {
  const [session, setSession] = useState(sessionSingleton);

  useEffect(() => {
    let alive = true;

    if (sessionSingleton) {
      setSession(sessionSingleton);
      return;
    }

    loadSessionOnce()
      .then((s) => {
        if (alive) setSession(s);
      })
      .catch((e) => console.error("Failed to load model:", e));

    return () => {
      alive = false;
    };
  }, []);

  const detect = async (imageElement, canvasRef, drawAROverlay) => {
    if (!session || !imageElement) {
      console.warn("Model not loaded yet or image not available");
      return [];
    }

    const ortMod = await loadOrtOnce();
    const iw = imageElement.videoWidth || imageElement.width;
    const ih = imageElement.videoHeight || imageElement.height;

    const { data, ratio, dx, dy } = letterbox(imageElement);
    const w = LETTERBOX_SIZE;
    const h = LETTERBOX_SIZE;
    const img = new Float32Array(1 * 3 * h * w);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const base = j;
      img[base] = data[i] / 255.0;
      img[w * h + base] = data[i + 1] / 255.0;
      img[2 * w * h + base] = data[i + 2] / 255.0;
    }

    const input = new ortMod.Tensor("float32", img, [1, 3, h, w]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    const output = outputs[session.outputNames[0]];
    const dataArr = output.data;
    const shape = output.dims;

    const numFeatures = shape[1];
    const numPred = shape[2];

    if (numFeatures !== NUM_FEATURES) {
      console.warn(`Expected ${NUM_FEATURES} features but got ${numFeatures}.`);
    }

    const sigmoid = (x) => {
      if (x < -10) return 0;
      if (x > 10) return 1;
      return 1.0 / (1.0 + Math.exp(-x));
    };

    const candidates = [];
    for (let i = 0; i < numPred; i++) {
      const r0 = dataArr[4 * numPred + i];
      const r1 = dataArr[5 * numPred + i];
      const r2 = dataArr[6 * numPred + i];
      const maxRaw = Math.max(r0, r1, r2);
      if (maxRaw > -1.0) candidates.push({ idx: i, score: maxRaw });
    }
    candidates.sort((a, b) => b.score - a.score);
    const toProcess = candidates.slice(0, Math.min(TOP_K, candidates.length));

    const boxes = [];
    for (const c of toProcess) {
      const i = c.idx;
      const x = dataArr[0 * numPred + i];
      const y = dataArr[1 * numPred + i];
      const wBox = dataArr[2 * numPred + i];
      const hBox = dataArr[3 * numPred + i];

      const scores = [
        sigmoid(dataArr[4 * numPred + i]),
        sigmoid(dataArr[5 * numPred + i]),
        sigmoid(dataArr[6 * numPred + i]),
      ];
      const classId = scores.indexOf(Math.max(scores[0], scores[1], scores[2]));
      const conf = scores[classId];

      if (conf > CONF_THRESH) {
        let x1 = (x - wBox / 2 - dx) / ratio;
        let y1 = (y - hBox / 2 - dy) / ratio;
        let x2 = (x + wBox / 2 - dx) / ratio;
        let y2 = (y + hBox / 2 - dy) / ratio;

        x1 = Math.max(0, x1);
        y1 = Math.max(0, y1);
        x2 = Math.min(iw, x2);
        y2 = Math.min(ih, y2);

        boxes.push([x1, y1, x2, y2, conf, classId]);
      }
    }

    const filtered = nms(boxes);

    if (import.meta.env.DEV) {
      console.log(`[local detect] ${filtered.length} detection(s)`);
    }

    if (drawAROverlay && canvasRef?.current && filtered.length > 0) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.lineWidth = 3;
      ctx.strokeStyle = "red";
      ctx.fillStyle = "red";
      ctx.font = "18px monospace";

      for (const [x1, y1, x2, y2, conf, classId] of filtered) {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        const label = `${BUILDING_CLASSES[classId] ?? `Building ${classId}`} ${(conf * 100).toFixed(1)}%`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 20, textWidth + 8, 20);
        ctx.fillStyle = "white";
        ctx.fillText(label, x1 + 4, y1 - 4);
        ctx.fillStyle = "red";
      }

      drawAROverlay(ctx, filtered);
    }

    return filtered;
  };

  return { session, detect };
}

export { BUILDING_CLASSES };
