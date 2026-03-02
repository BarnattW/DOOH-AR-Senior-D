function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

export function isNearLandmark(user, landmark, radiusM) {
  const d = haversineMeters({ lat: user.lat, lng: user.lng }, landmark);

  // Hard reject if accuracy is terrible
  if (user.accuracy > 150) return { ok: false, distance: d, reason: "low_accuracy"};

  // If you want to be conservative:
  if (d > radiusM) return { ok: false, distance: d, reason: "too_far"};

  return { ok: true, distance: d, reason: null };
}