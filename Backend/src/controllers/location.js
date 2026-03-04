const { validateLatitude, validateLongitude } = require('../utils/validation');
const { isPointInDagupan, calculateDistance, getBarangayFromCoordinates } = require('../utils/geolocation');
const Incident = require('../models/incident');

const DEFAULT_UNITS = [
  { id: 'BFP-FT-01', name: 'Fire Truck 01', department: 'Fire', availability: 'Available', latitude: 16.0455, longitude: 120.3412 },
  { id: 'CHO-AMB-01', name: 'Ambulance 01', department: 'Medical', availability: 'Available', latitude: 16.0441, longitude: 120.3386 },
  { id: 'PNP-PC-01', name: 'Patrol Car 01', department: 'Police', availability: 'Available', latitude: 16.043, longitude: 120.3367 },
  { id: 'DRRMO-RES-01', name: 'Rescue Unit 01', department: 'Disaster', availability: 'Available', latitude: 16.0463, longitude: 120.3394 },
];

function toMinutes(distanceMeters, speedKmh = 35) {
  const speedMetersPerMinute = (speedKmh * 1000) / 60;
  return Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));
}

function normalizeIncidentSeverityWeight(value) {
  const level = String(value || '').toLowerCase();
  if (level === 'high') return 3;
  if (level === 'medium') return 2;
  if (level === 'low') return 1;
  return 1;
}

const locationController = {
  // Check if coordinates are within Dagupan city boundaries
  async checkLocation(req, res) {
    try {
      const { latitude, longitude, bufferMeters } = req.body;

      // Validate required fields
      if (latitude === undefined || latitude === null) {
        return res.status(400).json({ error: 'Latitude is required' });
      }
      if (longitude === undefined || longitude === null) {
        return res.status(400).json({ error: 'Longitude is required' });
      }

      // Validate and parse coordinates
      const validatedLat = validateLatitude(latitude);
      const validatedLng = validateLongitude(longitude);

      // Parse buffer meters (optional, default to 0)
      let buffer = 0;
      if (bufferMeters !== undefined && bufferMeters !== null) {
        buffer = parseInt(bufferMeters, 10);
        if (isNaN(buffer) || buffer < 0) {
          return res.status(400).json({ error: 'bufferMeters must be a non-negative number' });
        }
      }

      // Check if point is in Dagupan polygon with optional buffer
      const isInDagupan = isPointInDagupan(validatedLat, validatedLng, buffer);

      res.status(200).json({
        success: true,
        isInDagupan: isInDagupan,
        coordinates: {
          latitude: validatedLat,
          longitude: validatedLng
        },
        bufferMeters: buffer,
        message: isInDagupan 
          ? `The coordinates are within Dagupan city boundaries${buffer > 0 ? ` (with ${buffer}m buffer)` : ''}`
          : `The coordinates are outside Dagupan city boundaries${buffer > 0 ? ` (even with ${buffer}m buffer)` : ''}`
      });
    } catch (error) {
      console.error('Error checking location:', error);
      if (error.message.includes('must be') || error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to check location' });
    }
  },

  async closestUnits(req, res) {
    try {
      const incident = req.body?.incident || {};
      const incidentLatitude = validateLatitude(incident.latitude);
      const incidentLongitude = validateLongitude(incident.longitude);
      const requestedUnits = Array.isArray(req.body?.units) ? req.body.units : [];
      const maxResults = Number.isFinite(Number(req.body?.limit))
        ? Math.min(Math.max(Number(req.body.limit), 1), 10)
        : 5;

      const candidateUnits = (requestedUnits.length > 0 ? requestedUnits : DEFAULT_UNITS)
        .map((unit, index) => {
          try {
            const latitude = validateLatitude(unit.latitude);
            const longitude = validateLongitude(unit.longitude);
            const distanceMeters = calculateDistance(incidentLatitude, incidentLongitude, latitude, longitude);
            return {
              id: unit.id || `unit-${index + 1}`,
              name: unit.name || `Unit ${index + 1}`,
              department: unit.department || 'General',
              availability: unit.availability || unit.status || 'Available',
              latitude,
              longitude,
              distanceMeters,
              etaMinutes: toMinutes(distanceMeters),
            };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, maxResults);

      res.status(200).json({
        success: true,
        incident: {
          latitude: incidentLatitude,
          longitude: incidentLongitude,
        },
        suggestions: candidateUnits,
      });
    } catch (error) {
      console.error('Error computing closest units:', error);
      if (error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to compute closest units' });
    }
  },

  async geofenceAlerts(req, res) {
    try {
      const bufferMeters = req.body?.bufferMeters != null ? Number(req.body.bufferMeters) : 0;
      if (!Number.isFinite(bufferMeters) || bufferMeters < 0) {
        return res.status(400).json({ error: 'bufferMeters must be a non-negative number' });
      }

      const sourceIncidents = Array.isArray(req.body?.incidents)
        ? req.body.incidents
        : await Incident.findAll({ limit: 100, offset: 0, status: 'pending' });

      const alerts = sourceIncidents
        .map((incident) => {
          const latitude = Number(incident.latitude);
          const longitude = Number(incident.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          const inside = isPointInDagupan(latitude, longitude, bufferMeters);
          if (inside) return null;
          return {
            report_id: incident.report_id || incident.id,
            latitude,
            longitude,
            barangay: incident.barangay || getBarangayFromCoordinates(latitude, longitude) || null,
            status: incident.status || null,
            severity_level: incident.severity_level || null,
            reason: 'Incident is outside configured Dagupan geofence',
          };
        })
        .filter(Boolean);

      res.status(200).json({
        success: true,
        bufferMeters,
        alertCount: alerts.length,
        alerts,
      });
    } catch (error) {
      console.error('Error generating geofence alerts:', error);
      res.status(500).json({ error: 'Failed to generate geofence alerts' });
    }
  },

  async heatmap(req, res) {
    try {
      const limit = Number.isFinite(Number(req.query?.limit))
        ? Math.min(Math.max(Number(req.query.limit), 1), 500)
        : 200;
      const incidents = await Incident.findAll({ limit, offset: 0 });

      const byBarangay = incidents.reduce((acc, incident) => {
        const key = incident.barangay || 'Unknown';
        if (!acc[key]) {
          acc[key] = {
            barangay: key,
            incidentCount: 0,
            heatScore: 0,
            criticalCount: 0,
            warningCount: 0,
          };
        }
        acc[key].incidentCount += 1;
        const weight = normalizeIncidentSeverityWeight(incident.severity_level);
        acc[key].heatScore += weight;
        if (weight === 3) acc[key].criticalCount += 1;
        if (weight === 2) acc[key].warningCount += 1;
        return acc;
      }, {});

      const hotspots = Object.values(byBarangay)
        .sort((a, b) => b.heatScore - a.heatScore)
        .slice(0, 20);

      res.status(200).json({
        success: true,
        hotspotCount: hotspots.length,
        hotspots,
      });
    } catch (error) {
      console.error('Error generating heatmap data:', error);
      res.status(500).json({ error: 'Failed to generate heatmap data' });
    }
  }
};

module.exports = locationController;
