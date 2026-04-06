const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)]
}

function loadAppWithEnv(overrides = {}) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  }

  Object.assign(process.env, overrides)

  clearModule('../src/config/env')
  clearModule('../src/app')

  const app = require('../src/app')

  return {
    app,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }

      clearModule('../src/config/env')
      clearModule('../src/app')
    },
  }
}

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })

  try {
    const address = server.address()
    return await callback(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

test('blocks admin endpoints in production when ADMIN_API_KEY is missing', async () => {
  const { app, restore } = loadAppWithEnv({
    NODE_ENV: 'production',
    ADMIN_API_KEY: '',
    CORS_ORIGIN: 'http://localhost:5173',
  })

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/crawler/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await response.json()

      assert.equal(response.status, 403)
      assert.match(data.error, /ADMIN_API_KEY/i)
    })
  } finally {
    restore()
  }
})

test('rejects unknown browser origins through CORS middleware', async () => {
  const { app, restore } = loadAppWithEnv({
    NODE_ENV: 'production',
    ADMIN_API_KEY: 'secret-key',
    CORS_ORIGIN: 'http://localhost:5173',
  })

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: 'http://evil.test' },
      })
      const data = await response.json()

      assert.equal(response.status, 500)
      assert.match(data.error, /CORS origin not allowed/i)
    })
  } finally {
    restore()
  }
})

