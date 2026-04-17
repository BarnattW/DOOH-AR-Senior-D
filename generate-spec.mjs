import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, PageBreak, Header, Footer,
} from "docx";
import { writeFileSync } from "fs";

// ── Helpers ────────────────────────────────────────────────────
const h1 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 100 },
});
const h2 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 80 },
});
const h3 = (text) => new Paragraph({
  text, heading: HeadingLevel.HEADING_3,
  spacing: { before: 160, after: 60 },
});
const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 22, font: "Calibri", ...opts })],
  spacing: { after: 100 },
});
const b = (text, sub = false) => new Paragraph({
  children: [new TextRun({ text, size: sub ? 20 : 22, font: "Calibri", color: sub ? "555555" : "111111" })],
  bullet: { level: sub ? 1 : 0 },
  spacing: { after: 70 },
});
const gap = (n = 1) => Array.from({ length: n }, () => new Paragraph({ text: "", spacing: { after: 80 } }));
const rule = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "dddddd" } },
  spacing: { after: 160 },
});

const cell = (text, header = false, shade = false, width) => new TableCell({
  children: [new Paragraph({
    children: [new TextRun({ text, size: 20, font: "Calibri", bold: header, color: header ? "ffffff" : "222222" })],
    spacing: { before: 60, after: 60 },
  })],
  shading: header
    ? { type: ShadingType.SOLID, color: "1a2e4a", fill: "1a2e4a" }
    : shade
    ? { type: ShadingType.SOLID, color: "f2f5fb", fill: "f2f5fb" }
    : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
});

const twoCol = (label, value) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [new TableRow({ children: [cell(label, false, true, 30), cell(value, false, false, 70)] })],
  margins: { bottom: 60 },
});

const screenTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ children: [cell("Property", true, false, 28), cell("Detail", true, false, 72)] }),
    ...rows.map(([k, v], i) => new TableRow({
      children: [cell(k, false, true, 28), cell(v, false, false, 72)],
    })),
  ],
});

// ── Document ───────────────────────────────────────────────────
const doc = new Document({
  creator: "AR·DOOH Team",
  title: "AR·DOOH Frontend Specification",
  styles: {
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 32, bold: true, color: "1a2e4a", font: "Calibri" },
        paragraph: { spacing: { before: 360, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1a2e4a", space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 26, bold: true, color: "1a2e4a", font: "Calibri" },
        paragraph: { spacing: { before: 240, after: 80 } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal",
        run: { size: 22, bold: true, color: "2a5faa", font: "Calibri" },
        paragraph: { spacing: { before: 160, after: 60 } } },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 900, bottom: 900, left: 1100, right: 1100 } } },
    headers: {
      default: new Header({ children: [new Paragraph({
        children: [
          new TextRun({ text: "AR·DOOH  ·  Frontend Flow Specification  ·  v1.0", size: 17, font: "Calibri", color: "999999" }),
          new TextRun({ text: "   |   Draft — March 2026", size: 17, font: "Calibri", color: "bbbbbb" }),
        ],
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "dddddd" } },
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        children: [new TextRun({ text: "Confidential  ·  AR·DOOH Team  ·  Not for external distribution", size: 16, font: "Calibri", color: "aaaaaa" })],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 3, color: "dddddd" } },
      })] }),
    },
    children: [

      // ── Title ─────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "AR·DOOH", size: 64, bold: true, font: "Calibri", color: "1a2e4a" })],
        alignment: AlignmentType.LEFT, spacing: { before: 200, after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Frontend Flow Specification", size: 30, font: "Calibri", color: "2a7fff" })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "Version 1.0  ·  Draft  ·  March 2026", size: 20, font: "Calibri", color: "888888", italics: true })],
        spacing: { after: 300 },
      }),
      rule(),

      // ── Purpose ───────────────────────────────────────────
      h1("Purpose"),
      p("This document defines the frontend user flow for AR·DOOH — a browser-based augmented reality web app that detects NYC landmarks (One WTC, The Edge, Empire State Building) through a device camera and overlays real-time AR information. It is intended as a reference for designers, frontend developers, and QA."),
      p("It covers: all 6 screens, their UI elements, interaction states, transitions, and edge cases."),
      ...gap(),
      rule(),

      // ── Flow Map ──────────────────────────────────────────
      h1("Flow Map"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell("Screen", true, false, 8), cell("Name", true, false, 22), cell("Entry Trigger", true, false, 35), cell("Exit Trigger", true, false, 35)] }),
          new TableRow({ children: [cell("1"), cell("Welcome"), cell("App load"), cell("'Start Tutorial' → Screen 2  |  'Skip' → Screen 4")] }),
          new TableRow({ children: [cell("2", false, true), cell("What You'll Need", false, true), cell("'Start Tutorial' clicked", false, true), cell("'Next' → Screen 3", false, true)] }),
          new TableRow({ children: [cell("3"), cell("How It Works"), cell("'Next' from Screen 2"), cell("'Next' → Screen 4")] }),
          new TableRow({ children: [cell("4", false, true), cell("Camera Permission", false, true), cell("'Next' from Screen 3  |  'Skip' from Screen 1", false, true), cell("Permission granted → Screen 5  |  Denied → Screen 6", false, true)] }),
          new TableRow({ children: [cell("5"), cell("Live Scanner"), cell("Camera permission granted"), cell("'Exit' → Screen 1")] }),
          new TableRow({ children: [cell("6", false, true), cell("Error", false, true), cell("Camera permission denied or failed", false, true), cell("'Try Again' → Screen 4", false, true)] }),
        ],
      }),
      ...gap(2),
      rule(),

      // ── Screen Specs ──────────────────────────────────────
      h1("Screen Specifications"),

      // ── S1 ────────────────────────────────────────────────
      h2("Screen 1 — Welcome"),
      screenTable([
        ["Route / State",   "step = 'welcome'"],
        ["Layout",          "Full-screen centered, dark background with subtle grid overlay"],
        ["Goal",            "Introduce the product and give the user two entry paths"],
      ]),
      ...gap(),
      h3("UI Elements"),
      b("App name: 'AR·DOOH'  —  large bold heading, glitch text animation"),
      b("Subtitle: 'Landmark Detection System'  —  small caps, muted"),
      b("Tagline: 'Discover NYC landmarks through your camera'  —  body text"),
      b("Primary button: 'Start Tutorial'"),
      b("→ navigates to Screen 2", true),
      b("Secondary link: 'Skip → Go straight to scanner'"),
      b("→ navigates directly to Screen 4, bypassing tutorial", true),
      b("Model status indicator  —  bottom of screen"),
      b("Amber pulse = model still loading in background", true),
      b("Green dot = model ready", true),
      b("Non-blocking, does not prevent user from proceeding", true),
      ...gap(),
      h3("Notes"),
      p("The ONNX/inference session begins loading silently as soon as the app opens. This gives the model a head start before the user reaches the scanner. The Welcome screen is the only place this status is surfaced."),
      ...gap(2),

      // ── S2 ────────────────────────────────────────────────
      h2("Screen 2 — What You'll Need"),
      screenTable([
        ["Route / State",   "step = 'needs'"],
        ["Layout",          "Centered card, max-width 480px, progress dots at top"],
        ["Goal",            "Set expectations — reduce camera permission denials"],
      ]),
      ...gap(),
      h3("UI Elements"),
      b("Progress dots: 3 dots, dot 1 filled/active"),
      b("Step label: 'Step 1 of 3'"),
      b("Heading: 'What You'll Need'"),
      b("Requirement cards (3):"),
      b("📷  A camera  —  'Built-in or external, any webcam works'", true),
      b("🏙️  A NYC landmark  —  'The Edge, One WTC, or Empire State Building'", true),
      b("☀️  Good lighting  —  'Works best outdoors or in well-lit spaces'", true),
      b("'Next' button  →  Screen 3"),
      ...gap(2),

      // ── S3 ────────────────────────────────────────────────
      h2("Screen 3 — How It Works"),
      screenTable([
        ["Route / State",   "step = 'how'"],
        ["Layout",          "Centered card, max-width 480px, progress dots at top"],
        ["Goal",            "Explain the 3-step AR process before camera access is requested"],
      ]),
      ...gap(),
      h3("UI Elements"),
      b("Progress dots: dot 2 active"),
      b("Step label: 'Step 2 of 3'"),
      b("Heading: 'How It Works'"),
      b("Numbered steps (3):"),
      b("01 · Point  —  'Aim your camera at a NYC landmark'", true),
      b("02 · Detect  —  'AI identifies the building in real-time using computer vision'", true),
      b("03 · Explore  —  'See the building name and confidence score overlaid on screen'", true),
      b("'Next' button  →  Screen 4"),
      ...gap(2),

      // ── S4 ────────────────────────────────────────────────
      h2("Screen 4 — Camera Permission"),
      screenTable([
        ["Route / State",   "step = 'permission'"],
        ["Layout",          "Centered card, max-width 480px, progress dots at top"],
        ["Goal",            "Request camera access cleanly and handle both outcomes"],
        ["API call",        "navigator.mediaDevices.getUserMedia({ video: true })"],
      ]),
      ...gap(),
      h3("UI Elements"),
      b("Progress dots: dot 3 active"),
      b("Step label: 'Step 3 of 3'"),
      b("Heading: 'Camera Access'"),
      b("Body copy: 'We need your camera to detect landmarks in real-time. No footage is recorded or stored.'"),
      b("'Allow Camera' button (idle state)"),
      b("Spinner + 'Waiting for permission...' (loading state — replaces button)"),
      ...gap(),
      h3("Interaction States"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell("State", true, false, 20), cell("Trigger", true, false, 40), cell("Outcome", true, false, 40)] }),
          new TableRow({ children: [cell("Idle"), cell("Screen loads"), cell("'Allow Camera' button visible")] }),
          new TableRow({ children: [cell("Loading", false, true), cell("Button clicked", false, true), cell("Spinner shown, getUserMedia called", false, true)] }),
          new TableRow({ children: [cell("Granted"), cell("getUserMedia resolves"), cell("Stream set on video element, navigate to Screen 5")] }),
          new TableRow({ children: [cell("Denied", false, true), cell("getUserMedia rejects", false, true), cell("Error message stored, navigate to Screen 6", false, true)] }),
        ],
      }),
      ...gap(),
      h3("Technical Detail"),
      p("getUserMedia is called directly on button click — not inside a useEffect. This avoids React StrictMode double-invocation issues. The Promise result (true/false) drives navigation directly, bypassing stale state closure bugs."),
      ...gap(2),

      new Paragraph({ children: [new PageBreak()] }),

      // ── S5 ────────────────────────────────────────────────
      h2("Screen 5 — Live Scanner"),
      screenTable([
        ["Route / State",   "step = 'scanner'"],
        ["Layout",          "Full-screen, no scroll — camera feed fills viewport"],
        ["Goal",            "Deliver the core AR detection experience"],
        ["Key components",  "useCamera · useDetector · useDetectionLoop · usePixiOverlay"],
      ]),
      ...gap(),
      h3("Canvas & Rendering"),
      b("PixiJS renders a canvas that fills the full viewport"),
      b("Camera video element is hidden (display: none) but kept in DOM as PixiJS texture source"),
      b("The canvas composites: live video frame + detection bounding boxes + AR overlay"),
      b("Render loop runs at ~30fps via requestAnimationFrame"),
      b("Detection loop runs independently — JPEG frames POSTed to inference server"),
      b("Last known detections are cached in a ref and redrawn every frame"),
      ...gap(),
      h3("HUD Elements"),
      b("Top-left: status badge"),
      b("'Loading model...'  —  amber  —  shown while inference session initialises", true),
      b("'Scanning...'  —  amber pulsing  —  model ready, no landmark in frame", true),
      b("'Landmark Detected'  —  green  —  one or more buildings detected", true),
      b("Top-right: 'AR·DOOH' wordmark (decorative, low opacity)"),
      b("Bottom-right: landmark legend"),
      b("● One WTC  (cyan  #00f0ff)", true),
      b("● The Edge  (orange  #ff6b00)", true),
      b("● Empire State Building  (purple  #a855f7)", true),
      b("Bottom-center: 'Exit' button  →  stops camera, returns to Screen 1"),
      ...gap(),
      h3("Idle Scanning Animation"),
      b("A horizontal gradient line sweeps top-to-bottom continuously (CSS animation, 2.8s loop)"),
      b("Disappears immediately when a landmark is detected"),
      b("Reappears when detection drops to zero"),
      ...gap(),
      h3("Detection Overlay (per building)"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell("Element", true, false, 35), cell("Description", true, false, 65)] }),
          new TableRow({ children: [cell("Bounding box"), cell("Solid colored rectangle around detected building")] }),
          new TableRow({ children: [cell("Label", false, true), cell("Building name + confidence score (e.g. 'One WTC  94.2%')", false, true)] }),
          new TableRow({ children: [cell("Corner brackets"), cell("4 corner L-shapes drawn outside bounding box — tactical/HUD feel")] }),
          new TableRow({ children: [cell("Pulsing circle", false, true), cell("Animated filled circle at building centroid — draws attention", false, true)] }),
          new TableRow({ children: [cell("Info panel"), cell("Dark semi-transparent box above building with name and confidence")] }),
        ],
      }),
      ...gap(),
      h3("Detection States"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell("State", true, false, 22), cell("Status Badge", true, false, 28), cell("Scan Line", true, false, 20), cell("Overlay", true, false, 30)] }),
          new TableRow({ children: [cell("Model loading"), cell("'Loading model...' amber"), cell("Visible"), cell("None")] }),
          new TableRow({ children: [cell("Idle — no detection", false, true), cell("'Scanning...' amber pulse", false, true), cell("Visible", false, true), cell("None", false, true)] }),
          new TableRow({ children: [cell("Landmark detected"), cell("'Landmark Detected' green"), cell("Hidden"), cell("Bounding box + AR overlay")] }),
        ],
      }),
      ...gap(2),

      // ── S6 ────────────────────────────────────────────────
      h2("Screen 6 — Error"),
      screenTable([
        ["Route / State",   "step = 'error'"],
        ["Layout",          "Full-screen centered, red accent brackets"],
        ["Goal",            "Surface a clear, actionable error when camera fails"],
        ["Trigger",         "getUserMedia() throws — permission denied, device unavailable, or insecure context"],
      ]),
      ...gap(),
      h3("UI Elements"),
      b("Warning triangle icon"),
      b("Heading: 'Camera Blocked'"),
      b("Body: 'Camera access was denied. Please allow camera access in your browser settings and try again.'"),
      b("Optional: displays raw error message from browser for debugging"),
      b("'Try Again' button  →  navigates back to Screen 4 and resets loading state"),
      ...gap(),
      h3("Common Error Causes"),
      b("NotAllowedError  —  user denied permission in browser dialog"),
      b("NotFoundError  —  no camera device found on the system"),
      b("NotReadableError  —  camera in use by another application"),
      b("SecurityError  —  page not served over HTTPS (non-localhost)"),
      ...gap(2),
      rule(),

      // ── Technical Notes ───────────────────────────────────
      h1("Technical Notes"),
      h3("Camera Initialisation"),
      p("getUserMedia is called directly (not via useCamera hook) on the permission screen to avoid React StrictMode issues with async useEffects. Once the stream resolves, it is attached to videoRef manually and the app navigates to the scanner."),
      ...gap(),
      h3("Detection Loop Architecture"),
      b("Render loop (requestAnimationFrame): draws video frame + cached detections at ~30fps"),
      b("Inference loop (async while loop): sends frames to server, updates cached detections"),
      b("The two loops are fully decoupled — a slow inference response never blocks rendering"),
      b("inferenceActiveRef (useRef) controls the loop lifecycle to avoid stale closures"),
      ...gap(),
      h3("Environment Variables"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell("Variable", true, false, 35), cell("Purpose", true, false, 65)] }),
          new TableRow({ children: [cell("VITE_DETECT_URL"), cell("Endpoint for the detection API (use /api/detect for proxy)")] }),
          new TableRow({ children: [cell("VITE_DETECT_KEY", false, true), cell("Optional API key sent as x-api-key header", false, true)] }),
          new TableRow({ children: [cell("DETECT_API_BACKEND"), cell("Backend URL used by Vite proxy to forward /api/detect requests")] }),
        ],
      }),
      ...gap(2),

      new Paragraph({
        children: [new TextRun({ text: "— End of Document —", size: 19, font: "Calibri", color: "bbbbbb", italics: true })],
        alignment: AlignmentType.CENTER, spacing: { before: 300 },
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("AR-DOOH-Frontend-Spec.docx", buffer);
console.log("✅ AR-DOOH-Frontend-Spec.docx written");
