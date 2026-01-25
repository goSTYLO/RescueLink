const fs = require('fs');
const path = require('path');

// Cache for the loaded polygon
let dagupanPolygon = null;

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
 * Check if a point (latitude, longitude) is within Dagupan city boundaries
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @returns {boolean} True if point is in Dagupan, false otherwise
 */
function isPointInDagupan(lat, lng) {
  const polygon = loadDagupanPolygon();
  return pointInPolygon(lat, lng, polygon);
}

module.exports = {
  loadDagupanPolygon,
  pointInPolygon,
  isPointInDagupan
};
