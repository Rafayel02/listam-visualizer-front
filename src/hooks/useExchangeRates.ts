import { useEffect, useState } from 'react'
import { FALLBACK_RATES, loadExchangeRates, type ExchangeRates } from '../utils/exchangeRates'

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void loadExchangeRates()
      .then((next) => {
        if (!cancelled) {
          setRates(next)
          setError(next.source === 'fallback' ? 'Using estimated rates — live fetch failed' : null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRates(FALLBACK_RATES)
          setError((err as Error).message)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { rates, loading, error }
}
