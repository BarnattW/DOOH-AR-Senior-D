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
  { id: "split",   label: "Classic",  bg: "linear-gradient(135deg,#ece3d8 0%,#d8cfc4 100%)" },
  { id: "strip",   label: "Strip",    bg: "linear-gradient(135deg,#d8e4ec 0%,#c4d4e0 100%)" },
  { id: "border",  label: "Border",   bg: "linear-gradient(135deg,#f0ece4 0%,#e4ddd4 100%)" },
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

// ── Shared back-panel renderer (used by all 3 templates) ─────────────────────
// Draws: postcard label + postmark + stamp row, rule, building name + date left,
// vertical divider, right column. panelX/panelW define the full panel bounds.
function drawBackPanel(ctx, panelX, panelW, building, date, bgColor = "#fdf9f3") {
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
  ctx.fillStyle = "#c0b4a8";
  ctx.textAlign = "center";
  ctx.fillText("— POSTCARD —", panelX + panelW / 2, pmCY + 4);

  const ruleY = stY + stH + 14;
  hRule(ctx, panelX + pad, ruleY, panelW - pad * 2);

  // Left column: building + date
  const colPad = panelX + pad;
  const divX   = panelX + panelW * 0.52;
  const colW   = divX - colPad - 12;

  let ty = ruleY + 44;
  if (building) {
    const bFont = "800 20px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#2a2420"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 28; }
    ty += 8;
  }

  ctx.font = "500 11px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText("New York City", colPad, ty);
  ctx.fillText(
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    colPad, ty + 18
  );

  vRule(ctx, divX, ruleY + 14, H - 20);

  ctx.font = "600 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8bca8"; ctx.textAlign = "center";
  ctx.fillText("NEW YORK, NY 10001", divX + (panelX + panelW - divX) / 2, H - 22);
}

// ── Template A: Classic Split ─────────────────────────────────────────────────
// Photo left 58% | postcard back right 42%
function drawSplit(ctx, img, building, date, transform) {
  const splitX = 696;
  drawCoverCropped(ctx, img, 0, 0, splitX, H, transform);

  // Subtle building label on photo
  if (building) {
    const g = ctx.createLinearGradient(0, H - 90, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, H - 90, splitX, 90);
    ctx.font = "400 18px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
    ctx.fillText(building, 18, H - 16);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#e0d8cc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, H); ctx.stroke();

  drawBackPanel(ctx, splitX, W - splitX, building, date, "#fdf9f3");
}

// ── Template B: Strip ─────────────────────────────────────────────────────────
// Full-width photo top | postcard back bottom strip
function drawStrip(ctx, img, building, date, transform) {
  const photoH = 520;
  drawCoverCropped(ctx, img, 0, 0, W, photoH, transform);

  if (building) {
    const g = ctx.createLinearGradient(0, photoH - 90, 0, photoH);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(0, photoH - 90, W, 90);
    ctx.font = "400 18px Caveat, cursive";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4;
    ctx.fillText(building, 20, photoH - 14);
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "#e0d8cc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, photoH); ctx.lineTo(W, photoH); ctx.stroke();

  // Back strip — draw manually to fit the shorter height
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

  hRule(ctx, pad, stY + stH + 10, W - pad * 2);

  const divX = W * 0.52;
  const colPad = pad;
  const colW = divX - colPad - 12;
  let ty = stY + stH + 38;

  if (building) {
    const bFont = "800 18px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#2a2420"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 25; }
    ty += 6;
  }

  ctx.font = "500 10px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText("New York City  ·  " +
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    colPad, ty
  );

  vRule(ctx, divX, stY + stH + 10, H - 12);

  ctx.font = "600 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8bca8"; ctx.textAlign = "center";
  ctx.fillText("NEW YORK, NY 10001", divX + (W - divX) / 2, H - 18);
}

// ── Template C: Border ────────────────────────────────────────────────────────
// White frame wrapper | photo with padding | postcard back strip inside frame
function drawBorder(ctx, img, building, date, transform) {
  const framePad = 24;
  const backH    = 160;
  const photoX   = framePad;
  const photoY   = framePad;
  const photoW   = W - framePad * 2;
  const photoH   = H - framePad - backH;

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  drawCoverCropped(ctx, img, photoX, photoY, photoW, photoH, transform);

  // Thin rule separating photo from back
  hRule(ctx, framePad, photoY + photoH + 1, photoW, "#e8e0d8");

  // Back area inside the white frame
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
  let ty = stY + 28;

  if (building) {
    const bFont = "800 17px Syne, sans-serif";
    const bLines = getWrappedLines(ctx, building, bFont, colW);
    ctx.font = bFont; ctx.fillStyle = "#1a1a1a"; ctx.textAlign = "left";
    for (const l of bLines) { ctx.fillText(l, colPad, ty); ty += 24; }
    ty += 4;
  }

  ctx.font = "500 10px DM Sans, sans-serif";
  ctx.fillStyle = "#b0a090"; ctx.textAlign = "left";
  ctx.fillText(
    "New York City  ·  " +
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase(),
    colPad, ty
  );

  vRule(ctx, divX, photoY + photoH + 14, H - framePad + 4, "#e8e0d8");

  ctx.font = "600 9px DM Sans, sans-serif";
  ctx.fillStyle = "#c8bca8"; ctx.textAlign = "center";
  ctx.fillText("NEW YORK, NY 10001", divX + (W - framePad - divX) / 2, stY + stH / 2 + 4);
}

const DRAW_FNS = { split: drawSplit, strip: drawStrip, border: drawBorder };

// ── Component ─────────────────────────────────────────────────────────────────
export default function PostcardEditor({ photo, onClose, onSaveToLibrary }) {
  const [activeTemplate,   setActiveTemplate]   = useState("split");
  const [selectedBuilding, setSelectedBuilding] = useState(photo.detectedBuilding ?? null);
  const [showBuildingPicker, setShowBuildingPicker] = useState(false);
  const [photoTransform,   setPhotoTransform]   = useState({ panX: 0, panY: 0, scale: 1 });
  const [cropMode,         setCropMode]         = useState(false);
  const [previewUrl,       setPreviewUrl]       = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [libSaved,         setLibSaved]         = useState(false);

  const canvasRef   = useRef(null);
  const renderTimer = useRef(null);
  const dragRef     = useRef(null);

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
    const building = getBuildingName(selectedBuilding);
    DRAW_FNS[activeTemplate](ctx, img, building, photo.capturedAt, photoTransform);
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

  // ── Crop ──────────────────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPanX: photoTransform.panX, startPanY: photoTransform.panY,
      w: e.currentTarget.offsetWidth, h: e.currentTarget.offsetHeight,
    };
  };
  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const { startX, startY, startPanX, startPanY, w, h } = dragRef.current;
    setPhotoTransform(prev => ({
      ...prev,
      panX: Math.max(-1, Math.min(1, startPanX - (e.clientX - startX) / (w * 0.5) * prev.scale)),
      panY: Math.max(-1, Math.min(1, startPanY - (e.clientY - startY) / (h * 0.5) * prev.scale)),
    }));
  };
  const handlePointerUp   = () => { dragRef.current = null; };
  const handleWheel       = (e) => {
    e.preventDefault();
    setPhotoTransform(prev => ({ ...prev, scale: Math.max(1, Math.min(4, prev.scale + (e.deltaY > 0 ? -0.12 : 0.12))) }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
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
  const buildingLabel = getBuildingName(selectedBuilding);

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
              disabled={saving || !previewUrl}
              className="rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40"
              style={{
                borderColor: libSaved ? "rgba(100,210,100,0.6)" : "rgba(255,255,255,0.25)",
                color:       libSaved ? "rgb(100,210,100)"       : "rgba(255,255,255,0.8)",
              }}
            >{libSaved ? "Saved ✓" : "Library"}</button>
          )}
          <button
            type="button" onClick={handleSave}
            disabled={saving || !previewUrl}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-40"
          >{saving ? "…" : "Save"}</button>
        </div>
      </div>

      {/* Preview */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {previewUrl ? (
          <img
            src={previewUrl} alt="Postcard preview"
            className="max-h-full w-full rounded-lg object-contain shadow-2xl shadow-black/60"
          />
        ) : (
          <div className="h-48 w-full animate-pulse rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        )}

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

        {cropMode && (
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}
          >drag to pan · scroll to zoom · {scaleLabel}</div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      {cropMode ? (
        <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.4)" }}>Zoom</span>
            <button type="button" onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.max(1, p.scale - 0.25) }))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 text-lg leading-none active:scale-95">−</button>
            <span className="min-w-[3rem] text-center text-sm font-semibold text-white/80">{scaleLabel}</span>
            <button type="button" onClick={() => setPhotoTransform(p => ({ ...p, scale: Math.min(4, p.scale + 0.25) }))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 text-lg leading-none active:scale-95">+</button>
            <button type="button" onClick={() => setPhotoTransform({ panX: 0, panY: 0, scale: 1 })}
              className="ml-auto text-xs text-white/40 active:text-white/70">Reset</button>
          </div>
          <button type="button" onClick={() => setCropMode(false)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}>Done Cropping</button>
        </div>
      ) : (
        <>
          {/* Building + crop row */}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.35)" }}>Building</span>
              <span className="text-sm font-semibold text-white/80">{buildingLabel ?? "None detected"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBuildingPicker(p => !p)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                style={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.55)", backgroundColor: "rgba(255,255,255,0.07)" }}
              >Wrong building?</button>
              <button
                type="button"
                onClick={() => setCropMode(true)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95"
                style={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.55)", backgroundColor: "rgba(255,255,255,0.07)" }}
              >Crop</button>
            </div>
          </div>

          {/* Building picker (expandable) */}
          {showBuildingPicker && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              <button
                type="button"
                onClick={() => { setSelectedBuilding(null); setShowBuildingPicker(false); }}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95"
                style={{
                  borderColor: selectedBuilding === null ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
                  color:       selectedBuilding === null ? "#fff"                   : "rgba(255,255,255,0.5)",
                  backgroundColor: selectedBuilding === null ? "rgba(255,255,255,0.15)" : "transparent",
                }}
              >None</button>
              {BUILDING_KEYS.map((key) => (
                <button key={key} type="button"
                  onClick={() => { setSelectedBuilding(key); setShowBuildingPicker(false); }}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95"
                  style={{
                    borderColor: selectedBuilding === key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)",
                    color:       selectedBuilding === key ? "#fff"                   : "rgba(255,255,255,0.5)",
                    backgroundColor: selectedBuilding === key ? "rgba(255,255,255,0.15)" : "transparent",
                  }}
                >{BUILDING_DISPLAY[key]}</button>
              ))}
            </div>
          )}

          {/* Template picker */}
          <div className="flex gap-3 overflow-x-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-5">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setActiveTemplate(t.id)}
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
