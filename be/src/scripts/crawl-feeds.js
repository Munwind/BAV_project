require('dotenv').config()

const { crawlAllFeeds } = require('../services/crawler-service')
const { closePool } = require('../db')

async function run() {
  const result = await crawlAllFeeds()
  console.log(JSON.stringify(result, null, 2))
  await closePool()
}

run().catch(async (error) => {
  console.error(error)
  await closePool()
  process.exit(1)
})
