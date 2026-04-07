export default function CameraControls({
  onStart,
  onStop,
  canStart,
  isRunning,
  zoom,
  onZoom,
  zoomCaps,
  className = "",
}) {
  const MIN_ZOOM = 1;
  const MAX_ZOOM = zoomCaps ? zoomCaps.max : 5;
  const zoomSteps = buildZoomSteps(MAX_ZOOM);
  const currentStepIndex = getClosestStepIndex(zoom, zoomSteps);

  const stepZoom = (direction) => {
    const nextIndex = Math.max(0, Math.min(zoomSteps.length - 1, currentStepIndex + direction));
    onZoom(zoomSteps[nextIndex]);
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative flex items-end justify-center gap-8">
        {isRunning ? (
          <>
            <button
              onClick={() => stepZoom(-1)}
              disabled={zoom <= MIN_ZOOM || currentStepIndex === 0}
              aria-label="Zoom out"
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xl text-white/80 backdrop-blur-md transition-transform duration-100 active:scale-95 disabled:opacity-25"
            >
              −
            </button>

            <div className="relative flex flex-col items-center">
              <button
                onClick={onStop}
                aria-label="Stop camera"
                className="h-[68px] w-[68px] rounded-full border-[3px] border-white/80 bg-black/20 backdrop-blur-sm transition-transform duration-100 active:scale-95 flex items-center justify-center"
              >
                <span className="block h-[22px] w-[22px] rounded-[4px] bg-white" />
              </button>
              <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-medium tabular-nums tracking-[0.2em] text-white/70 backdrop-blur-md">
                {zoomSteps[currentStepIndex].toFixed(zoomSteps[currentStepIndex] % 1 === 0 ? 0 : 1)}X
              </div>
            </div>

            <button
              onClick={() => stepZoom(1)}
              disabled={zoom >= MAX_ZOOM || currentStepIndex === zoomSteps.length - 1}
              aria-label="Zoom in"
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xl text-white/80 backdrop-blur-md transition-transform duration-100 active:scale-95 disabled:opacity-25"
            >
              +
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            disabled={!canStart}
            aria-label="Start camera"
            className="h-[68px] w-[68px] rounded-full border-[3px] border-white/80 bg-black/20 backdrop-blur-sm transition-transform duration-100 disabled:opacity-25 active:scale-95 flex items-center justify-center"
          >
            <span className="block h-[54px] w-[54px] rounded-full bg-white" />
          </button>
        )}
      </div>
    </div>
  );
}

function buildZoomSteps(maxZoom) {
  const normalizedMax = Math.max(1, Number(maxZoom?.toFixed?.(1) ?? 5));
  const steps = [1];

  if (normalizedMax <= 1) return steps;
  if (normalizedMax < 2) return [1, normalizedMax];

  for (let level = 2; level <= Math.floor(normalizedMax); level += 1) {
    steps.push(level);
  }

  if (steps[steps.length - 1] !== normalizedMax) {
    steps.push(normalizedMax);
  }

  return steps;
}

function getClosestStepIndex(zoom, steps) {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  steps.forEach((step, index) => {
    const distance = Math.abs(step - zoom);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}
