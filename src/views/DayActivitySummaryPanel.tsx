import type {
  DayActivitySummary,
  OwnerActionCategory,
  OwnerActionCounts,
  ReputationTierBreakdown,
} from '../api/client'
import './HistoryView.css'

const SUMMARY_ACTIONS: { action: OwnerActionCategory; label: string }[] = [
  { action: 'added', label: 'Added' },
  { action: 'removed', label: 'Removed' },
  { action: 'price', label: 'Price' },
  { action: 'images', label: 'Images' },
  { action: 'title', label: 'Title' },
  { action: 'description', label: 'Description' },
  { action: 'location', label: 'Location' },
  { action: 'other', label: 'Other' },
]

function visibleActions(counts: OwnerActionCounts) {
  return SUMMARY_ACTIONS.filter((item) => counts[item.action] > 0)
}

function TotalBadges({ counts }: { counts: OwnerActionCounts }) {
  const items = visibleActions(counts)
  if (items.length === 0) {
    return <p className="muted history-summary-empty">No activity recorded.</p>
  }

  return (
    <div className="history-day-totals">
      {items.map((item) => (
        <span key={item.action} className={`history-action-badge history-action-${item.action}`}>
          {item.label} {counts[item.action]}
        </span>
      ))}
      <span className="history-day-total-all">{counts.total} total</span>
    </div>
  )
}

function TierRow({ tier }: { tier: ReputationTierBreakdown }) {
  if (tier.counts.total === 0 && tier.ownerCount === 0) return null

  return (
    <tr>
      <td className="history-tier-label">{tier.label}</td>
      <td className="history-tier-owners">{tier.ownerCount}</td>
      {SUMMARY_ACTIONS.map((item) => (
        <td key={item.action} className="history-tier-count">
          {tier.counts[item.action] > 0 ? tier.counts[item.action] : '—'}
        </td>
      ))}
      <td className="history-tier-total">{tier.counts.total}</td>
    </tr>
  )
}

interface DayActivitySummaryPanelProps {
  summary: DayActivitySummary
}

export function DayActivitySummaryPanel({ summary }: DayActivitySummaryPanelProps) {
  const activeTiers = summary.byReputation.filter(
    (tier) => tier.counts.total > 0 || tier.ownerCount > 0,
  )

  return (
    <div className="history-day-summary">
      <div className="history-day-summary-header">
        <h4>Daily summary</h4>
        <span className="history-day-summary-meta">
          {summary.ownerCount} owners · {summary.totals.total} actions
        </span>
      </div>

      <TotalBadges counts={summary.totals} />

      {activeTiers.length > 0 && (
        <div className="history-tier-table-wrap">
          <p className="history-tier-caption">By reputation tier</p>
          <table className="history-tier-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Owners</th>
                {SUMMARY_ACTIONS.map((item) => (
                  <th key={item.action}>{item.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {activeTiers.map((tier) => (
                <TierRow key={tier.tier} tier={tier} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
