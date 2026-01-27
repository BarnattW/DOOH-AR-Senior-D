import { useState, useEffect } from 'react';

// ONNX Runtime will be loaded dynamically from CDN
let ort = null;

// MODEL CONSTANTS (Based on YOLOv8 Segmentation Output)
const NUM_FEATURES = 39; // 4 (box) + 3 (class scores) + 32 (mask coeffs) for trio model

// Building class names - matches the model's class order
export const BUILDING_CLASSES = [
  "Hudson Yards - The Edge",
  "Empire State Building",
  "WTC"
 // Add if model has 3 classes
];

// Reusable letterbox canvas (created once, reused every frame)
let lbCanvas = null;
let lbCtx = null;
const LETTERBOX_SIZE = 640;

// Initialize letterbox canvas once
const initLetterboxCanvas = () => {
  if (!lbCanvas) {
    lbCanvas = document.createElement("canvas");
    lbCanvas.width = LETTERBOX_SIZE;
    lbCanvas.height = LETTERBOX_SIZE;
    lbCtx = lbCanvas.getContext("2d", { willReadFrequently: true });
  }
};

// Helper function: letterbox (reuses canvas)
export const letterbox = (img, newShape = LETTERBOX_SIZE) => {
  initLetterboxCanvas();
  
  // Fill gray background
  lbCtx.fillStyle = "rgb(114,114,114)";
  lbCtx.fillRect(0, 0, newShape, newShape);

  const ratio = Math.min(newShape / img.width, newShape / img.height);
  const newW = img.width * ratio;
  const newH = img.height * ratio;
  const dx = (newShape - newW) / 2;
  const dy = (newShape - newH) / 2;
  lbCtx.drawImage(img, dx, dy, newW, newH);
  const imageData = lbCtx.getImageData(0, 0, newShape, newShape);
  return { data: imageData.data, ratio, dx, dy };
};

// Optimized NMS with typed arrays and early exit
export const nms = (boxes, iouThresh = 0.5, maxDetections = 1) => {
  if (boxes.length === 0) return [];
  
  // Sort by confidence (index 4)
  boxes.sort((a, b) => b[4] - a[4]);
  
  const keep = [];
  const areas = new Float32Array(boxes.length);
  
  // Precompute areas
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
    
    if (shouldKeep) {
      keep.push(i);
    }
  }
  
  return keep.map(idx => boxes[idx]);
};

export function useDetector() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const loadModel = async () => {
      // Dynamically import ONNX Runtime from CDN
      if (!ort) {
        try {
          const ortModule = await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/esm/ort.min.js');
          ort = ortModule;
        } catch (error) {
          console.error("Failed to load ONNX Runtime:", error);
          return;
        }
      }

      console.log("⏳ Loading YOLO ONNX model...");

      // Set WASM file path to CDN location
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
      
      // Enable multi-threading (requires COOP/COEP headers)
      // Falls back to 1 thread if SharedArrayBuffer is not available
      const numThreads = Math.min(4, navigator.hardwareConcurrency ?? 1);
      ort.env.wasm.numThreads = numThreads;
      console.log(`🔧 WASM threads: ${numThreads} (hardware concurrency: ${navigator.hardwareConcurrency ?? 'unknown'})`);

      // Prefer WebGPU, fallback to WASM automatically
      // ONNX Runtime will try WebGPU first and fall back to WASM if unavailable
      const providers = ["webgpu", "wasm"];
      console.log("🚀 Attempting WebGPU first, will fallback to WASM if unavailable");

      try {
        // Model file is in public/ folder, served from root in Vite
        const newSession = await ort.InferenceSession.create("/trio_finetuned_32.onnx", {
          executionProviders: providers,
        });
        console.log("✅ Model loaded:", newSession.inputNames, "→", newSession.outputNames);
        // Note: WebGPU will be used if available, otherwise WASM (fallback is automatic)
        setSession(newSession);
      } catch (error) {
        console.error("Failed to load model:", error);
      }
    };

    loadModel();
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

    // YOLOv8 Decoding with early filtering
    const numFeatures = shape[1];
    const numPred = shape[2];
    const confThresh = 0.6; // 60% confidence minimum
    const boxes = [];

    // Check if model has expected number of features (39 for 3 classes in trio model)
    if (numFeatures !== NUM_FEATURES) {
      console.warn(`Expected ${NUM_FEATURES} features for trio model but got ${numFeatures}. Proceeding anyway...`);
    }
    
    const numClasses = 3; // Trio model has 3 classes

    // Optimized sigmoid (faster approximation for large negative values)
    const sigmoid = (x) => {
      if (x < -10) return 0;
      if (x > 10) return 1;
      return 1.0 / (1.0 + Math.exp(-x));
    };

    // Early top-K filtering: only process top candidates before full decoding
    // This reduces work when there are many low-confidence predictions
    const topKCandidates = [];
    const TOP_K = 200; // Keep top 200 candidates before full processing

    // First pass: find top-K by max class score (without full sigmoid)
    for (let i = 0; i < numPred; i++) {
      const baseIdx = i;
      const class0Raw = dataArr[4 * numPred + baseIdx];
      const class1Raw = dataArr[5 * numPred + baseIdx];
      const class2Raw = dataArr[6 * numPred + baseIdx];
      
      // Quick max without sigmoid (monotonic, so order is preserved)
      const maxRaw = Math.max(class0Raw, class1Raw, class2Raw);
      
      // Only process if above threshold (rough estimate)
      if (maxRaw > -1.0) { // Rough threshold before sigmoid
        topKCandidates.push({ idx: i, score: maxRaw });
      }
    }
    
    // Sort and keep top K
    topKCandidates.sort((a, b) => b.score - a.score);
    const candidatesToProcess = topKCandidates.slice(0, Math.min(TOP_K, topKCandidates.length));

    // Second pass: full decoding only for top candidates
    for (const candidate of candidatesToProcess) {
      const i = candidate.idx;
      const x = dataArr[0 * numPred + i];
      const y = dataArr[1 * numPred + i];
      const wBox = dataArr[2 * numPred + i];
      const hBox = dataArr[3 * numPred + i];
      
      // Features 4+ are class scores (apply sigmoid)
      const class0Score = sigmoid(dataArr[4 * numPred + i]);
      const class1Score = sigmoid(dataArr[5 * numPred + i]);
      const class2Score = sigmoid(dataArr[6 * numPred + i]);
      
      // Find the class with highest score
      let maxScore = class0Score;
      let classId = 0;
      if (class1Score > maxScore) {
        maxScore = class1Score;
        classId = 1;
      }
      if (class2Score > maxScore) {
        maxScore = class2Score;
        classId = 2;
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

