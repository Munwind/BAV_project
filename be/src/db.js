const { Pool } = require('pg')
const env = require('./config/env')

const connectionString = env.databaseUrl

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: env.postgresHost,
        port: env.postgresPort,
        user: env.postgresUser,
        password: env.postgresPassword,
        database: env.postgresDb,
      },
)

async function query(text, params = []) {
  return pool.query(text, params)
}

async function withTransaction(callback) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function closePool() {
  await pool.end()
}

module.exports = {
  pool,
  query,
  withTransaction,
  closePool,
}
