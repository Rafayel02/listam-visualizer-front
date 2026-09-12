import type { FilterCurrency } from './currency'

export interface ExchangeRates {
  amdPerUnit: Record<FilterCurrency, number>
  fetchedAt: number
  rateDate?: string
  source: string
}

const CACHE_KEY = 'listam-exchange-rates-v1'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** Fallback only when live fetch and cache both fail. */
export const FALLBACK_RATES: ExchangeRates = {
  amdPerUnit: { AMD: 1, USD: 385, EUR: 445 },
  fetchedAt: 0,
  source: 'fallback',
}

interface CachedRates {
  rates: ExchangeRates
  savedAt: number
}

function readCache(allowStale = false): ExchangeRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    if (!allowStale && Date.now() - parsed.savedAt > CACHE_TTL_MS) return null
    return parsed.rates
  } catch {
    return null
  }
}

function writeCache(rates: ExchangeRates): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ rates, savedAt: Date.now() } satisfies CachedRates),
    )
  } catch {
    // Ignore quota / private mode errors.
  }
}

async function fetchFromExchangerateFun(): Promise<ExchangeRates> {
  const res = await fetch('https://api.exchangerate.fun/latest?base=USD')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = (await res.json()) as {
    base?: string
    timestamp?: number
    rates?: Record<string, number>
  }

  const amd = data.rates?.AMD
  const eur = data.rates?.EUR
  if (!amd || !eur) throw new Error('Missing AMD or EUR in exchange rate response')

  const rateDate = data.timestamp
    ? new Date(data.timestamp * 1000).toISOString().slice(0, 10)
    : undefined

  return {
    amdPerUnit: {
      AMD: 1,
      USD: amd,
      EUR: amd / eur,
    },
    fetchedAt: Date.now(),
    rateDate,
    source: 'exchangerate.fun',
  }
}

export async function loadExchangeRates(): Promise<ExchangeRates> {
  const cached = readCache()
  if (cached) return cached

  try {
    const live = await fetchFromExchangerateFun()
    writeCache(live)
    return live
  } catch {
    const stale = readCache(true)
    if (stale) return stale
    return FALLBACK_RATES
  }
}

export function formatRateSummary(rates: ExchangeRates): string {
  const usd = Math.round(rates.amdPerUnit.USD)
  const eur = Math.round(rates.amdPerUnit.EUR)
  const date = rates.rateDate ? ` (${rates.rateDate})` : ''
  const source = rates.source === 'fallback' ? 'estimated' : 'live'
  return `1 USD ≈ ${usd.toLocaleString()} AMD · 1 EUR ≈ ${eur.toLocaleString()} AMD${date} · ${source}`
}
