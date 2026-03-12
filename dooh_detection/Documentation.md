# Real-Time AR Detection System (Fully Reproducible Setup)

This document contains everything required to recreate the GPU-backed real-time
object detection infrastructure from scratch.

Stack:

- Frontend: Vite + React (Vercel)
- Backend API: FastAPI (Python)
- Model Server: NVIDIA Triton
- Model Format: ONNX
- GPU: NVIDIA T4 (GCP Compute Engine)
- Optional Secure Layer: Cloud Run proxy

---

# ARCHITECTURE

Development Mode:

Frontend → VM FastAPI → Triton → GPU

Secure Production Mode:

Vercel (HTTPS)
→ Cloud Run Proxy (HTTPS/WSS)
→ Compute VM FastAPI (HTTP/WS)
→ Triton
→ GPU

Cloud Run solves browser mixed-content issues without buying a domain.

---

# STEP 1 — CREATE GCP VM

Create a Compute Engine VM with:

- Ubuntu 22.04
- NVIDIA T4 GPU
- External IP

SSH into the VM.

---

# STEP 2 — INSTALL DOCKER

```bash
sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
newgrp docker
```

# STEP 3 — INSTALL NVIDIA CONTAINER TOOLKIT

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

Verify GPU
```bash
nvidia-smi
```

# STEP 4 — CREATE TRITON MODEL REPO

Upload ONNX model

```bash
scp your_model.onnx USER@VM_IP:~
```

Create directory:

```bash
mkdir -p ~/model_repo/trio/1
mv ~/your_model.onnx ~/model_repo/trio/1/model.onnx
```

IMPORTANT:
The file must be named:model.onnx 

# STEP 5 — CREATE config.pbtxt

```bash
nano ~/model_repo/trio/config.pbtxt
```

Example for model 

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

# STEP 6 - START TRITON

```bash
docker run -d --name triton --restart unless-stopped --gpus all \
  -p 127.0.0.1:8000:8000 \
  -v ~/model_repo:/models \
  nvcr.io/nvidia/tritonserver:24.08-py3 \
  tritonserver --model-repository=/models
```

Verify

```bash
curl http://localhost:8000/v2/models/trio
```

# STEP 7 — INSTALL FASTAPI ENVIRONMENT

```bash
sudo apt install -y python3-pip python3-venv
python3 -m venv ~/venv
source ~/venv/bin/activate
pip install fastapi uvicorn[standard] tritonclient[http] numpy pillow python-multipart anyio
```

# STEP 8 — CREATE detect_api.py

```bash
nano ~/detect_api.py
```

```python
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image
import tritonclient.http as httpclient
import math
import io
import anyio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL="trio"
INPUT="images"
OUTPUT="output0"

CONF_THRESH=0.6
IOU_THRESH=0.5
MAX_DETECTIONS=1
NUM_CLASSES=3

client=httpclient.InferenceServerClient("localhost:8000")

def sigmoid(x):
    return 1/(1+math.exp(-x))

def nms(boxes):
    boxes.sort(key=lambda x:x[4],reverse=True)
    keep=[]
    for b in boxes:
        x1,y1,x2,y2,conf,cls=b
        should_keep=True
        for k in keep:
            kx1,ky1,kx2,ky2,_,_=k
            interX1=max(x1,kx1)
            interY1=max(y1,ky1)
            interX2=min(x2,kx2)
            interY2=min(y2,ky2)
            inter=max(0,interX2-interX1)*max(0,interY2-interY1)
            area1=(x2-x1)*(y2-y1)
            area2=(kx2-kx1)*(ky2-ky1)
            union=area1+area2-inter
            if union>0 and inter/union>IOU_THRESH:
                should_keep=False
                break
        if should_keep:
            keep.append(b)
            if len(keep)>=MAX_DETECTIONS:
                break
    return keep

def letterbox(img,new_shape=640):
    w0,h0=img.size
    r=min(new_shape/w0,new_shape/h0)
    nw,nh=int(w0*r),int(h0*r)
    img2=img.resize((nw,nh))
    canvas=Image.new("RGB",(new_shape,new_shape),(114,114,114))
    dx=(new_shape-nw)//2
    dy=(new_shape-nh)//2
    canvas.paste(img2,(dx,dy))
    return canvas,r,dx,dy,w0,h0

def infer_bytes(jpeg):
    img=Image.open(io.BytesIO(jpeg)).convert("RGB")
    boxed,r,dx,dy,iw,ih=letterbox(img,640)
    arr=np.asarray(boxed).astype(np.float32)/255.0
    x=np.transpose(arr,(2,0,1))[None,...]
    inp=httpclient.InferInput(INPUT,x.shape,"FP32")
    inp.set_data_from_numpy(x)
    out=httpclient.InferRequestedOutput(OUTPUT)
    y=client.infer(MODEL,inputs=[inp],outputs=[out]).as_numpy(OUTPUT)[0]
    boxes=[]
    for i in range(y.shape[1]):
        xc,yc,w,h=y[0,i],y[1,i],y[2,i],y[3,i]
        scores=[sigmoid(y[4+j,i]) for j in range(NUM_CLASSES)]
        conf=max(scores)
        if conf<CONF_THRESH:
            continue
        cls=int(np.argmax(scores))
        x1=(xc-w/2-dx)/r
        y1=(yc-h/2-dy)/r
        x2=(xc+w/2-dx)/r
        y2=(yc+h/2-dy)/r
        boxes.append([x1,y1,x2,y2,conf,cls])
    return nms(boxes)

@app.post("/detect")
async def detect(file:UploadFile=File(...)):
    jpeg=await file.read()
    return await anyio.to_thread.run_sync(infer_bytes,jpeg)

@app.websocket("/ws")
async def ws_detect(ws:WebSocket):
    await ws.accept()
    try:
        while True:
            jpeg=await ws.receive_bytes()
            res=await anyio.to_thread.run_sync(infer_bytes,jpeg)
            await ws.send_json(res)
    except WebSocketDisconnect:
        return
```

# STEP 9 - RUN FASTAPI AS SERVICE 

```bash
sudo tee /etc/systemd/system/detect.service >/dev/null <<EOF
[Unit]
Description=Detection API
After=network.target docker.service

[Service]
User=$USER
WorkingDirectory=/home/$USER
ExecStart=/home/$USER/venv/bin/uvicorn detect_api:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable detect
sudo systemctl restart detect
```

# STEP 10 - OPEN FIREWALL

Make sure on GCP settings to open 8080

# FRONTEND ENV

Direct VM:
```
VITE_DETECT_URL=http://VM_IP:8080/detect
VITE_DETECT_WS_URL=ws://VM_IP:8080/ws
```

Secure through cloud run or secure connection
```
VITE_DETECT_URL=https://RUN_APP_URL/detect
VITE_DETECT_WS_URL=wss://RUN_APP_URL/ws
```

# OPTIONAL — CLOUD RUN PROXY (Not really if we wanna do socket with free credits lol)

Create folder:

detect-proxy/

nginx.conf

```nginx
events {}
http {
  server {
    listen 8080;
    location / {
      proxy_pass http://VM_IP:8080;
    }
    location /ws {
      proxy_pass http://VM_IP:8080/ws;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

Dockerfile

```Dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
```

Deploy 
```Bash
gcloud run deploy detect-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

# Model Updates 

Replace the model 

```Bash 
cp new_model.onnx ~/model_repo/trio/1/model.onnx
docker restart triton
```

Or pref version 

```Bash 
mkdir ~/model_repo/trio/2
cp new_model.onnx ~/model_repo/trio/2/model.onnx
docker restart triton
```
