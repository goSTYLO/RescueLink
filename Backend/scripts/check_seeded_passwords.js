require('dotenv').config();
const { comparePassword } = require('../src/utils/hash');
const User = require('../src/models/user');

const accounts = [
  { email: 'admin@rescuelink.test', password: 'admin123' },
  { email: 'admin2@rescuelink.test', password: 'admin123' },
  { email: 'dispatcher@rescuelink.test', password: 'dispatcher123' },
  { email: 'dispatcher2@rescuelink.test', password: 'dispatcher123' },
  { email: 'responder@rescuelink.test', password: 'responder123' },
  { email: 'responder2@rescuelink.test', password: 'responder123' },
  { email: 'supervisor@rescuelink.test', password: 'supervisor123' },
  { email: 'supervisor2@rescuelink.test', password: 'supervisor123' },
  { email: 'user@rescuelink.test', password: 'user123' },
  { email: 'user2@rescuelink.test', password: 'user123' }
];

(async () => {
  try {
    for (const acc of accounts) {
      const user = await User.findByEmail(acc.email);
      if (!user) {
        console.log(`${acc.email}: NOT FOUND`);
        continue;
      }
      const hash = user.password || '';
      const match = hash ? await comparePassword(acc.password, hash) : false;
      console.log(`${acc.email} (id=${user.user_id}, role=${user.role}): hash=${hash ? '[REDACTED]' : 'NONE'} compare=${match}`);
    }
  } catch (err) {
    console.error('Error checking passwords:', err);
    process.exit(2);
  }
})();
