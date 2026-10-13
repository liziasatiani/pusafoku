export type Topology = {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: { countries: { geometries: Geometry[] } };
};

type Geometry = { type: string; arcs?: number[][] | number[][][]; properties?: { name?: string } };

export type Country = { name: string; polygons: Float32Array[][]; west: number; east: number; south: number; north: number };

function decodeArcs(topology: Topology): Float32Array[] {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    const out = new Float32Array(arc.length * 2);
    let x = 0;
    let y = 0;
    arc.forEach(([dx, dy], i) => {
      x += dx;
      y += dy;
      out[i * 2] = x * sx + tx;
      out[i * 2 + 1] = y * sy + ty;
    });
    return out;
  });
}

function ring(indexes: number[], arcs: Float32Array[]): Float32Array {
  const parts: number[] = [];
  indexes.forEach((index) => {
    const reversed = index < 0;
    const arc = arcs[reversed ? ~index : index];
    const count = arc.length / 2;
    for (let n = 0; n < count; n++) {
      const i = reversed ? count - 1 - n : n;
      if (parts.length > 0 && n === 0) continue;
      parts.push(arc[i * 2], arc[i * 2 + 1]);
    }
  });
  return Float32Array.from(parts);
}

export function decodeCountries(topology: Topology): Country[] {
  const arcs = decodeArcs(topology);
  const countries: Country[] = [];
  for (const geometry of topology.objects.countries.geometries) {
    if (!geometry.arcs) continue;
    const polygons = (geometry.type === "Polygon" ? [geometry.arcs as number[][]] : geometry.type === "MultiPolygon" ? (geometry.arcs as number[][][]) : []).map((rings) => rings.map((r) => ring(r, arcs)));
    let west = 180;
    let east = -180;
    let south = 90;
    let north = -90;
    for (const rings of polygons) {
      const outer = rings[0];
      if (!outer) continue;
      for (let i = 0; i < outer.length; i += 2) {
        west = Math.min(west, outer[i]);
        east = Math.max(east, outer[i]);
        south = Math.min(south, outer[i + 1]);
        north = Math.max(north, outer[i + 1]);
      }
    }
    if (polygons.length > 0) countries.push({ name: geometry.properties?.name ?? "", polygons, west, east, south, north });
  }
  return countries;
}
