const { validateLatitude, validateLongitude } = require('../utils/validation');
const { isPointInDagupan } = require('../utils/geolocation');

const locationController = {
  // Check if coordinates are within Dagupan city boundaries
  async checkLocation(req, res) {
    try {
      const { latitude, longitude } = req.body;

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

      // Check if point is in Dagupan polygon
      const isInDagupan = isPointInDagupan(validatedLat, validatedLng);

      res.status(200).json({
        success: true,
        isInDagupan: isInDagupan,
        coordinates: {
          latitude: validatedLat,
          longitude: validatedLng
        },
        message: isInDagupan 
          ? 'The coordinates are within Dagupan city boundaries'
          : 'The coordinates are outside Dagupan city boundaries'
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
