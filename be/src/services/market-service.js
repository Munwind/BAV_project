const path = require('path')
const { promisify } = require('util')
const { execFile } = require('child_process')

const execFileAsync = promisify(execFile)
const DEFAULT_SYMBOLS = ['VIC.VN', 'VNM.VN', 'FPT.VN', 'HPG.VN', 'VCB.VN']
const MAX_SYMBOLS = 30
const ALLOWED_RANGES = new Set(['1mo', '3mo', '6mo', '1y'])

function sanitizeSymbols(input) {
  const raw = String(input || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

  const symbols = raw.length ? raw : DEFAULT_SYMBOLS
  return [...new Set(symbols)].slice(0, MAX_SYMBOLS)
}

function sanitizeInterval(value) {
  return '1d'
}

function sanitizeRange(value) {
  const range = String(value || '1y').trim()
  return ALLOWED_RANGES.has(range) ? range : '1y'
}

function normalizeIntervalRange(interval, range) {
  return { interval: sanitizeInterval(interval), range: sanitizeRange(range) }
}

function toIsoTimestamp(epochSeconds, timezone) {
  if (!Number.isFinite(epochSeconds)) return null
  const iso = new Date(epochSeconds * 1000).toISOString()
  return timezone ? `${iso}|${timezone}` : iso
}

function normalizeChartResult(symbol, payload) {
  const result = payload?.chart?.result?.[0]
  const meta = result?.meta || {}
  const indicators = result?.indicators?.quote?.[0] || {}
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []

  const candles = timestamps
    .map((ts, idx) => {
      const open = Number(indicators.open?.[idx])
      const high = Number(indicators.high?.[idx])
      const low = Number(indicators.low?.[idx])
      const close = Number(indicators.close?.[idx])
      const volume = Number(indicators.volume?.[idx] || 0)

      if (![open, high, low, close].every((v) => Number.isFinite(v) && v > 0)) {
        return null
      }

      return {
        ts,
        time: toIsoTimestamp(ts, meta.exchangeTimezoneName),
        open: Number(open.toFixed(4)),
        high: Number(high.toFixed(4)),
        low: Number(low.toFixed(4)),
        close: Number(close.toFixed(4)),
        volume: Number.isFinite(volume) ? Math.round(volume) : 0,
      }
    })
    .filter(Boolean)

  const last = candles[candles.length - 1] || null

  return {
    symbol,
    providerSymbol: meta.symbol || symbol,
    currency: meta.currency || 'VND',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    marketState: meta.marketState || 'UNKNOWN',
    fetchedAt: new Date().toISOString(),
    candles,
    quote: last
      ? {
          ...last,
          regularMarketPrice: Number.isFinite(meta.regularMarketPrice) ? Number(meta.regularMarketPrice) : last.close,
          regularMarketTime: Number.isFinite(meta.regularMarketTime) ? toIsoTimestamp(meta.regularMarketTime, meta.exchangeTimezoneName) : last.time,
          previousClose: Number.isFinite(meta.previousClose) ? Number(meta.previousClose) : null,
        }
      : null,
  }
}

async function fetchSymbolCandles(symbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false&events=div%2Csplits`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    const error = new Error(`Market provider error ${response.status}: ${text.slice(0, 180)}`)
    error.status = 502
    throw error
  }

  const payload = await response.json()
  return normalizeChartResult(symbol, payload)
}

async function getMarketSnapshot({ symbols, interval, range }) {
  const safeSymbols = sanitizeSymbols(symbols)
  const normalized = normalizeIntervalRange(interval, range)
  const safeInterval = normalized.interval
  const safeRange = normalized.range

  // Primary provider: vnstock (Vietnam market specific)
  // Fallback provider: Yahoo chart API (keeps endpoint available if python provider fails)
  try {
    const scriptPath = path.join(__dirname, 'vnstock-snapshot.py')
    const { stdout } = await execFileAsync('python', [
      scriptPath,
      safeSymbols.join(','),
      safeInterval,
      safeRange,
    ], {
      cwd: process.cwd(),
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    })

    const markerLine = String(stdout || '')
      .split(/\r?\n/)
      .find((line) => line.startsWith('__VNSTOCK_JSON__'))

    if (markerLine) {
      const payload = JSON.parse(markerLine.replace('__VNSTOCK_JSON__', ''))
      const hasUsableItems = Array.isArray(payload.items)
        && payload.items.some((item) => Array.isArray(item?.candles) && item.candles.length >= 2)

      if (hasUsableItems) {
        return {
          ...payload,
          interval: safeInterval,
          range: safeRange,
        }
      }
    }
  } catch (error) {
    // Continue to fallback provider.
  }

  const results = await Promise.allSettled(safeSymbols.map((symbol) => fetchSymbolCandles(symbol, safeInterval, safeRange)))

  const items = []
  const errors = []

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      items.push(result.value)
      return
    }

    errors.push({
      symbol: safeSymbols[idx],
      error: result.reason?.message || 'Unknown market provider error',
    })
  })

  return {
    ok: true,
    provider: 'yahoo-fallback',
    fetchedAt: new Date().toISOString(),
    interval: safeInterval,
    range: safeRange,
    total: items.length,
    items,
    errors,
  }
}

module.exports = {
  getMarketSnapshot,
}
