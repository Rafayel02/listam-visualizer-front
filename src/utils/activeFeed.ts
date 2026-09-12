import type { Listing, Owner, PriceHistoryEntry, SearchListing } from '../types'
import { isDetailEnriched } from './listingDetail'

export type FeedActivityType = 'created' | 'updated'
export type FeedTimeWindow = '24h' | '7d' | '30d' | 'all'
export type FeedTypeFilter = 'all' | FeedActivityType

export interface ActiveFeedItem {
  listing: Listing
  owner?: Owner
  activityAt: number
  activityType: FeedActivityType
  activityLabel: string
  isPresent: boolean
}

const WINDOW_MS: Record<Exclude<FeedTimeWindow, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const RENEWAL_VS_POST_MS = 24 * 60 * 60 * 1000

function isListingActive(
  listing: Listing,
  presenceByListing: Map<string, boolean | undefined>,
): boolean {
  if (listing.isRemoved || listing.enrichmentStatus === 'removed') return false
  const presence = presenceByListing.get(listing.id)
  if (presence === false) return false
  return true
}

function buildPresenceMap(
  searchRows: Pick<SearchListing, 'listingId' | 'isPresent'>[],
): Map<string, boolean | undefined> {
  const map = new Map<string, boolean | undefined>()
  for (const row of searchRows) {
    const current = map.get(row.listingId)
    if (current === true) continue
    map.set(row.listingId, row.isPresent ? true : current ?? false)
  }
  return map
}

function parseListAmDate(raw?: string): number | undefined {
  if (!raw) return undefined

  const dotted = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (dotted) {
    const day = parseInt(dotted[1]!, 10)
    const month = parseInt(dotted[2]!, 10) - 1
    const year = parseInt(dotted[3]!, 10)
    const ts = Date.UTC(year, month, day)
    return Number.isNaN(ts) ? undefined : ts
  }

  const ts = Date.parse(raw)
  return Number.isNaN(ts) ? undefined : ts
}

function getLatestPriceChangeAt(listing: Listing): number | undefined {
  const history = listing.sourcePriceHistory ?? []
  let latest = 0

  for (const entry of history) {
    const ts = parseListAmDate(entry.date)
    if (ts && ts > latest) latest = ts
  }

  return latest > 0 ? latest : undefined
}

export interface ListAmActivity {
  activityAt: number
  activityType: FeedActivityType
  activityLabel: string
}

export function getListAmActivity(listing: Listing): ListAmActivity | null {
  const postedAt = listing.postedAt
  const renewedAt = listing.renewedAt
  const priceChangeAt = getLatestPriceChangeAt(listing)

  const isRenewalUpdate =
    renewedAt != null && (postedAt == null || renewedAt - postedAt > RENEWAL_VS_POST_MS)

  if (isRenewalUpdate && renewedAt != null) {
    const activityAt = Math.max(renewedAt, priceChangeAt ?? 0)
    return {
      activityAt,
      activityType: 'updated',
      activityLabel:
        priceChangeAt && priceChangeAt >= renewedAt
          ? 'Price updated on list.am'
          : 'Renewed on list.am',
    }
  }

  if (priceChangeAt && (!postedAt || priceChangeAt > postedAt + RENEWAL_VS_POST_MS)) {
    return {
      activityAt: priceChangeAt,
      activityType: 'updated',
      activityLabel: 'Price updated on list.am',
    }
  }

  if (postedAt) {
    return {
      activityAt: postedAt,
      activityType: 'created',
      activityLabel: 'Posted on list.am',
    }
  }

  if (renewedAt) {
    return {
      activityAt: renewedAt,
      activityType: 'updated',
      activityLabel: 'Renewed on list.am',
    }
  }

  // Detail page analyzed but list.am did not expose a post/renew date in HTML.
  if (isDetailEnriched(listing) && listing.lastChangedAt) {
    const isUpdate = listing.lastChangedAt > listing.firstSeenAt + RENEWAL_VS_POST_MS
    return {
      activityAt: listing.lastChangedAt,
      activityType: isUpdate ? 'updated' : 'created',
      activityLabel: isUpdate
        ? 'Updated (detail analyzed, list.am date unavailable)'
        : 'Posted (detail analyzed, list.am date unavailable)',
    }
  }

  return null
}

export function getWindowStart(window: FeedTimeWindow): number {
  if (window === 'all') return 0
  return Date.now() - WINDOW_MS[window]
}

export function buildActiveFeed(
  listings: Listing[],
  owners: Owner[],
  searchRows: SearchListing[],
  window: FeedTimeWindow,
  typeFilter: FeedTypeFilter,
): ActiveFeedItem[] {
  const since = getWindowStart(window)
  const ownersById = new Map(owners.map((owner) => [owner.id, owner]))
  const presenceByListing = buildPresenceMap(searchRows)
  const items: ActiveFeedItem[] = []

  for (const listing of listings) {
    if (!isDetailEnriched(listing)) continue
    if (!isListingActive(listing, presenceByListing)) continue

    const activity = getListAmActivity(listing)
    if (!activity) continue
    if (since > 0 && activity.activityAt < since) continue

    items.push({
      listing,
      owner: listing.ownerId ? ownersById.get(listing.ownerId) : undefined,
      activityAt: activity.activityAt,
      activityType: activity.activityType,
      activityLabel: activity.activityLabel,
      isPresent: presenceByListing.get(listing.id) !== false,
    })
  }

  let filtered = items
  if (typeFilter !== 'all') {
    filtered = items.filter((item) => item.activityType === typeFilter)
  }

  return filtered.sort((a, b) => b.activityAt - a.activityAt)
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function formatListAmDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getLatestPriceHistoryEntry(
  listing: Listing,
): PriceHistoryEntry | undefined {
  const history = listing.sourcePriceHistory ?? []
  if (history.length === 0) return undefined

  return [...history].sort((a, b) => {
    const aTs = parseListAmDate(a.date) ?? 0
    const bTs = parseListAmDate(b.date) ?? 0
    return bTs - aTs
  })[0]
}
