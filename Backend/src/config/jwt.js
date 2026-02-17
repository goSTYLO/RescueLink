require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// In production, JWT_SECRET must be explicitly set via environment
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_this_secret') {
    throw new Error(
      'JWT_SECRET must be set to a secure random value in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
}

module.exports = { JWT_SECRET };
