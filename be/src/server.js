require('dotenv').config()

const app = require('./app')
const env = require('./config/env')
const { initializeDatabase } = require('./services/crawler-service')

async function initializeDatabaseWithRetry(maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await initializeDatabase()
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }

      console.warn(`Database init attempt ${attempt} failed, retrying...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}

async function bootstrap() {
  if (env.autoInitDb) {
    await initializeDatabaseWithRetry()
  }

  app.listen(env.port, () => {
    console.log(`Backend server running on http://localhost:${env.port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend', error)
  process.exit(1)
})
