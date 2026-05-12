# dooh_ai

Model training and export pipeline for the DOOH AR building detector. Detects three NYC landmarks:
- Hudson Yards – The Edge
- The Empire State Building
- World Trade Center

## Setup

Requires Python 3.11. Dependencies are managed with [uv](https://github.com/astral-sh/uv). An alternative would be to use conda's runtime environment to run scripts and train models.
Feel free to switch up requirements as per your system requirements and compatiability.

```bash
uv sync
```

Activate the environment:

```bash
# Windows
.\.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

If your editor doesn't detect the environment automatically, point it to `.venv\Scripts\python.exe` (VS Code: `Ctrl+Shift+P` → `Python: Select Interpreter`).

> **Note:** `pyproject.toml` is configured for Windows + CUDA 12.1 by default (PyTorch cu121 builds). On macOS/Linux the CPU builds are used automatically via platform markers.

## Model choices

Training uses **YOLOv8n** (nano), the smallest variant in the YOLOv8 family. This was chosen to keep the ONNX export small enough for in-browser inference via `onnxruntime-web`, where model size directly affects load time and memory. Later on, inference was transferred to a dedicated backend server, but we continued used the nano model for its fast inference time.

Two export precisions are produced:
- **FP16** — smaller model, less precise
- **FP32** — default choice with higher precision

The dataset (`DOOH-AR-Senior-D-8/`) is sourced from Roboflow (version 8) and contains segmentation annotations. `training.py` includes a label-cleaning step that strips malformed detection-format lines from segmentation label files before training begins. The dataset is potentially mixed between segmentation and detection labelling. Use detection models if unsure.

## Training

```bash
python scripts/training.py
```

This will:
1. Clean the dataset labels (remove empty pairs, strip 5-token detection lines from segmentation files)
2. Train YOLOv8n for 150 epochs on the dataset with cosine LR schedule
3. Export the best weights to `models/custom/fp16/` and `models/custom/fp32/` as ONNX

Training requires a CUDA GPU. Results and plots are saved to `runs/detect/train/`.

## Export (standalone)

If you already have a trained `.pt` file and just want to export:

```bash
python scripts/export.py
# or specify a custom weights path:
python scripts/export.py path/to/best.pt
```

Defaults to `runs/detect/train/weights/best.pt`. Exports both FP16 and FP32 ONNX models to `models/custom/`.

## Notebook

`yolov8_test.ipynb` is used for exploratory inference — load a trained model and run it against the test images in `test_images/` to visually verify predictions before exporting.

```bash
# make sure the dev dependencies are installed
uv sync --group dev
jupyter notebook yolov8_test.ipynb
```

## Dataset
Our project uses roboflow to maintain a repository of data for machine learning, where the data is to be labelled and exported.

`DOOH-AR-Senior-D-8/` — Roboflow dataset version 8, CC BY 4.0.  
Project: [dooh-ar-senior-d-ud86j](https://universe.roboflow.com/senior-d-dooh-ar/dooh-ar-senior-d-ud86j/dataset/8)
