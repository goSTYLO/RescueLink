const { calculateDuplicateConfidence } = require('../src/services/duplicateDetectionService');

describe('duplicateDetectionService', () => {
  describe('calculateDuplicateConfidence', () => {
    const radiusMeters = 100;
    const timeWindowMinutes = 10;

    it('should return high confidence for same location and time', () => {
      const now = new Date();
      const newReport = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const existing = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const score = calculateDuplicateConfidence(newReport, existing, radiusMeters, timeWindowMinutes);
      expect(score).toBeGreaterThan(0.9);
    });

    it('should return low confidence for distant locations', () => {
      const now = new Date();
      const newReport = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const existing = { latitude: 16.1, longitude: 120.1, created_at: now, incident_type: 'fire' };
      const score = calculateDuplicateConfidence(newReport, existing, radiusMeters, timeWindowMinutes);
      expect(score).toBeLessThan(0.5);
    });

    it('should return 0 when distance exceeds radius', () => {
      const now = new Date();
      const newReport = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const existing = { latitude: 16.5, longitude: 120.5, created_at: now, incident_type: 'fire' };
      const score = calculateDuplicateConfidence(newReport, existing, radiusMeters, timeWindowMinutes);
      expect(score).toBe(0);
    });

    it('should give bonus for same incident type', () => {
      const now = new Date();
      // Use slightly different locations so we're not at score cap
      const newReport = { latitude: 16.0005, longitude: 120.0005, created_at: now, incident_type: 'fire' };
      const existingSame = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const existingDiff = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'medical' };
      const scoreSame = calculateDuplicateConfidence(newReport, existingSame, radiusMeters, timeWindowMinutes);
      const scoreDiff = calculateDuplicateConfidence(newReport, existingDiff, radiusMeters, timeWindowMinutes);
      expect(scoreSame).toBeGreaterThanOrEqual(scoreDiff);
      expect(scoreDiff).toBeLessThan(1);
    });

    it('should return 0 when time difference exceeds window', () => {
      const now = new Date();
      const later = new Date(now.getTime() + 15 * 60 * 1000);
      const newReport = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const existing = { latitude: 16.0, longitude: 120.0, created_at: later, incident_type: 'fire' };
      const score = calculateDuplicateConfidence(newReport, existing, radiusMeters, timeWindowMinutes);
      expect(score).toBe(0);
    });

    it('should return score between 0 and 1', () => {
      const now = new Date();
      const newReport = { latitude: 16.0001, longitude: 120.0001, created_at: now, incident_type: 'fire' };
      const existing = { latitude: 16.0, longitude: 120.0, created_at: now, incident_type: 'fire' };
      const score = calculateDuplicateConfidence(newReport, existing, radiusMeters, timeWindowMinutes);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
