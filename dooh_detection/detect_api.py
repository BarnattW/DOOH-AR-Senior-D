from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image
import tritonclient.http as httpclient
import math
import io
import anyio
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detect_ws")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_MODEL = "trio"
STRONG_MODEL = "trio_strong"

INPUT = "images"
OUTPUT = "output0"

CONF_THRESH = 0.6
IOU_THRESH = 0.5
MAX_DETECTIONS = 1
NUM_CLASSES = 3

client = httpclient.InferenceServerClient("localhost:8000")


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def nms(boxes):
    boxes.sort(key=lambda x: x[4], reverse=True)
    keep = []
    for b in boxes:
        x1, y1, x2, y2, conf, cls = b
        should_keep = True
        for k in keep:
            kx1, ky1, kx2, ky2, _, _ = k
            interX1 = max(x1, kx1)
            interY1 = max(y1, ky1)
            interX2 = min(x2, kx2)
            interY2 = min(y2, ky2)
            inter = max(0, interX2 - interX1) * max(0, interY2 - interY1)
            area1 = max(0, x2 - x1) * max(0, y2 - y1)
            area2 = max(0, kx2 - kx1) * max(0, ky2 - ky1)
            union = area1 + area2 - inter
            if union > 0 and inter / union > IOU_THRESH:
                should_keep = False
                break
        if should_keep:
            keep.append(b)
            if len(keep) >= MAX_DETECTIONS:
                break
    return keep


def letterbox(img, new_shape=640):
    w0, h0 = img.size
    r = min(new_shape / w0, new_shape / h0)
    nw, nh = int(w0 * r), int(h0 * r)
    img2 = img.resize((nw, nh))
    canvas = Image.new("RGB", (new_shape, new_shape), (114, 114, 114))
    dx = (new_shape - nw) // 2
    dy = (new_shape - nh) // 2
    canvas.paste(img2, (dx, dy))
    return canvas, r, dx, dy, w0, h0


def sanitize_boxes(boxes):
    clean = []
    for b in boxes:
        if len(b) != 6:
            continue
        x1, y1, x2, y2, conf, cls = b
        vals = [x1, y1, x2, y2, conf]
        try:
            if any(not math.isfinite(float(v)) for v in vals):
                continue
            clean.append([
                float(x1),
                float(y1),
                float(x2),
                float(y2),
                float(conf),
                int(cls),
            ])
        except Exception:
            logger.exception("Failed to sanitize box: %r", b)
            continue
    return clean


def infer_bytes(jpeg: bytes, model: str):
    """Run inference against the given Triton model.

    Both `trio` and `trio_strong` use the same first 7 channels of output
    (4 box + 3 class scores). `trio`'s remaining 32 mask coefficients are
    ignored, so the same decoding loop works for both.
    """
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    boxed, r, dx, dy, iw, ih = letterbox(img, 640)
    arr = np.asarray(boxed).astype(np.float32) / 255.0
    x = np.transpose(arr, (2, 0, 1))[None, ...]

    inp = httpclient.InferInput(INPUT, x.shape, "FP32")
    inp.set_data_from_numpy(x)
    out = httpclient.InferRequestedOutput(OUTPUT)

    y = client.infer(model, inputs=[inp], outputs=[out]).as_numpy(OUTPUT)[0]

    boxes = []
    for i in range(y.shape[1]):
        xc, yc, w, h = y[0, i], y[1, i], y[2, i], y[3, i]
        scores = [sigmoid(y[4 + j, i]) for j in range(NUM_CLASSES)]
        conf = max(scores)
        if conf < CONF_THRESH:
            continue

        cls = int(np.argmax(scores))

        x1 = (xc - w / 2 - dx) / r
        y1 = (yc - h / 2 - dy) / r
        x2 = (xc + w / 2 - dx) / r
        y2 = (yc + h / 2 - dy) / r

        boxes.append([x1, y1, x2, y2, conf, cls])

    return sanitize_boxes(nms(boxes))


@app.get("/health")
async def health():
    return {"ok": True}


async def _detect_http(file: UploadFile, model: str):
    try:
        jpeg = await file.read()
        return await anyio.to_thread.run_sync(infer_bytes, jpeg, model)
    except Exception as e:
        logger.exception("HTTP detect failed for model=%s", model)
        return {"error": str(e)}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    return await _detect_http(file, DEFAULT_MODEL)


@app.post("/detect_strong")
async def detect_strong(file: UploadFile = File(...)):
    return await _detect_http(file, STRONG_MODEL)


async def _ws_loop(ws: WebSocket, model: str):
    await ws.accept()
    client_host = getattr(ws.client, "host", "unknown")
    logger.info("WebSocket connected from %s model=%s", client_host, model)

    try:
        while True:
            jpeg = await ws.receive_bytes()
            started = time.perf_counter()
            size_kb = len(jpeg) / 1024.0

            res = await anyio.to_thread.run_sync(infer_bytes, jpeg, model)

            latency_ms = (time.perf_counter() - started) * 1000.0
            logger.info(
                "Frame model=%s size_kb=%.1f latency_ms=%.1f detections=%d",
                model,
                size_kb,
                latency_ms,
                len(res),
            )

            await ws.send_json(res)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected client=%s model=%s", client_host, model)
    except Exception:
        logger.exception("ws crashed client=%s model=%s", client_host, model)
        try:
            await ws.close(code=1011, reason="server error")
        except Exception:
            pass


@app.websocket("/ws")
async def ws_detect(ws: WebSocket):
    await _ws_loop(ws, DEFAULT_MODEL)


@app.websocket("/ws_strong")
async def ws_detect_strong(ws: WebSocket):
    await _ws_loop(ws, STRONG_MODEL)
