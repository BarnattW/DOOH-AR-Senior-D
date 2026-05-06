from ultralytics import YOLO
import os, shutil, pathlib, argparse

def export_model(weights_path: str):
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model = YOLO(weights_path)

    # FP16
    fp16_path = model.export(
        format="onnx",
        device=0,
        opset=18,
        half=True,
        simplify=True,
        dynamic=False,
        project="./models/yolov8s/fp16",
        name="yolov8s_finetuned_fp16",
    )
    dst_fp16 = os.path.join(project_root, "models", "custom", "fp16")
    os.makedirs(dst_fp16, exist_ok=True)
    shutil.move(fp16_path, os.path.join(dst_fp16, "trio_finetuned_16_nano.onnx"))
    print(f"FP16 saved to {dst_fp16}")

    # FP32
    fp32_path = model.export(
        format="onnx",
        opset=18,
        simplify=True,
        dynamic=False,
        project="./models/yolov8s/fp32",
        name="yolov8s_finetuned_fp32",
    )
    dst_fp32 = os.path.join(project_root, "models", "custom", "fp32")
    os.makedirs(dst_fp32, exist_ok=True)
    shutil.move(fp32_path, os.path.join(dst_fp32, "trio_finetuned_32_nano.onnx"))
    print(f"FP32 saved to {dst_fp32}")

    print("Both models exported successfully!")

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    default_weights = os.path.join(project_root, "runs", "detect", "train", "weights", "best.pt")
    parser = argparse.ArgumentParser()
    parser.add_argument("weights", nargs="?", default=default_weights,
                        help="Path to .pt weights file")
    args = parser.parse_args()

    if not pathlib.Path(args.weights).exists():
        raise FileNotFoundError(f"Weights not found: {args.weights}")

    export_model(args.weights)
