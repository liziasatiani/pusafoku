export type View = { lon: number; lat: number; k: number };

export const MAX_ZOOM = 60;

export function baseScale(width: number, height: number): number {
  const fit = Math.min(width / 360, height / 180);
  return width / height < 1.4 ? Math.max(width / 360, height / 180) : fit;
}

export function clampView(view: View, width: number, height: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k));
  const scale = baseScale(width, height) * k;
  const halfLon = width / (2 * scale);
  const halfLat = height / (2 * scale);
  const lon = halfLon >= 180 ? 0 : Math.min(180 - halfLon, Math.max(-180 + halfLon, view.lon));
  const lat = halfLat >= 90 ? 0 : Math.min(90 - halfLat, Math.max(-90 + halfLat, view.lat));
  return { lon, lat, k };
}

export function project(view: View, width: number, height: number, lon: number, lat: number): [number, number] {
  const scale = baseScale(width, height) * view.k;
  return [width / 2 + (lon - view.lon) * scale, height / 2 - (lat - view.lat) * scale];
}

export function unproject(view: View, width: number, height: number, x: number, y: number): [number, number] {
  const scale = baseScale(width, height) * view.k;
  return [view.lon + (x - width / 2) / scale, view.lat - (y - height / 2) / scale];
}

export function zoomAt(view: View, width: number, height: number, x: number, y: number, factor: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k * factor));
  const [lon, lat] = unproject(view, width, height, x, y);
  const scale = baseScale(width, height) * k;
  return clampView({ lon: lon - (x - width / 2) / scale, lat: lat + (y - height / 2) / scale, k }, width, height);
}

export function panBy(view: View, width: number, height: number, dx: number, dy: number): View {
  const scale = baseScale(width, height) * view.k;
  return clampView({ ...view, lon: view.lon - dx / scale, lat: view.lat + dy / scale }, width, height);
}

export function gridStep(k: number): number {
  if (k < 2) return 30;
  if (k < 5) return 15;
  if (k < 12) return 10;
  if (k < 30) return 5;
  return 2;
}
