require('dotenv').config()

const { initializeDatabase } = require('../services/crawler-service')
const { closePool } = require('../db')

async function run() {
  await initializeDatabase()
  console.log('db initialized')
  await closePool()
}

run().catch(async (error) => {
  console.error(error)
  await closePool()
  process.exit(1)
})
