// Uses global fetch (Node 18+). Ensure Node >= 18 as configured in package.json engines.

export type LatLng = { lat: number; lng: number };

function getApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
}

export async function estimateTravelMinutes(origin: LatLng, destination: LatLng): Promise<number | null> {
  const key = getApiKey();
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      key,
      mode: 'driving',
    });
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    const sec = el?.duration_in_traffic?.value || el?.duration?.value;
    if (!sec || !Number.isFinite(sec)) return null;
    return Math.max(1, Math.round(sec / 60));
  } catch {
    return null;
  }
}
