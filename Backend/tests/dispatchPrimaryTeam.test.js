jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Dispatch = require('../src/models/dispatch');

describe('Dispatch primary-team helpers', () => {
  const sample = [
    { dispatch_id: 1, team_name: null, department_code: 'pnp', responder_source: 'account' },
    { dispatch_id: 2, team_name: 'Patrol Alpha', department_code: 'pnp', responder_source: 'account' },
    { dispatch_id: 3, team_name: 'Rescue Alpha', department_code: 'drrmo', responder_source: 'escalation' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats non-escalation team rows as primary', () => {
    const primary = sample.filter((row) => Dispatch.hasTeamName(row) && !Dispatch.isEscalationSource(row));
    expect(primary).toHaveLength(1);
    expect(primary[0].team_name).toBe('Patrol Alpha');
  });

  it('does not treat escalation team rows as primary', () => {
    expect(Dispatch.isEscalationSource(sample[2])).toBe(true);
    expect(Dispatch.hasTeamName(sample[2])).toBe(true);
  });

  it('hasPrimaryTeamAssignment is true only for non-escalation teams', async () => {
    const spy = jest.spyOn(Dispatch, 'findAll').mockResolvedValue(sample);
    await expect(Dispatch.hasPrimaryTeamAssignment(1)).resolves.toBe(true);
    spy.mockResolvedValue([sample[2]]);
    await expect(Dispatch.hasPrimaryTeamAssignment(1)).resolves.toBe(false);
    spy.mockRestore();
  });

  it('deleteEscalationDispatches only deletes escalation-sourced rows', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await Dispatch.deleteEscalationDispatches(9, 'drrmo');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/responder_source/i),
      [9, 'drrmo']
    );
    expect(String(pool.query.mock.calls[0][0])).toMatch(/escalation/i);
  });
});
