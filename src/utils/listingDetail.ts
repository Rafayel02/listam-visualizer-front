import type { Listing } from '../types'

/** Listing has been through the detail page scraper with usable results. */
export function isDetailEnriched(listing: Listing): boolean {
  if (listing.enrichmentStatus === 'removed') return false
  if (listing.enrichmentStatus === 'complete') return true

  return Boolean(
    listing.ownerId ||
      listing.description ||
      listing.postedAt ||
      listing.renewedAt ||
      (listing.sourcePriceHistory?.length ?? 0) > 0 ||
      (listing.imageUrls?.length ?? 0) > 0 ||
      (listing.attributes && Object.keys(listing.attributes).length > 0),
  )
}

export function detailEnrichmentLabel(listing: Listing): string | null {
  if (listing.enrichmentStatus === 'complete') return 'Detail analyzed'
  if (isDetailEnriched(listing)) return 'Partial detail data'
  return null
}
