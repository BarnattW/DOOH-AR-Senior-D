# Real-Time AR Detection System (FINAL SETUP)

This document contains everything required to recreate the GPU-backed real-time
object detection system with secure WebSocket streaming.

---

## STACK

- Frontend: Vite + React (Vercel)
- Backend API: FastAPI (systemd service)
- Model Server: NVIDIA Triton (Docker + systemd)
- Model Format: ONNX
- GPU: NVIDIA T4 (GCP Compute Engine)
- Networking:
  - Cloudflare (DNS + WSS)
  - Caddy (TLS termination)

---

## ARCHITECTURE

Frontend (HTTPS)  
↓  
wss://ws.amanechibana.lol  
↓  
Cloudflare (proxy)  
↓  
Caddy (TLS termination :443)  
↓  
FastAPI (localhost:8080)  
↓  
Triton (localhost:8000)  
↓  
GPU (T4)

---

## STEP 1 — CREATE GCP VM

- Ubuntu 22.04
- NVIDIA T4 GPU
- Static external IP
- Disk: 50GB+

---

## STEP 2 — INSTALL NVIDIA DRIVERS

```bash
sudo apt update
sudo apt install -y ubuntu-drivers-common
ubuntu-drivers devices
sudo apt install -y nvidia-driver-580-open
sudo reboot
```

Verify:

```bash
nvidia-smi
```

## STEP 3 — INSTALL DOCKER

```bash
sudo apt install -y docker.io
sudo usermod -aG docker $USER
newgrp docker
```

## STEP 4 — INSTALL NVIDIA CONTAINER TOOLKIT

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)

curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

Test GPU in Docker:

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base nvidia-smi
```

## STEP 5 — CREATE TRITON MODEL REPO

```bash
mkdir -p ~/model_repo/trio/1
scp your_model.onnx USER@VM_IP:~
mv ~/your_model.onnx ~/model_repo/trio/1/model.onnx
```

## STEP 6 — CREATE `config.pbtxt`

```bash
nano ~/model_repo/trio/config.pbtxt
```

```pbtxt
name: "trio"
platform: "onnxruntime_onnx"
max_batch_size: 0

input [
  {
    name: "images"
    data_type: TYPE_FP32
    dims: [ 1, 3, 640, 640 ]
  }
]

output [
  {
    name: "output0"
    data_type: TYPE_FP32
    dims: [ 1, 39, 8400 ]
  }
]
```

## STEP 7 — RUN TRITON (SYSTEMD)

```bash
sudo tee /etc/systemd/system/triton.service >/dev/null <<EOF
[Unit]
Description=Triton Inference Server
After=network-online.target docker.service
Requires=docker.service

[Service]
User=amane_chibana
Restart=always
RestartSec=5

ExecStartPre=-/usr/bin/docker stop triton
ExecStartPre=-/usr/bin/docker rm triton

ExecStart=/usr/bin/docker run --name triton --gpus all \
  -p 127.0.0.1:8000:8000 \
  -v /home/amane_chibana/model_repo:/models \
  nvcr.io/nvidia/tritonserver:24.08-py3 \
  tritonserver --model-repository=/models

ExecStop=/usr/bin/docker stop triton

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable triton
sudo systemctl restart triton
```

Verify:

```bash
curl http://127.0.0.1:8000/v2/models/trio
```

## STEP 8 — FASTAPI BACKEND

```bash
sudo apt install -y python3-pip python3-venv
python3 -m venv ~/venv
source ~/venv/bin/activate
pip install fastapi uvicorn[standard] tritonclient[http] numpy pillow python-multipart anyio
```

## STEP 9 — CREATE `detect_api.py`

```python
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

MODEL = "trio"
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


def infer_bytes(jpeg: bytes):
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    boxed, r, dx, dy, iw, ih = letterbox(img, 640)
    arr = np.asarray(boxed).astype(np.float32) / 255.0
    x = np.transpose(arr, (2, 0, 1))[None, ...]

    inp = httpclient.InferInput(INPUT, x.shape, "FP32")
    inp.set_data_from_numpy(x)
    out = httpclient.InferRequestedOutput(OUTPUT)

    y = client.infer(MODEL, inputs=[inp], outputs=[out]).as_numpy(OUTPUT)[0]

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


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    try:
        jpeg = await file.read()
        res = await anyio.to_thread.run_sync(infer_bytes, jpeg)
        return res
    except Exception as e:
        logger.exception("HTTP detect failed")
        return {"error": str(e)}


@app.websocket("/ws")
async def ws_detect(ws: WebSocket):
    await ws.accept()
    client_host = getattr(ws.client, "host", "unknown")
    logger.info("WebSocket connected from %s", client_host)

    try:
        while True:
            jpeg = await ws.receive_bytes()
            started = time.perf_counter()
            size_kb = len(jpeg) / 1024.0

            res = await anyio.to_thread.run_sync(infer_bytes, jpeg)

            latency_ms = (time.perf_counter() - started) * 1000.0
            logger.info(
                "Frame processed size_kb=%.1f latency_ms=%.1f detections=%d payload=%r",
                size_kb,
                latency_ms,
                len(res),
                res,
            )

            await ws.send_json(res)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client: %s", client_host)
    except Exception:
        logger.exception("ws_detect crashed for client=%s", client_host)
        try:
            await ws.close(code=1011, reason="server error")
        except Exception:
            pass
```

## STEP 10 — RUN FASTAPI AS SERVICE

```bash
sudo tee /etc/systemd/system/detect.service >/dev/null <<EOF
[Unit]
Description=Detection API
After=network.target docker.service triton.service
Requires=triton.service

[Service]
User=amane_chibana
WorkingDirectory=/home/amane_chibana
ExecStartPre=/bin/sleep 5
ExecStart=/home/amane_chibana/venv/bin/uvicorn detect_api:app \
  --host 0.0.0.0 \
  --port 8080 \
  --ws-ping-interval 20 \
  --ws-ping-timeout 60

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable detect
sudo systemctl restart detect
```

## STEP 11 — INSTALL CADDY (TLS + WSS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy
```

## STEP 12 — CONFIGURE CADDY

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddy
ws.amanechibana.lol {
    reverse_proxy 127.0.0.1:8080
}
```

Restart:

```bash
sudo systemctl restart caddy
sudo systemctl status caddy
```

## STEP 13 — FIREWALL

Allow:

- TCP: 443
- TCP: 8080 (optional dev only)

## STEP 14 — CLOUDFLARE

DNS:

- `A ws YOUR_STATIC_IP` (Proxied ON)

SSL:

- Mode: Full

## FRONTEND ENV

```env
VITE_DETECT_URL=https://ws.amanechibana.lol/detect
VITE_DETECT_WS_URL=wss://ws.amanechibana.lol/ws
```

## TESTING

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8000/v2/models/trio
curl https://ws.amanechibana.lol/docs
```

Browser:

```js
new WebSocket("wss://ws.amanechibana.lol/ws")
```

## DEBUGGING

Logs:

```bash
sudo journalctl -u detect -f
sudo journalctl -u triton -f
```

## MODEL UPDATE

```bash
cp new_model.onnx ~/model_repo/trio/1/model.onnx
sudo systemctl restart triton
```
