jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/db');
const Responder = require('../src/models/responder');

describe('Responder team membership syncs team_name', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addTeamMember sets responders.team_name from the team', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ team_id: 1, responder_id: 9, is_active: true }] }) // insert membership
      .mockResolvedValueOnce({ rows: [{ team_name: 'Alpha Unit' }] }) // load team
      .mockResolvedValueOnce({ rows: [] }); // update responder team_name

    await Responder.addTeamMember(1, 9);

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE responders SET team_name = $1 WHERE responder_id = $2',
      ['Alpha Unit', 9]
    );
  });

  it('removeTeamMember clears team_name when no active memberships remain', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ team_id: 1, responder_id: 9, is_active: false }] }) // soft remove
      .mockResolvedValueOnce({ rows: [] }) // no remaining teams
      .mockResolvedValueOnce({ rows: [] }); // clear team_name

    await Responder.removeTeamMember(1, 9);

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE responders SET team_name = $1 WHERE responder_id = $2',
      [null, 9]
    );
  });

  it('listTeamMembers only returns active memberships', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ responder_id: 9, name: 'Active One', member_active: true }],
    });

    const rows = await Responder.listTeamMembers(1);

    expect(rows).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/is_active = TRUE/i),
      [1]
    );
  });
});
