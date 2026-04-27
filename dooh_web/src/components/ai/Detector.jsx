import { useCallback, useEffect, useRef, useState } from "react";
import { BUILDING_CLASSES } from "../../constants/buildings";

export { BUILDING_CLASSES };

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
    // 250ms, 500ms, 1000ms, 2000ms, 4000ms (max 5s)
    return Math.min(5000, 250 * 2 ** Math.max(0, attempt - 1));
  }, []);

  const rejectPending = useCallback((error) => {
    if (!pendingRequestRef.current) return;
    pendingRequestRef.current.reject(error);
    pendingRequestRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!DETECT_WS_URL) {
      console.error("Missing websocket detection URL.");
      return Promise.resolve(null);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve(wsRef.current);
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    const now = Date.now();
    if (now < nextReconnectAtRef.current) {
      return Promise.resolve(null);
    }

    connectPromiseRef.current = new Promise((resolve, reject) => {
      const ws = new WebSocket(DETECT_WS_URL);
      ws.binaryType = "arraybuffer";

      const handleOpen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          resolve(null);
          return;
        }

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
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setSession(null);
        connectPromiseRef.current = null;
        if (!isUnmountedRef.current) {
          reconnectAttemptRef.current += 1;
          const waitMs = getReconnectDelayMs(reconnectAttemptRef.current);
          nextReconnectAtRef.current = Date.now() + waitMs;
          console.warn(
            "[Detect] WebSocket closed:",
            `code=${event.code}`,
            `reason=${event.reason || "none"}`,
            `wasClean=${event.wasClean}`,
            `retryIn=${waitMs}ms`
          );
        }
        rejectPending(new Error("Detection websocket closed."));
      };

      const handleError = () => {
        const error = new Error("Detection websocket failed.");
        console.error("[Detect] WebSocket error event.");
        if (ws.readyState !== WebSocket.OPEN) {
          connectPromiseRef.current = null;
          reject(error);
        }
        rejectPending(error);
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
      rejectPending(new Error("Detection websocket closed."));

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

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
    const reqStart = performance.now();
    console.log("[Detect] WebSocket →", DETECT_WS_URL, "| blob:", `${(blob.size / 1024).toFixed(1)}KB`);

    try {
      const response = await new Promise((resolve, reject) => {
        pendingRequestRef.current = { resolve, reject };
        ws.send(bytes);
      });

      const duration = (performance.now() - reqStart).toFixed(0);
      console.log("[Detect] Response ✓", `(${duration}ms) | detections:`, response?.length ?? 0, response);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("[Detect] WebSocket request failed:", error?.message || error);
      return [];
    }
  }, [connect]);

  return {
    session,
    detect,
  };
}
