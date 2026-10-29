export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoJsonPolygon {
  type: "Polygon";
  /**
   * GeoJSON polygon coordinates.
   * coordinates[0] is the exterior linear ring.
   * Each position is [longitude, latitude].
   */
  coordinates: number[][][];
}

/**
 * Validates whether a GeoJSON polygon has at least 3 distinct vertices.
 */
export function isValidPolygon(polygon: unknown): polygon is GeoJsonPolygon {
  if (!polygon || typeof polygon !== "object") return false;
  const p = polygon as Partial<GeoJsonPolygon>;
  if (p.type !== "Polygon" || !Array.isArray(p.coordinates) || p.coordinates.length === 0) {
    return false;
  }
  const exterior = p.coordinates[0];
  if (!Array.isArray(exterior) || exterior.length < 3) {
    return false;
  }
  for (const pt of exterior) {
    if (!Array.isArray(pt) || pt.length < 2) return false;
    const [lng, lat] = pt;
    if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) {
      return false;
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a point {lat, lng} is inside a GeoJSON polygon using ray-casting.
 * GeoJSON polygon coordinates are in [longitude, latitude] format.
 */
export function isPointInPolygon(
  point: GeoPoint,
  polygon: GeoJsonPolygon
): boolean {
  const { lat, lng } = point;
  const rings = polygon.coordinates;
  if (!rings || rings.length === 0) return false;

  function pointInRing(ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0]; // longitude
      const yi = ring[i][1]; // latitude
      const xj = ring[j][0]; // longitude
      const yj = ring[j][1]; // latitude

      // Check on-vertex or horizontal edge case
      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  // 1. Must be inside exterior ring
  const inExterior = pointInRing(rings[0]);
  if (!inExterior) return false;

  // 2. Must NOT be inside any interior rings (holes)
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(rings[i])) {
      return false;
    }
  }

  return true;
}
