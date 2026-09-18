jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../src/utils/encryption', () => ({
  tryDecryptValue: jest.fn((value) => {
    if (value === 'enc:16.05') return '16.05';
    if (value === 'enc:120.34') return '120.34';
    return value;
  }),
}));

const pool = require('../src/config/db');
const {
  getActiveAssigned,
  ALERT_RADIUS_KM,
  incidentMatchesVolunteerSpecialization,
  isWithinVolunteerRadius,
  parseCoordinate,
  findEligibleNearbyVolunteerUserIds,
} = require('../src/controllers/incidentAcceptance');

describe('responder active incidents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCoordinate', () => {
    it('parses plain numeric coordinates', () => {
      expect(parseCoordinate(16.05)).toBe(16.05);
      expect(parseCoordinate('120.34')).toBe(120.34);
    });

    it('parses decrypted coordinate strings', () => {
      expect(parseCoordinate('enc:16.05')).toBe(16.05);
      expect(parseCoordinate('enc:120.34')).toBe(120.34);
    });

    it('returns null for non-numeric encrypted payloads', () => {
      expect(parseCoordinate('43214df11f20d093f925d1de1f2847fe')).toBeNull();
    });
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
    it('ensures schema, loads volunteer coords, then queries active incidents', async () => {
      const rows = [
        {
          report_id: 10,
          incident_type: 'medical',
          accepted_by_user_id: null,
          latitude: 16.05,
          longitude: 120.34,
        },
        {
          report_id: 11,
          incident_type: 'sos',
          accepted_by_user_id: 4,
          responder_status: 'Assigned',
          latitude: 16.04,
          longitude: 120.33,
        },
      ];
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // ensurePhase3Schema
        .mockResolvedValueOnce({ rows: [{ latitude: 16.043, longitude: 120.333 }] })
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce({ rows: [] }); // backup merge

      const res = { json: jest.fn() };
      await getActiveAssigned({ user: { user_id: 4 } }, res);

      expect(pool.query).toHaveBeenCalledTimes(4);
      const [sql, params] = pool.query.mock.calls[2];
      expect(sql).toContain('accepted_by_user_id IS NULL');
      expect(sql).toContain('supported_incident_types');
      expect(sql).toContain('distance_km');
      expect(sql).toContain("~ '^-?[0-9]+(\\.[0-9]+)?$'");
      expect(params).toEqual([4, ALERT_RADIUS_KM]);
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ report_id: 10, latitude: 16.05, longitude: 120.34 }),
        expect.objectContaining({ report_id: 11, latitude: 16.04, longitude: 120.33 }),
      ]);
    });

    it('falls back when user location columns are missing', async () => {
      const rows = [{
        report_id: 10,
        incident_type: 'medical',
        accepted_by_user_id: null,
        latitude: 16.05,
        longitude: 120.34,
      }];
      const missingColumnErr = new Error('column u.latitude does not exist');
      missingColumnErr.code = '42703';

      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ latitude: null, longitude: null }] })
        .mockRejectedValueOnce(missingColumnErr)
        .mockResolvedValueOnce({ rows })
        .mockResolvedValueOnce({ rows: [] }); // backup merge

      const res = { json: jest.fn() };
      await getActiveAssigned({ user: { user_id: 4 } }, res);

      expect(pool.query).toHaveBeenCalledTimes(5);
      const [fallbackSql] = pool.query.mock.calls[3];
      expect(fallbackSql).toContain('NULL::double precision AS latitude');
      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ report_id: 10, latitude: 16.05, longitude: 120.34 }),
      ]);
    });

    it('returns 500 when query fails', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ latitude: 16.043, longitude: 120.333 }] })
        .mockRejectedValueOnce(new Error('db down'));
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      await getActiveAssigned({ user: { user_id: 4 } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error.' });
    });
  });

  describe('findEligibleNearbyVolunteerUserIds', () => {
    it('keeps nearby matching volunteers and skips reporter, mismatch, and far users', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { user_id: 1, latitude: 16.05, longitude: 120.34, supported_incident_types: ['medical'] },
            { user_id: 2, latitude: 16.05, longitude: 120.34, supported_incident_types: ['medical'] },
            { user_id: 3, latitude: 16.05, longitude: 120.34, supported_incident_types: ['fire'] },
            { user_id: 4, latitude: 17.5, longitude: 121.5, supported_incident_types: ['medical'] },
          ],
        });

      const ids = await findEligibleNearbyVolunteerUserIds(10, null, {
        latitude: 16.05,
        longitude: 120.34,
        incident_type: 'medical',
      });

      expect(ids).toEqual([2]);
      expect(pool.query.mock.calls.some(([sql]) => String(sql).includes('backup_responses'))).toBe(false);
    });
  });
});
