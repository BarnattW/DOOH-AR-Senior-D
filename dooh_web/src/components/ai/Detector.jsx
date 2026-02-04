import { useState, useEffect } from 'react';

// ONNX Runtime will be loaded dynamically from CDN
let ort = null;
let ortPromise = null;

let sessionSingleton = null;
let sessionPromise = null;

// MODEL CONSTANTS (Based on YOLOv8 Segmentation Output)
const NUM_FEATURES = 39; // 4 (box) + 3 (class scores) + 32 (mask coeffs) for trio model

// Building class names - matches the model's class order
export const BUILDING_CLASSES = [
  "Hudson Yards - The Edge",
  "Empire State Building",
  "WTC"
 // Add if model has 3 classes
];

// Helper function: letterbox
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
    // Video metadata not ready yet; caller should retry later
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


// Helper function: NMS
export const nms = (boxes, iouThresh = 0.5, maxDetections = 1) => {
  boxes.sort((a, b) => b[4] - a[4]); // Sort by confidence (index 4)
  const keep = [];

  for (let i = 0; i < boxes.length; i++) {
    const [x1, y1, x2, y2, conf] = boxes[i];
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
      // Limit maximum number of detections
      if (keep.length >= maxDetections) break;
    }
  }
  return keep;
};

async function loadOrtOnce() {
  if (ort) return ort;
  if (ortPromise) return ortPromise;

  ortPromise = (async () => {
    const ortModule = await import(
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/esm/ort.min.js"
    );

    // Depending on bundler/CDN, it might be default or namespace.
    // This makes it robust:
    ort = ortModule?.default ?? ortModule;

    // Configure runtime once
    ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/";
    ort.env.wasm.numThreads = 1;

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
      executionProviders: ["wasm"],
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

    // If already loaded, sync state and skip
    if (sessionSingleton) {
      setSession(sessionSingleton);
      return;
    }

    // Load once (cached promise)
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

    const iw = imageElement.videoWidth || imageElement.width;
    const ih = imageElement.videoHeight || imageElement.height;

    // Preprocess
    const { data, ratio, dx, dy } = letterbox(imageElement);
    const w = 640;
    const h = 640;
    const img = new Float32Array(1 * 3 * h * w);

    // Convert pixel data (RGBA) to Float32Array (NCHW, normalized)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const base = j;
      img[base] = data[i] / 255.0; // R
      img[w * h + base] = data[i + 1] / 255.0; // G
      img[2 * w * h + base] = data[i + 2] / 255.0; // B
    }

    const input = new ort.Tensor("float32", img, [1, 3, h, w]);

    // Run Inference
    const outputs = await session.run({ [session.inputNames[0]]: input });
    const output = outputs[session.outputNames[0]];
    const dataArr = output.data;
    const shape = output.dims;

    // YOLOv8 Decoding
    const numFeatures = shape[1];
    const numPred = shape[2];
    const confThresh = 0.6; // 60% confidence minimum
    const boxes = [];

    // Check if model has expected number of features (39 for 3 classes in trio model)
    if (numFeatures !== NUM_FEATURES) {
      console.warn(`Expected ${NUM_FEATURES} features for trio model but got ${numFeatures}. Proceeding anyway...`);
    }
    
    const numClasses = 3; // Trio model has 3 classes

    // Helper function: sigmoid (for class scores)
    const sigmoid = (x) => 1.0 / (1.0 + Math.exp(-x));

    // Iterate over predictions
    for (let i = 0; i < numPred; i++) {
      const x = dataArr[0 * numPred + i];
      const y = dataArr[1 * numPred + i];
      const wBox = dataArr[2 * numPred + i];
      const hBox = dataArr[3 * numPred + i];
      
      // Features 4+ are class scores (apply sigmoid)
      const class0Score = sigmoid(dataArr[4 * numPred + i]);
      const class1Score = sigmoid(dataArr[5 * numPred + i]);
      
      // Find the class with highest score
      let maxScore = class0Score;
      let classId = 0;
      if (class1Score > maxScore) {
        maxScore = class1Score;
        classId = 1;
      }
      
      // Check if there's a third class (if model has 3 classes)
      if (numClasses === 3) {
        const class2Score = sigmoid(dataArr[6 * numPred + i]);
        if (class2Score > maxScore) {
          maxScore = class2Score;
          classId = 2;
        }
      }
      
      const conf = maxScore;

      if (conf > confThresh) {
        let x1 = x - wBox / 2;
        let y1 = y - hBox / 2;
        let x2 = x + wBox / 2;
        let y2 = y + hBox / 2;

        // Rescale to original image space
        x1 = (x1 - dx) / ratio;
        y1 = (y1 - dy) / ratio;
        x2 = (x2 - dx) / ratio;
        y2 = (y2 - dy) / ratio;

        // Clamp to image bounds
        x1 = Math.max(0, x1);
        y1 = Math.max(0, y1);
        x2 = Math.min(iw, x2);
        y2 = Math.min(ih, y2);

        boxes.push([x1, y1, x2, y2, conf, classId]);
      }
    }

    const filtered = nms(boxes);
    console.log(`✅ Detections after NMS: ${filtered.length}`);

    // Only draw if drawAROverlay callback is provided (for backward compatibility)
    // Otherwise, just return the detections and let the render loop handle drawing
    if (drawAROverlay && canvasRef.current && filtered.length > 0) {
      const ctx = canvasRef.current.getContext("2d");
      
      // Draw boxes
      ctx.lineWidth = 3;
      ctx.strokeStyle = "red";
      ctx.fillStyle = "red";
      ctx.font = "18px monospace";

      for (const [x1, y1, x2, y2, conf, classId] of filtered) {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Get building name from class ID
        const buildingName = BUILDING_CLASSES[classId] || `Building ${classId}`;
        const label = `${buildingName} ${(conf * 100).toFixed(1)}%`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x1, y1 - 20, textWidth + 8, 20);
        ctx.fillStyle = "white";
        ctx.fillText(label, x1 + 4, y1 - 4);
        ctx.fillStyle = "red";
      }

      // Draw AR overlay
      drawAROverlay(ctx, filtered);
    }

    return filtered;
  };

  return {
    session,
    detect,
  };
}

