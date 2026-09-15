import { useMemo, useState } from 'react'
import {
  computeOwnerReliabilityScore,
  getEffectivePostCount,
  reliabilityColor,
} from '../analytics/ownerAnalytics'
import type { Listing, Owner, SearchListing } from '../types'
import { useExchangeRates } from '../hooks/useExchangeRates'
import {
  FILTER_CURRENCIES,
  currencyLabel,
  formatConversionHints,
  formatPriceRangeHints,
  passesPriceFilter,
  type FilterCurrency,
} from '../utils/currency'
import { detailEnrichmentLabel } from '../utils/listingDetail'
import { formatRateSummary, type ExchangeRates } from '../utils/exchangeRates'
import {
  buildActiveFeed,
  formatListAmDate,
  formatRelativeTime,
  getLatestPriceHistoryEntry,
  type ActiveFeedItem,
  type FeedTimeWindow,
  type FeedTypeFilter,
} from '../utils/activeFeed'
import './LatestView.css'

function parsePriceInput(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function ownerReliabilityScore(
  item: ActiveFeedItem,
  listingCountByOwner: Map<string, number>,
): number {
  if (!item.owner) return -1
  return computeOwnerReliabilityScore(
    item.owner,
    listingCountByOwner.get(item.owner.id) ?? 0,
  ).score
}

function filterAndSortFeedItems(
  items: ActiveFeedItem[],
  filterCurrency: FilterCurrency,
  minPrice: number | undefined,
  maxPrice: number | undefined,
  listingCountByOwner: Map<string, number>,
  rates: ExchangeRates,
  districtFilter: string | null,
): ActiveFeedItem[] {
  const filtered = items.filter((item) => {
    if (districtFilter) {
      const district = item.listing.district?.trim() ?? ''
      if (district !== districtFilter) return false
    }
    return passesPriceFilter(
      item.listing.price,
      item.listing.currency,
      filterCurrency,
      rates,
      minPrice,
      maxPrice,
    )
  })

  return [...filtered].sort((a, b) => {
    const reliabilityCmp =
      ownerReliabilityScore(b, listingCountByOwner) -
      ownerReliabilityScore(a, listingCountByOwner)
    if (reliabilityCmp !== 0) return reliabilityCmp
    return b.activityAt - a.activityAt
  })
}

function formatPrice(listing: {
  price?: number
  currency?: string
  isMonthly?: boolean
}): string {
  if (listing.price == null) return '—'
  const cur = listing.currency ?? ''
  const suffix = listing.isMonthly ? '/mo' : ''
  return `${listing.price.toLocaleString()} ${cur}${suffix}`
}

interface LatestViewProps {
  listings: Listing[]
  owners: Owner[]
  searchListings: SearchListing[]
  duplicateByListingId?: Record<string, string[]>
  loading?: boolean
}

export function LatestView({
  listings,
  owners,
  searchListings,
  duplicateByListingId = {},
  loading = false,
}: LatestViewProps) {
  const { rates, loading: ratesLoading, error: ratesError } = useExchangeRates()
  const [window, setWindow] = useState<FeedTimeWindow>('7d')
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>('all')
  const [filterCurrency, setFilterCurrency] = useState<FilterCurrency>('AMD')
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [districtFilter, setDistrictFilter] = useState<string | null>(null)

  const minPrice = parsePriceInput(minPriceInput)
  const maxPrice = parsePriceInput(maxPriceInput)
  const priceFilterActive = minPrice != null || maxPrice != null
  const extraFiltersActive = priceFilterActive || districtFilter != null

  const listingById = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings])

  const listingCountByOwner = useMemo(() => {
    const counts = new Map<string, number>()
    for (const listing of listings) {
      if (!listing.ownerId) continue
      counts.set(listing.ownerId, (counts.get(listing.ownerId) ?? 0) + 1)
    }
    return counts
  }, [listings])

  const items = useMemo(
    () => buildActiveFeed(listings, owners, searchListings, window, typeFilter),
    [listings, owners, searchListings, window, typeFilter],
  )

  const counts = useMemo(
    () => ({
      created: items.filter((item) => item.activityType === 'created').length,
      updated: items.filter((item) => item.activityType === 'updated').length,
    }),
    [items],
  )

  const availableDistricts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      const district = item.listing.district?.trim()
      if (!district) continue
      counts.set(district, (counts.get(district) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([district, count]) => ({ district, count }))
  }, [items])

  const visibleItems = useMemo(
    () =>
      filterAndSortFeedItems(
        items,
        filterCurrency,
        minPrice,
        maxPrice,
        listingCountByOwner,
        rates,
        districtFilter,
      ),
    [items, filterCurrency, minPrice, maxPrice, listingCountByOwner, rates, districtFilter],
  )

  const conversionHint = useMemo(() => {
    if (!priceFilterActive) return null
    return formatPriceRangeHints(minPrice, maxPrice, filterCurrency, rates)
  }, [priceFilterActive, minPrice, maxPrice, filterCurrency, rates])

  const exampleHint = useMemo(() => {
    if (filterCurrency === 'AMD') {
      return `Example: 500,000 AMD ≈ ${formatConversionHints(500_000, 'AMD', rates).join(', ')}`
    }
    if (filterCurrency === 'USD') {
      return `Example: $500 ≈ ${formatConversionHints(500, 'USD', rates).join(', ')}`
    }
    return `Example: €500 ≈ ${formatConversionHints(500, 'EUR', rates).join(', ')}`
  }, [filterCurrency, rates])

  return (
    <div className="latest-view">
      <section className="latest-hero">
        <div>
          <p className="latest-eyebrow">Live inventory</p>
          <h2>Latest active posts</h2>
          <p className="latest-subtitle">
            Only listings with analyzed detail pages (owners, dates, price history). Sorted by
            owner reliability. Price filters use live exchange rates.
          </p>
        </div>
        <div className="latest-stats">
          <span>
            {visibleItems.length} shown
            {extraFiltersActive && items.length !== visibleItems.length
              ? ` of ${items.length}`
              : ''}
          </span>
          <span>{counts.created} new</span>
          <span>{counts.updated} updated</span>
        </div>
      </section>

      <section className="latest-controls panel">
        <div className="latest-toggle-group">
          {(['24h', '7d', '30d', 'all'] as FeedTimeWindow[]).map((option) => (
            <button
              key={option}
              type="button"
              className={window === option ? 'active' : ''}
              onClick={() => setWindow(option)}
            >
              {option === 'all' ? 'All time' : option}
            </button>
          ))}
        </div>
        <div className="latest-toggle-group">
          {(['all', 'created', 'updated'] as FeedTypeFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={typeFilter === option ? 'active' : ''}
              onClick={() => setTypeFilter(option)}
            >
              {option === 'all' ? 'All activity' : option === 'created' ? 'New only' : 'Updated only'}
            </button>
          ))}
        </div>
        <div className="latest-price-filter">
          {availableDistricts.length > 0 && (
            <label className="latest-select-label">
              District
              <select
                className="latest-select"
                value={districtFilter ?? ''}
                onChange={(e) => setDistrictFilter(e.target.value || null)}
              >
                <option value="">All districts ({items.length})</option>
                {availableDistricts.map(({ district, count }) => (
                  <option key={district} value={district}>
                    {district} ({count})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="latest-select-label">
            Filter currency
            <select
              className="latest-select"
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value as FilterCurrency)}
            >
              {FILTER_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {currencyLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label className="latest-select-label">
            Min price
            <input
              className="latest-price-input"
              type="text"
              inputMode="numeric"
              placeholder="Any"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
            />
          </label>
          <label className="latest-select-label">
            Max price
            <input
              className="latest-price-input"
              type="text"
              inputMode="numeric"
              placeholder="Any"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
            />
          </label>
          {(minPriceInput || maxPriceInput || districtFilter) && (
            <button
              type="button"
              className="latest-clear-price"
              onClick={() => {
                setMinPriceInput('')
                setMaxPriceInput('')
                setDistrictFilter(null)
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="latest-filter-hint muted small">
          {ratesLoading ? 'Loading exchange rates…' : formatRateSummary(rates)}
          {ratesError && <span className="latest-rates-warning"> · {ratesError}</span>}
        </p>
        <p className="latest-filter-hint muted small">
          {conversionHint ?? exampleHint}
        </p>
      </section>

      {loading && (
        <section className="panel">
          <p className="muted">Loading data from backend…</p>
        </section>
      )}

      {!loading && visibleItems.length === 0 ? (
        <section className="panel latest-empty">
          <h3>No listings match</h3>
          <p className="muted">
            {items.length === 0
              ? 'Run detail analysis in scrape-front, sync to backend, then refresh. Card-only listings are not shown here.'
              : 'Try another district, widen the price range, or change the filter currency.'}
          </p>
        </section>
      ) : (
        <section className="latest-feed">
          {visibleItems.map((item) => {
            const scrapedCount = item.owner
              ? listingCountByOwner.get(item.owner.id) ?? 0
              : 0
            const ownerReliability = item.owner
              ? computeOwnerReliabilityScore(item.owner, scrapedCount)
              : null
            const ownerPostCount = item.owner
              ? getEffectivePostCount(item.owner, scrapedCount)
              : null

            return (
            <article key={item.listing.id} className="latest-card">
              <div className="latest-card-media">
                {item.listing.thumbnailUrl ? (
                  <img src={item.listing.thumbnailUrl} alt="" />
                ) : (
                  <div className="latest-card-placeholder">No image</div>
                )}
              </div>

              <div className="latest-card-body">
                <div className="latest-card-top">
                  <span className={`latest-badge latest-badge-${item.activityType}`}>
                    {item.activityType === 'created' ? 'New' : 'Updated'}
                  </span>
                  <span className="latest-time" title={formatListAmDate(item.activityAt)}>
                    {formatListAmDate(item.activityAt)} · {formatRelativeTime(item.activityAt)}
                  </span>
                </div>

                <h3 className="latest-card-title">
                  {item.listing.title || item.listing.id}
                </h3>

                <div className="latest-card-meta">
                  <strong>{formatPrice(item.listing)}</strong>
                  {item.listing.rooms != null && <span>{item.listing.rooms} rm</span>}
                  {item.listing.areaSqm != null && <span>{item.listing.areaSqm} m²</span>}
                  {item.listing.district && (
                    <button
                      type="button"
                      className="latest-district-link"
                      onClick={() => setDistrictFilter(item.listing.district!.trim())}
                    >
                      {item.listing.district}
                    </button>
                  )}
                  {detailEnrichmentLabel(item.listing) && (
                    <span className="latest-detail-badge">{detailEnrichmentLabel(item.listing)}</span>
                  )}
                </div>

                {item.listing.description && (
                  <p className="latest-description">
                    {item.listing.description.length > 180
                      ? `${item.listing.description.slice(0, 180)}…`
                      : item.listing.description}
                  </p>
                )}

                {item.owner && (
                  <div className="latest-owner">
                    {item.owner.avatarUrl && (
                      <img src={item.owner.avatarUrl} alt="" className="latest-owner-avatar" />
                    )}
                    <span>
                      {item.owner.name || item.owner.id}
                      {ownerPostCount != null && (
                        <span className="latest-owner-posts">
                          · {ownerPostCount} post{ownerPostCount === 1 ? '' : 's'}
                          {item.owner.sitePostsCount != null ? ' on list.am' : ' in your data'}
                        </span>
                      )}
                    </span>
                    {ownerReliability && (
                      <span
                        className="latest-reliability"
                        style={{ color: reliabilityColor(ownerReliability.score) }}
                        title={ownerReliability.label}
                      >
                        {ownerReliability.score} · {ownerReliability.label}
                      </span>
                    )}
                  </div>
                )}

                <p className="latest-created-note">
                  {item.activityLabel}
                  {item.listing.postedAt && item.activityType === 'updated' && (
                    <span> · posted {formatListAmDate(item.listing.postedAt)}</span>
                  )}
                  {item.listing.renewedAt && item.activityType === 'created' && (
                    <span> · renewed {formatListAmDate(item.listing.renewedAt)}</span>
                  )}
                </p>

                {item.activityType === 'updated' && getLatestPriceHistoryEntry(item.listing) && (
                  <p className="latest-price-note">
                    Latest price change: {getLatestPriceHistoryEntry(item.listing)?.raw}
                  </p>
                )}

                {(duplicateByListingId[item.listing.id]?.length ?? 0) > 0 && (
                  <div className="latest-duplicates">
                    <span className="latest-duplicates-label">Same post elsewhere:</span>
                    <ul className="latest-duplicates-list">
                      {duplicateByListingId[item.listing.id].map((dupId) => {
                        const dup = listingById.get(dupId)
                        const dupOwner = dup?.ownerId
                          ? owners.find((o) => o.id === dup.ownerId)
                          : undefined
                        return (
                          <li key={dupId}>
                            <a
                              href={dup?.url ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="latest-duplicate-link"
                            >
                              {dup?.title || dupId}
                            </a>
                            {dupOwner && (
                              <span className="latest-duplicate-owner">
                                · {dupOwner.name || dupOwner.id}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="latest-card-actions">
                <a
                  href={item.listing.url}
                  target="_blank"
                  rel="noreferrer"
                  className="latest-open-link"
                >
                  Open on list.am
                </a>
              </div>
            </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
