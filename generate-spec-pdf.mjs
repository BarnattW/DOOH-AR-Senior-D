import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";

const OUT  = "AR-DOOH-Spec.pdf";
const LOGO = "dooh_web/public/logos/logo-lens.jpg";

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 60, bottom: 60, left: 64, right: 64 },
  info: { Title: "AR·DOOH Frontend Specification", Author: "AR·DOOH Team" },
});
doc.pipe(createWriteStream(OUT));

const W        = doc.page.width - 128;
const NAVY     = "#1a2e4a";
const BLUE     = "#2a7fff";
const LGRAY    = "#e5e7eb";
const MGRAY    = "#6b7280";
const BLACK    = "#1f2937";
const WHITE    = "#ffffff";
const XGRAY    = "#f7f8fa";
const CODE_BG  = "#f3f4f6";
const WARN     = "#92400e";
const WARN_BG  = "#fffbeb";
const WARN_BD  = "#f59e0b";
const NOTE     = "#065f46";
const NOTE_BG  = "#ecfdf5";

// ── Helpers ────────────────────────────────────────────────

function checkSpace(needed = 60) {
  if (doc.y + needed > doc.page.height - 72) doc.addPage();
}

function hline(y, color = LGRAY, width = 0.75) {
  doc.save().moveTo(64, y).lineTo(64 + W, y).lineWidth(width).strokeColor(color).stroke().restore();
}

function fillRect(x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function section(num, title) {
  checkSpace(80);
  doc.moveDown(0.8);
  const y = doc.y;
  fillRect(64, y, 3, 22, BLUE);
  // No explicit y + no lineBreak:false so PDFKit correctly advances doc.y after text
  doc.font("Helvetica-Bold").fontSize(14).fillColor(NAVY)
     .text(`${num}.  ${title}`, 76, y + 3);
  doc.moveDown(0.3);
  hline(doc.y);
  doc.moveDown(0.5);
}

function subhead(text) {
  checkSpace(40);
  doc.moveDown(0.35).font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(text);
  doc.moveDown(0.1);
}

function body(text) {
  doc.font("Helvetica").fontSize(10).fillColor(BLACK).text(text, { lineGap: 4 });
  doc.moveDown(0.2);
}

function bullet(text, sub = false) {
  doc.font("Helvetica").fontSize(10).fillColor(BLACK)
     .text(`${sub ? "–" : "·"}  ${text}`, { indent: sub ? 28 : 12, lineGap: 3 });
}

function warn(text) {
  checkSpace(50);
  const y = doc.y;
  doc.font("Helvetica").fontSize(9);
  const h = doc.heightOfString(text, { width: W - 32 }) + 24;
  fillRect(64, y, W, h, WARN_BG);
  fillRect(64, y, 3, h, WARN_BD);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(WARN)
     .text("⚠  Note:  ", 76, y + 9, { continued: true });
  doc.font("Helvetica").fontSize(9).fillColor(WARN)
     .text(text, { width: W - 32, lineGap: 3 });
  doc.y = y + h + 8;
}

function note(text) {
  checkSpace(50);
  const y = doc.y;
  doc.font("Helvetica").fontSize(9);
  const h = doc.heightOfString(text, { width: W - 32 }) + 24;
  fillRect(64, y, W, h, NOTE_BG);
  fillRect(64, y, 3, h, NOTE);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NOTE)
     .text("Info:  ", 76, y + 9, { continued: true });
  doc.font("Helvetica").fontSize(9).fillColor(NOTE)
     .text(text, { width: W - 32, lineGap: 3 });
  doc.y = y + h + 8;
}

function code(lines) {
  checkSpace(lines.length * 13 + 24);
  const y = doc.y;
  const blockH = lines.length * 13 + 16;
  fillRect(64, y, W, blockH, CODE_BG);
  doc.font("Courier").fontSize(8).fillColor("#374151");
  lines.forEach((line, i) => {
    doc.text(line, 76, y + 8 + i * 13, { lineBreak: false });
  });
  doc.y = y + blockH + 8;
  doc.moveDown(0.2);
}

function drawTable(headers, rows, colWidths, compact = false) {
  const rowH = compact ? 17 : 20;
  const pad  = 5;
  const x0   = 64;
  checkSpace((rows.length + 1) * rowH + 12);
  let y = doc.y;

  let x = x0;
  colWidths.forEach((cw, i) => {
    fillRect(x, y, cw, rowH, NAVY);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
       .text(headers[i], x + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
    x += cw;
  });
  y += rowH;

  rows.forEach((row, ri) => {
    if (y + rowH > doc.page.height - 72) {
      doc.addPage(); y = doc.y;
      x = x0;
      colWidths.forEach((cw, i) => {
        doc.rect(x, y, cw, rowH).fill(NAVY);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
           .text(headers[i], x + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
        x += cw;
      });
      y += rowH;
    }
    const bg = ri % 2 === 1 ? XGRAY : WHITE;
    x = x0;
    colWidths.forEach((cw, ci) => {
      fillRect(x, y, cw, rowH, bg);
      doc.save().rect(x, y, cw, rowH).lineWidth(0.4).strokeColor(LGRAY).stroke().restore();
      doc.font("Helvetica").fontSize(8.5).fillColor(BLACK)
         .text(row[ci] || "", x + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
      x += cw;
    });
    y += rowH;
  });

  doc.y = y + 8;
  doc.moveDown(0.2);
}

function checklist(items) {
  items.forEach((item, i) => {
    checkSpace(20);
    const y = doc.y;
    doc.save().rect(64, y, 14, 14).lineWidth(0.75).strokeColor(NAVY).stroke().restore();
    // Number label — use fillColor only, no text call that shifts doc.y
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE)
       .text(`${i + 1}`, 68, y + 3, { width: 10, lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(BLACK)
       .text(item, 86, y + 1, { width: W - 22, lineGap: 3 });
    doc.moveDown(0.25);
  });
}

// ════════════════════════════════════════════════════════════
// COVER
// ════════════════════════════════════════════════════════════

doc.rect(0, 0, doc.page.width, 190).fill(NAVY);
doc.image(LOGO, 64, 28, { width: 75 });
doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE)
   .text("DOOH-AR  ·  dooh_web", 156, 34, { lineBreak: false });
doc.font("Helvetica-Bold").fontSize(26).fillColor(WHITE)
   .text("AR·DOOH", 156, 52, { lineBreak: false });
doc.font("Helvetica").fontSize(13).fillColor("rgba(255,255,255,0.55)")
   .text("Frontend & Application Specification", 156, 86, { lineBreak: false });
doc.moveTo(156, 108).lineTo(156 + 260, 108).strokeColor(BLUE).lineWidth(2).stroke();
doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.4)")
   .text("Version 1.0  ·  March 2026", 156, 116, { lineBreak: false });

doc.y = 208;

// ════════════════════════════════════════════════════════════
// 1. PURPOSE & SCOPE
// ════════════════════════════════════════════════════════════
section("1", "Purpose & Scope");
body("This document defines the frontend architecture, user flow, and screen specifications for AR·DOOH — a browser-based augmented reality web app that detects NYC landmarks through a device camera and overlays real-time AR information. It is written for both the client and the development team.");

subhead("What this document covers");
bullet("All 6 user-facing screens and how they connect");
bullet("UI elements, interaction states, and edge cases per screen");
bullet("Full application architecture — camera, detection, rendering");
bullet("Tech stack and environment setup");
bullet("Known risks and how to handle them");

doc.moveDown(0.2);
subhead("What is out of scope");
bullet("Backend / server infrastructure and model training");
bullet("CI/CD pipeline and deployment configuration");
bullet("Native mobile app (this is a web-only spec)");

// ════════════════════════════════════════════════════════════
// 2. APPLICATION OVERVIEW
// ════════════════════════════════════════════════════════════
section("2", "Application Overview");
body("AR·DOOH is a browser-based AR experience. Users point their device camera at a New York City landmark and the app identifies the building in real time, drawing a labeled AR overlay on screen. No download is required — it runs entirely in the browser.");

subhead("Detectable Landmarks");
drawTable(
  ["Building", "Location", "Overlay Color"],
  [
    ["World Trade Center", "Lower Manhattan", "#00f0ff  (cyan)"],
    ["The Edge",               "Hudson Yards",    "#ff6b00  (orange)"],
    ["Empire State Building",  "Midtown Manhattan","#a855f7  (purple)"],
  ],
  [170, 140, 154]
);

subhead("Tech Stack");
drawTable(
  ["Layer", "Technology", "Purpose"],
  [
    ["UI Framework",  "React + Vite",     "Component architecture and dev server"],
    ["Styling",       "Tailwind CSS",     "Responsive layout and utility classes"],
    ["AR Rendering",  "PixiJS",           "Canvas-based overlay drawn over live camera feed"],
    ["AI Detection",  "YOLOv8 (remote)",  "Building detection — runs on server, not on device"],
    ["Camera",        "getUserMedia API", "Browser camera access (requires HTTPS or localhost)"],
    ["Geolocation",   "Geolocation API",  "Optional proximity gate to Empire State Building"],
  ],
  [110, 140, 214]
);

// ════════════════════════════════════════════════════════════
// 3. DETECTION PIPELINE
// ════════════════════════════════════════════════════════════
section("3", "Detection Pipeline");
body("The detection system uses two independent loops running at different speeds so a slow server response never freezes the UI.");

subhead("Render Loop  (~30 fps)");
bullet("Runs via requestAnimationFrame — always smooth");
bullet("Reads the last known detections from a shared ref (lastDetectionsRef)");
bullet("Draws the video frame + cached bounding boxes + AR overlay via PixiJS");
bullet("Never waits for the server — uses whatever was last returned");

doc.moveDown(0.2);
subhead("Inference Loop  (async)");
bullet("Captures a JPEG frame from the video element");
bullet("POSTs it to the detection server at VITE_DETECT_URL");
bullet("Server returns building name, bounding box (x1, y1, x2, y2), and confidence %");
bullet("Result is written to lastDetectionsRef — picked up by the render loop next frame");
bullet("Loop runs continuously while the scanner is active; controlled by inferenceActiveRef");

doc.moveDown(0.2);
note("The two loops are fully decoupled. A 500ms server response does not cause a dropped frame. The render loop always draws at full speed using the last known detection.");

subhead("Detection Response Shape");
code([
  "// Server response format",
  "{",
  '  "detections": [',
  "    {",
  '      "label": "World Trade Center",          // building name',
  '      "confidence": 0.942,          // 0.0 – 1.0',
  '      "box": { "x1": 120, "y1": 80, "x2": 340, "y2": 420 }  // canvas pixels',
  "    }",
  "  ]",
  "}",
]);

// ════════════════════════════════════════════════════════════
// 4. USER FLOW
// ════════════════════════════════════════════════════════════
doc.addPage();
section("4", "User Flow");
body("The app guides users through 6 screens. The tutorial (screens 2–3) is optional and can be skipped from the welcome screen.");

drawTable(
  ["Screen", "Name", "Entry Trigger", "Exit Trigger"],
  [
    ["1", "Welcome",           "App load",                              "'Start Tutorial' → S2  |  'Skip' → S4"],
    ["2", "What You'll Need",  "'Start Tutorial' clicked",              "'Next' → S3"],
    ["3", "How It Works",      "'Next' from S2",                        "'Next' → S4"],
    ["4", "Camera Permission", "'Next' from S3  |  'Skip' from S1",    "Granted → S5  |  Denied → S6"],
    ["5", "Live Scanner",      "Camera permission granted",             "'Exit' → S1"],
    ["6", "Error",             "Camera permission denied or failed",    "'Try Again' → S4"],
  ],
  [32, 110, 170, 152]
);

// ════════════════════════════════════════════════════════════
// 5. SCREEN SPECIFICATIONS
// ════════════════════════════════════════════════════════════
section("5", "Screen Specifications");

// S1
subhead("Screen 1 — Welcome");
drawTable(
  ["Property", "Detail"],
  [
    ["State",   "step = 'welcome'"],
    ["Layout",  "Full-screen centered, dark background with subtle grid overlay"],
    ["Goal",    "Introduce the product and give the user two paths forward"],
  ],
  [100, 364]
);
bullet("App name 'AR·DOOH' — large bold heading with glitch text animation");
bullet("Subtitle: 'Landmark Detection System' — small caps, muted");
bullet("Primary button: 'Start Tutorial' → Screen 2");
bullet("Secondary link: 'Skip → Go straight to scanner' → Screen 4");
bullet("Model status indicator (bottom) — amber pulse = loading, green dot = ready");
bullet("Status indicator is non-blocking — user can proceed regardless", true);
doc.moveDown(0.3);

// S2
subhead("Screen 2 — What You'll Need");
drawTable(
  ["Property", "Detail"],
  [
    ["State",  "step = 'needs'"],
    ["Layout", "Centered card, max-width 480px, progress dots at top (1 of 3)"],
    ["Goal",   "Set expectations before asking for camera — reduces denials"],
  ],
  [100, 364]
);
bullet("A camera — 'Built-in or external, any webcam works'");
bullet("A NYC landmark — 'The Edge, World Trade Center, or Empire State Building'");
bullet("Good lighting — 'Works best outdoors or in well-lit spaces'");
bullet("'Next' button → Screen 3");
doc.moveDown(0.3);

// S3
subhead("Screen 3 — How It Works");
drawTable(
  ["Property", "Detail"],
  [
    ["State",  "step = 'how'"],
    ["Layout", "Centered card, max-width 480px, progress dots at top (2 of 3)"],
    ["Goal",   "Explain the 3-step process before camera access is requested"],
  ],
  [100, 364]
);
bullet("01 · Point — 'Aim your camera at a NYC landmark'");
bullet("02 · Detect — 'AI identifies the building in real-time'");
bullet("03 · Explore — 'See the name and confidence score overlaid on screen'");
bullet("'Next' button → Screen 4");
doc.moveDown(0.3);

// S4
subhead("Screen 4 — Camera Permission");
drawTable(
  ["Property", "Detail"],
  [
    ["State",    "step = 'permission'"],
    ["Layout",   "Centered card, max-width 480px, progress dots at top (3 of 3)"],
    ["Goal",     "Request camera access and handle both outcomes cleanly"],
    ["API call", "navigator.mediaDevices.getUserMedia({ video: true })"],
  ],
  [100, 364]
);
drawTable(
  ["State", "Trigger", "UI"],
  [
    ["Idle",    "Screen loads",          "'Allow Camera' button visible"],
    ["Loading", "Button clicked",        "Spinner shown, permission dialog appears"],
    ["Granted", "getUserMedia resolves", "Stream attached to video element → Screen 5"],
    ["Denied",  "getUserMedia rejects",  "Error stored → Screen 6"],
  ],
  [70, 160, 234]
);
warn("getUserMedia is called directly on button click — not inside a useEffect. This avoids React StrictMode double-invocation which would cause the permission dialog to fire twice and the camera to get stuck loading.");
doc.moveDown(0.3);

// S5
doc.addPage();
subhead("Screen 5 — Live Scanner");
drawTable(
  ["Property", "Detail"],
  [
    ["State",          "step = 'scanner'"],
    ["Layout",         "Full-screen, no scroll — camera feed fills the entire viewport"],
    ["Goal",           "Deliver the core AR detection experience"],
    ["Key components", "useCamera · useDetector · useDetectionLoop · usePixiOverlay"],
  ],
  [120, 344]
);

bullet("PixiJS canvas fills the full viewport — video element is hidden but live in the DOM");
bullet("Render loop composites: video frame + bounding boxes + AR overlay at ~30fps");
bullet("Inference loop sends frames to the server and writes results to a shared ref");
bullet("Exit button (bottom-center) stops the camera and returns to Screen 1");

doc.moveDown(0.2);
subhead("HUD Elements");
drawTable(
  ["Element", "Position", "Description"],
  [
    ["Status badge",   "Top-left",    "'Loading...' (amber) → 'Scanning...' (amber pulse) → 'Detected' (green)"],
    ["Wordmark",       "Top-right",   "AR·DOOH in low opacity — decorative"],
    ["Color legend",   "Bottom-right","Dot + name for each of the 3 buildings"],
    ["Exit button",    "Bottom-center","Stops camera, returns to Welcome screen"],
    ["Scan line",      "Full-width",  "Sweeping gradient line animates while no building detected"],
  ],
  [110, 110, 244]
);

subhead("Detection Overlay (per building)");
drawTable(
  ["Element", "Description"],
  [
    ["Bounding box",    "Solid colored rectangle drawn around the detected building"],
    ["Label",           "Building name + confidence score  e.g. 'World Trade Center  94.2%'"],
    ["Corner brackets", "L-shaped markers at each corner of the box — HUD feel"],
    ["Pulsing circle",  "Animated dot at building centroid — draws attention"],
    ["Info panel",      "Dark semi-transparent box above building with name and confidence"],
  ],
  [130, 334]
);

subhead("Scanner States");
drawTable(
  ["State", "Status Badge", "Scan Line", "Overlay"],
  [
    ["Model loading",       "'Loading model...' amber",  "Visible", "None"],
    ["Idle — no detection", "'Scanning...' amber pulse", "Visible", "None"],
    ["Landmark detected",   "'Landmark Detected' green", "Hidden",  "Bounding box + AR overlay"],
  ],
  [130, 145, 80, 109]
);
doc.moveDown(0.3);

// S6
subhead("Screen 6 — Error");
drawTable(
  ["Property", "Detail"],
  [
    ["State",   "step = 'error'"],
    ["Layout",  "Full-screen centered, red accent brackets"],
    ["Goal",    "Surface a clear, actionable error if camera fails"],
    ["Trigger", "getUserMedia() throws any error"],
  ],
  [100, 364]
);
bullet("Heading: 'Camera Blocked'");
bullet("Body: 'Allow camera access in your browser settings and try again.'");
bullet("Optional raw error message shown below for debugging");
bullet("'Try Again' button → returns to Screen 4");
doc.moveDown(0.2);
subhead("Common Browser Errors");
drawTable(
  ["Error", "Cause"],
  [
    ["NotAllowedError",  "User denied the browser permission dialog"],
    ["NotFoundError",    "No camera device found on the system"],
    ["NotReadableError", "Camera is currently in use by another app"],
    ["SecurityError",    "Page is not served over HTTPS (non-localhost)"],
  ],
  [160, 304]
);

// ════════════════════════════════════════════════════════════
// 6. ENVIRONMENT SETUP
// ════════════════════════════════════════════════════════════
doc.addPage();
section("6", "Environment Setup");

subhead("Environment Variables");
drawTable(
  ["Variable", "Purpose"],
  [
    ["VITE_DETECT_URL",    "Endpoint the app POSTs frames to for detection  (e.g. /api/detect)"],
    ["VITE_DETECT_KEY",    "Optional API key sent as x-api-key request header"],
    ["DETECT_API_BACKEND", "Backend server address used by the Vite proxy to forward requests"],
  ],
  [170, 294]
);

subhead("Local Setup");
code([
  "# 1. Copy environment file",
  "cp .env.example .env",
  "",
  "# 2. Install dependencies",
  "npm install",
  "",
  "# 3. Start dev server",
  "npm run dev",
  "# → App runs at http://localhost:8000 (or next available port)",
]);

warn("Camera access requires HTTPS or localhost. If you deploy to a non-HTTPS URL, getUserMedia will throw a SecurityError and the camera screen will never proceed.");

// ════════════════════════════════════════════════════════════
// 7. IMPLEMENTATION CHECKLIST
// ════════════════════════════════════════════════════════════
section("7", "Implementation Checklist");

checklist([
  "Set up .env file with VITE_DETECT_URL and DETECT_API_BACKEND",
  "Implement Welcome screen (step = 'welcome') with glitch animation on app name",
  "Implement What You'll Need screen (step = 'needs') with 3 requirement cards and progress dots",
  "Implement How It Works screen (step = 'how') with 3 numbered steps and progress dots",
  "Implement Camera Permission screen (step = 'permission') — call getUserMedia on button click, not in useEffect",
  "Implement Live Scanner screen (step = 'scanner') — full-screen PixiJS canvas over camera feed",
  "Wire up useDetectionLoop and usePixiOverlay to the scanner screen",
  "Implement scan line animation — visible when scanning, hidden when a building is detected",
  "Implement AR overlay per building — bounding box, label, corner brackets, pulsing circle",
  "Implement Error screen (step = 'error') with Try Again navigation back to Screen 4",
  "Test camera permission denial path — confirm Error screen appears correctly",
  "Test on mobile browser over HTTPS — confirm camera and detection work end to end",
]);

// ════════════════════════════════════════════════════════════
// 8. KNOWN RISKS
// ════════════════════════════════════════════════════════════
section("8", "Known Risks & Mitigations");

drawTable(
  ["Risk", "Mitigation"],
  [
    ["React StrictMode double-fires useEffect",   "Call getUserMedia directly on button click, not in a useEffect. Avoids the camera getting stuck in a loading state."],
    ["Slow inference server freezes UI",          "Use the two-loop architecture — render loop draws at 30fps from cache; inference loop updates cache independently."],
    ["Camera not available on HTTP",              "Serve the app over HTTPS in production. Localhost is exempt but any deployed URL must use SSL."],
    ["iOS Safari WebGL limitations",             "Test on iOS Safari early. Avoid heavy PixiJS filters on mobile. Keep canvas compositing simple for performance."],
    ["Model confidence too low / false positives","Tune the confidence threshold in the detection loop. Currently set to filter out results below a minimum score."],
    ["getUserMedia denied with no error message", "Always catch the getUserMedia promise and store the error. Display it on Screen 6 to help users self-diagnose."],
  ],
  [180, 284]
);

// ════════════════════════════════════════════════════════════
// 9. FUTURE ROADMAP
// ════════════════════════════════════════════════════════════
section("9", "Future Roadmap");

subhead("Phase 1 — Polish (immediate)");
bullet("Onboarding animations — screen transitions with fade/slide");
bullet("Haptic feedback on detection (mobile devices that support it)");
bullet("Sound cue when a landmark is first detected");

doc.moveDown(0.2);
subhead("Phase 2 — 3D AR");
bullet("Migrate PixiJS 2D overlay to Pixi3D for perspective-correct AR");
bullet("Billboard sprite labels that scale with distance");
bullet("glTF 3D models anchored to building centroids");

doc.moveDown(0.2);
subhead("Phase 3 — Content");
bullet("Per-building info panels — history, height, facts");
bullet("Multiple language support");
bullet("Share/screenshot functionality — save your AR detection moment");

// ════════════════════════════════════════════════════════════
// FOOTER
// ════════════════════════════════════════════════════════════
doc.moveDown(1.5);
doc.moveTo(64, doc.y).lineTo(64 + W, doc.y).strokeColor(LGRAY).lineWidth(0.5).stroke();
doc.moveDown(0.4);
doc.font("Helvetica").fontSize(8).fillColor(MGRAY)
   .text("AR·DOOH  ·  Frontend & Application Specification  ·  v1.0  ·  March 2026", { align: "center" });

doc.end();
doc.on("finish", () => console.log(`✅ ${OUT} written`));
