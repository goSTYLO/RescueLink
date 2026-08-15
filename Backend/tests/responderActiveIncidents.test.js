jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const {
  getActiveAssigned,
  ALERT_RADIUS_KM,
  incidentMatchesVolunteerSpecialization,
  isWithinVolunteerRadius,
} = require('../src/controllers/incidentAcceptance');

describe('responder active incidents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('incidentMatchesVolunteerSpecialization', () => {
    it('allows SOS for any specialization', () => {
      expect(incidentMatchesVolunteerSpecialization('sos', ['medical'])).toBe(true);
    });

    it('allows matching specialization types', () => {
      expect(incidentMatchesVolunteerSpecialization('medical', ['medical'])).toBe(true);
      expect(incidentMatchesVolunteerSpecialization('Medical', ['medical'])).toBe(true);
    });

    it('rejects mismatched specialization types', () => {
      expect(incidentMatchesVolunteerSpecialization('fire', ['medical'])).toBe(false);
    });

    it('allows all types when volunteer has empty specialization list', () => {
      expect(incidentMatchesVolunteerSpecialization('fire', [])).toBe(true);
      expect(incidentMatchesVolunteerSpecialization('fire', null)).toBe(true);
    });
  });

  describe('isWithinVolunteerRadius', () => {
    it('skips radius check when volunteer location is missing', () => {
      expect(isWithinVolunteerRadius(null, null, 16.04, 120.33)).toBe(true);
    });

    it('rejects incidents outside alert radius', () => {
      expect(isWithinVolunteerRadius(16.043, 120.333, 16.2, 120.333, 10)).toBe(false);
    });

    it('accepts incidents inside alert radius', () => {
      expect(isWithinVolunteerRadius(16.043, 120.333, 16.05, 120.34, 10)).toBe(true);
    });
  });

  describe('getActiveAssigned handler', () => {
    it('queries with user id and alert radius then returns rows', async () => {
      const rows = [
        { report_id: 10, incident_type: 'medical', accepted_by_user_id: null },
        { report_id: 11, incident_type: 'sos', accepted_by_user_id: 4, responder_status: 'Assigned' },
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const res = { json: jest.fn() };
      await getActiveAssigned({ user: { user_id: 4 } }, res);

      expect(pool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('accepted_by_user_id IS NULL');
      expect(sql).toContain('supported_incident_types');
      expect(sql).toContain('distance_km');
      expect(params).toEqual([4, ALERT_RADIUS_KM]);
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('returns 500 when query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('db down'));
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await getActiveAssigned({ user: { user_id: 4 } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error.' });
    });
  });
});
