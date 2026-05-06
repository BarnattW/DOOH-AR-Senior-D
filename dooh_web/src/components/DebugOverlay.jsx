import { useEffect, useRef, useState } from "react";

// Toggleable via ?debug=1 in URL. Reads stats from a ref so it doesn't
// re-render the high-FPS render loop.
export default function DebugOverlay({ statsRef, model, sessionUrl }) {
  const [enabled] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1"
  );
  const [, setTick] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    const loop = (t) => {
      if (t - last > 250) { setTick((n) => n + 1); last = t; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled]);

  if (!enabled) return null;

  const s = statsRef.current || {};
  const fps = s.fps != null ? s.fps.toFixed(1) : "—";
  const latency = s.latencyMs != null ? `${s.latencyMs.toFixed(0)}ms` : "—";
  const wsState = sessionUrl ? "open" : "closed";

  return (
    <div className="pointer-events-none absolute right-2 top-20 z-50 rounded-md bg-black/75 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-emerald-300">
      <div>model: {model}</div>
      <div>ws: {wsState}</div>
      <div>fps: {fps}</div>
      <div>latency: {latency}</div>
    </div>
  );
}
