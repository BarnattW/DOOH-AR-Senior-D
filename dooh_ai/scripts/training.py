from ultralytics import YOLO
import os, shutil, pathlib

def clean_labels(dataset_root):
    """
    1. Delete image+label pairs where the label file is empty.
    2. Strip detection-format lines (exactly 5 values) from segmentation label files.
       These cause the 'Box and segment counts should be equal' warning and crash training.
    """
    removed_empty = 0
    stripped_lines = 0

    for split in ("train", "valid", "test"):
        label_dir = pathlib.Path(dataset_root) / split / "labels"
        image_dir = pathlib.Path(dataset_root) / split / "images"
        if not label_dir.exists():
            continue

        for label_file in label_dir.glob("*.txt"):
            # Remove empty files + paired image
            if label_file.stat().st_size == 0:
                for ext in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
                    img = image_dir / (label_file.stem + ext)
                    if img.exists():
                        img.unlink()
                        break
                label_file.unlink()
                removed_empty += 1
                continue

            # Strip detection-only lines (5 tokens = class cx cy w h, no polygon)
            lines = label_file.read_text().splitlines()
            clean = [l for l in lines if len(l.split()) != 5]
            if len(clean) != len(lines):
                stripped_lines += len(lines) - len(clean)
                label_file.write_text("\n".join(clean) + "\n" if clean else "")

    print(f"Removed {removed_empty} empty-label pairs, stripped {stripped_lines} detect-format lines.")

def train_model():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_root = os.path.join(project_root, "DOOH-AR-Senior-D-8")
    data_yaml_path = os.path.join(dataset_root, "data.yaml")
    clean_labels(dataset_root)

    # Remove stale caches so Ultralytics rescans the cleaned labels
    for cache in pathlib.Path(dataset_root).rglob("*.cache"):
        cache.unlink()

    model = YOLO("yolov8s-seg.pt")

    results = model.train(
        data=data_yaml_path,
        device=0,
        epochs=150,
        patience=20,
        batch=16,
        workers=2,
        amp=True,
        lr0=0.01,
        cos_lr=True,
        warmup_epochs=3,
        flipud=0.0,
        degrees=10,
        perspective=0.0005,
        exist_ok=True,
        plots=True,
        val=True,
        verbose=True,
    )

    print("Training completed!")
    print(f"Results saved to: {results.save_dir}")

    # fp16 export
    fp16_path = model.export(
        format="onnx",
        device=0,
        opset=17,
        half=True,
        simplify=True,
        dynamic=False,
        project="./models/yolov8s/fp16",
        name="yolov8s_finetuned_fp16",
    )

    dst_fp16 = os.path.join(project_root, "models", "custom", "fp16")
    os.makedirs(dst_fp16, exist_ok=True)
    shutil.move(fp16_path, os.path.join(dst_fp16, "trio_finetuned_16.onnx"))

    # fp32 export
    fp32_path = model.export(
        format="onnx",
        opset=17,
        simplify=True,
        dynamic=False,
        project="./models/yolov8s/fp32",
        name="yolov8s_finetuned_fp32",
    )

    dst_fp32 = os.path.join(project_root, "models", "custom", "fp32")
    os.makedirs(dst_fp32, exist_ok=True)
    shutil.move(fp32_path, os.path.join(dst_fp32, "trio_finetuned_32.onnx"))

    print("Both FP16 and FP32 models exported and moved successfully!")

if __name__ == "__main__":
    train_model()
