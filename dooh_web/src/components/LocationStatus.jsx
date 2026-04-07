export default function LocationStatus({ coords, near, geoLoading, geoError }) {
    return (
      <div className="text-sm text-gray-200">
        {geoLoading && <div>Getting location…</div>}
        {geoError && <div className="text-red-300">Location error: {geoError}</div>}
        {coords && near && (
          <div>
            Distance: {Math.round(near.distance)}m · Accuracy: ±{Math.round(coords.accuracy)}m ·{" "}
            {near.ok ? "✅ Near landmark" : `❌ ${near.reason}`}
          </div>
        )}
      </div>
    );
  }
