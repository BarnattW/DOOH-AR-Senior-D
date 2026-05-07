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

Models live under `public/` and are loaded by the local detector:

- `duo_finetuned_32.onnx`
- `edge_finetuned_32.onnx`
- `trio_finetuned_32.onnx`

## Environment

Create `.env.local` if you want to use the remote detection modes:

```
VITE_DETECT_WS_URL=wss://your-detector.example.com/ws
VITE_DETECT_WS_URL_STRONG=wss://your-detector.example.com/ws_strong   # optional
```

If `VITE_DETECT_WS_URL_STRONG` is omitted, the `strong` mode is derived from `VITE_DETECT_WS_URL` by replacing the trailing `/ws` with `/ws_strong`. With no env vars set, only **local** mode works.

## Scripts

```bash
npm run dev       # vite dev server (HTTPS via mkcert)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

The dev server prints a LAN URL — open it on a phone (same network) to test on a real device.

## Detection modes

Toggleable at runtime through `ModelToggle` (visible with `?debug=1`):

| Mode       | Where inference runs            | Notes                                  |
| ---------- | ------------------------------- | -------------------------------------- |
| `original` | Remote WS (`VITE_DETECT_WS_URL`) | Default light model                    |
| `strong`   | Remote WS (`..._STRONG`)        | Heavier / more accurate model          |
| `local`    | In-browser via `onnxruntime-web` | No network; uses ONNX models in `public/` |

## Project layout

```
src/
├── App.jsx                 # Top-level orchestration
├── main.jsx
├── components/
│   ├── ai/Detector.jsx     # WS detector client + frame encoder
│   ├── ar/                 # AR overlay (Learn More buttons, etc.)
│   ├── camera/             # Camera + zoom controls
│   ├── onboarding/         # Tutorial flow
│   ├── FilterPicker.jsx    # Filter pill row
│   ├── LockOnOverlay.jsx   # Glitch / "Detecting…" lock-on UI
│   ├── PostcardEditor.jsx  # Photo capture + share
│   └── ...
├── filters/                # 2D/3D AR filters (cyber, neon, kingKong, sol, …)
├── hooks/
│   ├── useDetectionLoop.js # Per-frame detection driver
│   ├── useDetectorMode.js  # Switches between WS and local detectors
│   ├── usePixiOverlay.js   # Pixi app + filter compositor
│   ├── useMotionGate.js    # Skip detections while phone is moving
│   ├── useGeolocation.ts
│   └── ...
├── store/arStore.js        # Zustand AR state machine
├── constants/buildings.js  # Supported building classes + URLs
└── workers/                # Web worker entry points for local inference
```

## Notes

- The app expects HTTPS (camera + sensors). `vite-plugin-mkcert` handles this automatically in dev.
- Detection is gated by `useMotionGate` — frames are skipped while the phone is in motion to reduce wasted inference and false positives.
- Append `?debug=1` to the URL to expose the model toggle and a stats overlay (FPS, latency).
