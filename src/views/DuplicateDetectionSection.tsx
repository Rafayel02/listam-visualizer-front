import type { DuplicatePair, DuplicateJobState } from '../api/client'
import type { Listing, Owner } from '../types'
import './DuplicateDetectionSection.css'

interface DuplicateDetectionSectionProps {
  job: DuplicateJobState
  pairs: DuplicatePair[]
  listings: Listing[]
  owners: Owner[]
  loading: boolean
  error: string | null
  isRunning: boolean
  listingsWithHashes: number
  onStart: () => void
}

function formatPrice(price?: number, currency?: string): string {
  if (price == null) return '—'
  return `${price.toLocaleString()} ${currency ?? ''}`.trim()
}

function ownerName(owners: Owner[], ownerId?: string): string {
  if (!ownerId) return 'Unknown owner'
  const owner = owners.find((o) => o.id === ownerId)
  return owner?.name || ownerId
}

function progressPct(job: DuplicateJobState, running: boolean): number {
  if (!job.progress) return running ? 8 : 0
  if (job.progress.total <= 0) return running ? 12 : 0
  return Math.min(100, Math.round((job.progress.current / job.progress.total) * 100))
}

export function DuplicateDetectionSection({
  job,
  pairs,
  listings,
  owners,
  loading,
  error,
  isRunning,
  listingsWithHashes,
  onStart,
}: DuplicateDetectionSectionProps) {
  const listingById = new Map(listings.map((l) => [l.id, l]))

  return (
    <section className="analyze-panel duplicate-section">
      <header className="analyze-panel-header duplicate-header">
        <div>
          <h3>Duplicate posts (cross-owner)</h3>
          <span className="analyze-panel-meta">
            Backend fetches images and pHash-compares · ≥90% per image · ≥80% match · different owners
          </span>
        </div>
        <button
          type="button"
          className="duplicate-run-btn"
          onClick={onStart}
          disabled={isRunning || loading}
        >
          {isRunning ? 'Detection in progress…' : 'Detect duplicate posts'}
        </button>
      </header>

      {error && <p className="duplicate-error">{error}</p>}

      {isRunning && (
        <div className="duplicate-progress">
          <div className="duplicate-progress-bar">
            <div
              className={`duplicate-progress-fill${job.progress && job.progress.total <= 0 ? ' duplicate-progress-indeterminate' : ''}`}
              style={{ width: `${progressPct(job, isRunning)}%` }}
            />
          </div>
          <p className="duplicate-progress-text">
            {job.progress?.message ?? 'Starting detection…'}
            {job.imagesFetched != null && job.imagesFetched > 0 && (
              <> · {job.imagesFetched} newly fetched</>
            )}
            {job.imagesFailed != null && job.imagesFailed > 0 && (
              <> · {job.imagesFailed} failed</>
            )}
          </p>
        </div>
      )}

      {!isRunning && job.status === 'completed' && job.pairsFound != null && (
        <p className="duplicate-summary">
          Last run found <strong>{job.pairsFound}</strong> duplicate pair
          {job.pairsFound === 1 ? '' : 's'}
          {job.listingsEligible != null && ` from ${job.listingsEligible} listings`}
          {(job.listingsWithHashes ?? listingsWithHashes) > 0 && (
            <> · {job.listingsWithHashes ?? listingsWithHashes} with hashes</>
          )}
          {job.imagesHashed != null && ` · ${job.imagesHashed} images hashed`}
          {job.imagesFailed != null && job.imagesFailed > 0 && (
            <> · <span className="duplicate-fail-count">{job.imagesFailed} fetch failures</span></>
          )}
          .
        </p>
      )}

      {!isRunning && job.imagesFailed != null && job.imagesFailed > 0 && job.listingsWithHashes === 0 && (
        <p className="duplicate-warn">
          list.am blocked image downloads from the server ({job.imagesFailed} failed). Duplicate
          detection needs hashed images — try again later or check Railway outbound access.
        </p>
      )}

      {!isRunning && job.status === 'failed' && job.error && (
        <p className="duplicate-error">Detection failed: {job.error}</p>
      )}

      {pairs.length === 0 && !isRunning && !loading ? (
        <p className="analyze-empty">
          {job.status === 'completed'
            ? 'Detection finished — no cross-owner duplicate posts matched.'
            : 'No duplicate pairs stored yet. Run detection after detail analysis.'}
        </p>
      ) : (
        <div className="duplicate-pairs">
          {pairs.map((pair) => (
            <article key={pair.id} className="duplicate-pair-card">
              <div className="duplicate-pair-score">
                <strong>{Math.round(pair.avgSimilarity * 100)}%</strong>
                <span>avg match</span>
                <span className="duplicate-pair-ratio">{Math.round(pair.matchRatio * 100)}% images</span>
              </div>
              <div className="duplicate-pair-listings">
                {[pair.listingA, pair.listingB].map((item) => {
                  const listing = listingById.get(item.id)
                  return (
                    <div key={item.id} className="duplicate-listing">
                      {item.thumbnailUrl && (
                        <img src={item.thumbnailUrl} alt="" className="duplicate-thumb" />
                      )}
                      <div>
                        <a href={item.url} target="_blank" rel="noreferrer" className="duplicate-link">
                          {item.title || item.id}
                        </a>
                        <div className="duplicate-listing-meta">
                          <span>{formatPrice(item.price, item.currency)}</span>
                          {item.district && <span>{item.district}</span>}
                          <span>{ownerName(owners, item.ownerId)}</span>
                        </div>
                        {listing?.description && (
                          <p className="duplicate-desc">
                            {listing.description.length > 100
                              ? `${listing.description.slice(0, 100)}…`
                              : listing.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
