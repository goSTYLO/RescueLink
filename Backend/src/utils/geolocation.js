const fs = require('fs');
const path = require('path');

// Cache for the loaded polygon
let dagupanPolygon = null;

// Cache for the loaded barangays GeoJSON
let dagupanBarangaysFeatures = null;

/**
 * Load and parse the Dagupan GeoJSON file, extracting the polygon coordinates
 * @returns {Array} Array of [longitude, latitude] coordinate pairs
 */
function loadDagupanPolygon() {
  if (dagupanPolygon) {
    return dagupanPolygon;
  }

  try {
    const geojsonPath = path.join(__dirname, '../goelogical_polygon/dagupan.geojson');
    const geojsonData = fs.readFileSync(geojsonPath, 'utf8');
    const geojson = JSON.parse(geojsonData);

    // Extract polygon coordinates from the first feature
    // GeoJSON format: features[0].geometry.coordinates[0] contains the outer ring
    if (geojson.features && geojson.features.length > 0) {
      const geometry = geojson.features[0].geometry;
      if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates.length > 0) {
        dagupanPolygon = geometry.coordinates[0]; // First ring is the outer boundary
        return dagupanPolygon;
      }
    }

    throw new Error('Invalid GeoJSON structure: Could not find polygon coordinates');
  } catch (error) {
    throw new Error(`Failed to load Dagupan polygon: ${error.message}`);
  }
}

/**
 * Calculate the distance between two points in meters using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a point is inside a polygon using the ray casting algorithm
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygon - Array of [lng, lat] coordinate pairs forming the polygon
 * @returns {boolean} True if point is inside polygon, false otherwise
 */
function pointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) {
    return false;
  }

  let inside = false;
  const x = lng;
  const y = lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]; // longitude
    const yi = polygon[i][1]; // latitude
    const xj = polygon[j][0]; // longitude
    const yj = polygon[j][1]; // latitude

    // Ray casting algorithm: check if ray from point crosses polygon edge
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is within the polygon or within buffer distance from nearest edge
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygon - Array of [lng, lat] coordinate pairs forming the polygon
 * @param {number} bufferMeters - Buffer distance in meters (default: 0)
 * @returns {boolean} True if point is in polygon or within buffer distance
 */
function pointInPolygonWithBuffer(lat, lng, polygon, bufferMeters = 0) {
  // First check if point is inside polygon
  if (pointInPolygon(lat, lng, polygon)) {
    return true;
  }

  // If buffer is 0 or not specified, return false
  if (!bufferMeters || bufferMeters <= 0) {
    return false;
  }

  // Check distance to nearest polygon edge
  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    // Find closest point on line segment p1-p2
    const distToSegment = distanceToLineSegment(lat, lng, p1[1], p1[0], p2[1], p2[0]);
    minDistance = Math.min(minDistance, distToSegment);

    if (minDistance <= bufferMeters) {
      return true;
    }
  }

  return minDistance <= bufferMeters;
}

/**
 * Calculate shortest distance from a point to a line segment
 * @param {number} lat - Latitude of point
 * @param {number} lng - Longitude of point
 * @param {number} lat1 - Latitude of segment start
 * @param {number} lng1 - Longitude of segment start
 * @param {number} lat2 - Latitude of segment end
 * @param {number} lng2 - Longitude of segment end
 * @returns {number} Distance in meters
 */
function distanceToLineSegment(lat, lng, lat1, lng1, lat2, lng2) {
  const A = lat - lat1;
  const B = lng - lng1;
  const C = lat2 - lat1;
  const D = lng2 - lng1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lat1;
    yy = lng1;
  } else if (param > 1) {
    xx = lat2;
    yy = lng2;
  } else {
    xx = lat1 + param * C;
    yy = lng1 + param * D;
  }

  return calculateDistance(lat, lng, xx, yy);
}

/**
 * Load and parse the Dagupan barangays GeoJSON file (cached).
 * @returns {Array} Array of GeoJSON features (each with properties.NAME_3 and geometry)
 */
function loadDagupanBarangays() {
  if (dagupanBarangaysFeatures) {
    return dagupanBarangaysFeatures;
  }

  try {
    const geojsonPath = path.join(__dirname, '../goelogical_polygon/dagupan_barangays.geojson');
    const geojsonData = fs.readFileSync(geojsonPath, 'utf8');
    const geojson = JSON.parse(geojsonData);

    if (geojson.features && Array.isArray(geojson.features)) {
      dagupanBarangaysFeatures = geojson.features;
      return dagupanBarangaysFeatures;
    }

    throw new Error('Invalid GeoJSON structure: no features array');
  } catch (error) {
    throw new Error(`Failed to load Dagupan barangays: ${error.message}`);
  }
}

/**
 * Get barangay name for a point (latitude, longitude) using point-in-polygon
 * against dagupan_barangays.geojson. Handles MultiPolygon (tests each polygon's exterior ring).
 * @param {number} latitude - Latitude of the point
 * @param {number} longitude - Longitude of the point
 * @returns {string|null} Barangay name (NAME_3) or null if not inside any barangay
 */
function getBarangayFromCoordinates(latitude, longitude) {
  let features;
  try {
    features = loadDagupanBarangays();
  } catch (err) {
    console.error('getBarangayFromCoordinates: could not load barangays GeoJSON', err.message);
    return null;
  }

  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'MultiPolygon' || !geometry.coordinates) continue;

    // MultiPolygon: coordinates is array of polygons; each polygon is array of rings (first = exterior)
    for (const polygon of geometry.coordinates) {
      if (!polygon || !polygon[0]) continue;
      const exteriorRing = polygon[0];
      if (pointInPolygon(latitude, longitude, exteriorRing)) {
        const name = feature.properties && feature.properties.NAME_3;
        return name || null;
      }
    }
  }

  return null;
}

/**
 * Check if a point (latitude, longitude) is within Dagupan city boundaries
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {number} bufferMeters - Buffer distance in meters (default: 0)
 * @returns {boolean} True if point is in Dagupan or within buffer distance, false otherwise
 */
function isPointInDagupan(lat, lng, bufferMeters = 0) {
  const polygon = loadDagupanPolygon();
  return pointInPolygonWithBuffer(lat, lng, polygon, bufferMeters);
}

module.exports = {
  loadDagupanPolygon,
  loadDagupanBarangays,
  getBarangayFromCoordinates,
  pointInPolygon,
  pointInPolygonWithBuffer,
  calculateDistance,
  distanceToLineSegment,
  isPointInDagupan
};
