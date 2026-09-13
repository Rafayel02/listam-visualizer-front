import { useEffect, useState } from 'react'
import { BarChart } from '../components/charts/BarChart'
import { CorrelationMatrix } from '../components/charts/CorrelationMatrix'
import { ScatterPlot } from '../components/charts/ScatterPlot'
import { fetchChangeHistoryCorrelation, type ReputationChangeCorrelation } from '../api/client'
import './AnalyzeView.css'
import './HistoryView.css'

function correlationColor(value: number): string {
  if (value >= 0.35) return '#059669'
  if (value > 0.1) return '#34d399'
  if (value > -0.1) return '#64748b'
  if (value > -0.35) return '#f87171'
  return '#dc2626'
}

function formatR(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
}

interface HistoryCorrelationSectionProps {
  days: number
}

export function HistoryCorrelationSection({ days }: HistoryCorrelationSectionProps) {
  const [data, setData] = useState<ReputationChangeCorrelation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchChangeHistoryCorrelation(days)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [days])

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Loading correlation analysis…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    )
  }

  if (!data || data.ownerCount < 3) {
    return (
      <section className="panel history-empty">
        <h3>Not enough data for correlation</h3>
        <p className="muted">
          Need at least 3 owners with linked reputation and change history in the selected period.
        </p>
      </section>
    )
  }

  const strongest = [...data.reputationCorrelations]
    .filter((row) => row.action !== 'total')
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0]

  return (
    <div className="history-correlation">
      <section className="panel history-correlation-summary">
        <p>
          Pearson correlation across <strong>{data.ownerCount}</strong> owners and{' '}
          <strong>{data.totalEvents}</strong> changes in the last <strong>{data.days}</strong> days.
        </p>
        {strongest && (
          <p className="history-correlation-insight">
            Strongest link: <strong>{strongest.label}</strong> ({formatR(strongest.r)})
            {Math.abs(strongest.r) >= 0.35
              ? strongest.r > 0
                ? ' — higher reputation owners tend to have more of this activity.'
                : ' — higher reputation owners tend to have less of this activity.'
              : ' — weak correlation in this window.'}
          </p>
        )}
      </section>

      <div className="history-correlation-grid">
        <article className="panel history-correlation-panel">
          <header className="history-correlation-header">
            <h3>Reputation vs actions</h3>
            <span className="muted">Pearson r per owner</span>
          </header>
          <div className="history-correlation-rows">
            {data.reputationCorrelations.map((row) => (
              <div key={row.action} className="history-correlation-row">
                <span className="history-correlation-label">{row.label}</span>
                <span
                  className="history-correlation-value"
                  style={{ color: correlationColor(row.r) }}
                  title={`n=${row.n}`}
                >
                  {formatR(row.r)}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel history-correlation-panel">
          <header className="history-correlation-header">
            <h3>Avg changes by reputation tier</h3>
            <span className="muted">Per owner in each band</span>
          </header>
          <BarChart
            items={data.tiers
              .filter((tier) => tier.ownerCount > 0)
              .map((tier) => ({
                label: `${tier.label} (${tier.ownerCount})`,
                value: tier.avgTotal,
                secondary: tier.avgPrice,
              }))}
            valueFormatter={(v) => `${v.toFixed(1)} changes`}
            secondaryFormatter={(v) => `${v.toFixed(1)} price`}
            color="#6366f1"
            secondaryColor="#f59e0b"
          />
        </article>

        <article className="panel history-correlation-panel history-correlation-span-2">
          <header className="history-correlation-header">
            <h3>Correlation matrix</h3>
            <span className="muted">Reputation and change counts across owners</span>
          </header>
          <CorrelationMatrix
            labels={data.correlationLabels}
            cells={data.correlationMatrix}
          />
        </article>

        <article className="panel history-correlation-panel">
          <header className="history-correlation-header">
            <h3>Reputation vs total changes</h3>
          </header>
          <ScatterPlot
            points={data.scatterTotal.map((point) => ({
              id: point.id,
              x: point.x,
              y: point.y,
              label: point.label,
              district: '',
            }))}
            xLabel="Reputation score"
            yLabel="Total changes"
          />
        </article>

        <article className="panel history-correlation-panel">
          <header className="history-correlation-header">
            <h3>Reputation vs price changes</h3>
          </header>
          <ScatterPlot
            points={data.scatterPrice.map((point) => ({
              id: point.id,
              x: point.x,
              y: point.y,
              label: point.label,
              district: '',
            }))}
            xLabel="Reputation score"
            yLabel="Price changes"
          />
        </article>
      </div>
    </div>
  )
}
