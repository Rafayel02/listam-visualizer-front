import { useMemo } from 'react'
import { enumParam, useSearchParam } from '../hooks/useUrlQuery'
import {
  BROKER_LISTING_THRESHOLD,
  buildOwnerAnalysisSnapshot,
  compareOwnersByReliability,
  profileTypeColor,
  profileTypeLabel,
  reliabilityColor,
  type OwnerAnalysisRow,
  type OwnerProfileType,
} from '../analytics/ownerAnalytics'
import { formatPrice, type ListingKind } from '../analytics/listingAnalytics'
import { BarChart } from '../components/charts/BarChart'
import { DonutChart } from '../components/charts/DonutChart'
import { OwnerScatterPlot } from '../components/charts/OwnerScatterPlot'
import { StatCard } from '../components/charts/StatCard'
import type { Listing, Owner } from '../types'

type OwnerTypeFilter = 'all' | OwnerProfileType

interface OwnerAnalysisSectionProps {
  listings: Listing[]
  owners: Owner[]
  kind: ListingKind
  includeRemoved: boolean
  district?: string | null
}

export function OwnerAnalysisSection({
  listings,
  owners,
  kind,
  includeRemoved,
  district = null,
}: OwnerAnalysisSectionProps) {
  const [typeFilter, setTypeFilter] = useSearchParam<OwnerTypeFilter>('ownerType', {
    defaultValue: 'all',
    ...enumParam(
      ['all', 'agency', 'broker', 'likely_owner', 'uncertain'] as const,
      'all',
    ),
  })
  const [sortBy, setSortBy] = useSearchParam<
    'reliability' | 'posts' | 'rating' | 'confidence'
  >('ownerSort', {
    defaultValue: 'reliability',
    ...enumParam(['reliability', 'posts', 'rating', 'confidence'] as const, 'reliability'),
  })

  const analysis = useMemo(
    () => buildOwnerAnalysisSnapshot(listings, owners, kind, includeRemoved, district),
    [listings, owners, kind, includeRemoved, district],
  )

  const visibleRows = useMemo(() => {
    let rows = analysis.rows
    if (typeFilter !== 'all') {
      rows = rows.filter((row) => row.profileType === typeFilter)
    }
    return [...rows].sort((a, b) => {
      if (sortBy === 'reliability') {
        return compareOwnersByReliability(a, b)
      }
      if (sortBy === 'rating') {
        return (b.owner.rating ?? 0) - (a.owner.rating ?? 0)
      }
      if (sortBy === 'confidence') {
        return b.confidence - a.confidence
      }
      return b.postCount - a.postCount
    })
  }, [analysis.rows, typeFilter, sortBy])

  if (analysis.withListings === 0 && owners.length === 0) {
    return (
      <section className="analyze-panel analyze-empty-state">
        <h3>No owner data yet</h3>
        <p>Run the scraper and sync data to see seller analytics here.</p>
      </section>
    )
  }

  return (
    <>
      {analysis.withListings === 0 && (
        <section className="analyze-panel analyze-empty-state">
          <h3>No linked owner listings yet</h3>
          <p>Run detail analysis in scrape-front to link listings to owners.</p>
        </section>
      )}

      {analysis.withListings > 0 && (
      <>
      <section className="analyze-kpi-grid">
        <StatCard
          label="Owners tracked"
          value={`${analysis.withListings}`}
          hint={`${analysis.totalOwners} total in database`}
          accent="#ec4899"
        />
        <StatCard
          label="Likely brokers"
          value={`${analysis.brokerCount + analysis.agencyCount}`}
          hint={`≥ ${BROKER_LISTING_THRESHOLD} posts or verified company`}
          accent="#f472b6"
        />
        <StatCard
          label="Likely owners"
          value={`${analysis.likelyOwnerCount}`}
          hint="1–2 posts, few reviews"
          accent="#34d399"
        />
        <StatCard
          label="Avg seller rating"
          value={analysis.avgRating ? analysis.avgRating.toFixed(1) : '—'}
          hint={`Median ${analysis.medianListingCount} posts per seller`}
          accent="#f59e0b"
        />
        <StatCard
          label="Uncertain"
          value={`${analysis.uncertainCount}`}
          hint="3 posts or mixed signals"
          accent="#94a3b8"
        />
      </section>

      <section className="analyze-grid">
        <article className="analyze-panel analyze-span-2">
          <header className="analyze-panel-header">
            <h3>Posts vs seller rating</h3>
            <span className="analyze-panel-meta">
              Vertical line = broker threshold ({BROKER_LISTING_THRESHOLD}+ posts)
            </span>
          </header>
          <OwnerScatterPlot points={analysis.postsVsRating} />
        </article>

        <article className="analyze-panel">
          <header className="analyze-panel-header">
            <h3>Seller classification</h3>
          </header>
          <DonutChart slices={analysis.typeBreakdown} />
        </article>

        <article className="analyze-panel">
          <header className="analyze-panel-header">
            <h3>Posts per seller</h3>
          </header>
          <BarChart
            items={analysis.listingCountHistogram.map((row) => ({
              label: row.label,
              value: row.count,
            }))}
            valueFormatter={(v) => `${v} sellers`}
            color="#818cf8"
          />
        </article>

        <article className="analyze-panel analyze-span-2">
          <header className="analyze-panel-header">
            <h3>Owner directory</h3>
            <div className="analyze-owner-filters">
              <div className="analyze-toggle-group">
                {(['all', 'likely_owner', 'broker', 'agency', 'uncertain'] as OwnerTypeFilter[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className={typeFilter === option ? 'active' : ''}
                      onClick={() => setTypeFilter(option)}
                    >
                      {option === 'all' ? 'All' : profileTypeLabel(option)}
                    </button>
                  ),
                )}
              </div>
              <select
                className="analyze-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="reliability">Sort: reliability</option>
                <option value="posts">Sort: posts</option>
                <option value="rating">Sort: rating</option>
                <option value="confidence">Sort: confidence</option>
              </select>
            </div>
          </header>

          <div className="analyze-table-wrap">
            <table className="analyze-table analyze-owner-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Reliability</th>
                  <th>Type</th>
                  <th>On list.am</th>
                  <th>In your data</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>Median price</th>
                  <th>Areas</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <OwnerRow key={row.owner.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      </>
      )}
    </>
  )
}

function OwnerRow({ row }: { row: OwnerAnalysisRow }) {
  return (
    <tr>
      <td>
        <div className="analyze-owner-cell">
          {row.owner.avatarUrl && (
            <img src={row.owner.avatarUrl} alt="" className="analyze-owner-avatar" />
          )}
          <div>
            <a
              href={`https://www.list.am${row.owner.profileUrl}`}
              target="_blank"
              rel="noreferrer"
              className="analyze-owner-name"
            >
              {row.owner.name || row.owner.id}
            </a>
            {row.owner.tenureText && (
              <div className="analyze-owner-tenure">{row.owner.tenureText}</div>
            )}
          </div>
        </div>
      </td>
      <td>
        <span
          className="analyze-reliability-score"
          style={{ color: reliabilityColor(row.reliability.score) }}
        >
          {row.reliability.score}
        </span>
        <div className="analyze-owner-sub">{row.reliability.label}</div>
      </td>
      <td>
        <span
          className="analyze-owner-type"
          style={{ background: `${profileTypeColor(row.profileType)}22`, color: profileTypeColor(row.profileType) }}
        >
          {profileTypeLabel(row.profileType)}
        </span>
        <div className="analyze-owner-confidence">{row.confidence}%</div>
      </td>
      <td>
        <strong>{row.sitePostsCount ?? '—'}</strong>
      </td>
      <td>
        <strong>{row.scrapedPostsCount}</strong>
        {row.activeListingCount !== row.scrapedPostsCount && (
          <div className="analyze-owner-sub">{row.activeListingCount} active</div>
        )}
      </td>
      <td>{row.owner.rating != null ? row.owner.rating.toFixed(1) : '—'}</td>
      <td>{row.owner.reviewCount ?? '—'}</td>
      <td>{row.medianPrice ? formatPrice(Math.round(row.medianPrice)) : '—'}</td>
      <td className="analyze-owner-districts">
        {row.districts.slice(0, 2).join(', ')}
        {row.districts.length > 2 ? ` +${row.districts.length - 2}` : ''}
      </td>
      <td className="analyze-owner-reasons">{row.reasons.join(' · ')}</td>
    </tr>
  )
}
