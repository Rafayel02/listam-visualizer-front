import { useCallback, useEffect, useState } from 'react'
import { enumParam, numberParam, useSearchParam } from '../hooks/useUrlQuery'
import { reliabilityColor } from '../analytics/ownerAnalytics'
import {
  fetchChangeHistoryDay,
  fetchChangeHistoryOwners,
  fetchChangeHistorySummary,
  fetchDayActivitySummary,
  fetchOwnerChangeHistoryDay,
  UNKNOWN_OWNER_ID,
  type DayActivitySummary,
  type DaySummary,
  type HistoryEvent,
  type OwnerActionCategory,
  type OwnerActionCounts,
  type OwnerDaySummary,
  type OwnerReputation,
} from '../api/client'
import { DayActivitySummaryPanel } from './DayActivitySummaryPanel'
import { HistoryCorrelationSection } from './HistoryCorrelationSection'
import './HistoryView.css'

const PAGE_SIZE = 200

type HistoryViewMode = 'timeline' | 'owners' | 'correlation'

interface HistoryViewProps {
  loading?: boolean
}

const ACTION_LABELS: Record<OwnerActionCategory, string> = {
  added: 'Added',
  removed: 'Removed',
  price: 'Price',
  images: 'Images',
  title: 'Title',
  description: 'Description',
  location: 'Location',
  other: 'Other',
}

const ACTION_ORDER: OwnerActionCategory[] = [
  'added',
  'removed',
  'price',
  'images',
  'title',
  'description',
  'location',
  'other',
]

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

function displayOwnerName(owner: Pick<OwnerDaySummary, 'ownerId' | 'ownerName'>): string {
  if (owner.ownerId === UNKNOWN_OWNER_ID) return 'Unknown owner'
  return owner.ownerName || owner.ownerId
}

function ReputationBadge({ reputation }: { reputation: OwnerReputation }) {
  const ratingText =
    reputation.rating != null
      ? ` · ${reputation.rating.toFixed(1)}★`
      : reputation.reviewCount != null
        ? ` · ${reputation.reviewCount} reviews`
        : ''

  return (
    <span
      className="history-reputation"
      style={{ color: reliabilityColor(reputation.score) }}
      title={`${reputation.label}${ratingText}`}
    >
      {reputation.score} · {reputation.label}
      {ratingText}
    </span>
  )
}

function ActionBadges({ counts }: { counts: OwnerActionCounts }) {
  const badges = ACTION_ORDER.filter((action) => counts[action] > 0)
  if (badges.length === 0) return null

  return (
    <div className="history-action-badges">
      {badges.map((action) => (
        <span key={action} className={`history-action-badge history-action-${action}`}>
          {ACTION_LABELS[action]} {counts[action]}
        </span>
      ))}
    </div>
  )
}

function EventList({ events }: { events: HistoryEvent[] }) {
  return (
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
  )
}

function Pagination({
  page,
  totalPages,
  loading,
  onPage,
}: {
  page: number
  totalPages: number
  loading: boolean
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="history-pagination">
      <button type="button" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="history-page-info">
        Page {page} of {totalPages}
        <span className="history-page-size"> · {PAGE_SIZE} per page</span>
      </span>
      <button type="button" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  )
}

interface OwnerSectionProps {
  date: string
  owner: OwnerDaySummary
}

function OwnerSection({ date, owner }: OwnerSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(
    (nextPage: number) => {
      setLoading(true)
      setError(null)
      void fetchOwnerChangeHistoryDay(date, owner.ownerId, nextPage, PAGE_SIZE)
        .then((data) => {
          setEvents(data.events)
          setTotalPages(data.totalPages)
          setPage(data.page)
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setLoading(false))
    },
    [date, owner.ownerId],
  )

  useEffect(() => {
    if (!expanded) return
    loadPage(1)
  }, [expanded, loadPage])

  const ownerLabel = displayOwnerName(owner)
  const profileHref =
    owner.ownerProfileUrl && owner.ownerId !== UNKNOWN_OWNER_ID
      ? `https://www.list.am${owner.ownerProfileUrl}`
      : undefined

  return (
    <article className="history-owner-card">
      <button
        type="button"
        className="history-owner-header"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <div className="history-owner-title-wrap">
          <div className="history-owner-name-row">
            {profileHref ? (
              <a
                href={profileHref}
                target="_blank"
                rel="noreferrer"
                className="history-owner-name"
                onClick={(e) => e.stopPropagation()}
              >
                {ownerLabel}
              </a>
            ) : (
              <span className="history-owner-name">{ownerLabel}</span>
            )}
            <ReputationBadge reputation={owner.reputation} />
          </div>
          <span className="history-owner-total">
            {owner.counts.total} action{owner.counts.total === 1 ? '' : 's'}
            {owner.counts.total > PAGE_SIZE ? ` · expand for ${PAGE_SIZE} per page` : ''}
          </span>
        </div>
        <ActionBadges counts={owner.counts} />
        <span className="history-owner-toggle">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="history-owner-body">
          {loading && <p className="muted history-day-loading">Loading…</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && events.length > 0 && <EventList events={events} />}
          <Pagination page={page} totalPages={totalPages} loading={loading} onPage={loadPage} />
        </div>
      )}
    </article>
  )
}

interface DaySectionProps {
  summary: DaySummary
  mode: HistoryViewMode
}

function mergeOwners(
  current: OwnerDaySummary[],
  incoming: OwnerDaySummary[],
): OwnerDaySummary[] {
  const seen = new Set(current.map((owner) => owner.ownerId))
  const added = incoming.filter((owner) => !seen.has(owner.ownerId))
  return [...current, ...added]
}

function DaySection({ summary, mode }: DaySectionProps) {
  const [page, setPage] = useState(1)
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [owners, setOwners] = useState<OwnerDaySummary[]>([])
  const [dayActivity, setDayActivity] = useState<DayActivitySummary | null>(null)
  const [totalOwners, setTotalOwners] = useState(0)
  const [nextActionOffset, setNextActionOffset] = useState(0)
  const [hasMoreOwners, setHasMoreOwners] = useState(false)
  const [loadingMoreOwners, setLoadingMoreOwners] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const loadTimelinePage = useCallback(
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

  const loadOwnersBatch = useCallback(
    (actionOffset: number, append: boolean) => {
      const setBusy = append ? setLoadingMoreOwners : setLoading
      setBusy(true)
      setError(null)
      void fetchChangeHistoryOwners(summary.date, actionOffset, PAGE_SIZE)
        .then((data) => {
          setOwners((current) => (append ? mergeOwners(current, data.owners) : data.owners))
          setTotalOwners(data.totalOwners)
          setNextActionOffset(data.nextActionOffset)
          setHasMoreOwners(data.hasMore)
        })
        .catch((err) => setError((err as Error).message))
        .finally(() => setBusy(false))
    },
    [summary.date],
  )

  const loadMoreOwners = useCallback(() => {
    if (!hasMoreOwners || loadingMoreOwners) return
    loadOwnersBatch(nextActionOffset, true)
  }, [hasMoreOwners, loadingMoreOwners, loadOwnersBatch, nextActionOffset])

  useEffect(() => {
    let cancelled = false
    setLoadingSummary(true)
    void fetchDayActivitySummary(summary.date)
      .then((data) => {
        if (cancelled) return
        setDayActivity(data.summary)
        setSummaryError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setSummaryError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })

    return () => {
      cancelled = true
    }
  }, [summary.date])

  useEffect(() => {
    if (mode === 'timeline') {
      loadTimelinePage(1)
      return
    }
    setOwners([])
    setNextActionOffset(0)
    setHasMoreOwners(false)
    loadOwnersBatch(0, false)
  }, [mode, loadTimelinePage, loadOwnersBatch])

  const dayMeta =
    mode === 'owners'
      ? `${owners.length} of ${totalOwners} owners shown · ${summary.totalEvents} actions`
      : `${summary.totalEvents} changes`

  return (
    <section className="history-day panel">
      <header className="history-day-header">
        <h3>{summary.label}</h3>
        <span className="history-day-count">{dayMeta}</span>
      </header>

      {loadingSummary && <p className="muted history-day-loading">Loading summary…</p>}
      {summaryError && <p className="error">{summaryError}</p>}
      {!loadingSummary && !summaryError && dayActivity && (
        <DayActivitySummaryPanel summary={dayActivity} />
      )}

      {loading && <p className="muted history-day-loading">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {mode === 'timeline' && !loading && !error && events.length === 0 && (
        <p className="muted">No events for this day.</p>
      )}

      {mode === 'timeline' && !loading && !error && events.length > 0 && (
        <>
          <EventList events={events} />
          <Pagination page={page} totalPages={totalPages} loading={loading} onPage={loadTimelinePage} />
        </>
      )}

      {mode === 'owners' && !loading && !error && owners.length === 0 && (
        <p className="muted">No owner activity for this day.</p>
      )}

      {mode === 'owners' && !loading && !error && owners.length > 0 && (
        <>
          <div className="history-owner-list">
            {owners.map((owner) => (
              <OwnerSection key={owner.ownerId} date={summary.date} owner={owner} />
            ))}
          </div>
          {hasMoreOwners && (
            <div className="history-load-more">
              <button
                type="button"
                onClick={loadMoreOwners}
                disabled={loadingMoreOwners}
              >
                {loadingMoreOwners ? 'Loading…' : 'Load more owners'}
              </button>
              <span className="history-load-more-meta">
                Up to {PAGE_SIZE} actions per batch
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function HistoryView({ loading: parentLoading = false }: HistoryViewProps) {
  const [days, setDays] = useSearchParam('days', {
    defaultValue: 14,
    ...numberParam([7, 14, 30, 60, 90], 14),
  })
  const [mode, setMode] = useSearchParam<HistoryViewMode>('history', {
    defaultValue: 'owners',
    ...enumParam(['timeline', 'owners', 'correlation'] as const, 'owners'),
  })
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
            {mode === 'owners'
              ? 'Per-owner daily actions sorted by reputation — load more in batches of up to 200 actions.'
              : mode === 'correlation'
                ? 'How owner reputation relates to listing changes — Pearson correlation across sellers.'
                : 'All changes in chronological order · up to 200 events per page.'}
          </p>
        </div>
        <div className="history-controls">
          <div className="history-mode-toggle">
            <button
              type="button"
              className={mode === 'owners' ? 'active' : ''}
              onClick={() => setMode('owners')}
            >
              By owner
            </button>
            <button
              type="button"
              className={mode === 'timeline' ? 'active' : ''}
              onClick={() => setMode('timeline')}
            >
              Timeline
            </button>
            <button
              type="button"
              className={mode === 'correlation' ? 'active' : ''}
              onClick={() => setMode('correlation')}
            >
              Correlation
            </button>
          </div>
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

      {mode === 'correlation' && <HistoryCorrelationSection days={days} />}

      {mode !== 'correlation' && !isLoading && !error && summaries.length === 0 && (
        <section className="panel history-empty">
          <h3>No changes in this period</h3>
          <p className="muted">
            Run the scraper and sync to backend — changes are recorded on each scrape run.
          </p>
        </section>
      )}

      {mode !== 'correlation' &&
        !isLoading &&
        summaries.map((summary) => (
          <DaySection key={`${summary.date}-${mode}`} summary={summary} mode={mode} />
        ))}
    </div>
  )
}
