from ultralytics import YOLO
import os, shutil

def train_model():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_yaml_path = os.path.join(project_root, "DOOH-AR-Senior-D-7", "data.yaml")

    # Load pre-trained model
    model = YOLO("yolov8n-seg.pt")


    # Train the model on your dataset
    results = model.train(
        data=data_yaml_path,
        device = 0,
        epochs=25,
        batch=16,
        workers=2,
        amp=True,
        lr0=0.01,
        exist_ok=True,
        plots=True,
        val=True,
        verbose=True
    )

    print("Training completed!")
    print(f"Results saved to: {results.save_dir}")

    # fp16 export
    fp16_path = model.export(
        format="onnx",
        device=0,
        opset=12
        half=True,
        simplify=True,
        dynamic=False,
        project="./models/yolov8n/fp16",
        name="yolov8n_edge_finetuned_fp16",
    )

    # Create destination and move file
    dst_fp16 = os.path.join(project_root, "models", "custom", "fp16")
    os.makedirs(dst_fp16, exist_ok=True)
    shutil.move(fp16_path, os.path.join(dst_fp16, "trio_finetuned_16.onnx"))

    # fp32 export
    fp32_path = model.export(
        format="onnx",
        simplify=True,
        dynamic=False,
        project="./models/yolov8n/fp32",
        name="yolov8n_edge_finetuned",
    )

    dst_fp32 = os.path.join(project_root, "models", "custom", "fp32")
    os.makedirs(dst_fp32, exist_ok=True)
    shutil.move(fp32_path, os.path.join(dst_fp32, "trio_finetuned_32.onnx"))

    print("Both FP16 and FP32 models exported and moved successfully!")

if __name__ == "__main__":
    train_model()