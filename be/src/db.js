const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT || 5432),
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'sentimentx',
      },
)

async function query(text, params = []) {
  return pool.query(text, params)
}

async function closePool() {
  await pool.end()
}

module.exports = {
  pool,
  query,
  closePool,
}
