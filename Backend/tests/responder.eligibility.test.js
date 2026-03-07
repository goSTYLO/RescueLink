jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Responder = require('../src/models/responder');

describe('Responder eligibility incident type mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bypasses incident type SQL filter when incident_type is other', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ responder_id: 1, name: 'Responder One', availability_status: 'Available' }],
    });

    const rows = await Responder.findEligibleByTeam({
      department_code: 'drrmo',
      team_name: 'Rescue Alpha',
      incident_type: 'other',
    });

    expect(rows).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBe('');
  });

  it('keeps incident type SQL filter for canonical incident types', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ responder_id: 2, name: 'Responder Two', availability_status: 'Standby' }],
    });

    await Responder.findEligibleByTeam({
      department_code: 'drrmo',
      team_name: 'Medical Alpha',
      incident_type: 'medical',
    });

    const params = pool.query.mock.calls[0][1];
    expect(params[2]).toBe('medical');
  });

  it('uses fallback without incident filter when incident_type is other', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const findAllSpy = jest.spyOn(Responder, 'findAll').mockResolvedValue([
      {
        responder_id: 3,
        name: 'Responder Three',
        organization: 'CDRRMO Team',
        availability_status: 'Available',
      },
    ]);

    const rows = await Responder.findEligibleByTeam({
      department_code: 'drrmo',
      team_name: 'Rescue Alpha',
      incident_type: 'other',
    });

    expect(findAllSpy).toHaveBeenCalledWith(expect.objectContaining({
      team_name: 'Rescue Alpha',
      incident_type: null,
    }));
    expect(rows).toHaveLength(1);

    findAllSpy.mockRestore();
  });
});
