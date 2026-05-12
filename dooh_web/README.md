# DOOH Web

React + Vite + PixiJS frontend for the DOOH AR experience. Streams camera frames to a YOLO building detector (remote WebSocket or in-browser ONNX), then renders 2D/3D AR filters anchored to the detected building.

## Tech stack

- **React 18** + **Vite 5** (with `vite-plugin-mkcert` for local HTTPS — required for `getUserMedia` on mobile)
- **PixiJS 7** + **pixi3d** + **pixi-filters** for the AR overlay
- **onnxruntime-web** for in-browser inference (`local` mode)
- **Zustand** for AR state (`idle` → `glitching` → `tracking` → `lost`)
- **Tailwind CSS** for UI

## Setup

```bash
npm install
```

Models live under `public/` and are loaded by the in-browser worker detector:

- `duo_finetuned_32.onnx`
- `edge_finetuned_32.onnx`
- `trio_finetuned_32.onnx`

## Environment

Create `.env.local` to point at a remote detector:

```
VITE_DETECT_WS_URL=wss://your-detector.example.com/ws
VITE_DETECT_WS_URL_STRONG=wss://your-detector.example.com/ws_strong   # optional
```

If `VITE_DETECT_WS_URL_STRONG` is omitted, the `strong` mode is derived from `VITE_DETECT_WS_URL` by replacing the trailing `/ws` with `/ws_strong`. With no env vars set, the app runs entirely on the in-browser worker.

### Vercel HTTP proxy (`api/detect.js`)

`api/detect.js` is a Vercel serverless function that forwards `POST /api/detect` to `${DETECT_API_BACKEND}/detect`. Set `DETECT_API_BACKEND` in the Vercel project env (e.g. `https://ws.amanechibana.lol`) if you want HTTP fallback alongside the WSS endpoints. Frame-by-frame inference still uses the WebSocket.

> **Naming caveat:** `strong` (a.k.a. `trio_strong` on the backend) is **not** a heavier model. It is currently a lightweight nano detection-only model. The name was kept to avoid renaming call sites across the stack. See [`dooh_detection/Documentation.md`](../dooh_detection/Documentation.md) for the backend setup.

## Scripts

```bash
npm run dev       # vite dev server, HTTPS via mkcert, port 8000
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

The dev server prints a LAN URL — open it on a phone (same network) to test on a real device.

The dev server also:

- Proxies `/api/detect` → `${DETECT_API_BACKEND}/detect` (same env var the Vercel function uses, so dev and prod behave the same).
- Sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. These are required for `onnxruntime-web`'s threaded WASM (SharedArrayBuffer). If `local` mode breaks in production, check that your host preserves these headers.

## URL query parameters

| Param      | Effect                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `?dev`     | Shows the dev `StartPanel` before the camera starts: model selector, mock location, manual start. Without `?dev` the app auto-starts the camera and hides these controls. |
| `?debug=1` | Renders `DebugOverlay` with live FPS and detection latency.                                     |

The compact in-camera `ModelToggle` (top-right) is currently commented out in `App.jsx`; the primary way to choose a model is `?dev` → `StartPanel`.

## Detection modes

`useDetectorMode` selects the backend based on the current mode:

| Mode       | Where inference runs            | Notes                                                                                                 |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `original` | Remote WS (`VITE_DETECT_WS_URL`) | `trio` — original seg-style YOLO.                                                                     |
| `strong`   | Remote WS (`..._STRONG`)        | `trio_strong` — lightweight nano detection-only model (misleading name).                              |
| `local`    | In-browser via `onnxruntime-web` worker | Uses ONNX models in `public/`.                                                                |

If `original` or `strong` is selected but the WebSocket doesn't connect within ~3s, the worker detector warms up and takes over as an automatic fallback (`API_GRACE_MS` in `useDetectorMode.js`). `local` skips the WS entirely.

## Project layout

```
src/
├── App.jsx                       # Top-level orchestration, ?dev / ?debug gating
├── main.jsx
├── components/
│   ├── ai/
│   │   ├── Detector.jsx          # WS detector client + frame encoder
│   │   └── DetectorOld.jsx       # Legacy detector kept for reference
│   ├── ar/                       # AR overlay (Learn More buttons, etc.)
│   ├── camera/                   # Camera + zoom controls
│   ├── onboarding/               # Tutorial flow
│   ├── CameraControls.jsx
│   ├── DebugOverlay.jsx          # FPS / latency HUD (?debug=1)
│   ├── FilterPicker.jsx          # Filter pill row
│   ├── HelpButton.jsx
│   ├── LocationStatus.jsx
│   ├── LockOnOverlay.jsx         # Glitch / "Detecting…" lock-on UI
│   ├── ModelToggle.jsx           # original / strong toggle (rendered in StartPanel)
│   ├── PhotoLibrary.jsx
│   ├── PostcardEditor.jsx        # Photo capture + share
│   └── StartPanel.jsx            # Dev-only pre-start panel (?dev)
├── filters/                      # 2D/3D AR filters (cyber, neon, kingKong, sol, fireworks, kaboom, thermal, …)
├── hooks/
│   ├── useCanvasSync.js
│   ├── useDetectionLoop.js       # Per-frame detection driver
│   ├── useDetectorMode.js        # WS + worker fallback selector
│   ├── useGeolocation.ts
│   ├── useMotionGate.js          # Skip detections while phone is moving
│   ├── useOverlayLoop.js
│   ├── usePhotoLibrary.js
│   ├── usePinchZoom.js
│   ├── usePixiOverlay.js         # Pixi app + filter compositor
│   └── useWorkerDetector.js      # In-browser ONNX worker client
├── store/
│   ├── arStore.js                # Zustand AR state machine
│   └── detectorStore.js          # Worker detector lifecycle/state
├── constants/
│   ├── brands.js
│   └── buildings.js              # Supported building classes + URLs
├── util/
│   └── geolocation.js
└── workers/
    └── detector.worker.js        # ONNX Runtime Web worker entry
```

## Notes

- The app expects HTTPS (camera + sensors). `vite-plugin-mkcert` handles this automatically in dev.
- Detection is gated by `useMotionGate` — frames are skipped while the phone is in motion to reduce wasted inference and false positives.
- Append `?debug=1` for the stats overlay; append `?dev` for the model/location dev panel.
