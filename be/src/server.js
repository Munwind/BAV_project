require('dotenv').config()

const app = require('./app')
const { initializeDatabase } = require('./services/crawler-service')

const port = Number(process.env.PORT || 8080)

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
  if (process.env.AUTO_INIT_DB === 'true') {
    await initializeDatabaseWithRetry()
  }

  app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend', error)
  process.exit(1)
})
