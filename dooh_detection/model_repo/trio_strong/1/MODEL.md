# trio_strong model weights

The ONNX weights go here as `model.onnx` (Triton requires that exact filename).

This file is intentionally a placeholder — the actual weights are kept off
the repo. On the VM:

```
~/model_repo/trio_strong/1/model.onnx
```

> Naming caveat: `trio_strong` is **not** a stronger model. It is currently a
> lighter nano detection-only variant. The name was kept because changing it
> required updating too many call sites.

Expected ONNX shapes:

- INPUT  `images`  [1, 3, 640, 640]
- OUTPUT `output0` [1, 7, 8400]

If you replace these weights and the output shape changes, update
`../config.pbtxt` to match. The historical Triton crash on this model was
caused exactly by a config/ONNX shape mismatch (`[1,39,8400]` vs `[1,7,8400]`).
