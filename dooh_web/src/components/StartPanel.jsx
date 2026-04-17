import LocationStatus from "./LocationStatus";

export default function StartPanel({
  canStart,
  detectionMode,
  onDetectionMode,
  mockLocation,
  onMockLocation,
  coords,
  near,
  geoLoading,
  geoError,
  modelReady,
  onStart,
}) {
  return (
    <div className="pointer-events-auto w-full px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8 sm:pb-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-black/55 p-4 shadow-2xl shadow-black/40 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => onDetectionMode("api")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              detectionMode === "api"
                ? "bg-white text-black"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            API
          </button>
          <button
            type="button"
            onClick={() => onDetectionMode("local")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              detectionMode === "local"
                ? "bg-white text-black"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            Local
          </button>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          <span>Mock location</span>
          <input
            type="checkbox"
            checked={mockLocation}
            onChange={(e) => onMockLocation(e.target.checked)}
            className="h-5 w-5 rounded"
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/80">
          <LocationStatus coords={coords} near={near} geoLoading={geoLoading} geoError={geoError} />
          <div className="mt-2 text-white/45">
            {modelReady ? "Detector ready" : "Detector loading"}
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="h-12 rounded-full bg-white px-6 text-sm font-bold uppercase tracking-[0.22em] text-black transition active:scale-[0.98] disabled:opacity-40"
        >
          Start
        </button>
      </div>
    </div>
  );
}
