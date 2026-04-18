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
  { id: "classic",   label: "Classic",   bg: "linear-gradient(135deg,#ece3d8 0%,#d8cfc4 100%)" },
  { id: "panoramic", label: "Panoramic", bg: "linear-gradient(135deg,#d8e4ec 0%,#c4d4e0 100%)" },
  { id: "print",     label: "Print",     bg: "linear-gradient(135deg,#e8d8be 0%,#d4c4a0 100%)" },
  { id: "flipped",   label: "Flipped",   bg: "linear-gradient(135deg,#f0ece4 0%,#e4ddd4 100%)" },
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
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Syne:wght@700&family=DM+Sans:wght@400;500&display=swap";
    document.head.appendChild(link);
  }
  _fontsReady = Promise.allSettled([
    document.fonts.load("400 16px Caveat"),
    document.fonts.load("700 16px Caveat"),
    document.fonts.load("700 16px Syne"),
    document.fonts.load("500 16px DM Sans"),
  ]);
  return _fontsReady;
}

// ─── drawCoverCropped ─────────────────────────────────────────────────────────
// Object-fit cover with pan (panX/panY in [-1,1]) and zoom (scale ≥ 1)
function drawCoverCropped(ctx, img, dx, dy, dw, dh, { panX = 0, panY = 0, scale = 1 } = {}) {
  const imgAR  = img.width / img.height;
  const destAR = dw / dh;

  // Source rect that fits the destination at 1× (cover)
  let srcW, srcH;
  if (imgAR > destAR) {
    srcH = img.height / scale;
    srcW = srcH * destAR;
  } else {
    srcW = img.width / scale;
    srcH = srcW / destAR;
  }

  // Max pan range (pixels in source image space)
  const maxPanX = (img.width  - srcW) / 2;
  const maxPanY = (img.height - srcH) / 2;

  const srcX = Math.max(0, Math.min(img.width  - srcW, img.width  / 2 - srcW / 2 + panX * maxPanX));
  const srcY = Math.max(0, Math.min(img.height - srcH, img.height / 2 - srcH / 2 + panY * maxPanY));

  ctx.drawImage(img, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
}

// ─── Stamp ────────────────────────────────────────────────────────────────────
function drawStamp(ctx, x, y, w, h, variant = "default") {
  const borderColor = variant === "red"   ? "#c04040" : variant === "sepia" ? "#9a7a50" : "#c0b8ae";
  const bgColor     = variant === "sepia" ? "#fdf6e8" : "#ffffff";
  const textColor   = variant === "red"   ? "#c04040" : variant === "sepia" ? "#9a7a50" : "#9a9490";
  const innerBorder = variant === "red"   ? "#e08080" : variant === "sepia" ? "#c8a870" : "#dddddd";

  ctx.save();
  ctx.fillStyle = bgColor;   ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = borderColor; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);   ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.strokeStyle = innerBorder; ctx.lineWidth = 0.75;
  ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);

  ctx.fillStyle = textColor;
  ctx.font = "bold 8px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NEW YORK", x + w / 2, y + 19);

  // Skyline
  const bY = y + h - 26, bX = x + 8;
  ctx.globalAlpha = 0.5; ctx.fillStyle = textColor;
  ctx.beginPath();
  const skyW = w - 16;
  [[0,0],[0,-13],[4,-13],[4,-20],[8,-20],[8,-16],[13,-16],[13,-24],[15,-27],[17,-24],[17,-16],
   [22,-16],[22,-20],[26,-20],[26,-12],[31,-12],[31,-18],[37,-18],[37,-12],[43,-12],[43,-19],
   [49,-19],[49,-16],[skyW,-16],[skyW,0]].forEach(([px, py], i) =>
    i === 0 ? ctx.moveTo(bX + px, bY + py) : ctx.lineTo(bX + px, bY + py)
  );
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = textColor;
  ctx.font = "bold 8px DM Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FOREVER", x + w / 2, y + h - 9);
  ctx.restore();
}

// ─── Postmark ─────────────────────────────────────────────────────────────────
function drawPostmark(ctx, cx, cy, r, date, variant = "default") {
  const color = variant === "sepia" ? "rgba(120,80,30,0.55)" : "rgba(175,50,30,0.5)";
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r,     0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, Math.PI * 2); ctx.stroke();
  const ds = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  ctx.textAlign = "center";
  ctx.font = "bold 9px DM Sans, sans-serif"; ctx.fillText(ds,           cx, cy - 6);
  ctx.font = "8px DM Sans, sans-serif";      ctx.fillText("NEW YORK NY",cx, cy + 5);
                                             ctx.fillText("10001",       cx, cy + 15);
  ctx.restore();
}

function hRule(ctx, x, y, w, color = "#e4dcd4") {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.restore();
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
function getWrappedLines(ctx, text, font, maxWidth) {
  ctx.font = font;
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Info panel (Classic / Flipped / Print right side) ────────────────────────
// Vertically centers building name + caption in the space between the rule and date.
function drawInfoPanel(ctx, panelX, panelW, photo, caption, date, variant = "default") {
  const pad  = 26;
  const cx   = panelX + panelW / 2;
  const rX   = panelX + pad;
  const rW   = panelW - pad * 2;
  const stW  = 86, stH = 106;
  const stX  = panelX + panelW - pad - stW;
  const stY  = 18;

  drawStamp(ctx, stX, stY, stW, stH, variant);
  drawPostmark(ctx, rX + 38, stY + stH / 2, 36, date, variant);

  ctx.font = "bold 9px DM Sans, sans-serif";
  ctx.fillStyle = variant === "sepia" ? "#b0a080" : "#c8c0b8";
  ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", cx, stY + stH / 2 + 5);

  const ruleY = stY + stH + 16;
  hRule(ctx, rX, ruleY, rW, variant === "sepia" ? "#c8bca8" : "#e4dcd4");

  // Two-pass: measure content height, then draw centered
  const building      = getBuildingName(photo.detectedBuilding);
  const buildingFont  = "bold 26px Syne, sans-serif";
  const captionFont   = "400 26px Caveat, cursive";
  const lineH         = 34;
  const gap           = 16;
  const maxW          = rW - 8;

  const bLines = building     ? getWrappedLines(ctx, building,         buildingFont, maxW) : [];
  const cLines = caption.trim() ? getWrappedLines(ctx, caption.trim(), captionFont,  maxW) : [];

  const totalH = bLines.length * lineH
    + (bLines.length && cLines.length ? gap : 0)
    + cLines.length * lineH;

  const contentTop    = ruleY + 20;
  const contentBottom = H - 48;
  let ty = contentTop + ((contentBottom - contentTop) - totalH) / 2 + lineH;

  if (bLines.length) {
    ctx.font = buildingFont;
    ctx.fillStyle = variant === "sepia" ? "#4a3a28" : "#3a3228";
    ctx.textAlign = "center";
    for (const l of bLines) { ctx.fillText(l, cx, ty); ty += lineH; }
    if (cLines.length) ty += gap;
  }

  if (cLines.length) {
    ctx.font = captionFont;
    ctx.fillStyle = variant === "sepia" ? "#6a5a40" : "#5a5048";
    ctx.textAlign = "center";
    for (const l of cLines) { ctx.fillText(l, cx, ty); ty += lineH; }
  }

  ctx.font = "bold 11px DM Sans, sans-serif";
  ctx.fillStyle = variant === "sepia" ? "#b0a080" : "#c0b4a8";
  ctx.textAlign = "right";
  ctx.fillText(
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    panelX + panelW - pad, H - 18
  );
}

// ─── Template A: Classic ─────────────────────────────────────────────────────
function drawClassic(ctx, img, photo, caption, transform) {
  const splitX = 700;
  drawCoverCropped(ctx, img, 0, 0, splitX, H, transform);

  const tag = getBuildingName(photo.detectedBuilding);
  if (tag) {
    const g = ctx.createLinearGradient(0, H - 80, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.44)");
    ctx.fillStyle = g; ctx.fillRect(0, H - 80, splitX, 80);
    ctx.font = "400 20px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
    ctx.fillText(tag, 20, H - 18);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#d8d0c8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, H); ctx.stroke();
  ctx.fillStyle = "#fdf9f4";
  ctx.fillRect(splitX, 0, W - splitX, H);

  drawInfoPanel(ctx, splitX, W - splitX, photo, caption, photo.capturedAt, "default");
}

// ─── Template B: Panoramic ────────────────────────────────────────────────────
function drawPanoramic(ctx, img, photo, caption, transform) {
  const photoH = 476, splitX = 720, pad = 22;

  drawCoverCropped(ctx, img, 0, 0, W, photoH, transform);

  const tag = getBuildingName(photo.detectedBuilding);
  if (tag) {
    ctx.font = "400 20px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 5;
    ctx.fillText(tag, 20, photoH - 14);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#d8d0c8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, photoH); ctx.lineTo(W, photoH); ctx.stroke();
  ctx.fillStyle = "#fdf9f4"; ctx.fillRect(0, photoH, W, H - photoH);

  // Bottom-left: ruled message lines
  const msgX = pad, msgW = splitX - pad * 2;
  const lineCount = 4;
  const usableH   = H - photoH - pad * 2;
  const lineStep  = Math.floor(usableH / (lineCount + 0.5));
  const firstLineY = photoH + pad + lineStep;

  ctx.font = "bold 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c8c0b8"; ctx.textAlign = "left";
  ctx.fillText("MESSAGE", msgX, photoH + pad + 12);

  const wrappedLines = [];
  let cur = "";
  ctx.font = "400 24px Caveat, cursive";
  for (const word of caption.trim().split(" ").filter(Boolean)) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > msgW && cur) { wrappedLines.push(cur); cur = word; }
    else { cur = test; }
  }
  if (cur) wrappedLines.push(cur);

  for (let i = 0; i < lineCount; i++) {
    const ly = firstLineY + i * lineStep;
    hRule(ctx, msgX, ly, msgW, "#e0d8d0");
    if (wrappedLines[i]) {
      ctx.font = "400 24px Caveat, cursive";
      ctx.fillStyle = "#3a2e22"; ctx.textAlign = "left";
      ctx.fillText(wrappedLines[i], msgX, ly);
    }
  }

  ctx.strokeStyle = "#d8d0c8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, photoH); ctx.lineTo(splitX, H); ctx.stroke();

  // Bottom-right: stamp + info
  const adX = splitX + pad, adW = W - splitX - pad * 2;
  const stW = 72, stH = 88, stX = W - pad - stW, stY = photoH + 14;

  drawStamp(ctx, stX, stY, stW, stH);
  drawPostmark(ctx, adX + 32, stY + stH / 2, 30, photo.capturedAt);

  ctx.font = "bold 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8c0b8"; ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", splitX + (W - splitX) / 2, stY + stH / 2 + 5);

  hRule(ctx, adX, stY + stH + 12, adW);

  const building = getBuildingName(photo.detectedBuilding);
  let infoY = stY + stH + 36;
  if (building) {
    ctx.font = "bold 18px Syne, sans-serif";
    ctx.fillStyle = "#3a3228"; ctx.textAlign = "left";
    const bLines = getWrappedLines(ctx, building, "bold 18px Syne, sans-serif", adW);
    for (const l of bLines) { ctx.fillText(l, adX, infoY); infoY += 24; }
    infoY += 6;
  }

  ctx.font = "bold 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "right";
  ctx.fillText(
    photo.capturedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    W - pad, H - 12
  );
}

// ─── Template C: Print ────────────────────────────────────────────────────────
function drawPrint(ctx, img, photo, caption, transform) {
  const outerPad = 20, splitX = 820, captionH = 50;

  ctx.fillStyle = "#f4ede0"; ctx.fillRect(0, 0, W, H);

  const pX = outerPad, pY = outerPad;
  const pW = splitX - outerPad;
  const pH = H - outerPad * 2 - captionH;
  drawCoverCropped(ctx, img, pX, pY, pW, pH, transform);

  ctx.strokeStyle = "#c8bca8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, outerPad); ctx.lineTo(splitX, H - outerPad); ctx.stroke();

  // Caption + building name centered in right info panel
  drawInfoPanel(ctx, splitX, W - splitX - outerPad, photo, caption, photo.capturedAt, "sepia");

  // Bottom rule under photo
  hRule(ctx, pX, pY + pH + 10, pW, "#c8bca8");
}

// ─── Template D: Flipped ──────────────────────────────────────────────────────
function drawFlipped(ctx, img, photo, caption, transform) {
  const splitX = 460, pad = 26;

  ctx.fillStyle = "#fdf9f4"; ctx.fillRect(0, 0, splitX, H);

  const stW = 82, stH = 100;
  const stX = splitX - pad - stW, stY = 20;
  drawStamp(ctx, stX, stY, stW, stH);
  drawPostmark(ctx, pad + 38, stY + stH / 2, 34, photo.capturedAt);

  ctx.font = "bold 8px DM Sans, sans-serif";
  ctx.fillStyle = "#c8c0b8"; ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", splitX / 2, stY + stH / 2 + 4);

  const ruleY = stY + stH + 14;
  hRule(ctx, pad, ruleY, splitX - pad * 2);

  // Two-pass centering for flipped panel
  const building     = getBuildingName(photo.detectedBuilding);
  const buildingFont = "bold 24px Syne, sans-serif";
  const captionFont  = "400 22px Caveat, cursive";
  const lineH = 30, gap = 14, maxW = splitX - pad * 2;

  const bLines = building       ? getWrappedLines(ctx, building,        buildingFont, maxW) : [];
  const cLines = caption.trim() ? getWrappedLines(ctx, caption.trim(),  captionFont,  maxW) : [];

  const totalH = bLines.length * lineH + (bLines.length && cLines.length ? gap : 0) + cLines.length * lineH;
  const contentTop    = ruleY + 20;
  const contentBottom = H - 48;
  let ty = contentTop + ((contentBottom - contentTop) - totalH) / 2 + lineH;

  if (bLines.length) {
    ctx.font = buildingFont; ctx.fillStyle = "#3a3228"; ctx.textAlign = "center";
    for (const l of bLines) { ctx.fillText(l, splitX / 2, ty); ty += lineH; }
    if (cLines.length) ty += gap;
  }
  if (cLines.length) {
    ctx.font = captionFont; ctx.fillStyle = "#5a5048"; ctx.textAlign = "center";
    for (const l of cLines) { ctx.fillText(l, splitX / 2, ty); ty += lineH; }
  }

  ctx.font = "bold 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c0b4a8"; ctx.textAlign = "center";
  ctx.fillText(
    photo.capturedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    splitX / 2, H - 18
  );

  ctx.strokeStyle = "#d8d0c8"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, H); ctx.stroke();

  drawCoverCropped(ctx, img, splitX, 0, W - splitX, H, transform);
}

const DRAW_FNS = { classic: drawClassic, panoramic: drawPanoramic, print: drawPrint, flipped: drawFlipped };

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostcardEditor({ photo, onClose, onSaveToLibrary }) {
  const [activeTemplate,   setActiveTemplate]   = useState("classic");
  const [caption,          setCaption]          = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState(photo.detectedBuilding ?? null);
  const [photoTransform,   setPhotoTransform]   = useState({ panX: 0, panY: 0, scale: 1 });
  const [cropMode,       setCropMode]       = useState(false);
  const [previewUrl,     setPreviewUrl]     = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [rendering,      setRendering]      = useState(false);
  const [libSaved,       setLibSaved]       = useState(false);

  const canvasRef   = useRef(null);
  const renderTimer = useRef(null);
  const dragRef     = useRef(null);

  // Reset crop when switching templates
  useEffect(() => {
    setPhotoTransform({ panX: 0, panY: 0, scale: 1 });
    setCropMode(false);
  }, [activeTemplate]);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    await ensureFonts();
    await document.fonts.ready;
    const img = new Image();
    img.src = photo.url;
    await new Promise((res) => { img.onload = res; img.onerror = res; });
    const photoWithBuilding = { ...photo, detectedBuilding: selectedBuilding };
    DRAW_FNS[activeTemplate](ctx, img, photoWithBuilding, caption, photoTransform);
    return canvas;
  }, [photo, activeTemplate, caption, photoTransform, selectedBuilding]);

  // Debounced re-render — longer window while typing avoids rapid redraws
  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(() => {
      render().then((canvas) => {
        if (!cancelled && canvas) setPreviewUrl(canvas.toDataURL("image/png"));
        if (!cancelled) setRendering(false);
      });
    }, 220);
    return () => { cancelled = true; clearTimeout(renderTimer.current); };
  }, [render]);

  // ── Crop interaction ────────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX:    e.clientX,
      startY:    e.clientY,
      startPanX: photoTransform.panX,
      startPanY: photoTransform.panY,
      w: e.currentTarget.offsetWidth,
      h: e.currentTarget.offsetHeight,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { startX, startY, startPanX, startPanY, w, h } = dragRef.current;
    // Dragging the full width/height = full pan range (±1), modulated by zoom
    const dPanX = -(e.clientX - startX) / (w * 0.5) * photoTransform.scale;
    const dPanY = -(e.clientY - startY) / (h * 0.5) * photoTransform.scale;
    setPhotoTransform(prev => ({
      ...prev,
      panX: Math.max(-1, Math.min(1, startPanX + dPanX)),
      panY: Math.max(-1, Math.min(1, startPanY + dPanY)),
    }));
  };

  const handlePointerUp = () => { dragRef.current = null; };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setPhotoTransform(prev => ({ ...prev, scale: Math.max(1, Math.min(4, prev.scale + delta)) }));
  };

  // ── Save handlers ───────────────────────────────────────────────────────────
  const renderBlob = async () => {
    const canvas = await render();
    if (!canvas) return null;
    return new Promise((res) => canvas.toBlob(res, "image/png"));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const blob = await renderBlob();
      if (!blob) return;
      const filename = `postcard-${Date.now()}.png`;
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
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

  const scaleLabel = photoTransform.scale === 1 ? "1×" : `${photoTransform.scale.toFixed(1)}×`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/95 text-white backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5">
        <button
          type="button" onClick={onClose} aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition active:scale-95"
        >←</button>
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">Create</div>
          <div className="text-sm text-white/85">Postcard</div>
        </div>
        <div className="flex items-center gap-2">
          {onSaveToLibrary && (
            <button
              type="button" onClick={handleSaveToLibrary}
              disabled={saving || !previewUrl || rendering}
              className="rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40"
              style={{
                borderColor: libSaved ? "rgba(100,210,100,0.6)" : "rgba(255,255,255,0.25)",
                color:       libSaved ? "rgb(100,210,100)"       : "rgba(255,255,255,0.8)",
              }}
            >{libSaved ? "Saved ✓" : "Library"}</button>
          )}
          <button
            type="button" onClick={handleSave}
            disabled={saving || !previewUrl || rendering}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-40"
          >{saving ? "…" : "Save"}</button>
        </div>
      </div>

      {/* Preview — no opacity flicker; crop overlay when active */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {previewUrl ? (
          <img
            src={previewUrl} alt="Postcard preview"
            className="max-h-full w-full rounded-lg object-contain shadow-2xl shadow-black/60"
          />
        ) : (
          <div className="h-48 w-full animate-pulse rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        )}

        {/* Transparent drag layer for crop */}
        {cropMode && (
          <div
            className="absolute inset-4 rounded-lg"
            style={{ cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />
        )}

        {/* Crop mode badge */}
        {cropMode && (
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}
          >
            drag to pan · scroll to zoom · {scaleLabel}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls — crop toolbar or caption + templates */}
      {cropMode ? (
        <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-5">
          {/* Zoom row */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Zoom
            </span>
            <button
              type="button"
              onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.max(1, p.scale - 0.25) }))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 text-lg leading-none active:scale-95"
            >−</button>
            <span className="min-w-[3rem] text-center text-sm font-semibold text-white/80">{scaleLabel}</span>
            <button
              type="button"
              onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.min(4, p.scale + 0.25) }))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 text-lg leading-none active:scale-95"
            >+</button>
            <button
              type="button"
              onClick={() => setPhotoTransform({ panX: 0, panY: 0, scale: 1 })}
              className="ml-auto text-xs text-white/40 active:text-white/70"
            >Reset</button>
          </div>
          <button
            type="button"
            onClick={() => setCropMode(false)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
          >Done Cropping</button>
        </div>
      ) : (
        <>
          {/* Caption + crop toggle */}
          <div className="px-4 pb-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Caption
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write something…"
                  maxLength={120}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.15)", color: "#ffffff" }}
                />
              </div>
              <button
                type="button"
                onClick={() => setCropMode(true)}
                className="mb-0.5 flex-shrink-0 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-95"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.08)" }}
              >Crop</button>
            </div>
          </div>

          {/* Building picker */}
          <div className="px-4 pb-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Building
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedBuilding(null)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95"
                style={{
                  borderColor: selectedBuilding === null ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
                  color:       selectedBuilding === null ? "#ffffff"                : "rgba(255,255,255,0.5)",
                  backgroundColor: selectedBuilding === null ? "rgba(255,255,255,0.15)" : "transparent",
                }}
              >None</button>
              {BUILDING_KEYS.map((key) => (
                <button
                  key={key} type="button"
                  onClick={() => setSelectedBuilding(key)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95"
                  style={{
                    borderColor: selectedBuilding === key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
                    color:       selectedBuilding === key ? "#ffffff"                : "rgba(255,255,255,0.5)",
                    backgroundColor: selectedBuilding === key ? "rgba(255,255,255,0.15)" : "transparent",
                  }}
                >{BUILDING_DISPLAY[key]}</button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          <div className="flex gap-3 overflow-x-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id} type="button"
                onClick={() => setActiveTemplate(t.id)}
                className={`flex flex-shrink-0 flex-col items-center gap-1.5 rounded-xl border p-1 transition active:scale-95 ${
                  activeTemplate === t.id ? "border-white/60 ring-2 ring-white/40" : "border-white/10 opacity-60 hover:opacity-90"
                }`}
              >
                <div className="h-14 w-24 rounded-lg" style={{ background: t.bg }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
