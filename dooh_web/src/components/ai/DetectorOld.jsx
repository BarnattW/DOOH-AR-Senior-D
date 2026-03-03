import { useState, useEffect } from 'react';

let ort = null;
let ortPromise = null;

let sessionSingleton = null;
let sessionPromise = null;

const NUM_FEATURES = 39; // 4 (box) + 3 (class scores) + 32 (mask coeffs)

export const BUILDING_CLASSES = [
  "Hudson Yards - The Edge",
  "Empire State Building",
  "WTC",
];

export const letterbox = (img, newShape = 640) => {
  const canvasTmp = document.createElement("canvas");
  const ctxTmp = canvasTmp.getContext("2d");
  canvasTmp.width = newShape;
  canvasTmp.height = newShape;

  ctxTmp.fillStyle = "rgb(114,114,114)";
  ctxTmp.fillRect(0, 0, newShape, newShape);

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

  ctxTmp.drawImage(img, 0, 0, srcW, srcH, dx, dy, newW, newH);

  const imageData = ctxTmp.getImageData(0, 0, newShape, newShape);
  return { data: imageData.data, ratio, dx, dy };
};

export const nms = (boxes, iouThresh = 0.5, maxDetections = 1) => {
  boxes.sort((a, b) => b[4] - a[4]);
  const keep = [];

  for (let i = 0; i < boxes.length; i++) {
    const [x1, y1, x2, y2] = boxes[i];
    let shouldKeep = true;

    for (const kept of keep) {
      const [kx1, ky1, kx2, ky2] = kept;
      const interX1 = Math.max(x1, kx1);
      const interY1 = Math.max(y1, ky1);
      const interX2 = Math.min(x2, kx2);
      const interY2 = Math.min(y2, ky2);
      const inter = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
      const area1 = (x2 - x1) * (y2 - y1);
      const area2 = (kx2 - kx1) * (ky2 - ky1);
      const union = area1 + area2 - inter;

      if (union > 0 && inter / union > iouThresh) {
        shouldKeep = false;
        break;
      }
    }

    if (shouldKeep) {
      keep.push(boxes[i]);
      if (keep.length >= maxDetections) break;
    }
  }

  return keep;
};

// DetectorOld.jsx
async function loadOrtOnce() {
  if (ort) return ort;
  if (ortPromise) return ortPromise;

  ortPromise = (async () => {
    const url = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/ort.all.min.js";
    
    if (!window.ort) {
      const script = document.createElement("script");
      script.src = url;
      document.head.appendChild(script);
      await new Promise((res) => (script.onload = res));
    }
    
    ort = window.ort;
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/";
    return ort;
  })();

  return ortPromise;
}

async function loadSessionOnce() {
  if (sessionSingleton) return sessionSingleton;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const ort = await loadOrtOnce();
    console.log("⏳ Loading YOLO ONNX model...");

    const s = await ort.InferenceSession.create("/trio_finetuned_32.onnx", {
      executionProviders: ["webgpu", "wasm"],
    });

    console.log("✅ Model loaded:", s.inputNames, "→", s.outputNames);
    console.log("⚡ Execution provider:", s.handler?.executionProviderName ?? "unknown");
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
      .then((s) => { if (alive) setSession(s); })
      .catch((e) => console.error("Failed to load model:", e));

    return () => { alive = false; };
  }, []);

  const detect = async (imageElement, canvasRef, drawAROverlay) => {
    if (!session || !imageElement) {
      console.warn("Model not loaded yet or image not available");
      return [];
    }

    const t0 = performance.now();

    const iw = imageElement.videoWidth || imageElement.width;
    const ih = imageElement.videoHeight || imageElement.height;

    // --- Letterbox ---
    const { data, ratio, dx, dy } = letterbox(imageElement);
    console.log(`[perf] letterbox: ${(performance.now() - t0).toFixed(1)}ms`);

    // --- Preprocess: RGBA → Float32 NCHW ---
    const t1 = performance.now();
    const w = 640, h = 640;
    const img = new Float32Array(1 * 3 * h * w);
    const red = new Float32Array(w * h);
    const green = new Float32Array(w * h);
    const blue = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      red[i] = data[i * 4] / 255.0;
      green[i] = data[i * 4 + 1] / 255.0;
      blue[i] = data[i * 4 + 2] / 255.0;
    }
    img.set(red);
    img.set(green, w * h);
    img.set(blue, 2 * w * h);
    console.log(`[perf] preprocess: ${(performance.now() - t1).toFixed(1)}ms`);

    // --- Inference ---
    const t2 = performance.now();
    const input = new ort.Tensor("float32", img, [1, 3, h, w]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    console.log(`[perf] inference: ${(performance.now() - t2).toFixed(1)}ms`);

    // --- Decode + NMS ---
    const t3 = performance.now();
    const output = outputs[session.outputNames[0]];
    const dataArr = output.data;
    const shape = output.dims;

    const numFeatures = shape[1];
    const numPred = shape[2];
    const confThresh = 0.4;
    const boxes = [];

    if (numFeatures !== NUM_FEATURES) {
      console.warn(`Expected ${NUM_FEATURES} features but got ${numFeatures}.`);
    }

    const sigmoid = (x) => 1.0 / (1.0 + Math.exp(-x));

    for (let i = 0; i < numPred; i++) {
      const x = dataArr[0 * numPred + i];
      const y = dataArr[1 * numPred + i];
      const wBox = dataArr[2 * numPred + i];
      const hBox = dataArr[3 * numPred + i];

      const scores = [
        sigmoid(dataArr[4 * numPred + i]),
        sigmoid(dataArr[5 * numPred + i]),
        sigmoid(dataArr[6 * numPred + i]),
      ];

      const classId = scores.indexOf(Math.max(...scores));
      const conf = scores[classId];

      if (conf > confThresh) {
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
    console.log(`[perf] decode+NMS: ${(performance.now() - t3).toFixed(1)}ms`);
    console.log(`[perf] total: ${(performance.now() - t0).toFixed(1)}ms`);
    console.log(`[perf] detections after NMS: ${filtered.length}`);

    if (drawAROverlay && canvasRef.current && filtered.length > 0) {
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