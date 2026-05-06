import { useCallback, useEffect, useRef, useState } from "react";

export { BUILDING_CLASSES } from "../../constants/buildings";

const DEFAULT_WS_URL = import.meta.env.VITE_DETECT_WS_URL;
const STRONG_WS_URL = import.meta.env.VITE_DETECT_WS_URL_STRONG;

export const MODEL_URLS = {
  original: DEFAULT_WS_URL,
  strong: STRONG_WS_URL || DEFAULT_WS_URL?.replace(/\/ws$/, "/ws_strong"),
};

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

export function useDetector(model = "original", { onLatency } = {}) {
  const wsUrl = MODEL_URLS[model];
  const [session, setSession] = useState(null);
  const wsRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const connectPromiseRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const nextReconnectAtRef = useRef(0);
  const onLatencyRef = useRef(onLatency);

  useEffect(() => { onLatencyRef.current = onLatency; }, [onLatency]);

  const getReconnectDelayMs = useCallback((attempt) => {
    return Math.min(5000, 250 * 2 ** Math.max(0, attempt - 1));
  }, []);

  const rejectPending = useCallback((error) => {
    if (!pendingRequestRef.current) return;
    pendingRequestRef.current.reject(error);
    pendingRequestRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!wsUrl) {
      console.error("[Detect] Missing WS URL for model:", model);
      return Promise.resolve(null);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.url === wsUrl) {
      return Promise.resolve(wsRef.current);
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    if (Date.now() < nextReconnectAtRef.current) {
      return Promise.resolve(null);
    }

    connectPromiseRef.current = new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      const handleOpen = () => {
        if (isUnmountedRef.current) { ws.close(); resolve(null); return; }
        console.log(`[Detect] WebSocket connected → ${wsUrl} (model: ${model})`);
        wsRef.current = ws;
        setSession({ provider: "websocket", url: wsUrl, model });
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
          console.warn(`[Detect] WebSocket disconnected (model: ${model}) code=${event.code} retryIn=${waitMs}ms`);
        }
        rejectPending(new Error("WebSocket closed"));
      };

      const handleError = () => {
        console.error(`[Detect] WebSocket error (model: ${model})`);
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
  }, [wsUrl, model, getReconnectDelayMs, rejectPending]);

  // Reconnect on model/url change.
  useEffect(() => {
    isUnmountedRef.current = false;
    // If a socket is open to a different URL, close it so connect() opens a fresh one.
    if (wsRef.current && wsRef.current.url !== wsUrl) {
      console.log("[Detect] Model changed, closing previous socket");
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
      setSession(null);
      reconnectAttemptRef.current = 0;
      nextReconnectAtRef.current = 0;
      rejectPending(new Error("Model changed"));
    }
    void connect();
    return () => {
      isUnmountedRef.current = true;
      setSession(null);
      rejectPending(new Error("Detector unmounted"));
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      connectPromiseRef.current = null;
    };
  }, [connect, wsUrl, rejectPending]);

  const detect = useCallback(async (imageElement) => {
    if (!imageElement || !wsUrl) return [];

    const ws = await connect();
    if (!ws || ws.readyState !== WebSocket.OPEN) return [];
    if (pendingRequestRef.current) return []; // single-flight

    const blob = await frameToJpegBlob(imageElement, 0.7);
    if (!blob) return [];

    const bytes = await blob.arrayBuffer();
    const t0 = performance.now();

    try {
      const response = await new Promise((resolve, reject) => {
        pendingRequestRef.current = { resolve, reject };
        ws.send(bytes);
      });
      const latencyMs = performance.now() - t0;
      onLatencyRef.current?.(latencyMs);
      console.log(`[Detect] ${model} ${latencyMs.toFixed(0)}ms detections=${response?.length ?? 0}`);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("[Detect] request failed:", error?.message || error);
      return [];
    }
  }, [connect, wsUrl, model]);

  return { session, detect };
}
