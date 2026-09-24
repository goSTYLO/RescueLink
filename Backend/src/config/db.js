const { Pool } = require('pg');
const { getPgPoolConfig } = require('./pgPool');

const pool = new Pool(getPgPoolConfig());

module.exports = pool;
