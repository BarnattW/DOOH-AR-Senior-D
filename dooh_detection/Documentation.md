# Real-Time AR Detection System

GPU-backed real-time object detection with secure WebSocket streaming.
Two models are served concurrently for live A/B testing.

> **Naming note:** `trio_strong` is **not** actually a stronger model. The name
> stuck after the model was swapped to a lighter nano variant. Treat `trio_strong`
> as "the newer/lighter detection-only model." `trio` is the original
> segmentation-style YOLO model.

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

```
Frontend (HTTPS)
        |
        | WebSocket JPEG frames
        v
wss://ws.amanechibana.lol
        |
        v
Cloudflare (proxy)
        |
        v
Caddy (TLS termination :443)
        |
        v
FastAPI (localhost:8080)   <-- /ws, /ws_strong, /detect, /detect_strong
        |
        | Triton HTTP client
        v
Triton (localhost:8000)
        |
        v
ONNX models on GPU (T4)
```

---

## MODELS

Triton serves two models from `~/model_repo/`:

| Model         | Version | Input              | Output           | Notes                                 |
|---------------|---------|--------------------|------------------|---------------------------------------|
| `trio`        | 2       | images [1,3,640,640] | output0 [1,39,8400] | Original seg-style YOLO. 4 box + 3 cls + 32 mask coeffs (mask coeffs ignored). |
| `trio_strong` | 1       | images [1,3,640,640] | output0 [1,7,8400]  | Lightweight nano detection-only model (despite the name). 4 box + 3 cls. |

Endpoint mapping:

```
/ws            -> trio
/ws_strong     -> trio_strong
/detect        -> trio
/detect_strong -> trio_strong
```

Both endpoints return the same frontend format:

```
[x1, y1, x2, y2, confidence, classId]
```

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

## STEP 5 — DEPLOY TRITON MODEL REPO

The canonical layout is mirrored in this repo at `model_repo/`. Sync it to
the VM and drop the ONNX weights in:

```bash
rsync -av --exclude='MODEL.md' --exclude='README.md' \
  model_repo/ USER@VM_IP:~/model_repo/

scp trio.onnx        USER@VM_IP:~/model_repo/trio/2/model.onnx
scp trio_strong.onnx USER@VM_IP:~/model_repo/trio_strong/1/model.onnx
```

Final on-VM structure:

```
~/model_repo/
  trio/
    config.pbtxt
    2/model.onnx
  trio_strong/
    config.pbtxt
    1/model.onnx
```

> Triton requires the weight file to be named exactly `model.onnx`.
> Triton tries to load every folder under `~/model_repo/`. Move broken/disabled
> models out (e.g. `~/model_repo_DISABLED/`) instead of leaving stubs.

The two `config.pbtxt` files differ only in the output dim:

- `trio`        → `dims: [ 1, 39, 8400 ]`
- `trio_strong` → `dims: [ 1, 7, 8400 ]`

A mismatch here is the most common cause of Triton failing to load a model.
There is no separate "STEP 6" — the configs ship with the repo at
`model_repo/trio/config.pbtxt` and `model_repo/trio_strong/config.pbtxt`.

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

Verify both models:

```bash
curl http://127.0.0.1:8000/v2/models/trio
curl http://127.0.0.1:8000/v2/models/trio_strong
```

## STEP 8 — FASTAPI BACKEND

```bash
sudo apt install -y python3-pip python3-venv
python3 -m venv ~/venv
source ~/venv/bin/activate
pip install fastapi uvicorn[standard] tritonclient[http] numpy pillow python-multipart anyio onnx
```

## STEP 9 — DEPLOY `detect_api.py`

The canonical server lives in this repo at `detect_api.py`. Copy it onto the VM:

```bash
scp detect_api.py USER@VM_IP:~/detect_api.py
```

It exposes:

```
GET  /health
POST /detect
POST /detect_strong
WS   /ws
WS   /ws_strong
```

## STEP 10 — RUN FASTAPI AS SERVICE

The canonical unit file lives in this repo at `systemd/detect.service`.

```bash
sudo cp systemd/detect.service /etc/systemd/system/detect.service
sudo systemctl daemon-reload
sudo systemctl enable detect
sudo systemctl restart detect
sudo systemctl status detect --no-pager
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

```caddy
ws.amanechibana.lol {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl restart caddy
```

Caddy proxies all paths, so `/ws`, `/ws_strong`, `/detect`, `/detect_strong`
and `/health` are all reachable through the single hostname.

## STEP 13 — FIREWALL

Allow:

- TCP 443
- TCP 8080 (dev only — skip in prod)

Do **not** publicly expose TCP 8000 (Triton). FastAPI talks to it on localhost.

## STEP 14 — CLOUDFLARE

DNS:

- `A ws YOUR_STATIC_IP` (Proxied ON)

SSL:

- Mode: Full

## FRONTEND ENV

```env
VITE_DETECT_URL=https://ws.amanechibana.lol/detect
VITE_DETECT_STRONG_URL=https://ws.amanechibana.lol/detect_strong
VITE_DETECT_WS_URL=wss://ws.amanechibana.lol/ws
VITE_DETECT_WS_STRONG_URL=wss://ws.amanechibana.lol/ws_strong
```

For direct VM testing without Cloudflare/Caddy:

```env
VITE_DETECT_WS_URL=ws://<VM_IP>:8080/ws
VITE_DETECT_WS_STRONG_URL=ws://<VM_IP>:8080/ws_strong
```

## TESTING

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8000/v2/models/trio
curl http://127.0.0.1:8000/v2/models/trio_strong
curl https://ws.amanechibana.lol/docs
```

Browser:

```js
new WebSocket("wss://ws.amanechibana.lol/ws")
new WebSocket("wss://ws.amanechibana.lol/ws_strong")
```

## DEBUGGING

```bash
sudo journalctl -u detect -f
sudo journalctl -u triton -f
docker logs -f triton
```

## MODEL UPDATE / SWAP

Always verify ONNX shapes before swapping:

```bash
source ~/venv/bin/activate
python3 - <<'PY'
import onnx
m = onnx.load("/path/to/model.onnx")
for i in m.graph.input:
    print("INPUT", i.name, [d.dim_value or d.dim_param for d in i.type.tensor_type.shape.dim])
for o in m.graph.output:
    print("OUTPUT", o.name, [d.dim_value or d.dim_param for d in o.type.tensor_type.shape.dim])
PY
```

Common shapes:

- `[1,3,640,640]` input + `[1,39,8400]` output → YOLO seg-style (use `trio` config)
- `[1,3,640,640]` input + `[1,7,8400]`  output → detection-only (use `trio_strong` config)

Then drop the new weight in and restart Triton:

```bash
cp new_model.onnx ~/model_repo/trio_strong/1/model.onnx
sudo systemctl restart triton
```

> Historical note: `trio_strong` originally crashed Triton because its config
> claimed `[1,39,8400]` but the actual ONNX output is `[1,7,8400]`. Always
> match `config.pbtxt` to the ONNX graph.
