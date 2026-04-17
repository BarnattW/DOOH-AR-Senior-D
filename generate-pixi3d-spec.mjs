import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";

const OUT  = "Pixi2D-to-Pixi3D-Spec.pdf";
const LOGO = "dooh_web/public/logos/logo-lens.jpg";

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 60, bottom: 60, left: 64, right: 64 },
  info: { Title: "Pixi2D → Pixi3D Transition Specification", Author: "AR·DOOH Team" },
});
doc.pipe(createWriteStream(OUT));

const W     = doc.page.width - 128;
const NAVY  = "#1a2e4a";
const BLUE  = "#2a7fff";
const LGRAY = "#e5e7eb";
const MGRAY = "#6b7280";
const BLACK = "#1f2937";
const WHITE = "#ffffff";
const XGRAY = "#f7f8fa";
const CODE_BG = "#f3f4f6";
const WARN  = "#92400e";
const WARN_BG = "#fffbeb";
const WARN_BORDER = "#f59e0b";
const GREEN = "#065f46";
const GREEN_BG = "#ecfdf5";

let currentPage = 1;

// ── Helpers ────────────────────────────────────────────────

function checkSpace(needed = 60) {
  if (doc.y + needed > doc.page.height - 72) {
    doc.addPage();
    currentPage++;
  }
}

function section(num, title) {
  checkSpace(80);
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(64, y, 3, 22).fill(BLUE);
  doc.font("Helvetica-Bold").fontSize(14).fillColor(NAVY)
     .text(`${num}.  ${title}`, 76, y + 2, { lineBreak: false });
  doc.moveDown(0.2);
  doc.moveTo(64, doc.y).lineTo(64 + W, doc.y).strokeColor(LGRAY).lineWidth(0.75).stroke();
  doc.moveDown(0.5);
}

function subhead(text) {
  checkSpace(40);
  doc.moveDown(0.35)
     .font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
     .text(text);
  doc.moveDown(0.1);
}

function body(text) {
  doc.font("Helvetica").fontSize(10).fillColor(BLACK)
     .text(text, { lineGap: 4 });
  doc.moveDown(0.2);
}

function bullet(text, sub = false) {
  const indent = sub ? 28 : 12;
  const mark   = sub ? "–" : "·";
  doc.font("Helvetica").fontSize(10).fillColor(BLACK)
     .text(`${mark}  ${text}`, { indent, lineGap: 3 });
}

function warn(text) {
  checkSpace(50);
  const y = doc.y;
  const h = doc.heightOfString(text, { width: W - 24 }) + 20;
  doc.rect(64, y, W, h).fill(WARN_BG);
  doc.rect(64, y, 3, h).fill(WARN_BORDER);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(WARN)
     .text("⚠  Warning:  ", 76, y + 8, { continued: true, lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(WARN)
     .text(text, { width: W - 24, lineGap: 3 });
  doc.y = y + h + 6;
  doc.moveDown(0.3);
}

function note(text) {
  checkSpace(50);
  const y = doc.y;
  const h = doc.heightOfString(text, { width: W - 24 }) + 20;
  doc.rect(64, y, W, h).fill(GREEN_BG);
  doc.rect(64, y, 3, h).fill(GREEN);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN)
     .text("Note:  ", 76, y + 8, { continued: true, lineBreak: false });
  doc.font("Helvetica").fontSize(9).fillColor(GREEN)
     .text(text, { width: W - 24, lineGap: 3 });
  doc.y = y + h + 6;
  doc.moveDown(0.3);
}

function code(lines) {
  checkSpace(lines.length * 13 + 24);
  const y = doc.y;
  const blockH = lines.length * 13 + 16;
  doc.rect(64, y, W, blockH).fill(CODE_BG);
  doc.font("Courier").fontSize(8).fillColor("#374151");
  lines.forEach((line, i) => {
    doc.text(line, 76, y + 8 + i * 13, { lineBreak: false });
  });
  doc.y = y + blockH + 6;
  doc.moveDown(0.3);
}

function drawTable(headers, rows, colWidths, compact = false) {
  const rowH = compact ? 17 : 20;
  const pad  = 5;
  const x0   = 64;
  checkSpace((rows.length + 1) * rowH + 12);
  let y = doc.y;

  // header
  let x = x0;
  colWidths.forEach((cw, i) => {
    doc.rect(x, y, cw, rowH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
       .text(headers[i], x + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
    x += cw;
  });
  y += rowH;

  rows.forEach((row, ri) => {
    if (y + rowH > doc.page.height - 72) {
      doc.addPage(); currentPage++;
      y = doc.y;
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
      doc.rect(x, y, cw, rowH).fill(bg).stroke(LGRAY).lineWidth(0.4);
      const val = row[ci] || "";
      const isCode = val.startsWith("npm ") || val.includes("(") || val.startsWith("import") || val.startsWith("PIXI") || val.startsWith("^");
      doc.font(isCode ? "Courier" : "Helvetica").fontSize(8.5).fillColor(BLACK)
         .text(val, x + pad, y + pad, { width: cw - pad * 2, lineBreak: false });
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
    doc.rect(64, y, 14, 14).stroke(NAVY).lineWidth(0.75);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE)
       .text(`${i + 1}`, 68, y + 2.5, { lineBreak: false });
    doc.font("Helvetica").fontSize(10).fillColor(BLACK)
       .text(item, 86, y + 1, { width: W - 22, lineGap: 3 });
    doc.moveDown(0.25);
  });
}

// ════════════════════════════════════════════════════════════
// COVER PAGE
// ════════════════════════════════════════════════════════════

doc.rect(0, 0, doc.page.width, 190).fill(NAVY);
doc.image(LOGO, 64, 28, { width: 75 });

doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE)
   .text("DOOH-AR  ·  dooh_web", 156, 34, { lineBreak: false });
doc.font("Helvetica-Bold").fontSize(26).fillColor(WHITE)
   .text("Pixi2D → Pixi3D", 156, 52, { lineBreak: false });
doc.font("Helvetica").fontSize(13).fillColor("rgba(255,255,255,0.55)")
   .text("Transition Specification", 156, 86, { lineBreak: false });
doc.moveTo(156, 108).lineTo(156 + 240, 108).strokeColor(BLUE).lineWidth(2).stroke();
doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.4)")
   .text("Version 1.0  ·  March 2026", 156, 116, { lineBreak: false });

doc.y = 208;

// ════════════════════════════════════════════════════════════
// 1. PURPOSE & SCOPE
// ════════════════════════════════════════════════════════════
section("1", "Purpose & Scope");
body("This document specifies the complete migration path for the dooh_web folder of the DOOH-AR-Senior-D project from its current PixiJS 2D-only rendering stack to Pixi3D, unlocking true 3D AR capabilities (billboard sprites, glTF models, perspective-correct overlays) while preserving all existing filter logic, detection pipeline, and React component architecture.");

subhead("What stays the same");
bullet("React/Vite project structure and component tree");
bullet("ONNX-based building detector (Detector, useDetectionLoop)");
bullet("Camera abstraction (useCamera, Camera component)");
bullet("Geolocation gate (useGeolocation, isNearLandmark)");
bullet("FilterPicker UI component");
bullet("Filter module contract — each filter exports id, label, and draw()");

doc.moveDown(0.2);
subhead("What changes");
bullet("usePixiOverlay — rewired to bootstrap a Pixi3D-aware stage");
bullet("Stage layer model — effectSprite replaced by a Pixi3D Container3D layer");
bullet("Filter draw() signature — receives a Container3D instead of a flat PIXI.Graphics + textContainer pair");
bullet("package.json — adds pixi3d, pins pixi.js to v7");

// ════════════════════════════════════════════════════════════
// 2. LIBRARY VERSIONS
// ════════════════════════════════════════════════════════════
section("2", "Library Versions & Compatibility");
warn("Pixi3D 2.5.0 (the current latest) targets PixiJS v5, v6, and v7. PixiJS v8 introduced breaking API changes (async init, canvas instead of view) and Pixi3D does not yet support it. Pin pixi.js to ^7.4.2 for this migration.");

drawTable(
  ["Package", "Version / Notes"],
  [
    ["pixi.js",          "^7.4.2 — must NOT upgrade to v8 while on Pixi3D 2.x"],
    ["pixi3d",           "^2.5.0 — import from \"pixi3d/pixi7\""],
    ["@pixi/filter-*",   "Any v5/v6/v7-compatible filter packages remain compatible"],
    ["onnxruntime-web",  "No change"],
    ["React / Vite",     "No change"],
  ],
  [160, 304]
);

subhead("Install command");
code(["npm install pixi.js@^7.4.2 pixi3d"]);

// ════════════════════════════════════════════════════════════
// 3. ARCHITECTURE
// ════════════════════════════════════════════════════════════
section("3", "Architecture: Current vs Target");

subhead("3.1  Current Stage Layers (PixiJS 2D only)");
drawTable(
  ["Layer", "Object", "Purpose"],
  [
    ["0", "bgSprite",      "Full-frame video background (no effects)"],
    ["1", "maskGfx",       "PIXI.Graphics rectangle — clip mask for effectSprite"],
    ["2", "effectSprite",  "Same video texture masked to bounding box; 2D pixel filters applied"],
    ["3", "decorGfx",      "PIXI.Graphics cleared each frame; 2D line decorations"],
    ["4", "textContainer", "PIXI.Container of PIXI.Text nodes; cleared each frame"],
  ],
  [40, 130, 294]
);

subhead("3.2  Target Stage Layers (Pixi3D)");
drawTable(
  ["Layer", "Object", "Purpose"],
  [
    ["0", "bgSprite",               "Full-frame video background — unchanged from current"],
    ["1", "maskGfx + effectSprite", "PIXI 2D masked region for pixel-shader filters — unchanged"],
    ["2", "scene3d (Container3D)",  "NEW — Pixi3D scene graph root; perspective camera anchored to bounding box"],
    ["3", "decorGfx (PIXI.Graphics)","Flat 2D vector decorations on top of 3D scene — unchanged contract"],
    ["4", "textContainer",          "PIXI.Text labels — unchanged from current"],
  ],
  [40, 160, 264]
);

// ════════════════════════════════════════════════════════════
// 4. API MAPPING
// ════════════════════════════════════════════════════════════
doc.addPage(); currentPage++;
section("4", "API Mapping: PIXI 2D → Pixi3D");
body("The table below covers every Pixi2D construct currently used in the codebase and its Pixi3D equivalent.");

drawTable(
  ["Current (PIXI 2D)", "Target (Pixi3D)", "Notes"],
  [
    ["import * as PIXI from \"pixi.js\"",  "import * as PIXI from \"pixi.js\"\nimport * as PIXI3D from \"pixi3d/pixi7\"", "Both imports required side-by-side"],
    ["PIXI.Application({})",              "PIXI.Application({}) — unchanged",    "Pixi3D uses the same PIXI.Application object"],
    ["PIXI.Container",                    "PIXI3D.Container3D",                   "Root 3D scene node; add to app.stage as usual"],
    ["PIXI.Sprite (video)",               "PIXI.Sprite (video)",                  "bgSprite and effectSprite stay as 2D sprites"],
    ["PIXI.Graphics (decorGfx)",          "PIXI.Graphics (decorGfx)",             "2D vector decorations remain on top"],
    ["PIXI.Text / PIXI.TextStyle",        "PIXI.Text / PIXI.TextStyle",           "Labels remain 2D PIXI.Text in textContainer"],
    ["n/a (2D only)",                     "PIXI3D.Mesh3D.createPlane()",          "Flat plane anchored to bounding box"],
    ["n/a",                               "PIXI3D.Model.from(gltf)",              "Load glTF 3D model via PIXI.Assets.load()"],
    ["n/a",                               "PIXI3D.Sprite3D",                      "Billboard sprite in 3D space (always faces camera)"],
    ["n/a",                               "PIXI3D.Camera.main",                   "Perspective camera; use worldToScreen / screenToWorld"],
    ["n/a",                               "PIXI3D.Light",                         "Point/directional light; add to LightingEnvironment.main"],
    ["PIXI.Filter subclass",              "PIXI.Filter subclass (unchanged)",     "2D pixel filters still apply to effectSprite"],
    ["app.ticker.add(fn)",                "app.ticker.add(fn) — unchanged",       "Pixi3D auto-renders within the same ticker loop"],
  ],
  [148, 168, 148],
  true
);

// ════════════════════════════════════════════════════════════
// 5. FILE-BY-FILE CHANGES
// ════════════════════════════════════════════════════════════
section("5", "File-by-File Changes");

subhead("5.1  hooks/usePixiOverlay.js  (PRIMARY CHANGE)");
note("This is the only hook that needs a meaningful rewrite. All other hooks are unchanged.");
body("Replace the current 2D-only init() body with the following structure:");

code([
  "import * as PIXI   from 'pixi.js';",
  "import * as PIXI3D from 'pixi3d/pixi7';",
  "",
  "function init() {",
  "  const app = new PIXI.Application({",
  "    view: canvas, width: video.videoWidth || 640,",
  "    height: video.videoHeight || 480,",
  "    antialias: true, backgroundColor: 0x000000,",
  "  });",
  "  appRef.current = app;",
  "",
  "  // Layer 0+1+2: video bg + masked effect sprite (unchanged)",
  "  const videoResource = new PIXI.VideoResource(video, { autoPlay: false });",
  "  const videoTex = new PIXI.Texture(new PIXI.BaseTexture(videoResource));",
  "  const bgSprite = new PIXI.Sprite(videoTex);",
  "  bgSprite.width = app.screen.width; bgSprite.height = app.screen.height;",
  "  app.stage.addChild(bgSprite);",
  "  const maskGfx = new PIXI.Graphics();",
  "  const effectSprite = new PIXI.Sprite(videoTex);",
  "  effectSprite.mask = maskGfx;",
  "  app.stage.addChild(maskGfx); app.stage.addChild(effectSprite);",
  "",
  "  // Layer 3: Pixi3D scene",
  "  const scene3d = app.stage.addChild(new PIXI3D.Container3D());",
  "",
  "  // Layer 4+5: 2D decorations & text (unchanged)",
  "  const decorGfx = new PIXI.Graphics();",
  "  app.stage.addChild(decorGfx);",
  "  const textContainer = new PIXI.Container();",
  "  app.stage.addChild(textContainer);",
  "",
  "  // Render loop",
  "  app.ticker.add(() => {",
  "    // ... pixel filter + mask update (unchanged) ...",
  "    scene3d.removeChildren();",
  "    if (filter.draw3d && detections.length > 0)",
  "      filter.draw3d(scene3d, detections, time, app.screen);",
  "    decorGfx.clear(); textContainer.removeChildren();",
  "    if (filter.draw && detections.length > 0)",
  "      filter.draw(decorGfx, textContainer, detections, time, app.screen);",
  "  });",
  "}",
]);

doc.addPage(); currentPage++;

subhead("5.2  filters/*.jsx  (Additive — no breaking changes)");
body("Each filter module gains an optional draw3d() export. The existing draw() export keeps working exactly as before — legacy 2D filters require zero changes.");

subhead("New optional filter API:");
code([
  "// New optional export — gives access to the Pixi3D scene Container3D",
  "// scene3d   : PIXI3D.Container3D — scene root, cleared each frame",
  "// detections: array of detection objects (same shape as always)",
  "// time      : seconds (app.ticker.lastTime / 1000)",
  "// screen    : PIXI.Rectangle (app.screen)",
  "export function draw3d(scene3d, detections, time, screen) {",
  "  const det = detections[0];",
  "  const { x1, y1, x2, y2 } = det.box;",
  "",
  "  if (cachedModel) {",
  "    const instance = scene3d.addChild(PIXI3D.Model.from(cachedGltf));",
  "    const cx = (x1 + x2) / 2;",
  "    const cy = (y1 + y2) / 2;",
  "    const worldPos = PIXI3D.Camera.main.screenToWorld(cx, cy, 5);",
  "    instance.position.set(worldPos.x, worldPos.y, worldPos.z);",
  "    instance.rotationQuaternion.setEulerAngles(0, time * 45, 0);",
  "  }",
  "}",
]);

subhead("Example: cyber.jsx with draw3d() addition");
body("The existing draw() is kept verbatim. A draw3d() function is added alongside it:");
code([
  "import * as PIXI3D from 'pixi3d/pixi7';",
  "",
  "// Keep all existing draw() code unchanged ...",
  "",
  "export function draw3d(scene3d, detections, time, screen) {",
  "  const { x1, y1, x2, y2 } = detections[0].box;",
  "  const cx = (x1 + x2) / 2;",
  "  const cy = (y1 + y2) / 2;",
  "",
  "  // Billboard sprite — always faces the camera",
  "  const sprite = scene3d.addChild(new PIXI3D.Sprite3D(cyberTexture));",
  "  const wp = PIXI3D.Camera.main.screenToWorld(cx, cy - 80, 3);",
  "  sprite.position.set(wp.x, wp.y, wp.z);",
  "  sprite.scale.set(0.4 + Math.sin(time * 2) * 0.05);",
  "}",
]);

subhead("5.3  All Other Files — No Changes Required");
body("The following files require zero modifications:");

const noChange = [
  "src/App.jsx",
  "src/components/camera/Camera.jsx and useCamera.js",
  "src/components/ai/Detector.js",
  "src/hooks/useDetectionLoop.js",
  "src/hooks/useGeolocation.js",
  "src/components/CameraControls.jsx",
  "src/components/FilterPicker.jsx",
  "src/components/LocationStatus.jsx",
  "src/util/geolocation.js",
  "src/filters/index.js (filters/FILTERS array)",
];
noChange.forEach(f => bullet(f));

// ════════════════════════════════════════════════════════════
// 6. LOADING glTF ASSETS
// ════════════════════════════════════════════════════════════
doc.addPage(); currentPage++;
section("6", "Loading glTF 3D Assets");
body("Pixi3D uses the glTF 2.0 format. Assets should be loaded once (outside the render loop) using PIXI.Assets:");

code([
  "import * as PIXI   from 'pixi.js';",
  "import * as PIXI3D from 'pixi3d/pixi7';",
  "",
  "// Load once — e.g. in a filter module at module scope",
  "let buildingModelGltf = null;",
  "",
  "export async function preload() {",
  "  buildingModelGltf = await PIXI.Assets.load('/assets/building-marker.gltf');",
  "}",
  "",
  "// Then inside draw3d():",
  "if (buildingModelGltf) {",
  "  const model = scene3d.addChild(PIXI3D.Model.from(buildingModelGltf));",
  "  model.position.set(worldX, worldY, worldZ);",
  "}",
]);

body("Place .gltf and .bin files under public/assets/ so Vite serves them as static assets.");
warn("scene3d.removeChildren() is called every frame. Do not add heavy glTF models inside the render loop without instancing. Either use a persistent model that you update each frame (position, rotation) instead of re-adding it, or use PIXI3D instancing for repeated meshes.");

// ════════════════════════════════════════════════════════════
// 7. CAMERA & COORDINATE SYSTEM
// ════════════════════════════════════════════════════════════
section("7", "Camera & Coordinate System");

subhead("7.1  Bridging Screen Space to 3D World Space");
body("The YOLO detector outputs bounding boxes in pixel/canvas coordinates (x1, y1, x2, y2 relative to the PixiJS canvas). Pixi3D's Camera.main provides two helpers to cross between spaces:");

drawTable(
  ["Method", "Use"],
  [
    ["Camera.main.screenToWorld(x, y, depth)", "Convert a canvas pixel to a 3D world point at the given depth. Use to place 3D objects above detected buildings."],
    ["Camera.main.worldToScreen(x3d, y3d, z3d)", "Convert a 3D world position back to a 2D screen pixel. Use to pin 2D text labels at the projected top of a 3D object."],
  ],
  [200, 264]
);

subhead("7.2  Recommended Camera Setup");
code([
  "// After scene3d is added to the stage:",
  "PIXI3D.Camera.main.fieldOfView = 60; // degrees — tune to match device FOV",
  "",
  "// Keep camera at origin looking down -Z (default)",
  "// Objects placed via screenToWorld(cx, cy, depth) will appear",
  "// correctly positioned over the detected bounding box.",
]);

// ════════════════════════════════════════════════════════════
// 8. MIGRATION CHECKLIST
// ════════════════════════════════════════════════════════════
section("8", "Step-by-Step Migration Checklist");

checklist([
  "Install updated packages:  npm install pixi.js@^7.4.2 pixi3d",
  "Verify pixi.js version is 7.x in node_modules",
  "Update usePixiOverlay.js — add scene3d Container3D layer per Section 5.1. Keep all existing bgSprite / maskGfx / effectSprite / decorGfx / textContainer code intact.",
  "Add scene3d pass to render loop: call filter.draw3d() if it exists; keep the filter.draw() call unchanged for backward compatibility.",
  "Smoke-test existing filters: run the app, switch through all filters, confirm no visual regression. The 2D path through draw() must be identical to pre-migration.",
  "Add draw3d() to one filter (e.g., cyber.jsx) using a simple Mesh3D.createPlane() or Sprite3D — confirm 3D object renders and is positioned correctly over the detected building.",
  "Add public/assets/ directory; place your first .gltf model there.",
  "Implement preload() in the target filter module; call it from usePixiOverlay init() using PIXI.Assets.",
  "Load glTF model in draw3d(); position via Camera.main.screenToWorld().",
  "Iterate filter by filter — each one can add draw3d() independently at its own pace.",
]);

// ════════════════════════════════════════════════════════════
// 9. KNOWN CONSTRAINTS & RISKS
// ════════════════════════════════════════════════════════════
doc.addPage(); currentPage++;
section("9", "Known Constraints & Risks");

drawTable(
  ["Constraint", "Mitigation"],
  [
    ["Pixi3D max PixiJS v7",          "Pin pixi.js to ^7.4.2. Do not upgrade to v8 until Pixi3D publishes v8 support. Monitor github.com/jnsmalm/pixi3d releases."],
    ["No pixi3d v8 support yet",      "Alternative: if v8 is required, substitute pixi3d with Three.js as an overlay canvas using the PixiJS + Three.js mixing pattern."],
    ["scene3d.removeChildren() overhead", "If a 3D model is persistent, lift it out of the loop: add once, mutate transform each frame rather than re-adding."],
    ["Mobile WebGL constraints",      "Pixi3D uses WebGL2 by default. Test on iOS Safari (WebGL1 fallback available). Avoid complex PBR materials on mobile."],
    ["Camera depth calibration",      "screenToWorld() depth parameter is abstract. Start at depth=5 and tune empirically until overlay aligns with the building footprint."],
    ["glTF asset size / load time",   "Keep .gltf models under 500 KB for mobile. Use Draco compression in Blender export and enable the PIXI3D Draco decoder if needed."],
  ],
  [160, 304]
);

// ════════════════════════════════════════════════════════════
// 10. FEATURE ROADMAP
// ════════════════════════════════════════════════════════════
section("10", "3D Feature Roadmap (Post-Migration)");
body("Once the baseline Pixi3D integration is stable, the following 3D AR capabilities become available:");

subhead("Phase 1 — Flat 3D (immediate)");
bullet("Sprite3D billboard labels — replace PIXI.Text with perspective-scaled 3D sprites");
bullet("Mesh3D.createPlane() floor decals — project flat plane textures onto the ground at the building footprint");
bullet("Animated glTF icons — spinning logos or markers above the detected centroid");

doc.moveDown(0.2);
subhead("Phase 2 — Spatial AR");
bullet("glTF building annotation models — floating name cards that always face the camera (Sprite3D)");
bullet("Shadow casting — configure PIXI3D.ShadowCastingLight with a StandardPipeline");
bullet("Custom GLSL materials — subclass Material for custom shader effects on 3D geometry");

doc.moveDown(0.2);
subhead("Phase 3 — Advanced");
bullet("Skeletal animation — animate characters or structural walkthroughs tied to detection confidence");
bullet("Image-based lighting (IBL) — use PIXI3D.ImageBasedLighting with a Cubemap for realistic ambient light");
bullet("Multiple building instances — PIXI3D instancing for rendering many markers simultaneously at low GPU cost");

// ════════════════════════════════════════════════════════════
// FOOTER
// ════════════════════════════════════════════════════════════
doc.moveDown(1.5);
doc.moveTo(64, doc.y).lineTo(64 + W, doc.y).strokeColor(LGRAY).lineWidth(0.5).stroke();
doc.moveDown(0.4);
doc.font("Helvetica").fontSize(8).fillColor(MGRAY)
   .text("AR·DOOH  ·  Pixi2D → Pixi3D Transition Spec  ·  v1.0  ·  March 2026", { align: "center" });

doc.end();
doc.on("finish", () => console.log(`✅ ${OUT} written`));
