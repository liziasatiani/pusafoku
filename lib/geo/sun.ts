const RAD = Math.PI / 180;

export function subsolar(at: number): { lat: number; lon: number } {
  const d = at / 86400000 - 10957.5;
  const meanLon = 280.46 + 0.9856474 * d;
  const anomaly = (357.528 + 0.9856003 * d) * RAD;
  const eclipticLon = (meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const tilt = (23.439 - 0.0000004 * d) * RAD;
  const declination = Math.asin(Math.sin(tilt) * Math.sin(eclipticLon));
  const ascension = Math.atan2(Math.cos(tilt) * Math.sin(eclipticLon), Math.cos(eclipticLon));
  const sidereal = (280.46061837 + 360.98564736629 * d) % 360;
  let lon = ascension / RAD - sidereal;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: declination / RAD, lon };
}

export function nightPolygon(at: number, stepDegrees = 2): [number, number][] {
  const sun = subsolar(at);
  const tan = Math.tan(sun.lat * RAD);
  const safe = Math.abs(tan) < 1e-6 ? 1e-6 : tan;
  const edge: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += stepDegrees) {
    edge.push([lon, Math.atan(-Math.cos((lon - sun.lon) * RAD) / safe) / RAD]);
  }
  const pole = sun.lat >= 0 ? -90 : 90;
  return [...edge, [180, pole], [-180, pole]];
}
