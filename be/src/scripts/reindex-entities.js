require('dotenv').config()

const { reindexAllArticleEntities } = require('../services/entity-service')
const { closePool } = require('../db')

async function run() {
  const total = await reindexAllArticleEntities()
  console.log(`reindexed ${total} articles`)
  await closePool()
}

run().catch(async (error) => {
  console.error(error)
  await closePool()
  process.exit(1)
})
