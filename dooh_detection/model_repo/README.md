# model_repo

Local mirror of the Triton model repository that lives at `~/model_repo/` on
the GPU VM. The directory structure here is exactly what Triton expects to
find when started with `--model-repository=/models`.

```
model_repo/
  trio/
    config.pbtxt          # output dims [1, 39, 8400]  (seg-style YOLO)
    2/
      model.onnx          # not checked in — see 2/MODEL.md
  trio_strong/
    config.pbtxt          # output dims [1,  7, 8400]  (detection-only nano)
    1/
      model.onnx          # not checked in — see 1/MODEL.md
```

## Sync to the VM

```bash
rsync -av --exclude='MODEL.md' model_repo/ USER@VM_IP:~/model_repo/
```

The actual `model.onnx` weights are not tracked in git. Copy them onto the
VM directly into the appropriate version folder.

## Rules

- The weight file must be named exactly `model.onnx`.
- Triton tries to load every folder under `model_repo/`. Do not leave broken
  or in-progress models here — move them to `~/model_repo_DISABLED/` on the
  VM instead.
- `config.pbtxt` output dims must match the actual ONNX graph. Verify with:

  ```bash
  python3 - <<'PY'
  import onnx
  m = onnx.load("model.onnx")
  for o in m.graph.output:
      print(o.name, [d.dim_value or d.dim_param for d in o.type.tensor_type.shape.dim])
  PY
  ```
