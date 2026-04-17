// ============================================================
// CONFIGURATION - UPDATE THESE FOR YOUR MODEL
// ============================================================
const CONFIG = {
  modelPath: 'wtc_finetuned_32.onnx',  // ⚠️ Your model filename
  classNames: ['WTC', 'Edge', 'Building'],  // ⚠️ Your class names
  confThreshold: 0.20,
  iouThreshold: 0.45,
  colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
};

// ============================================================
// GLOBAL STATE
// ============================================================
let session = null;           // ONNX session
let stream = null;            // Camera stream
let animationId = null;       // Animation frame ID
let isDetecting = false;

// Statistics
let stats = {
  fps: 0,
  frameCount: 0,
  lastTime: Date.now(),
  currentDetections: 0,
  totalDetections: 0,
  maxConfidence: 0
};

// ============================================================
// DOM ELEMENTS
// ============================================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const confSlider = document.getElementById('confSlider');
const confValue = document.getElementById('confValue');
const consoleLog = document.getElementById('consoleLog');

// Stats elements
const fpsValue = document.getElementById('fpsValue');
const detectionsValue = document.getElementById('detectionsValue');
const totalValue = document.getElementById('totalValue');
const maxConfValue = document.getElementById('maxConfValue');

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * LOG TO CONSOLE
 * Displays messages in both browser console and on-screen console
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span>${message}`;
  consoleLog.appendChild(logEntry);
  consoleLog.scrollTop = consoleLog.scrollHeight;
  console.log(`[${type.toUpperCase()}]`, message);
}

/**
 * CLEAR CONSOLE
 */
function clearConsole() {
  consoleLog.innerHTML = '';
  log('Console cleared', 'info');
}

/**
 * UPDATE STATUS
 */
function updateStatus(status, message) {
  statusDot.className = `status-dot ${status}`;
  statusText.textContent = message;
  log(message, status === 'error' ? 'error' : 'info');
}

/**
 * UPDATE STATISTICS DISPLAY
 */
function updateStatsDisplay() {
  fpsValue.textContent = stats.fps;
  detectionsValue.textContent = stats.currentDetections;
  totalValue.textContent = stats.totalDetections;
  maxConfValue.textContent = stats.maxConfidence.toFixed(2);
}

/**
 * LETTERBOX PREPROCESSING
 * Resizes image to 640x640 while maintaining aspect ratio
 */
function letterbox(img, newShape = 640) {
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCanvas.width = newShape;
  tmpCanvas.height = newShape;

  // Fill with gray (same as YOLO training)
  tmpCtx.fillStyle = 'rgb(114,114,114)';
  tmpCtx.fillRect(0, 0, newShape, newShape);

  // Calculate scaling to fit image in square
  const ratio = Math.min(newShape / img.width, newShape / img.height);
  const newW = img.width * ratio;
  const newH = img.height * ratio;
  
  // Center the image
  const dx = (newShape - newW) / 2;
  const dy = (newShape - newH) / 2;

  // Draw resized image
  tmpCtx.drawImage(img, dx, dy, newW, newH);
  
  const imageData = tmpCtx.getImageData(0, 0, newShape, newShape);
  return { data: imageData.data, ratio, dx, dy };
}

/**
 * NON-MAXIMUM SUPPRESSION (NMS)
 * Removes duplicate/overlapping bounding boxes
 */
function nms(boxes, iouThresh = 0.45) {
  // Sort by confidence (highest first)
  boxes.sort((a, b) => b[4] - a[4]);
  const keep = [];

  for (const box of boxes) {
    const [x1, y1, x2, y2, conf, classId] = box;
    let shouldKeep = true;

    // Check against all kept boxes
    for (const kept of keep) {
      const [kx1, ky1, kx2, ky2] = kept;

      // Calculate intersection
      const interX1 = Math.max(x1, kx1);
      const interY1 = Math.max(y1, ky1);
      const interX2 = Math.min(x2, kx2);
      const interY2 = Math.min(y2, ky2);
      const inter = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);

      // Calculate union
      const area1 = (x2 - x1) * (y2 - y1);
      const area2 = (kx2 - kx1) * (ky2 - ky1);
      const union = area1 + area2 - inter;

      // Calculate IoU (Intersection over Union)
      const iou = inter / union;

      // If too much overlap, it's a duplicate
      if (iou > iouThresh) {
        shouldKeep = false;
        break;
      }
    }

    if (shouldKeep) keep.push(box);
  }

  return keep;
}

// ============================================================
// MODEL LOADING - ENHANCED ERROR HANDLING
// ============================================================

/**
 * WAIT FOR ONNX RUNTIME TO BE FULLY LOADED
 */
async function waitForOnnxRuntime() {
  log('⏳ Waiting for ONNX Runtime to load...');
  
  // Check if ort is available
  if (typeof ort === 'undefined') {
    throw new Error('ONNX Runtime not loaded. Check if script tag is correct.');
  }

  // Wait for ONNX Runtime to initialize
  let attempts = 0;
  while (!ort.InferenceSession && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!ort.InferenceSession) {
    throw new Error('ONNX Runtime failed to initialize after 5 seconds');
  }

  log('✅ ONNX Runtime loaded');
}

/**
 * LOAD YOLO MODEL
 * Loads the ONNX model file into memory
 */
async function loadModel() {
  try {
    updateStatus('loading', '⏳ Loading model...');

    // ========================================
    // STEP 1: Wait for ONNX Runtime
    // ========================================
    await waitForOnnxRuntime();

    // ========================================
    // STEP 2: Check if model file exists
    // ========================================
    log(`Checking for model: ${CONFIG.modelPath}`);
    const response = await fetch(CONFIG.modelPath);
    
    if (!response.ok) {
      throw new Error(`Model file not found (HTTP ${response.status}). Make sure ${CONFIG.modelPath} is in the same folder.`);
    }

    const modelSize = response.headers.get('content-length');
    log(`✅ Model found: ${(modelSize / 1024 / 1024).toFixed(2)} MB`);

    // ========================================
    // STEP 3: Download model as ArrayBuffer
    // ========================================
    log('📥 Downloading model...');
    const modelBuffer = await response.arrayBuffer();
    log(`✅ Downloaded: ${(modelBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // ========================================
    // STEP 4: Validate model file
    // ========================================
    log('🔍 Validating model file...');
    
    // Check if it's a valid ONNX file (should start with certain bytes)
    const view = new Uint8Array(modelBuffer, 0, 4);
    const signature = String.fromCharCode(...view);
    
    if (signature !== '\x08\x03\x12\x02' && signature !== '\x08\x07\x12\x02') {
      log(`⚠️ Warning: File signature is ${[...view].map(b => '0x'+b.toString(16)).join(' ')}`, 'warn');
      log('This might not be a valid ONNX file', 'warn');
    }

    // ========================================
    // STEP 5: Configure ONNX Runtime
    // ========================================
    log('⚙️ Configuring ONNX Runtime...');
    
    // Set WASM paths
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
    
    // Use single thread for stability
    ort.env.wasm.numThreads = 1;
    
    // Disable SIMD if it causes issues
    // ort.env.wasm.simd = false;
    
    log('✅ ONNX Runtime configured');

    // ========================================
    // STEP 6: Create inference session
    // ========================================
    log('🧠 Creating inference session...');
    log('This may take 10-30 seconds for large models...');
    
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });

    // ========================================
    // STEP 7: Inspect model
    // ========================================
    log(`✅ Model loaded successfully!`);
    log(`📊 Model Information:`);
    log(`  Input names: ${session.inputNames.join(', ')}`);
    log(`  Output names: ${session.outputNames.join(', ')}`);
    
    // Try to get input/output shapes if available
    try {
      const inputNames = session.inputNames;
      log(`  Number of inputs: ${inputNames.length}`);
      log(`  Number of outputs: ${session.outputNames.length}`);
    } catch (e) {
      log('  (Could not read tensor shapes)', 'warn');
    }

    updateStatus('ready', '✅ Model ready - Click "Start Camera"');
    startBtn.disabled = false;

  } catch (error) {
    // ========================================
    // DETAILED ERROR REPORTING
    // ========================================
    updateStatus('error', `❌ Error loading model`);
    
    log('═══════════════════════════════════════', 'error');
    log('ERROR DETAILS:', 'error');
    log('═══════════════════════════════════════', 'error');
    
    // Error name
    if (error.name) {
      log(`Error name: ${error.name}`, 'error');
    }
    
    // Error message
    if (error.message) {
      log(`Error message: ${error.message}`, 'error');
    } else {
      log('Error message: (no message provided)', 'error');
    }
    
    // Full error object
    log(`Full error object:`, 'error');
    log(JSON.stringify(error, null, 2), 'error');
    
    // Stack trace
    if (error.stack) {
      log(`Stack trace:`, 'error');
      log(error.stack, 'error');
    }
    
    log('═══════════════════════════════════════', 'error');
    log('TROUBLESHOOTING TIPS:', 'error');
    log('═══════════════════════════════════════', 'error');
    
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
      log('💡 Network issue detected:', 'warn');
      log('  - Check if model file exists in same folder', 'warn');
      log('  - Make sure Python HTTP server is running', 'warn');
      log('  - Try: python -m http.server 8000', 'warn');
    } else if (errorMsg.includes('opset') || errorMsg.includes('operator')) {
      log('💡 Model compatibility issue detected:', 'warn');
      log('  - Your model might use unsupported operations', 'warn');
      log('  - Try re-exporting with: opset=14', 'warn');
      log('  - Python: model.export(format="onnx", opset=14, simplify=True)', 'warn');
    } else if (errorMsg.includes('memory') || errorMsg.includes('allocation')) {
      log('💡 Memory issue detected:', 'warn');
      log('  - Model might be too large', 'warn');
      log('  - Try closing other tabs', 'warn');
      log('  - Try using a desktop browser', 'warn');
    } else {
      log('💡 General troubleshooting:', 'warn');
      log('  1. Check browser console (F12) for more details', 'warn');
      log('  2. Try opening model in Netron: https://netron.app', 'warn');
      log('  3. Verify model was exported correctly for ONNX Runtime Web', 'warn');
      log('  4. Try a different browser (Chrome/Edge recommended)', 'warn');
    }
    
    console.error('Full error object:', error);
  }
}

// ============================================================
// CAMERA CONTROL
// ============================================================

/**
 * START WEBCAM
 */
async function startWebcam() {
  try {
    updateStatus('loading', '📹 Starting camera...');
    log('Requesting camera access...');

    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'  // Use back camera on mobile
      }
    });

    // Set video source
    video.srcObject = stream;

    // Wait for video to be ready
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    log('✅ Camera started');
    log(`Video size: ${video.videoWidth}x${video.videoHeight}`);
    updateStatus('ready', '🎥 Detecting...');

    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // Start detection loop
    startDetection();

  } catch (error) {
    updateStatus('error', `❌ Camera error: ${error.message}`);
    log(`Camera error: ${error.message}`, 'error');
  }
}

/**
 * STOP WEBCAM
 */
function stopWebcam() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  isDetecting = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  log('⏹️ Camera stopped');
  updateStatus('ready', '✅ Stopped - Ready to start again');
}

// ============================================================
// DETECTION
// ============================================================

/**
 * START DETECTION LOOP
 */
function startDetection() {
  if (!session || !video.videoWidth) {
    log('Cannot start detection - model or video not ready', 'warn');
    return;
  }

  isDetecting = true;
  log('🔍 Starting detection loop...');
  
  // Reset stats
  stats.frameCount = 0;
  stats.totalDetections = 0;
  stats.lastTime = Date.now();

  // Start FPS counter
  setInterval(updateFPS, 1000);

  // Start detection loop
  detectLoop();
}

/**
 * UPDATE FPS
 */
function updateFPS() {
  stats.fps = stats.frameCount;
  stats.frameCount = 0;
  updateStatsDisplay();
}

/**
 * MAIN DETECTION LOOP
 * Runs continuously using requestAnimationFrame
 */
async function detectLoop() {
  if (!isDetecting || !stream) return;

  try {
    // Run detection on current frame
    const detections = await detect();
    
    // Update stats
    stats.frameCount++;
    stats.currentDetections = detections.length;
    stats.totalDetections += detections.length;
    
    // Draw results
    drawDetections(detections);

  } catch (error) {
    log(`Detection error: ${error.message}`, 'error');
  }

  // Schedule next frame
  animationId = requestAnimationFrame(detectLoop);
}

/**
 * RUN DETECTION ON CURRENT FRAME
 * Returns array of detections: [x1, y1, x2, y2, confidence, classId]
 */
async function detect() {
  if (!session || !video.videoWidth) return [];

  const iw = video.videoWidth;
  const ih = video.videoHeight;

  // ========================================
  // STEP 1: PREPROCESS IMAGE
  // ========================================
  const { data, ratio, dx, dy } = letterbox(video);
  const w = 640;
  const h = 640;

  // Convert RGBA uint8 [0-255] to RGB float32 [0-1] in NCHW format
  // NCHW = (Batch, Channels, Height, Width)
  const img = new Float32Array(3 * h * w);
  
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    img[j] = data[i] / 255.0;                    // R
    img[w * h + j] = data[i + 1] / 255.0;        // G
    img[2 * w * h + j] = data[i + 2] / 255.0;    // B
  }

  const input = new ort.Tensor('float32', img, [1, 3, h, w]);

  // ========================================
  // STEP 2: RUN INFERENCE
  // ========================================
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const output = outputs[session.outputNames[0]];

  // ========================================
  // STEP 3: PARSE OUTPUT
  // ========================================
  const dataArr = output.data;
  const shape = output.dims;
  
  // YOLOv8 output shape: [1, features, predictions]
  // features = 4 (box) + num_classes + 32 (mask coefficients)
  const numFeatures = shape[1];
  const numPred = shape[2];
  const numClasses = numFeatures - 4 - 32;

  // ========================================
  // STEP 4: DECODE PREDICTIONS
  // ========================================
  const boxes = [];
  stats.maxConfidence = 0;

  for (let i = 0; i < numPred; i++) {
    // Get box coordinates (center format)
    const x = dataArr[0 * numPred + i];
    const y = dataArr[1 * numPred + i];
    const wBox = dataArr[2 * numPred + i];
    const hBox = dataArr[3 * numPred + i];

    // Find class with highest confidence
    let maxConf = 0;
    let maxClassId = 0;
    
    for (let c = 0; c < numClasses; c++) {
      const classConf = dataArr[(4 + c) * numPred + i];
      if (classConf > maxConf) {
        maxConf = classConf;
        maxClassId = c;
      }
    }

    // Track max confidence
    if (maxConf > stats.maxConfidence) {
      stats.maxConfidence = maxConf;
    }

    // Filter by confidence threshold
    if (maxConf > CONFIG.confThreshold) {
      // Convert from center format to corner format
      let x1 = x - wBox / 2;
      let y1 = y - hBox / 2;
      let x2 = x + wBox / 2;
      let y2 = y + hBox / 2;

      // Scale back to original image size
      x1 = (x1 - dx) / ratio;
      y1 = (y1 - dy) / ratio;
      x2 = (x2 - dx) / ratio;
      y2 = (y2 - dy) / ratio;

      // Clamp to image bounds
      x1 = Math.max(0, Math.min(iw, x1));
      y1 = Math.max(0, Math.min(ih, y1));
      x2 = Math.max(0, Math.min(iw, x2));
      y2 = Math.max(0, Math.min(ih, y2));

      boxes.push([x1, y1, x2, y2, maxConf, maxClassId]);
    }
  }

  // ========================================
  // STEP 5: NON-MAXIMUM SUPPRESSION
  // ========================================
  const filtered = nms(boxes, CONFIG.iouThreshold);
  
  return filtered;
}

/**
 * DRAW DETECTIONS ON CANVAS
 */
function drawDetections(detections) {
  // Set canvas size to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Draw each detection
  ctx.lineWidth = 3;
  ctx.font = 'bold 18px Arial';

  for (const [x1, y1, x2, y2, conf, classId] of detections) {
    const color = CONFIG.colors[classId % CONFIG.colors.length];
    const className = CONFIG.classNames[classId] || `Class ${classId}`;
    const label = `${className} ${(conf * 100).toFixed(1)}%`;

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw label background
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);

    // Draw label text
    ctx.fillStyle = 'white';
    ctx.fillText(label, x1 + 5, y1 - 7);
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Start button
startBtn.addEventListener('click', startWebcam);

// Stop button
stopBtn.addEventListener('click', stopWebcam);

// Confidence slider
confSlider.addEventListener('input', (e) => {
  CONFIG.confThreshold = parseFloat(e.target.value);
  confValue.textContent = CONFIG.confThreshold.toFixed(2);
  log(`Confidence threshold: ${CONFIG.confThreshold}`);
});

// ============================================================
// INITIALIZATION
// ============================================================

// Load model when page loads
window.addEventListener('load', () => {
  log('🚀 Initializing YOLO Object Detection System');
  log(`Model: ${CONFIG.modelPath}`);
  log(`Classes: ${CONFIG.classNames.join(', ')}`);
  
  // Wait a bit for ONNX Runtime to fully load
  setTimeout(() => {
    loadModel();
  }, 500);
});