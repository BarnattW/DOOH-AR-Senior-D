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

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>

      {/* Zoom row — only when camera is active */}
      {isRunning && (
        <div className="flex items-center gap-3 w-full max-w-xs rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
          <button
            onClick={() => onZoom(Math.max(MIN_ZOOM, parseFloat((zoom - 0.5).toFixed(1))))}
            disabled={zoom <= MIN_ZOOM}
            className="text-white/50 disabled:opacity-20 text-xl w-6 text-center leading-none"
          >
            −
          </button>

          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoom}
            onChange={e => onZoom(parseFloat(e.target.value))}
            className="flex-1 h-px accent-white cursor-pointer"
          />

          <button
            onClick={() => onZoom(Math.min(MAX_ZOOM, parseFloat((zoom + 0.5).toFixed(1))))}
            disabled={zoom >= MAX_ZOOM}
            className="text-white/50 disabled:opacity-20 text-xl w-6 text-center leading-none"
          >
            +
          </button>

          <span className="text-white/40 text-xs tabular-nums w-9 text-right">
            {zoom.toFixed(1)}×
          </span>
        </div>
      )}

      {/* Shutter row */}
      <div className="flex items-center justify-center">
        {isRunning ? (
          /* Stop: square inside ring */
          <button
            onClick={onStop}
            aria-label="Stop camera"
            className="w-[68px] h-[68px] rounded-full border-[3px] border-white/80
              bg-black/20 backdrop-blur-sm flex items-center justify-center
              active:scale-95 transition-transform duration-100"
          >
            <span className="w-[22px] h-[22px] bg-white rounded-[4px] block" />
          </button>
        ) : (
          /* Start: disc inside ring */
          <button
            onClick={onStart}
            disabled={!canStart}
            aria-label="Start camera"
            className="w-[68px] h-[68px] rounded-full border-[3px] border-white/80
              bg-black/20 backdrop-blur-sm flex items-center justify-center
              disabled:opacity-25 active:scale-95 transition-transform duration-100"
          >
            <span className="w-[54px] h-[54px] bg-white rounded-full block" />
          </button>
        )}
      </div>
    </div>
  );
}
