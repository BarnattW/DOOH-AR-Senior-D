export default function CameraControls({
  onStart,
  onCapture,
  lastPhoto,
  onOpenLibrary,
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
    <div className={`w-full ${className}`}>
      {isRunning ? (
        <div className="relative flex items-center justify-center">
          {/* Zoom out — left of shutter */}
          <button
            onClick={() => stepZoom(-1)}
            disabled={currentStepIndex === 0}
            aria-label="Zoom out"
            className="mr-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xl text-white/80 backdrop-blur-md transition-transform duration-100 active:scale-95 disabled:opacity-25"
          >
            -
          </button>

          {/* Shutter */}
          <div className="flex flex-col items-center">
            <button
              onClick={onCapture}
              aria-label="Take photo"
              className="h-[68px] w-[68px] rounded-full border-[3px] border-white/80 bg-black/20 backdrop-blur-sm transition-transform duration-100 active:scale-95 flex items-center justify-center"
            >
              <span className="block h-[54px] w-[54px] rounded-full bg-white" />
            </button>
            <div className="mt-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-medium tabular-nums tracking-[0.2em] text-white/70 backdrop-blur-md">
              {zoomSteps[currentStepIndex].toFixed(zoomSteps[currentStepIndex] % 1 === 0 ? 0 : 1)}X
            </div>
          </div>

          {/* Zoom in — right of shutter */}
          <button
            onClick={() => stepZoom(1)}
            disabled={currentStepIndex === zoomSteps.length - 1}
            aria-label="Zoom in"
            className="ml-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-xl text-white/80 backdrop-blur-md transition-transform duration-100 active:scale-95 disabled:opacity-25"
          >
            +
          </button>

          {/* Gallery — bottom right, iPhone-style */}
          <button
            onClick={onOpenLibrary}
            disabled={!lastPhoto}
            aria-label="Open photo library"
            className="absolute right-0 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-white/30 bg-black/35 text-white/80 shadow-lg shadow-black/30 backdrop-blur-md transition-transform duration-100 active:scale-95 disabled:opacity-35"
          >
            {lastPhoto ? (
              <img
                src={lastPhoto.url}
                alt=""
                className="h-full w-full object-cover"
                draggable="false"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="flex justify-center">
          <button
            onClick={onStart}
            disabled={!canStart}
            aria-label="Start camera"
            className="h-[68px] w-[68px] rounded-full border-[3px] border-white/80 bg-black/20 backdrop-blur-sm transition-transform duration-100 disabled:opacity-25 active:scale-95 flex items-center justify-center"
          >
            <span className="block h-[54px] w-[54px] rounded-full bg-white" />
          </button>
        </div>
      )}
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
