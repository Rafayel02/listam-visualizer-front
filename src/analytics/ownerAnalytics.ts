import { BROKER_LISTING_THRESHOLD } from '../config'
import type { Listing, Owner } from '../types'
import { filterListings, type ListingKind } from './listingAnalytics'

export { BROKER_LISTING_THRESHOLD }

export type OwnerProfileType = 'agency' | 'broker' | 'likely_owner' | 'uncertain'

export interface OwnerReliability {
  score: number
  label: string
}

export interface OwnerAnalysisRow {
  owner: Owner
  /** Best estimate for broker/owner classification. */
  postCount: number
  sitePostsCount?: number
  scrapedPostsCount: number
  activeListingCount: number
  medianPrice: number
  districts: string[]
  profileType: OwnerProfileType
  confidence: number
  reliability: OwnerReliability
  reasons: string[]
}

export function getEffectivePostCount(owner: Owner, scrapedCount: number): number {
  return owner.sitePostsCount ?? scrapedCount
}

type OwnerClassificationInput = Pick<
  Owner,
  'isVerifiedCompany' | 'sitePostsCount' | 'rating' | 'reviewCount'
>

export function getOwnerProfileType(
  owner: OwnerClassificationInput,
  scrapedPostsCount = 1,
): OwnerProfileType {
  const postCount = getEffectivePostCount(owner as Owner, scrapedPostsCount)
  return classifyOwner(postCount, owner as Owner).profileType
}

/** True for private sellers; false for agencies and likely brokers. */
export function isLikelyOwnerPost(
  owner: OwnerClassificationInput,
  scrapedPostsCount = 1,
): boolean {
  const profileType = getOwnerProfileType(owner, scrapedPostsCount)
  return profileType === 'likely_owner' || profileType === 'uncertain'
}

export interface OwnerScatterPoint {
  id: string
  x: number
  y: number
  label: string
  district: string
  profileType: OwnerProfileType
}

export interface OwnerAnalysisSnapshot {
  totalOwners: number
  withListings: number
  agencyCount: number
  brokerCount: number
  likelyOwnerCount: number
  uncertainCount: number
  avgRating: number
  medianListingCount: number
  rows: OwnerAnalysisRow[]
  typeBreakdown: { label: string; count: number; color: string }[]
  postsVsRating: OwnerScatterPoint[]
  listingCountHistogram: { label: string; count: number }[]
}

const TYPE_COLORS: Record<OwnerProfileType, string> = {
  agency: '#f59e0b',
  broker: '#f472b6',
  likely_owner: '#34d399',
  uncertain: '#94a3b8',
}

const TYPE_LABELS: Record<OwnerProfileType, string> = {
  agency: 'Agency',
  broker: 'Likely broker',
  likely_owner: 'Likely owner',
  uncertain: 'Uncertain',
}

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

function classifyOwner(
  postCount: number,
  owner: Owner,
): { profileType: OwnerProfileType; confidence: number; reasons: string[] } {
  const reasons: string[] = []

  if (owner.isVerifiedCompany) {
    reasons.push('Verified company on list.am')
    return { profileType: 'agency', confidence: 96, reasons }
  }

  if (postCount >= BROKER_LISTING_THRESHOLD) {
    const source = owner.sitePostsCount != null ? 'on list.am' : 'in your scraped data'
    reasons.push(`${postCount} listings ${source}`)
    if (owner.reviewCount != null && owner.reviewCount >= 5) {
      reasons.push(`${owner.reviewCount} seller reviews`)
    }
    if (owner.rating != null && owner.rating >= 4.5) {
      reasons.push(`High seller rating (${owner.rating})`)
    }
    const confidence = Math.min(96, 58 + postCount * 9)
    return { profileType: 'broker', confidence, reasons }
  }

  if (postCount <= 2) {
    reasons.push(`Only ${postCount} listing${postCount === 1 ? '' : 's'} total`)
    if (owner.reviewCount == null || owner.reviewCount <= 2) {
      reasons.push('Few or no seller reviews')
    }
    const confidence = postCount === 1 ? 84 : 68
    return { profileType: 'likely_owner', confidence, reasons }
  }

  reasons.push(`${postCount} listings — between owner and broker range`)
  if (owner.reviewCount != null && owner.reviewCount >= 8) {
    reasons.push(`${owner.reviewCount} reviews suggests professional seller`)
    return { profileType: 'broker', confidence: 62, reasons }
  }

  return { profileType: 'uncertain', confidence: 48, reasons }
}

export function profileTypeLabel(type: OwnerProfileType): string {
  return TYPE_LABELS[type]
}

export function profileTypeColor(type: OwnerProfileType): string {
  return TYPE_COLORS[type]
}

export function computeOwnerReliabilityScore(
  owner: Owner,
  scrapedCount = 1,
): OwnerReliability {
  const listingCount = getEffectivePostCount(owner, scrapedCount)
  let score = 0

  if (owner.rating != null) {
    score += (owner.rating / 5) * 45
  }

  if (owner.reviewCount != null && owner.reviewCount > 0) {
    score += Math.min(30, Math.log10(owner.reviewCount + 1) * 15)
  }

  if (owner.isVerifiedCompany) {
    score += 15
  }

  if (
    listingCount >= BROKER_LISTING_THRESHOLD &&
    owner.rating != null &&
    owner.rating >= 4
  ) {
    score += 5
  }

  if (
    listingCount <= 2 &&
    owner.rating != null &&
    owner.rating >= 4.5 &&
    (owner.reviewCount ?? 0) >= 1
  ) {
    score += 8
  }

  if (owner.rating == null && (owner.reviewCount == null || owner.reviewCount === 0)) {
    score -= 12
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let label = 'Low data'
  if (score >= 75) label = 'Very reliable'
  else if (score >= 55) label = 'Reliable'
  else if (score >= 35) label = 'Moderate'

  return { score, label }
}

export function compareOwnersByReliability(
  left: Pick<OwnerAnalysisRow, 'owner' | 'scrapedPostsCount' | 'reliability'>,
  right: Pick<OwnerAnalysisRow, 'owner' | 'scrapedPostsCount' | 'reliability'>,
): number {
  const leftScore = left.reliability?.score ??
    computeOwnerReliabilityScore(left.owner, left.scrapedPostsCount).score
  const rightScore = right.reliability?.score ??
    computeOwnerReliabilityScore(right.owner, right.scrapedPostsCount).score

  if (rightScore !== leftScore) return rightScore - leftScore

  const ratingDiff = (right.owner.rating ?? 0) - (left.owner.rating ?? 0)
  if (ratingDiff !== 0) return ratingDiff

  return (right.owner.reviewCount ?? 0) - (left.owner.reviewCount ?? 0)
}

export function reliabilityColor(score: number): string {
  if (score >= 75) return '#059669'
  if (score >= 55) return '#34d399'
  if (score >= 35) return '#fbbf24'
  return '#94a3b8'
}

export function buildOwnerAnalysisSnapshot(
  listings: Listing[],
  owners: Owner[],
  kind: ListingKind,
  includeRemoved: boolean,
  district?: string | null,
): OwnerAnalysisSnapshot {
  const filtered = filterListings(listings, kind, includeRemoved, district)
  const listingsByOwner = new Map<string, Listing[]>()

  for (const listing of filtered) {
    if (!listing.ownerId) continue
    const bucket = listingsByOwner.get(listing.ownerId) ?? []
    bucket.push(listing)
    listingsByOwner.set(listing.ownerId, bucket)
  }

  const rows: OwnerAnalysisRow[] = []

  for (const owner of owners) {
    const ownerListings = listingsByOwner.get(owner.id) ?? []
    if (ownerListings.length === 0) continue

    const prices = ownerListings
      .map((listing) => listing.price)
      .filter((price): price is number => price != null && price > 0)
    const districts = [...new Set(
      ownerListings.map((listing) => listing.district).filter(Boolean) as string[],
    )]
    const activeListingCount = ownerListings.filter(
      (listing) => !listing.isRemoved && listing.enrichmentStatus !== 'removed',
    ).length

    const scrapedPostsCount = ownerListings.length
    const postCount = getEffectivePostCount(owner, scrapedPostsCount)
    const classification = classifyOwner(postCount, owner)
    const reliability = computeOwnerReliabilityScore(owner, scrapedPostsCount)

    rows.push({
      owner,
      postCount,
      sitePostsCount: owner.sitePostsCount,
      scrapedPostsCount,
      activeListingCount,
      medianPrice: median(prices),
      districts,
      profileType: classification.profileType,
      confidence: classification.confidence,
      reliability,
      reasons: classification.reasons,
    })
  }

  rows.sort(compareOwnersByReliability)

  const typeCounts = new Map<OwnerProfileType, number>()
  for (const row of rows) {
    typeCounts.set(row.profileType, (typeCounts.get(row.profileType) ?? 0) + 1)
  }

  const ratedOwners = rows.filter((row) => row.owner.rating != null)

  const countBuckets = new Map<string, number>()
  for (const row of rows) {
    const label =
      row.postCount === 1
        ? '1 post'
        : row.postCount <= 3
          ? '2–3 posts'
          : row.postCount <= 6
            ? '4–6 posts'
            : '7+ posts'
    countBuckets.set(label, (countBuckets.get(label) ?? 0) + 1)
  }

  return {
    totalOwners: owners.length,
    withListings: rows.length,
    agencyCount: typeCounts.get('agency') ?? 0,
    brokerCount: typeCounts.get('broker') ?? 0,
    likelyOwnerCount: typeCounts.get('likely_owner') ?? 0,
    uncertainCount: typeCounts.get('uncertain') ?? 0,
    avgRating: average(ratedOwners.map((row) => row.owner.rating!)),
    medianListingCount: median(rows.map((row) => row.postCount)),
    rows,
    typeBreakdown: (['agency', 'broker', 'likely_owner', 'uncertain'] as OwnerProfileType[])
      .map((type) => ({
        label: TYPE_LABELS[type],
        count: typeCounts.get(type) ?? 0,
        color: TYPE_COLORS[type],
      }))
      .filter((slice) => slice.count > 0),
    postsVsRating: ratedOwners.map((row) => ({
      id: row.owner.id,
      x: row.postCount,
      y: row.owner.rating!,
      label: row.owner.name ?? row.owner.id,
      district: row.profileType,
      profileType: row.profileType,
    })),
    listingCountHistogram: [...countBuckets.entries()].map(([label, count]) => ({
      label,
      count,
    })),
  }
}
