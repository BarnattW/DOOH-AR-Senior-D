import { useCallback, useEffect, useRef, useState } from "react";

export { BUILDING_CLASSES } from "../../constants/buildings";

const DETECT_WS_URL = import.meta.env.VITE_DETECT_WS_URL;

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
  const wsRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const connectPromiseRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const nextReconnectAtRef = useRef(0);

  const getReconnectDelayMs = useCallback((attempt) => {
    return Math.min(5000, 250 * 2 ** Math.max(0, attempt - 1));
  }, []);

  const rejectPending = useCallback((error) => {
    if (!pendingRequestRef.current) return;
    pendingRequestRef.current.reject(error);
    pendingRequestRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!DETECT_WS_URL) {
      console.error("[Detect] Missing VITE_DETECT_WS_URL");
      return Promise.resolve(null);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve(wsRef.current);
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    if (Date.now() < nextReconnectAtRef.current) {
      return Promise.resolve(null);
    }

    connectPromiseRef.current = new Promise((resolve, reject) => {
      const ws = new WebSocket(DETECT_WS_URL);
      ws.binaryType = "arraybuffer";

      const handleOpen = () => {
        if (isUnmountedRef.current) { ws.close(); resolve(null); return; }
        console.log("[Detect] WebSocket connected →", DETECT_WS_URL);
        wsRef.current = ws;
        setSession({ provider: "websocket", url: DETECT_WS_URL });
        reconnectAttemptRef.current = 0;
        nextReconnectAtRef.current = 0;
        connectPromiseRef.current = null;
        resolve(ws);
      };

      const handleMessage = (event) => {
        if (!pendingRequestRef.current) return;
        try {
          const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          pendingRequestRef.current.resolve(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
          pendingRequestRef.current.reject(error);
        } finally {
          pendingRequestRef.current = null;
        }
      };

      const handleClose = (event) => {
        if (wsRef.current === ws) wsRef.current = null;
        setSession(null);
        connectPromiseRef.current = null;
        if (!isUnmountedRef.current) {
          reconnectAttemptRef.current += 1;
          const waitMs = getReconnectDelayMs(reconnectAttemptRef.current);
          nextReconnectAtRef.current = Date.now() + waitMs;
          console.warn("[Detect] WebSocket closed:", `code=${event.code}`, `retryIn=${waitMs}ms`);
        }
        rejectPending(new Error("WebSocket closed"));
      };

      const handleError = () => {
        console.error("[Detect] WebSocket error");
        if (ws.readyState !== WebSocket.OPEN) {
          connectPromiseRef.current = null;
          reject(new Error("WebSocket failed"));
        }
        rejectPending(new Error("WebSocket error"));
      };

      ws.addEventListener("open", handleOpen, { once: true });
      ws.addEventListener("message", handleMessage);
      ws.addEventListener("close", handleClose);
      ws.addEventListener("error", handleError);
    });

    return connectPromiseRef.current;
  }, [getReconnectDelayMs, rejectPending]);

  useEffect(() => {
    isUnmountedRef.current = false;
    void connect();
    return () => {
      isUnmountedRef.current = true;
      setSession(null);
      rejectPending(new Error("Detector unmounted"));
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      connectPromiseRef.current = null;
    };
  }, [connect, rejectPending]);

  const detect = useCallback(async (imageElement) => {
    if (!imageElement || !DETECT_WS_URL) return [];

    const ws = await connect();
    if (!ws || ws.readyState !== WebSocket.OPEN) return [];
    if (pendingRequestRef.current) return [];

    const blob = await frameToJpegBlob(imageElement, 0.7);
    if (!blob) return [];

    const bytes = await blob.arrayBuffer();
    const t0 = performance.now();
    console.log("[Detect] → sending frame", `${(blob.size / 1024).toFixed(1)}KB`);

    try {
      const response = await new Promise((resolve, reject) => {
        pendingRequestRef.current = { resolve, reject };
        ws.send(bytes);
      });
      console.log("[Detect] ← response", `${(performance.now() - t0).toFixed(0)}ms`, "| detections:", response?.length ?? 0, response);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("[Detect] request failed:", error?.message || error);
      return [];
    }
  }, [connect]);

  return { session, detect };
}
