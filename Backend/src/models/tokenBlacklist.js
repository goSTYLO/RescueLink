const pool = require('../config/db');
const crypto = require('crypto');

const TokenBlacklist = {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  },

  async add(token, expiresAt) {
    const tokenHash = this.hashToken(token);
    await pool.query(
      'INSERT INTO token_blacklist (token_hash, expires_at) VALUES ($1, $2) ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at',
      [tokenHash, expiresAt]
    );
  },

  async isBlacklisted(token) {
    const tokenHash = this.hashToken(token);
    const res = await pool.query(
      'SELECT 1 FROM token_blacklist WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    return res.rows.length > 0;
  },

  async cleanupExpired() {
    await pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()');
  }
};

module.exports = TokenBlacklist;
