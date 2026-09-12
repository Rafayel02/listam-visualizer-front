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
  type FeedTimeWindow,
  type FeedTypeFilter,
} from '../utils/activeFeed'
import './LatestView.css'

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
  const [sortByReliability, setSortByReliability] = useState(true)

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

  const visibleItems = useMemo(() => {
    if (!sortByReliability) return items

    return [...items].sort((a, b) => {
      const scoreA = a.owner
        ? computeOwnerReliabilityScore(
            a.owner,
            listingCountByOwner.get(a.owner.id) ?? 0,
          ).score
        : -1
      const scoreB = b.owner
        ? computeOwnerReliabilityScore(
            b.owner,
            listingCountByOwner.get(b.owner.id) ?? 0,
          ).score
        : -1

      if (scoreB !== scoreA) return scoreB - scoreA
      return b.activityAt - a.activityAt
    })
  }, [items, sortByReliability, listingCountByOwner])

  return (
    <div className="latest-view">
      <section className="latest-hero">
        <div>
          <p className="latest-eyebrow">Live inventory</p>
          <h2>Latest active posts</h2>
          <p className="latest-subtitle">
            Sorted by list.am posted, renewed, and price-change dates — not when we scraped them.
          </p>
        </div>
        <div className="latest-stats">
          <span>{items.length} shown</span>
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
        <label className="latest-checkbox">
          <input
            type="checkbox"
            checked={sortByReliability}
            onChange={(e) => setSortByReliability(e.target.checked)}
          />
          Sort by owner reliability (most reliable first)
        </label>
      </section>

      {loading && (
        <section className="panel">
          <p className="muted">Loading data from backend…</p>
        </section>
      )}

      {!loading && visibleItems.length === 0 ? (
        <section className="panel latest-empty">
          <h3>No recent list.am activity</h3>
          <p className="muted">
            Run detail analysis so posted/renewed dates are captured, or widen the time window.
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
