# DOOH AR Senior D

A real-time AR experience that detects NYC landmarks (Empire State Building, Hudson Yards – The Edge, One World Trade) through a phone camera and overlays interactive effects on top of them. The system pairs a YOLO-based building detector with a React/PixiJS frontend that renders 2D and 3D AR filters anchored to the detected building.

## Project Structure

```
DOOH-AR-Senior-D/
├── dooh_ai/           # Model training, fine-tuning, and inference experiments
│   ├── models/        # ONNX / weights for the building detectors
│   ├── scripts/       # Dataset utilities (e.g. HEIC → JPG)
│   └── *.ipynb        # Notebooks for training and evaluation
├── dooh_detection/    # GPU detection backend (FastAPI + Triton on a GCP VM)
│   ├── detect_api.py  # FastAPI server: /ws, /ws_strong, /detect, /detect_strong
│   ├── model_repo/    # Mirror of the Triton model repo (configs tracked, weights not)
│   ├── systemd/       # detect.service + triton.service units
│   └── Documentation.md
└── dooh_web/          # React + Vite + PixiJS web app (the AR demo)
    ├── public/        # Bundled ONNX models served to the browser
    └── src/           # App, hooks, AR filters, detector clients, UI
```

## Detection modes

The web app supports three detection backends, switchable at runtime via `?debug=1` or the `ModelToggle`:

- **original** — remote WebSocket inference, `trio` model (`VITE_DETECT_WS_URL` → `/ws`)
- **strong** — remote WebSocket inference, `trio_strong` model (`VITE_DETECT_WS_URL_STRONG` → `/ws_strong`)
- **local** — in-browser ONNX Runtime Web inference (no network hop)

> Despite the name, `trio_strong` is currently a **lighter** nano detection-only model, not a heavier one. The name stuck from an earlier iteration and was kept to avoid churning call sites. See [`dooh_detection/Documentation.md`](dooh_detection/Documentation.md) for backend details.

## Supported landmarks

- Empire State Building
- Hudson Yards — The Edge
- One World Trade Center

## Quick start

- [`dooh_web/README.md`](dooh_web/README.md) — running the AR web app
- [`dooh_ai/README.md`](dooh_ai/README.md) — training / inference toolchain
- [`dooh_detection/Documentation.md`](dooh_detection/Documentation.md) — GPU detection backend (FastAPI + Triton + Caddy on a GCP VM)

### DISCLAIMER: WE HAVE USED AI FOR DOCUMENTATION, CLEANUP AND CODE REVIEW
