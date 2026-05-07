# DOOH AR Senior D

A real-time AR experience that detects NYC landmarks (Empire State Building, Hudson Yards – The Edge, One World Trade) through a phone camera and overlays interactive effects on top of them. The system pairs a YOLO-based building detector with a React/PixiJS frontend that renders 2D and 3D AR filters anchored to the detected building.

## Project Structure

```
DOOH-AR-Senior-D/
├── dooh_ai/           # Model training, fine-tuning, and inference experiments
│   ├── models/        # ONNX / weights for the building detectors
│   ├── scripts/       # Dataset utilities (e.g. HEIC → JPG)
│   └── *.ipynb        # Notebooks for training and evaluation
└── dooh_web/          # React + Vite + PixiJS web app (the AR demo)
    ├── public/        # Bundled ONNX models served to the browser
    └── src/           # App, hooks, AR filters, detector clients, UI
```

## Detection modes

The web app supports three detection backends, switchable at runtime via `?debug=1` or the `ModelToggle`:

- **original** — remote WebSocket inference (`VITE_DETECT_WS_URL`)
- **strong** — remote WebSocket inference using a heavier model (`VITE_DETECT_WS_URL_STRONG`)
- **local** — in-browser ONNX Runtime Web inference (no network hop)

## Supported landmarks

- Empire State Building
- Hudson Yards — The Edge
- One World Trade Center

## Quick start

See [`dooh_web/README.md`](dooh_web/README.md) for running the AR app and [`dooh_ai/README.md`](dooh_ai/README.md) for the training / inference toolchain.
