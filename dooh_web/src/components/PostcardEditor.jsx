import { useCallback, useEffect, useRef, useState } from "react";

const BUILDING_DISPLAY = {
  "WTC": "One World Trade Center",
  "Empire State Building": "Empire State Building",
  "Hudson Yards - The Edge": "The Edge — Hudson Yards",
};
const BUILDING_KEYS = Object.keys(BUILDING_DISPLAY);

function getBuildingName(raw) {
  if (!raw) return null;
  return BUILDING_DISPLAY[raw] ?? raw;
}

const TEMPLATES = [
  { id: "split",  label: "Classic" },
  { id: "strip",  label: "Strip"   },
  { id: "border", label: "Border"  },
];

const W = 1200;
const H = 800;

let _fontsReady = null;
function ensureFonts() {
  if (_fontsReady) return _fontsReady;
  if (!document.getElementById("postcard-gfonts")) {
    const link = document.createElement("link");
    link.id = "postcard-gfonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }
  _fontsReady = Promise.allSettled([
    document.fonts.load("400 16px Caveat"),
    document.fonts.load("700 16px Caveat"),
    document.fonts.load("800 16px Syne"),
    document.fonts.load("600 16px DM Sans"),
  ]);
  return _fontsReady;
}

// ── Cover crop with pan/zoom ──────────────────────────────────────────────────
function drawCoverCropped(ctx, img, dx, dy, dw, dh, { panX = 0, panY = 0, scale = 1 } = {}) {
  const imgAR  = img.width / img.height;
  const destAR = dw / dh;
  let srcW, srcH;
  if (imgAR > destAR) { srcH = img.height / scale; srcW = srcH * destAR; }
  else                { srcW = img.width  / scale; srcH = srcW / destAR; }
  const maxPanX = (img.width  - srcW) / 2;
  const maxPanY = (img.height - srcH) / 2;
  const srcX = Math.max(0, Math.min(img.width  - srcW, img.width  / 2 - srcW / 2 + panX * maxPanX));
  const srcY = Math.max(0, Math.min(img.height - srcH, img.height / 2 - srcH / 2 + panY * maxPanY));
  ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function hRule(ctx, x, y, w, color = "#e4dcd4") {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.restore();
}

function vRule(ctx, x, y1, y2, color = "#e4dcd4") {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.restore();
}

function getWrappedLines(ctx, text, font, maxWidth) {
  ctx.font = font;
  const lines = []; let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawStamp(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#c0b8ae"; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]); ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.strokeStyle = "#dddddd"; ctx.lineWidth = 0.75;
  ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

  ctx.fillStyle = "#9a9490";
  ctx.font = "600 7px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NEW YORK", x + w / 2, y + 16);

  const bY = y + h - 22, bX = x + 8;
  ctx.globalAlpha = 0.5; ctx.fillStyle = "#9a9490";
  ctx.beginPath();
  const skyW = w - 16;
  [[0,0],[0,-11],[3,-11],[3,-17],[7,-17],[7,-13],[11,-13],[11,-20],[13,-23],[15,-20],[15,-13],
   [19,-13],[19,-17],[22,-17],[22,-10],[26,-10],[26,-15],[31,-15],[31,-10],[36,-10],[36,-16],
   [41,-16],[41,-13],[skyW,-13],[skyW,0]].forEach(([px, py], i) =>
    i === 0 ? ctx.moveTo(bX + px, bY + py) : ctx.lineTo(bX + px, bY + py)
  );
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#9a9490";
  ctx.font = "600 7px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FOREVER", x + w / 2, y + h - 7);
  ctx.restore();
}

function drawPostmark(ctx, cx, cy, r, date) {
  const color = "rgba(175,50,30,0.5)";
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r,     0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 6, 0, Math.PI * 2); ctx.stroke();
  const ds = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  ctx.textAlign = "center";
  ctx.font = "600 8px DM Sans, sans-serif"; ctx.fillText(ds,            cx, cy - 5);
  ctx.font = "500 7px DM Sans, sans-serif"; ctx.fillText("NEW YORK NY", cx, cy + 5);
                                            ctx.fillText("10001",        cx, cy + 14);
  ctx.restore();
}

// ── Shared back-panel renderer (used by Classic Split) ───────────────────────
function drawBackPanel(ctx, panelX, panelW, building, date, filterLabel, bgColor = "#fdf9f3") {
  ctx.fillStyle = bgColor;
  ctx.fillRect(panelX, 0, panelW, H);

  const pad  = 24;
  const stW  = 64, stH = 80;
  const stX  = panelX + panelW - pad - stW;
  const stY  = 20;
  const pmCX = panelX + pad + 34;
  const pmCY = stY + stH / 2;

  drawStamp(ctx, stX, stY, stW, stH);
  drawPostmark(ctx, pmCX, pmCY, 28, date);

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", panelX + panelW / 2, pmCY + 4);

  const ruleY = stY + stH + 14;
  hRule(ctx, panelX + pad, ruleY, panelW - pad * 2);

  const colPad = panelX + pad;
  const divX   = panelX + panelW * 0.52;
  const colW   = divX - colPad - 14;

  // ── Left column ───────────────────────────────────────────────────────────
  let ty = ruleY + 38;

  if (building) {
    const bFont = "800 24px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#2a2420"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 30; }
    ty += 6;
  }

  ctx.font = "500 11px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText("New York City, NY", colPad, ty); ty += 18;
  ctx.fillText(
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    colPad, ty
  ); ty += 14;

  if (filterLabel) {
    ctx.font = "400 15px Caveat, cursive";
    ctx.fillStyle = "rgba(175,50,30,0.65)";
    ctx.fillText("✶  " + filterLabel + " filter", colPad, ty + 14);
    ty += 28;
  }

  ty += 16;
  hRule(ctx, colPad, ty, colW, "#e4dcd4");
  ty += 16;

  ctx.font = "500 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b8ae"; ctx.textAlign = "left";
  ctx.fillText("40°44′N  73°59′W  ·  NEW YORK CITY", colPad, ty);
  ty += 22;

  hRule(ctx, colPad, ty, colW, "#e4dcd4");
  ty += 18;

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#b8b0a8"; ctx.textAlign = "left";
  ctx.fillText("M E S S A G E", colPad, ty);
  ty += 16;

  for (let i = 0; i < 9; i++) {
    hRule(ctx, colPad, ty + i * 34, colW, "#ddd5cc");
  }
  ty += 8 * 34 + 24;

  hRule(ctx, colPad, ty, colW, "#e4dcd4");
  ty += 22;

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c8c0b4"; ctx.textAlign = "left";
  ctx.fillText("G R E E T I N G S  F R O M", colPad, ty);
  ty += 24;
  ctx.font = "800 26px Syne, sans-serif";
  ctx.fillStyle = "#d4ccc4";
  ctx.fillText("NEW YORK", colPad, ty);

  ctx.font = "500 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c8c0b8"; ctx.textAlign = "left";
  ctx.fillText("DOOH AR  ·  NYC  ·  " + date.getFullYear(), colPad, H - 22);

  // ── Vertical divider ──────────────────────────────────────────────────────
  vRule(ctx, divX, ruleY + 14, H - 20);

  // ── Right column: address ─────────────────────────────────────────────────
  const rightX = divX + 14;
  const rightW = panelX + panelW - rightX - pad;
  let ry = ruleY + 30;

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "left";
  ctx.fillText("A D D R E S S", rightX, ry);
  ry += 22;

  ctx.font = "700 10px DM Sans, sans-serif";
  ctx.fillStyle = "#a09088";
  ctx.fillText("TO :", rightX, ry);
  ry += 30;

  const fields = ["NAME", "STREET", "CITY", "STATE / ZIP"];
  for (const field of fields) {
    ctx.font = "500 7px DM Sans, sans-serif";
    ctx.fillStyle = "#c8bcb0"; ctx.textAlign = "left";
    ctx.fillText(field, rightX, ry - 4);
    hRule(ctx, rightX, ry, rightW, "#d0c8c0");
    ry += 52;
  }

  ctx.font = "600 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8bca8"; ctx.textAlign = "center";
  ctx.fillText("NEW YORK, NY 10001", divX + (panelX + panelW - divX) / 2, H - 22);
}

// ── Template A: Classic Split ─────────────────────────────────────────────────
function drawSplit(ctx, img, building, date, transform, filterLabel) {
  const splitX = 696;
  drawCoverCropped(ctx, img, 0, 0, splitX, H, transform);

  if (building) {
    const g = ctx.createLinearGradient(0, H - 90, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, H - 90, splitX, 90);
    ctx.font = "400 18px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
    ctx.fillText(building, 18, H - 16);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#e0d8cc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, H); ctx.stroke();

  drawBackPanel(ctx, splitX, W - splitX, building, date, filterLabel, "#fdf9f3");
}

// ── Template B: Strip ─────────────────────────────────────────────────────────
function drawStrip(ctx, img, building, date, transform, filterLabel) {
  const photoH = 520;
  drawCoverCropped(ctx, img, 0, 0, W, photoH, transform);

  if (building) {
    const g = ctx.createLinearGradient(0, photoH - 90, 0, photoH);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, photoH - 90, W, 90);
    ctx.font = "400 18px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
    ctx.fillText(building, 20, photoH - 14);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#e0d8cc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, photoH); ctx.lineTo(W, photoH); ctx.stroke();

  const pad  = 24;
  const stW  = 64, stH = 72;
  const stX  = W - pad - stW;
  const stY  = photoH + 14;
  const pmCX = pad + 34;
  const pmCY = stY + stH / 2;

  ctx.fillStyle = "#fdf9f3"; ctx.fillRect(0, photoH, W, H - photoH);
  drawStamp(ctx, stX, stY, stW, stH);
  drawPostmark(ctx, pmCX, pmCY, 26, date);

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", W / 2, pmCY + 4);

  const ruleY = stY + stH + 10;
  hRule(ctx, pad, ruleY, W - pad * 2);

  const divX   = W * 0.52;
  const colPad = pad;
  const colW   = divX - colPad - 12;
  let ty = ruleY + 32;

  if (building) {
    const bFont = "800 20px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#2a2420"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 26; }
    ty += 4;
  }

  ctx.font = "500 10px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText(
    "New York City, NY  ·  " +
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase(),
    colPad, ty
  ); ty += 16;

  if (filterLabel) {
    ctx.font = "400 14px Caveat, cursive";
    ctx.fillStyle = "rgba(175,50,30,0.65)";
    ctx.fillText("✶  " + filterLabel + " filter", colPad, ty + 10);
    ty += 22;
  }

  ty += 10;
  hRule(ctx, colPad, ty, colW, "#e4dcd4");
  ty += 14;

  ctx.font = "500 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b8ae";
  ctx.fillText("40°44′N  73°59′W  ·  NEW YORK CITY", colPad, ty);
  ty += 18;

  hRule(ctx, colPad, ty, colW, "#e4dcd4");
  ty += 14;

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#b8b0a8";
  ctx.fillText("M E S S A G E", colPad, ty);
  ty += 14;

  const linesAvail = Math.floor((H - 18 - ty) / 28);
  for (let i = 0; i < Math.min(linesAvail, 3); i++) {
    hRule(ctx, colPad, ty + i * 28, colW, "#ddd5cc");
  }

  // Right column
  const rightX = divX + 14;
  const rightW = W - rightX - pad;
  let ry = ruleY + 28;

  ctx.font = "700 10px DM Sans, sans-serif";
  ctx.fillStyle = "#a09088"; ctx.textAlign = "left";
  ctx.fillText("TO :", rightX, ry); ry += 28;

  const stripFields = ["NAME", "STREET", "CITY / STATE / ZIP"];
  for (const field of stripFields) {
    ctx.font = "500 7px DM Sans, sans-serif";
    ctx.fillStyle = "#c8bcb0";
    ctx.fillText(field, rightX, ry - 4);
    hRule(ctx, rightX, ry, rightW, "#d0c8c0");
    ry += 38;
  }

  ctx.font = "600 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8bca8"; ctx.textAlign = "center";
  ctx.fillText("NEW YORK, NY 10001", divX + (W - divX) / 2, H - 18);
}

// ── Template C: Border ────────────────────────────────────────────────────────
function drawBorder(ctx, img, building, date, transform, filterLabel) {
  const framePad = 24;
  const backH    = 180;
  const photoX   = framePad;
  const photoY   = framePad;
  const photoW   = W - framePad * 2;
  const photoH   = H - framePad - backH;

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  drawCoverCropped(ctx, img, photoX, photoY, photoW, photoH, transform);

  hRule(ctx, framePad, photoY + photoH + 1, photoW, "#e8e0d8");

  const pad   = 20;
  const stW   = 60, stH = 66;
  const stX   = W - framePad - pad - stW;
  const stY   = photoY + photoH + 18;
  const pmCX  = framePad + pad + 30;
  const pmCY  = stY + stH / 2;

  drawStamp(ctx, stX, stY, stW, stH);
  drawPostmark(ctx, pmCX, pmCY, 24, date);

  ctx.font = "600 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", W / 2, pmCY + 4);

  const divX   = W * 0.52;
  const colPad = framePad + pad;
  const colW   = divX - colPad - 12;
  let ty = stY + 24;

  if (building) {
    const bFont = "800 19px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#1a1a1a"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 26; }
    ty += 4;
  }

  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  const filterPart = filterLabel ? "  ·  " + filterLabel : "";
  ctx.font = "500 10px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText("New York City, NY  ·  " + datePart + filterPart, colPad, ty);
  ty += 16;

  ctx.font = "500 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b8ae";
  ctx.fillText("40°44′N  73°59′W", colPad, ty);

  vRule(ctx, divX, photoY + photoH + 14, H - framePad + 4, "#e8e0d8");

  // Right column
  const rightX = divX + 14;
  const rightW = W - framePad - rightX;
  let ry = stY + 24;

  ctx.font = "700 10px DM Sans, sans-serif";
  ctx.fillStyle = "#a09088"; ctx.textAlign = "left";
  ctx.fillText("TO :", rightX, ry); ry += 28;

  const borderFields = ["NAME", "STREET", "CITY / STATE / ZIP"];
  for (const field of borderFields) {
    ctx.font = "500 7px DM Sans, sans-serif";
    ctx.fillStyle = "#c8bcb0";
    ctx.fillText(field, rightX, ry - 4);
    hRule(ctx, rightX, ry, rightW, "#d0c8c0");
    ry += 36;
  }
}

const DRAW_FNS = { split: drawSplit, strip: drawStrip, border: drawBorder };

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:          "#0d0a07",
  surface:     "rgba(255,255,255,0.04)",
  border:      "rgba(255,255,255,0.08)",
  borderMed:   "rgba(255,255,255,0.14)",
  accent:      "#b83020",
  accentMuted: "rgba(175,80,50,0.75)",
  accentGlow:  "rgba(175,80,50,0.18)",
  textPrimary: "rgba(255,255,255,0.88)",
  textSec:     "rgba(255,255,255,0.5)",
  textMuted:   "rgba(255,255,255,0.28)",
  syne:        "'Syne', sans-serif",
  dm:          "'DM Sans', sans-serif",
};

// ── Template thumbnail previews ───────────────────────────────────────────────
function TemplateThumbnail({ id, active }) {
  const border = `1.5px solid ${active ? "rgba(184,48,32,0.85)" : "rgba(255,255,255,0.1)"}`;
  const glow   = active ? "0 0 0 3px rgba(184,48,32,0.2)" : "none";
  const photo  = "linear-gradient(150deg, #7a6450 0%, #3c2a1a 100%)";
  const paper  = "#e8ddd0";

  const stamp = (w = 10, h = 13) => (
    <div style={{ width: w, height: h, background: "#fff", border: "0.5px solid #c0b4a8", flexShrink: 0 }} />
  );

  if (id === "split") return (
    <div style={{
      width: 78, height: 52, display: "flex", borderRadius: 5, overflow: "hidden",
      border, boxShadow: glow, transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      <div style={{ flex: "0 0 57%", background: photo }} />
      <div style={{ flex: 1, background: paper, display: "flex", flexDirection: "column", padding: "5px 5px 4px 4px", gap: 3 }}>
        <div style={{ marginLeft: "auto" }}>{stamp(10, 13)}</div>
        <div style={{ height: 1, background: "#d0c4b8", margin: "1px 0" }} />
        <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1, width: "85%" }} />
        <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1, width: "60%" }} />
      </div>
    </div>
  );

  if (id === "strip") return (
    <div style={{
      width: 78, height: 52, display: "flex", flexDirection: "column", borderRadius: 5, overflow: "hidden",
      border, boxShadow: glow, transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      <div style={{ flex: "0 0 62%", background: photo }} />
      <div style={{ flex: 1, background: paper, display: "flex", alignItems: "center", padding: "0 5px", gap: 5 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1 }} />
          <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1, width: "65%" }} />
        </div>
        {stamp(8, 11)}
      </div>
    </div>
  );

  if (id === "border") return (
    <div style={{
      width: 78, height: 52, borderRadius: 5, overflow: "hidden",
      background: "#fff", border, boxShadow: glow,
      padding: "4px 4px 0 4px", display: "flex", flexDirection: "column", gap: 2,
      transition: "box-shadow 0.2s, border-color 0.2s",
    }}>
      <div style={{ flex: 1, background: photo, borderRadius: "3px 3px 0 0" }} />
      <div style={{ height: 16, background: "#f0e8dc", display: "flex", alignItems: "center", padding: "0 4px", gap: 4 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1, width: "75%" }} />
          <div style={{ height: 2, background: "#cbbfb0", borderRadius: 1, width: "50%" }} />
        </div>
        {stamp(8, 10)}
      </div>
    </div>
  );

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PostcardEditor({ photo, onClose, onSaveToLibrary }) {
  const [activeTemplate,     setActiveTemplate]     = useState("split");
  const [selectedBuilding,   setSelectedBuilding]   = useState(photo.detectedBuilding ?? null);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [photoTransform,     setPhotoTransform]     = useState({ panX: 0, panY: 0, scale: 1 });
  const [cropMode,           setCropMode]           = useState(false);
  const [previewUrl,         setPreviewUrl]         = useState(null);
  const [saving,             setSaving]             = useState(false);
  const [libSaved,           setLibSaved]           = useState(false);

  const canvasRef    = useRef(null);
  const renderTimer  = useRef(null);
  const dragRef      = useRef(null);
  const transformRef = useRef(photoTransform);
  const imgCacheRef  = useRef(null);
  const rafRef       = useRef(null);

  useEffect(() => {
    ensureFonts().then(() => document.fonts.ready).then(() => {
      const img = new Image();
      img.src = photo.url;
      img.onload = () => { imgCacheRef.current = img; };
    });
  }, [photo.url]);

  useEffect(() => { transformRef.current = photoTransform; }, [photoTransform]);

  useEffect(() => {
    setPhotoTransform({ panX: 0, panY: 0, scale: 1 });
    setCropMode(false);
  }, [activeTemplate]);

  const renderLiveToCanvas = useCallback((transform) => {
    const canvas = canvasRef.current;
    const img    = imgCacheRef.current;
    if (!canvas || !img) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    DRAW_FNS[activeTemplate](ctx, img, getBuildingName(selectedBuilding), photo.capturedAt, transform, photo.filterLabel);
  }, [activeTemplate, selectedBuilding, photo.capturedAt, photo.filterLabel]);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    await ensureFonts();
    await document.fonts.ready;
    let img = imgCacheRef.current;
    if (!img) {
      img = new Image();
      img.src = photo.url;
      await new Promise((res) => { img.onload = res; img.onerror = res; });
      imgCacheRef.current = img;
    }
    DRAW_FNS[activeTemplate](ctx, img, getBuildingName(selectedBuilding), photo.capturedAt, photoTransform, photo.filterLabel);
    return canvas;
  }, [photo, activeTemplate, selectedBuilding, photoTransform]);

  useEffect(() => {
    let cancelled = false;
    clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(() => {
      render().then((canvas) => {
        if (!cancelled && canvas) setPreviewUrl(canvas.toDataURL("image/png"));
      });
    }, 180);
    return () => { cancelled = true; clearTimeout(renderTimer.current); };
  }, [render]);

  // ── Crop gesture handlers ──────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPanX: transformRef.current.panX,
      startPanY: transformRef.current.panY,
      w: e.currentTarget.offsetWidth,
      h: e.currentTarget.offsetHeight,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { startX, startY, startPanX, startPanY, w, h } = dragRef.current;
    const scale = transformRef.current.scale;
    const next = {
      ...transformRef.current,
      panX: Math.max(-1, Math.min(1, startPanX - (e.clientX - startX) / (w * 0.5) * scale)),
      panY: Math.max(-1, Math.min(1, startPanY - (e.clientY - startY) / (h * 0.5) * scale)),
    };
    transformRef.current = next;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => renderLiveToCanvas(next));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPhotoTransform(transformRef.current);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const next = {
      ...transformRef.current,
      scale: Math.max(1, Math.min(4, transformRef.current.scale + (e.deltaY > 0 ? -0.12 : 0.12))),
    };
    transformRef.current = next;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => renderLiveToCanvas(next));
    setPhotoTransform(next);
  };

  // ── Save / Share ───────────────────────────────────────────────────────────
  const renderBlob = async () => {
    const canvas = await render();
    if (!canvas) return null;
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  };

  const handleShare = async () => {
    setSaving(true);
    try {
      const blob = await renderBlob();
      if (!blob) return;
      const filename = `postcard-${Date.now()}.png`;
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "NYC Postcard" });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally { setSaving(false); }
  };

  const handleSaveToLibrary = async () => {
    setSaving(true);
    try {
      const blob = await renderBlob();
      if (!blob) return;
      onSaveToLibrary(blob);
      setLibSaved(true);
      setTimeout(() => setLibSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const scaleLabel    = photoTransform.scale === 1 ? "1×" : `${photoTransform.scale.toFixed(1)}×`;
  const buildingLabel = getBuildingName(selectedBuilding);

  return (
    <div className="absolute inset-0 z-30 flex flex-col text-white" style={{ background: S.bg }}>

      {/* Grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px",
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
        <button
          type="button" onClick={onClose} aria-label="Back"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: S.surface, border: `1px solid ${S.border}`, color: S.textSec }}
        >
          <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M10.5 3.5 6 8.5l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[9px] font-bold uppercase tracking-[0.45em]"
            style={{ color: S.accentMuted, fontFamily: S.syne }}
          >Postcard Studio</span>
          <span
            className="text-[15px] font-bold leading-none"
            style={{ color: S.textPrimary, fontFamily: S.syne }}
          >Create</span>
        </div>

        <div className="flex items-center gap-2">
          {onSaveToLibrary && (
            <button
              type="button" onClick={handleSaveToLibrary}
              disabled={saving || !previewUrl}
              className="h-9 rounded-full px-4 text-xs font-semibold transition active:scale-95 disabled:opacity-30"
              style={{
                border: libSaved ? "1px solid rgba(100,200,100,0.5)" : `1px solid ${S.borderMed}`,
                color:  libSaved ? "rgb(110,215,110)" : S.textSec,
                background: S.surface,
                fontFamily: S.dm,
              }}
            >{libSaved ? "✓ Saved" : "Library"}</button>
          )}
          <button
            type="button" onClick={handleShare}
            disabled={saving || !previewUrl}
            className="flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition active:scale-95 disabled:opacity-30"
            style={{
              background: saving ? "rgba(140,35,20,0.7)" : S.accent,
              color: "#fff",
              fontFamily: S.syne,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {saving ? "…" : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v7M2.5 4 6 1l3.5 3M1 10.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Postcard preview */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 py-3">
        {previewUrl && !cropMode && (
          <div
            className="postcard-enter w-full"
            style={{
              maxHeight: "100%",
              borderRadius: 6,
              border: "1px solid rgba(90,65,40,0.35)",
              boxShadow: "0 48px 96px rgba(0,0,0,0.65), 0 16px 40px rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
          >
            <img
              src={previewUrl}
              alt="Postcard preview"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            display: cropMode ? "block" : "none",
            maxHeight: "100%",
            width: "100%",
            borderRadius: 6,
            border: "1px solid rgba(90,65,40,0.35)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.55)",
          }}
        />

        {!previewUrl && !cropMode && (
          <div
            className="h-48 w-full animate-pulse rounded-lg"
            style={{ background: "rgba(90,65,40,0.12)", border: "1px solid rgba(90,65,40,0.2)" }}
          />
        )}

        {cropMode && (
          <>
            <div
              className="absolute inset-5 rounded-lg"
              style={{ cursor: "grab", touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            />
            <div
              className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs"
              style={{
                background: "rgba(13,10,7,0.8)",
                color: S.textSec,
                border: `1px solid ${S.border}`,
                backdropFilter: "blur(8px)",
                fontFamily: S.dm,
              }}
            >drag to pan · scroll to zoom · {scaleLabel}</div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10">
        {cropMode ? (
          <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-5">
            <div className="flex items-center gap-3">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.3em]"
                style={{ color: S.textMuted, fontFamily: S.syne }}
              >Zoom</span>
              <button
                type="button"
                onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.max(1, p.scale - 0.25) }))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition active:scale-90"
                style={{ border: `1px solid ${S.border}`, color: S.textSec, background: S.surface }}
              >−</button>
              <span
                className="min-w-[3rem] text-center text-sm font-bold"
                style={{ color: S.textPrimary, fontFamily: S.syne }}
              >{scaleLabel}</span>
              <button
                type="button"
                onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.min(4, p.scale + 0.25) }))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition active:scale-90"
                style={{ border: `1px solid ${S.border}`, color: S.textSec, background: S.surface }}
              >+</button>
              <button
                type="button"
                onClick={() => setPhotoTransform({ panX: 0, panY: 0, scale: 1 })}
                className="ml-auto text-xs transition active:opacity-50"
                style={{ color: S.textMuted, fontFamily: S.dm }}
              >Reset</button>
            </div>
            <button
              type="button"
              onClick={() => setCropMode(false)}
              className="w-full rounded-xl py-3 text-sm font-bold transition active:scale-[0.98]"
              style={{
                background: S.surface,
                color: S.textPrimary,
                border: `1px solid ${S.border}`,
                fontFamily: S.syne,
                letterSpacing: "0.05em",
              }}
            >Done Cropping</button>
          </div>
        ) : (
          <>
            {/* Building + crop row */}
            <div
              className="mx-4 mb-3 flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: S.surface, border: `1px solid ${S.border}` }}
            >
              <div>
                <div
                  className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.35em]"
                  style={{ color: S.accentMuted, fontFamily: S.syne }}
                >Building</div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: buildingLabel ? S.textPrimary : S.textMuted, fontFamily: S.syne }}
                >{buildingLabel ?? "None detected"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBuildingPicker(p => !p)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                  style={{ border: `1px solid ${S.border}`, color: S.textSec, background: "transparent", fontFamily: S.dm }}
                >Change</button>
                <button
                  type="button"
                  onClick={() => { renderLiveToCanvas(transformRef.current); setCropMode(true); }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                  style={{ border: `1px solid ${S.border}`, color: S.textSec, background: "transparent", fontFamily: S.dm }}
                >Crop</button>
              </div>
            </div>

            {/* Building picker */}
            {showBuildingPicker && (
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {[null, ...BUILDING_KEYS].map((key) => {
                  const isActive = selectedBuilding === key;
                  return (
                    <button
                      key={key ?? "none"}
                      type="button"
                      onClick={() => { setSelectedBuilding(key); setShowBuildingPicker(false); }}
                      className="rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95"
                      style={{
                        border:      isActive ? "1px solid rgba(184,48,32,0.7)" : `1px solid ${S.border}`,
                        color:       isActive ? "rgba(220,120,90,0.95)"          : S.textSec,
                        background:  isActive ? S.accentGlow                     : "transparent",
                        fontFamily: S.dm,
                      }}
                    >{key === null ? "None" : BUILDING_DISPLAY[key]}</button>
                  );
                })}
              </div>
            )}

            {/* Template picker */}
            <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-5">
              <div
                className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.35em]"
                style={{ color: S.textMuted, fontFamily: S.syne }}
              >Layout</div>
              <div className="flex gap-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTemplate(t.id)}
                    className="flex flex-shrink-0 flex-col items-center gap-2 transition active:scale-95"
                  >
                    <TemplateThumbnail id={t.id} active={activeTemplate === t.id} />
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.2em] transition-colors"
                      style={{
                        color:      activeTemplate === t.id ? "rgba(220,110,80,0.9)" : S.textMuted,
                        fontFamily: S.syne,
                      }}
                    >{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
