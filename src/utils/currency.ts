export type FilterCurrency = 'AMD' | 'USD' | 'EUR'

/** AMD per 1 unit of foreign currency (e.g. 1 USD ≈ 1,000 AMD). */
export const AMD_PER_UNIT: Record<FilterCurrency, number> = {
  AMD: 1,
  USD: 1000,
  EUR: 1080,
}

export const FILTER_CURRENCIES: FilterCurrency[] = ['AMD', 'USD', 'EUR']

const CURRENCY_LABELS: Record<FilterCurrency, string> = {
  AMD: 'AMD (֏)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
}

export function currencyLabel(code: string): string {
  if (code in CURRENCY_LABELS) return CURRENCY_LABELS[code as FilterCurrency]
  return code
}

export function normalizeCurrency(currency?: string): FilterCurrency | null {
  if (!currency) return null
  const trimmed = currency.trim()
  if (trimmed === '֏' || trimmed.toUpperCase() === 'AMD') return 'AMD'
  if (trimmed === '$' || trimmed.toUpperCase() === 'USD') return 'USD'
  if (trimmed === '€' || trimmed.toUpperCase() === 'EUR') return 'EUR'
  return null
}

export function convertPrice(
  amount: number,
  from: FilterCurrency,
  to: FilterCurrency,
): number {
  if (from === to) return amount
  const amd = amount * AMD_PER_UNIT[from]
  return amd / AMD_PER_UNIT[to]
}

export function formatFilterAmount(value: number, currency: FilterCurrency): string {
  const rounded = currency === 'AMD' ? Math.round(value) : Math.round(value * 100) / 100
  const suffix =
    currency === 'AMD' ? '֏' : currency === 'USD' ? '$' : '€'
  return `${rounded.toLocaleString()} ${suffix}`
}

export function formatConversionHints(
  amount: number,
  from: FilterCurrency,
): string[] {
  return FILTER_CURRENCIES
    .filter((code) => code !== from)
    .map((code) => `≈ ${formatFilterAmount(convertPrice(amount, from, code), code)}`)
}

export function formatPriceRangeHints(
  min: number | undefined,
  max: number | undefined,
  currency: FilterCurrency,
): string | null {
  const parts: string[] = []
  if (min != null && min > 0) {
    parts.push(
      `min ${formatFilterAmount(min, currency)} (${formatConversionHints(min, currency).join(', ')})`,
    )
  }
  if (max != null && max > 0) {
    parts.push(
      `max ${formatFilterAmount(max, currency)} (${formatConversionHints(max, currency).join(', ')})`,
    )
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function listingPriceInFilterCurrency(
  price: number | undefined,
  listingCurrency: string | undefined,
  filterCurrency: FilterCurrency,
): number | null {
  if (price == null || price <= 0) return null
  const normalized = normalizeCurrency(listingCurrency)
  if (!normalized) return null
  return convertPrice(price, normalized, filterCurrency)
}

export function passesPriceFilter(
  price: number | undefined,
  listingCurrency: string | undefined,
  filterCurrency: FilterCurrency,
  minPrice?: number,
  maxPrice?: number,
): boolean {
  const hasMin = minPrice != null && minPrice > 0
  const hasMax = maxPrice != null && maxPrice > 0
  if (!hasMin && !hasMax) return true

  const converted = listingPriceInFilterCurrency(price, listingCurrency, filterCurrency)
  if (converted == null) return false

  if (hasMin && converted < minPrice!) return false
  if (hasMax && converted > maxPrice!) return false
  return true
}
