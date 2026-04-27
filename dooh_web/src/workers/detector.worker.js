import * as ort from "onnxruntime-web";

const ORT_WASM_VERSION = "1.22.0";
const WASM_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WASM_VERSION}/dist/`;
const LETTERBOX_SIZE = 640;

let session = null;

(async () => {
  try {
    ort.env.wasm.wasmPaths = WASM_CDN_BASE;
    // Multi-threading requires crossOriginIsolated (COOP/COEP headers)
    ort.env.wasm.numThreads = self.crossOriginIsolated ? (navigator.hardwareConcurrency ?? 4) : 1;

    // WebNN uses the browser's native ML stack (Chrome 121+ / Edge) — better op
    // coverage than WebGPU EP and hardware-accelerated. Falls back to WASM.
    const providers = typeof navigator !== "undefined" && "ml" in navigator
      ? ["webnn", "wasm"]
      : ["wasm"];

    session = await ort.InferenceSession.create("/trio_finetuned_32.onnx", {
      executionProviders: providers,
    });
    console.log("[worker] session ready — EP:", providers[0], "| threads:", ort.env.wasm.numThreads, "| outputs:", session.outputNames);
    postMessage({ type: "ready" });
  } catch (e) {
    postMessage({ type: "error", message: e.message });
  }
})();

self.onmessage = async ({ data }) => {
  if (data.type !== "infer") return;
  if (!session) {
    postMessage({ type: "result", id: data.id, outputData: null });
    return;
  }
  try {
    const input = new ort.Tensor("float32", data.imgData, [1, 3, LETTERBOX_SIZE, LETTERBOX_SIZE]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    const out = outputs[session.outputNames[0]];
    const resultData = new Float32Array(out.data);
    postMessage(
      { type: "result", id: data.id, outputData: resultData, dims: [...out.dims] },
      [resultData.buffer]
    );
  } catch (e) {
    console.error("[worker] inference error:", e.message);
    postMessage({ type: "result", id: data.id, outputData: null, error: e.message });
  }
};
