import { useEffect, useState } from 'react'
import { fetchChangeHistory, type DailyHistoryGroup, type HistoryEvent } from '../api/client'
import './HistoryView.css'

interface HistoryViewProps {
  loading?: boolean
}

function kindClass(kind: HistoryEvent['kind']): string {
  switch (kind) {
    case 'added':
      return 'history-kind-added'
    case 'removed':
      return 'history-kind-removed'
    default:
      return 'history-kind-updated'
  }
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function HistoryView({ loading: parentLoading = false }: HistoryViewProps) {
  const [days, setDays] = useState(14)
  const [groups, setGroups] = useState<DailyHistoryGroup[]>([])
  const [totalEvents, setTotalEvents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchChangeHistory(days)
      .then((data) => {
        if (cancelled) return
        setGroups(data.days)
        setTotalEvents(data.totalEvents)
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

  const isLoading = parentLoading || loading

  return (
    <div className="history-view">
      <section className="history-hero">
        <div>
          <p className="history-eyebrow">Activity log</p>
          <h2>Daily change history</h2>
          <p className="history-subtitle">
            New listings, removals, price and date updates — grouped by calendar day.
          </p>
        </div>
        <div className="history-controls">
          <label className="history-days-label">
            Show last
            <select
              className="history-days-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 14, 30, 60, 90].map((n) => (
                <option key={n} value={n}>{n} days</option>
              ))}
            </select>
          </label>
          {!isLoading && (
            <span className="history-stats">{totalEvents} events</span>
          )}
        </div>
      </section>

      {error && (
        <section className="panel">
          <p className="error">{error}</p>
        </section>
      )}

      {isLoading && (
        <section className="panel">
          <p className="muted">Loading change history…</p>
        </section>
      )}

      {!isLoading && !error && groups.length === 0 && (
        <section className="panel history-empty">
          <h3>No changes in this period</h3>
          <p className="muted">
            Run the scraper and sync to backend — changes are recorded on each scrape run.
          </p>
        </section>
      )}

      {!isLoading && groups.map((group) => (
        <section key={group.date} className="history-day panel">
          <header className="history-day-header">
            <h3>{group.label}</h3>
            <span className="history-day-count">{group.events.length} changes</span>
          </header>
          <ul className="history-list">
            {group.events.map((event) => (
              <li key={event.id} className={`history-item ${kindClass(event.kind)}`}>
                <div className="history-item-main">
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noreferrer"
                    className="history-listing-title"
                  >
                    {event.title || event.listingId}
                  </a>
                  <span className="history-summary">→ {event.summary}</span>
                </div>
                <time className="history-time" dateTime={new Date(event.changedAt).toISOString()}>
                  {formatTime(event.changedAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
