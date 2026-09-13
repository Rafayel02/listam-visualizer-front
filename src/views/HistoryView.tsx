import { useCallback, useEffect, useState } from 'react'
import {
  fetchChangeHistoryDay,
  fetchChangeHistorySummary,
  type DaySummary,
  type HistoryEvent,
} from '../api/client'
import './HistoryView.css'

const PAGE_SIZE = 200

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

interface DaySectionProps {
  summary: DaySummary
}

function DaySection({ summary }: DaySectionProps) {
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(
    (nextPage: number) => {
      setLoading(true)
      setError(null)
      void fetchChangeHistoryDay(summary.date, nextPage, PAGE_SIZE)
        .then((data) => {
          setEvents(data.events)
          setTotalPages(data.totalPages)
          setPage(data.page)
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false))
    },
    [summary.date],
  )

  useEffect(() => {
    loadPage(1)
  }, [loadPage])

  return (
    <section className="history-day panel">
      <header className="history-day-header">
        <h3>{summary.label}</h3>
        <span className="history-day-count">{summary.totalEvents} changes</span>
      </header>

      {loading && <p className="muted history-day-loading">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p className="muted">No events for this day.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <>
          <ul className="history-list">
            {events.map((event) => (
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

          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => loadPage(page - 1)}
              >
                Previous
              </button>
              <span className="history-page-info">
                Page {page} of {totalPages}
                <span className="history-page-size"> · {PAGE_SIZE} per page</span>
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => loadPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function HistoryView({ loading: parentLoading = false }: HistoryViewProps) {
  const [days, setDays] = useState(14)
  const [summaries, setSummaries] = useState<DaySummary[]>([])
  const [totalEvents, setTotalEvents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchChangeHistorySummary(days)
      .then((data) => {
        if (cancelled) return
        setSummaries(data.days)
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
            Grouped by date · up to {PAGE_SIZE} events per page within each day.
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
            <span className="history-stats">
              {summaries.length} days · {totalEvents} events
            </span>
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
          <p className="muted">Loading dates…</p>
        </section>
      )}

      {!isLoading && !error && summaries.length === 0 && (
        <section className="panel history-empty">
          <h3>No changes in this period</h3>
          <p className="muted">
            Run the scraper and sync to backend — changes are recorded on each scrape run.
          </p>
        </section>
      )}

      {!isLoading &&
        summaries.map((summary) => <DaySection key={summary.date} summary={summary} />)}
    </div>
  )
}
