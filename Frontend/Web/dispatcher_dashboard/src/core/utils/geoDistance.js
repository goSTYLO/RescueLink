/**
 * Haversine distance in kilometers between two lat/lng points.
 * @returns {number|null} Distance in km, or null if inputs invalid
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;

  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Format distance from department HQ to incident for dashboard display.
 */
export function formatDepartmentToIncidentDistance(departmentLat, departmentLon, incidentLat, incidentLon) {
  const km = haversineKm(departmentLat, departmentLon, incidentLat, incidentLon);
  if (km == null) return { label: '—', hint: 'Department location not set' };
  return { label: `${km.toFixed(1)} km`, hint: 'From department HQ to incident' };
}
