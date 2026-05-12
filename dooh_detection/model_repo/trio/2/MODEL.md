# trio model weights

The ONNX weights go here as `model.onnx` (Triton requires that exact filename).

This file is intentionally a placeholder — the actual weights are kept off
the repo. On the VM:

```
~/model_repo/trio/2/model.onnx
```

Expected ONNX shapes:

- INPUT  `images`  [1, 3, 640, 640]
- OUTPUT `output0` [1, 39, 8400]

If you replace these weights and the output shape changes, update
`../config.pbtxt` to match.
