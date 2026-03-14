/**
 * Duplicate detection configuration - reads from environment variables
 * Thresholds are editable in Backend/.env without code deployment
 */

module.exports = {
  realTime: {
    radiusMeters: parseInt(process.env.DUPLICATE_RADIUS_METERS, 10) || 100,
    timeWindowMinutes: parseInt(process.env.DUPLICATE_TIME_WINDOW_MINUTES, 10) || 10,
    autoLinkThreshold: parseFloat(process.env.DUPLICATE_AUTO_LINK_THRESHOLD) || 0.8,
    flagThreshold: parseFloat(process.env.DUPLICATE_FLAG_THRESHOLD) || 0.5,
  },
  background: {
    radiusMeters: parseInt(process.env.DUPLICATE_BACKGROUND_RADIUS_METERS, 10) || 150,
    timeWindowMinutes: parseInt(process.env.DUPLICATE_BACKGROUND_TIME_WINDOW_MINUTES, 10) || 30,
    minClusterSize: parseInt(process.env.DUPLICATE_MIN_CLUSTER_SIZE, 10) || 2,
  },
  enabled: process.env.DUPLICATE_DETECTION_ENABLED !== 'false',
};
