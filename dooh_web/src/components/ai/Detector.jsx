import { useState, useEffect } from "react";

export const BUILDING_CLASSES = [
  "Hudson Yards - The Edge",
  "Empire State Building",
  "WTC",
];

// ---- API CONFIG (ENV ONLY) ----
// Vite requires env vars to start with VITE_
const DETECT_URL = import.meta.env.VITE_DETECT_URL; // required
const API_KEY = import.meta.env.VITE_DETECT_KEY || ""; // optional

async function frameToJpegBlob(imageElement, quality = 0.7) {
  const iw = imageElement.videoWidth || imageElement.width;
  const ih = imageElement.videoHeight || imageElement.height;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = iw;
  canvas.height = ih;
  ctx.drawImage(imageElement, 0, 0, iw, ih);

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

export function useDetector() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!DETECT_URL) {
      console.error("Missing VITE_DETECT_URL env var.");
      return;
    }
    setSession({ provider: "server", url: DETECT_URL });
  }, []);

  const detect = async (imageElement, canvasRef, drawAROverlay) => {
    if (!imageElement || !DETECT_URL) return [];

    const blob = await frameToJpegBlob(imageElement, 0.7);
    if (!blob) return [];

    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");

    const headers = {};
    if (API_KEY) headers["x-api-key"] = API_KEY;

    const reqStart = performance.now();
    console.log("[Detect] Request →", DETECT_URL, "| blob:", `${(blob.size / 1024).toFixed(1)}KB`);

    let filtered;
    try {
      const res = await fetch(DETECT_URL, {
        method: "POST",
        headers,
        body: fd,
      });

      const duration = (performance.now() - reqStart).toFixed(0);
      if (!res.ok) {
        const text = await res.text();
        console.warn("[Detect] Response ✗", res.status, `(${duration}ms)`, text || res.statusText);
        return [];
      }

      filtered = await res.json();
      console.log("[Detect] Response ✓", res.status, `(${duration}ms) | detections:`, filtered?.length ?? 0, filtered);
    } catch (e) {
      console.error("[Detect] Request failed:", e.message || e);
      return [];
    }

    if (drawAROverlay && canvasRef?.current && filtered.length > 0) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.lineWidth = 3;
      ctx.strokeStyle = "red";
      ctx.fillStyle = "red";
      ctx.font = "18px monospace";

      for (const [x1, y1, x2, y2, conf, classId] of filtered) {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        const buildingName = BUILDING_CLASSES[classId] || `Building ${classId}`;
        const label = `${buildingName} ${(conf * 100).toFixed(1)}%`;
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

  return {
    session,
    detect,
  };
}
