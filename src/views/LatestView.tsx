import { useMemo, useState } from 'react'
import {
  computeOwnerReliabilityScore,
  getEffectivePostCount,
  reliabilityColor,
} from '../analytics/ownerAnalytics'
import type { Listing, Owner, SearchListing } from '../types'
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

type LatestSort = 'activity' | 'price-asc' | 'price-desc'

const CURRENCY_LABELS: Record<string, string> = {
  '֏': 'AMD (֏)',
  AMD: 'AMD (֏)',
  $: 'USD ($)',
  USD: 'USD ($)',
  '€': 'EUR (€)',
  EUR: 'EUR (€)',
}

function currencyLabel(code: string): string {
  return CURRENCY_LABELS[code] ?? code
}

function normalizeCurrency(currency?: string): string {
  if (!currency) return ''
  const trimmed = currency.trim()
  if (trimmed === '֏' || trimmed.toUpperCase() === 'AMD') return 'AMD'
  if (trimmed === '$' || trimmed.toUpperCase() === 'USD') return 'USD'
  if (trimmed === '€' || trimmed.toUpperCase() === 'EUR') return 'EUR'
  return trimmed
}

function listingCurrencyKey(listing: { currency?: string }): string {
  return normalizeCurrency(listing.currency)
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

function compareByReliability(
  a: ActiveFeedItem,
  b: ActiveFeedItem,
  listingCountByOwner: Map<string, number>,
): number {
  return ownerReliabilityScore(b, listingCountByOwner) - ownerReliabilityScore(a, listingCountByOwner)
}

function compareByPrice(
  a: ActiveFeedItem,
  b: ActiveFeedItem,
  sort: 'price-asc' | 'price-desc',
): number {
  const priceA = a.listing.price
  const priceB = b.listing.price
  const missingA = priceA == null || priceA <= 0
  const missingB = priceB == null || priceB <= 0
  if (missingA && missingB) return 0
  if (missingA) return 1
  if (missingB) return -1
  if (priceA === priceB) return 0
  return sort === 'price-asc' ? priceA - priceB : priceB - priceA
}

function sortFeedItems(
  items: ActiveFeedItem[],
  sort: LatestSort,
  currencyFilter: string,
  listingCountByOwner: Map<string, number>,
): ActiveFeedItem[] {
  let filtered = items
  if (currencyFilter !== 'all') {
    filtered = items.filter((item) => listingCurrencyKey(item.listing) === currencyFilter)
  }

  return [...filtered].sort((a, b) => {
    if (sort === 'price-asc' || sort === 'price-desc') {
      const priceCmp = compareByPrice(a, b, sort)
      if (priceCmp !== 0) return priceCmp
    } else {
      const activityCmp = b.activityAt - a.activityAt
      if (activityCmp !== 0) return activityCmp
    }

    const reliabilityCmp = compareByReliability(a, b, listingCountByOwner)
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
  loading?: boolean
}

export function LatestView({
  listings,
  owners,
  searchListings,
  loading = false,
}: LatestViewProps) {
  const [window, setWindow] = useState<FeedTimeWindow>('7d')
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>('all')
  const [sort, setSort] = useState<LatestSort>('activity')
  const [currencyFilter, setCurrencyFilter] = useState<string>('all')

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

  const currencyOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const item of items) {
      const key = listingCurrencyKey(item.listing)
      if (key) keys.add(key)
    }
    return [...keys].sort((a, b) => currencyLabel(a).localeCompare(currencyLabel(b)))
  }, [items])

  const counts = useMemo(
    () => ({
      created: items.filter((item) => item.activityType === 'created').length,
      updated: items.filter((item) => item.activityType === 'updated').length,
    }),
    [items],
  )

  const visibleItems = useMemo(
    () => sortFeedItems(items, sort, currencyFilter, listingCountByOwner),
    [items, sort, currencyFilter, listingCountByOwner],
  )

  const sortDescription =
    sort === 'price-asc'
      ? 'Sorted by price (low → high), then owner reliability'
      : sort === 'price-desc'
        ? 'Sorted by price (high → low), then owner reliability'
        : 'Sorted by list.am activity, then owner reliability'

  return (
    <div className="latest-view">
      <section className="latest-hero">
        <div>
          <p className="latest-eyebrow">Live inventory</p>
          <h2>Latest active posts</h2>
          <p className="latest-subtitle">
            {sortDescription}. Dates come from list.am posted, renewed, and price-change fields.
          </p>
        </div>
        <div className="latest-stats">
          <span>
            {visibleItems.length} shown
            {currencyFilter !== 'all' && items.length !== visibleItems.length
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
        <div className="latest-sort-row">
          <label className="latest-select-label">
            Currency
            <select
              className="latest-select"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
            >
              <option value="all">All currencies</option>
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {currencyLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label className="latest-select-label">
            Sort
            <select
              className="latest-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as LatestSort)}
            >
              <option value="activity">Latest activity</option>
              <option value="price-asc">Price: low → high</option>
              <option value="price-desc">Price: high → low</option>
            </select>
          </label>
          <span className="latest-sort-hint">Owner reliability always breaks ties</span>
        </div>
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
              ? 'Run detail analysis so posted/renewed dates are captured, or widen the time window.'
              : 'Try a different currency filter or sort option.'}
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
                  {item.listing.district && <span>{item.listing.district}</span>}
                </div>

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
