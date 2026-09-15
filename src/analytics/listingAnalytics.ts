import type { Listing, Owner } from '../types'

export type ListingKind = 'all' | 'sale' | 'rent'

export interface AnalysisPoint {
  id: string
  title: string
  price: number
  pricePerSqm: number
  rooms: number
  areaSqm: number
  floor: number
  totalFloors: number
  district: string
  ownerId?: string
  isRemoved: boolean
  enrichmentStatus: Listing['enrichmentStatus']
}

export interface BucketStat {
  label: string
  count: number
  medianPrice: number
  medianPricePerSqm: number
}

export interface HistogramBin {
  label: string
  count: number
  from: number
  to: number
}

export interface ScatterPoint {
  id: string
  x: number
  y: number
  label: string
  district: string
}

export interface CorrelationCell {
  x: string
  y: string
  value: number
}

export interface PriceChangeRow {
  id: string
  title: string
  district: string
  currentPrice: number
  previousPrice: number
  dropPct: number
}

export interface OwnerStat {
  id: string
  name: string
  count: number
  medianPrice: number
}

export interface AnalysisSnapshot {
  points: AnalysisPoint[]
  totalListings: number
  activeListings: number
  removedListings: number
  enrichedListings: number
  withPrice: number
  withArea: number
  medianPrice: number
  avgPrice: number
  medianPricePerSqm: number
  avgPricePerSqm: number
  medianRooms: number
  medianArea: number
  districtStats: BucketStat[]
  roomStats: BucketStat[]
  floorStats: BucketStat[]
  priceHistogram: HistogramBin[]
  pricePerSqmHistogram: HistogramBin[]
  areaPriceScatter: ScatterPoint[]
  correlationMatrix: CorrelationCell[]
  correlationLabels: string[]
  enrichmentBreakdown: { label: string; count: number; color: string }[]
  priceDrops: PriceChangeRow[]
  topOwners: OwnerStat[]
  freshnessBuckets: BucketStat[]
}

const CORRELATION_FIELDS = [
  { key: 'price', label: 'Price' },
  { key: 'pricePerSqm', label: '$/m²' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'areaSqm', label: 'Area' },
  { key: 'floor', label: 'Floor' },
] as const

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function pearson(xs: number[], ys: number[]): number {
  if (xs.length < 3 || ys.length < 3 || xs.length !== ys.length) return 0
  const xMean = average(xs)
  const yMean = average(ys)
  let num = 0
  let xDen = 0
  let yDen = 0
  for (let i = 0; i < xs.length; i++) {
    const xDiff = xs[i]! - xMean
    const yDiff = ys[i]! - yMean
    num += xDiff * yDiff
    xDen += xDiff * xDiff
    yDen += yDiff * yDiff
  }
  const den = Math.sqrt(xDen * yDen)
  return den === 0 ? 0 : num / den
}

function buildHistogram(values: number[], binCount = 12): HistogramBin[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [{ label: formatCompact(min), count: values.length, from: min, to: max }]
  }

  const step = (max - min) / binCount
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + step * i
    const to = i === binCount - 1 ? max : min + step * (i + 1)
    return {
      label: `${formatCompact(from)}–${formatCompact(to)}`,
      count: 0,
      from,
      to,
    }
  })

  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / step))
    bins[index]!.count++
  }

  return bins
}

function bucketBy<T>(
  items: T[],
  getKey: (item: T) => string,
  getPrice: (item: T) => number | undefined,
  getPps: (item: T) => number | undefined,
  minCount = 1,
): BucketStat[] {
  const map = new Map<string, { prices: number[]; pps: number[] }>()
  for (const item of items) {
    const key = getKey(item) || 'Unknown'
    const bucket = map.get(key) ?? { prices: [], pps: [] }
    const price = getPrice(item)
    const pps = getPps(item)
    if (price != null) bucket.prices.push(price)
    if (pps != null) bucket.pps.push(pps)
    map.set(key, bucket)
  }

  return [...map.entries()]
    .map(([label, data]) => ({
      label,
      count: Math.max(data.prices.length, data.pps.length),
      medianPrice: median(data.prices),
      medianPricePerSqm: median(data.pps),
    }))
    .filter((row) => row.count >= minCount)
    .sort((a, b) => b.count - a.count)
}

function parsePriceFromHistory(listing: Listing): PriceChangeRow | null {
  const history = listing.sourcePriceHistory ?? []
  if (history.length < 2 || listing.price == null) return null

  const prices = history
    .map((entry) => entry.price)
    .filter((p): p is number => p != null && p > 0)
  if (prices.length < 2) return null

  const previousPrice = prices[1] ?? prices[0]!
  const currentPrice = listing.price
  if (previousPrice <= currentPrice) return null

  return {
    id: listing.id,
    title: listing.title ?? listing.id,
    district: listing.district ?? 'Unknown',
    currentPrice,
    previousPrice,
    dropPct: ((previousPrice - currentPrice) / previousPrice) * 100,
  }
}

function freshnessLabel(postedAt?: number): string {
  if (!postedAt) return 'Unknown'
  const days = (Date.now() - postedAt) / (1000 * 60 * 60 * 24)
  if (days <= 7) return '≤ 7 days'
  if (days <= 30) return '8–30 days'
  if (days <= 90) return '31–90 days'
  return '90+ days'
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return Math.round(value).toString()
}

export function formatPrice(value: number, currency = '֏'): string {
  return `${value.toLocaleString()} ${currency}`
}

export function filterListings(
  listings: Listing[],
  kind: ListingKind,
  includeRemoved: boolean,
  district?: string | null,
): Listing[] {
  const districtFilter = district?.trim() || null
  return listings.filter((listing) => {
    if (!includeRemoved && (listing.isRemoved || listing.enrichmentStatus === 'removed')) {
      return false
    }
    if (kind === 'sale' && listing.isMonthly) return false
    if (kind === 'rent' && !listing.isMonthly) return false
    if (districtFilter) {
      const value = listing.district?.trim() ?? ''
      if (value !== districtFilter) return false
    }
    return true
  })
}

export function availableDistricts(
  listings: Listing[],
  kind: ListingKind,
  includeRemoved: boolean,
): Array<{ district: string; count: number }> {
  const counts = new Map<string, number>()
  for (const listing of filterListings(listings, kind, includeRemoved)) {
    const district = listing.district?.trim()
    if (!district) continue
    counts.set(district, (counts.get(district) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([district, count]) => ({ district, count }))
}

export function buildAnalysisSnapshot(
  listings: Listing[],
  owners: Owner[],
  kind: ListingKind,
  includeRemoved: boolean,
  district?: string | null,
): AnalysisSnapshot {
  const filtered = filterListings(listings, kind, includeRemoved, district)
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]))

  const points: AnalysisPoint[] = filtered
    .filter((listing) => listing.price != null && listing.price > 0)
    .map((listing) => {
      const areaSqm = listing.areaSqm ?? 0
      const price = listing.price!
      return {
        id: listing.id,
        title: listing.title ?? listing.id,
        price,
        pricePerSqm: areaSqm > 0 ? price / areaSqm : 0,
        rooms: listing.rooms ?? 0,
        areaSqm,
        floor: listing.currentFloor ?? 0,
        totalFloors: listing.totalFloors ?? 0,
        district: listing.district ?? 'Unknown',
        ownerId: listing.ownerId,
        isRemoved: !!listing.isRemoved || listing.enrichmentStatus === 'removed',
        enrichmentStatus: listing.enrichmentStatus,
      }
    })

  const priced = points.filter((p) => p.price > 0)
  const withArea = points.filter((p) => p.areaSqm > 0)
  const withPps = withArea.filter((p) => p.pricePerSqm > 0)

  const correlationLabels = CORRELATION_FIELDS.map((f) => f.label)
  const correlationMatrix: CorrelationCell[] = []
  for (const xField of CORRELATION_FIELDS) {
    for (const yField of CORRELATION_FIELDS) {
      const rows = withPps.filter(
        (p) => p[xField.key] > 0 && p[yField.key] > 0,
      )
      correlationMatrix.push({
        x: xField.label,
        y: yField.label,
        value: pearson(
          rows.map((r) => r[xField.key]),
          rows.map((r) => r[yField.key]),
        ),
      })
    }
  }

  const enrichmentCounts = new Map<string, number>()
  for (const listing of filtered) {
    const key = listing.enrichmentStatus
    enrichmentCounts.set(key, (enrichmentCounts.get(key) ?? 0) + 1)
  }

  const enrichmentColors: Record<string, string> = {
    complete: '#34d399',
    pending: '#fbbf24',
    processing: '#60a5fa',
    failed: '#f87171',
    removed: '#94a3b8',
  }

  const ownerGroups = new Map<string, number[]>()
  for (const point of priced) {
    if (!point.ownerId) continue
    const bucket = ownerGroups.get(point.ownerId) ?? []
    bucket.push(point.price)
    ownerGroups.set(point.ownerId, bucket)
  }

  const topOwners: OwnerStat[] = [...ownerGroups.entries()]
    .map(([id, prices]) => ({
      id,
      name: ownersById.get(id)?.name ?? id,
      count: prices.length,
      medianPrice: median(prices),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const freshnessSource = filtered.map((listing) => ({
    label: freshnessLabel(listing.postedAt),
    price: listing.price,
    pricePerSqm:
      listing.price && listing.areaSqm
        ? listing.price / listing.areaSqm
        : undefined,
  }))

  return {
    points,
    totalListings: listings.length,
    activeListings: listings.filter((l) => !l.isRemoved && l.enrichmentStatus !== 'removed')
      .length,
    removedListings: listings.filter((l) => l.isRemoved || l.enrichmentStatus === 'removed')
      .length,
    enrichedListings: filtered.filter((l) => l.enrichmentStatus === 'complete').length,
    withPrice: priced.length,
    withArea: withArea.length,
    medianPrice: median(priced.map((p) => p.price)),
    avgPrice: average(priced.map((p) => p.price)),
    medianPricePerSqm: median(withPps.map((p) => p.pricePerSqm)),
    avgPricePerSqm: average(withPps.map((p) => p.pricePerSqm)),
    medianRooms: median(priced.filter((p) => p.rooms > 0).map((p) => p.rooms)),
    medianArea: median(withArea.map((p) => p.areaSqm)),
    districtStats: bucketBy(
      withPps,
      (p) => p.district,
      (p) => p.price,
      (p) => p.pricePerSqm,
      2,
    ).slice(0, 12),
    roomStats: bucketBy(
      withPps.filter((p) => p.rooms > 0),
      (p) => `${p.rooms} rm`,
      (p) => p.price,
      (p) => p.pricePerSqm,
    ),
    floorStats: bucketBy(
      withPps.filter((p) => p.floor > 0),
      (p) => (p.floor === 1 ? '1st' : p.floor === p.totalFloors && p.totalFloors > 0 ? 'Top' : `${p.floor}`),
      (p) => p.price,
      (p) => p.pricePerSqm,
      2,
    ).slice(0, 10),
    priceHistogram: buildHistogram(priced.map((p) => p.price)),
    pricePerSqmHistogram: buildHistogram(withPps.map((p) => p.pricePerSqm)),
    areaPriceScatter: withPps.map((p) => ({
      id: p.id,
      x: p.areaSqm,
      y: p.price,
      label: p.title,
      district: p.district,
    })),
    correlationMatrix,
    correlationLabels,
    enrichmentBreakdown: [...enrichmentCounts.entries()].map(([label, count]) => ({
      label,
      count,
      color: enrichmentColors[label] ?? '#cbd5e1',
    })),
    priceDrops: filtered
      .map(parsePriceFromHistory)
      .filter((row): row is PriceChangeRow => row != null)
      .sort((a, b) => b.dropPct - a.dropPct)
      .slice(0, 10),
    topOwners,
    freshnessBuckets: bucketBy(
      freshnessSource,
      (row) => row.label,
      (row) => row.price,
      (row) => row.pricePerSqm,
    ),
  }
}
