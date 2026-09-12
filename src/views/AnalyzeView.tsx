import { useMemo, useState } from 'react'
import {
  buildAnalysisSnapshot,
  formatCompact,
  formatPrice,
  type ListingKind,
} from '../analytics/listingAnalytics'
import { BarChart } from '../components/charts/BarChart'
import { CorrelationMatrix } from '../components/charts/CorrelationMatrix'
import { DonutChart } from '../components/charts/DonutChart'
import { Histogram } from '../components/charts/Histogram'
import { ScatterPlot } from '../components/charts/ScatterPlot'
import { StatCard } from '../components/charts/StatCard'
import type { DuplicatePair, DuplicateJobState } from '../api/client'
import type { Listing, Owner } from '../types'
import { DuplicateDetectionSection } from './DuplicateDetectionSection'
import { OwnerAnalysisSection } from './OwnerAnalysisSection'
import './AnalyzeView.css'

type AnalyzeMode = 'listings' | 'owners'

interface AnalyzeViewProps {
  listings: Listing[]
  owners: Owner[]
  loading?: boolean
  duplicateJob: DuplicateJobState
  duplicatePairs: DuplicatePair[]
  duplicateLoading?: boolean
  duplicateError?: string | null
  duplicateRunning?: boolean
  listingsWithHashes?: number
  onStartDuplicateDetection?: () => void
}

export function AnalyzeView({
  listings,
  owners,
  loading = false,
  duplicateJob,
  duplicatePairs,
  duplicateLoading = false,
  duplicateError = null,
  duplicateRunning = false,
  listingsWithHashes = 0,
  onStartDuplicateDetection,
}: AnalyzeViewProps) {
  const [mode, setMode] = useState<AnalyzeMode>('listings')
  const [kind, setKind] = useState<ListingKind>('sale')
  const [includeRemoved, setIncludeRemoved] = useState(false)

  const analysis = useMemo(
    () => buildAnalysisSnapshot(listings, owners, kind, includeRemoved),
    [listings, owners, kind, includeRemoved],
  )

  const enrichedPct = analysis.totalListings
    ? Math.round((analysis.enrichedListings / analysis.totalListings) * 100)
    : 0

  return (
    <div className="analyze-view">
      {loading && (
        <section className="analyze-panel">
          <p className="muted">Loading data from backend…</p>
        </section>
      )}
      <section className="analyze-hero">
        <div>
          <p className="analyze-eyebrow">Market intelligence</p>
          <h2>{mode === 'listings' ? 'Analyze listings' : 'Analyze owners'}</h2>
          <p className="analyze-subtitle">
            {mode === 'listings'
              ? 'Correlations, price structure, and district patterns from your scraped data.'
              : 'Classify sellers as likely brokers or owners using post count, ratings, and reviews.'}
          </p>
        </div>
        <div className="analyze-controls">
          <div className="analyze-toggle-group analyze-mode-toggle">
            {(['listings', 'owners'] as AnalyzeMode[]).map((option) => (
              <button
                key={option}
                type="button"
                className={mode === option ? 'active' : ''}
                onClick={() => setMode(option)}
              >
                {option === 'listings' ? 'Listings' : 'Owners'}
              </button>
            ))}
          </div>
          <div className="analyze-toggle-group">
            {(['sale', 'rent', 'all'] as ListingKind[]).map((option) => (
              <button
                key={option}
                type="button"
                className={kind === option ? 'active' : ''}
                onClick={() => setKind(option)}
              >
                {option === 'all' ? 'All' : option === 'sale' ? 'For sale' : 'Rent'}
              </button>
            ))}
          </div>
          <label className="analyze-checkbox">
            <input
              type="checkbox"
              checked={includeRemoved}
              onChange={(e) => setIncludeRemoved(e.target.checked)}
            />
            Include removed
          </label>
        </div>
      </section>

      <DuplicateDetectionSection
        job={duplicateJob}
        pairs={duplicatePairs}
        listings={listings}
        owners={owners}
        loading={duplicateLoading}
        error={duplicateError}
        isRunning={duplicateRunning}
        listingsWithHashes={listingsWithHashes}
        onStart={() => onStartDuplicateDetection?.()}
      />

      {mode === 'owners' ? (
        <OwnerAnalysisSection
          listings={listings}
          owners={owners}
          kind={kind}
          includeRemoved={includeRemoved}
        />
      ) : analysis.withPrice === 0 ? (
        <section className="analyze-panel analyze-empty-state">
          <h3>No priced listings yet</h3>
          <p>Run the scraper and analyze some detail pages to unlock charts here.</p>
        </section>
      ) : (
        <>
          <section className="analyze-kpi-grid">
            <StatCard
              label="Median price"
              value={formatPrice(analysis.medianPrice)}
              hint={`Avg ${formatPrice(Math.round(analysis.avgPrice))}`}
              accent="#6366f1"
            />
            <StatCard
              label="Median $/m²"
              value={formatPrice(Math.round(analysis.medianPricePerSqm))}
              hint={`Avg ${formatPrice(Math.round(analysis.avgPricePerSqm))}`}
              accent="#06b6d4"
            />
            <StatCard
              label="Inventory"
              value={`${analysis.withPrice}`}
              hint={`${analysis.activeListings} active · ${analysis.removedListings} removed`}
              accent="#8b5cf6"
            />
            <StatCard
              label="Typical layout"
              value={`${analysis.medianRooms || '—'} rm`}
              hint={`${analysis.medianArea ? `${Math.round(analysis.medianArea)} m² median` : 'Area n/a'}`}
              accent="#f59e0b"
            />
            <StatCard
              label="Detail coverage"
              value={`${enrichedPct}%`}
              hint={`${analysis.enrichedListings} enriched listings`}
              accent="#10b981"
            />
          </section>

          <section className="analyze-grid">
            <article className="analyze-panel analyze-span-2">
              <header className="analyze-panel-header">
                <h3>Area vs price</h3>
                <span className="analyze-panel-meta">Trend line shows size–price relationship</span>
              </header>
              <ScatterPlot
                points={analysis.areaPriceScatter}
                xLabel="Area (m²)"
                yLabel="Price"
              />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Enrichment status</h3>
              </header>
              <DonutChart slices={analysis.enrichmentBreakdown} />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Price distribution</h3>
              </header>
              <Histogram bins={analysis.priceHistogram} color="#6366f1" />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>$/m² distribution</h3>
              </header>
              <Histogram bins={analysis.pricePerSqmHistogram} color="#06b6d4" />
            </article>

            <article className="analyze-panel analyze-span-2">
              <header className="analyze-panel-header">
                <h3>Median $/m² by district</h3>
                <span className="analyze-panel-meta">Bar length = median $/m² · label count = listings</span>
              </header>
              <BarChart
                items={analysis.districtStats.map((row) => ({
                  label: `${row.label} (${row.count})`,
                  value: row.medianPricePerSqm,
                  secondary: row.medianPrice,
                }))}
                valueFormatter={(v) => formatPrice(Math.round(v))}
                secondaryFormatter={(v) => `med ${formatCompact(v)}`}
                color="#22d3ee"
                secondaryColor="#6366f133"
              />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Rooms vs median $/m²</h3>
              </header>
              <BarChart
                items={analysis.roomStats.map((row) => ({
                  label: row.label,
                  value: row.medianPricePerSqm,
                }))}
                valueFormatter={(v) => formatPrice(Math.round(v))}
                color="#8b5cf6"
              />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Floor vs median $/m²</h3>
              </header>
              <BarChart
                items={analysis.floorStats.map((row) => ({
                  label: row.label,
                  value: row.medianPricePerSqm,
                }))}
                valueFormatter={(v) => formatPrice(Math.round(v))}
                color="#f59e0b"
              />
            </article>

            <article className="analyze-panel analyze-span-2">
              <header className="analyze-panel-header">
                <h3>Correlation matrix</h3>
                <span className="analyze-panel-meta">Pearson r across numeric fields</span>
              </header>
              <CorrelationMatrix
                labels={analysis.correlationLabels}
                cells={analysis.correlationMatrix}
              />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Listing freshness</h3>
                <span className="analyze-panel-meta">Based on posted date when available</span>
              </header>
              <BarChart
                items={analysis.freshnessBuckets.map((row) => ({
                  label: `${row.label} (${row.count})`,
                  value: row.medianPricePerSqm,
                }))}
                valueFormatter={(v) => (v ? formatPrice(Math.round(v)) : '—')}
                color="#10b981"
              />
            </article>

            <article className="analyze-panel">
              <header className="analyze-panel-header">
                <h3>Top owners by volume</h3>
              </header>
              <BarChart
                items={analysis.topOwners.map((row) => ({
                  label: row.name,
                  value: row.count,
                  secondary: row.medianPrice,
                }))}
                valueFormatter={(v) => `${v} listings`}
                secondaryFormatter={(v) => formatCompact(v)}
                color="#ec4899"
                secondaryColor="#f472b655"
              />
            </article>

            <article className="analyze-panel analyze-span-2">
              <header className="analyze-panel-header">
                <h3>Recent price drops</h3>
                <span className="analyze-panel-meta">From scraped price history</span>
              </header>
              {analysis.priceDrops.length === 0 ? (
                <p className="analyze-empty">No price drops detected in stored history yet.</p>
              ) : (
                <div className="analyze-table-wrap">
                  <table className="analyze-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>District</th>
                        <th>Was</th>
                        <th>Now</th>
                        <th>Drop</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.priceDrops.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td>{row.district}</td>
                          <td>{formatPrice(row.previousPrice)}</td>
                          <td>{formatPrice(row.currentPrice)}</td>
                          <td className="analyze-drop">−{row.dropPct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  )
}
