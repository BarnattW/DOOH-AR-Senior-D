import LocationStatus from "./LocationStatus";
import ModelToggle from "./ModelToggle";

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
        <ModelToggle mode={detectionMode} onMode={onDetectionMode} />

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
          className="font-syne h-12 rounded-full bg-accent px-6 text-sm font-bold uppercase tracking-[0.22em] text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Start
        </button>
      </div>
    </div>
  );
}
