const { validateLatitude, validateLongitude } = require('../utils/validation');
const { isPointInDagupan } = require('../utils/geolocation');

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
  }
};

module.exports = locationController;
