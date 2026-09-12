import type { CorrelationCell } from '../../analytics/listingAnalytics'

interface CorrelationMatrixProps {
  labels: string[]
  cells: CorrelationCell[]
}

function cellColor(value: number): string {
  if (value >= 0.7) return '#059669'
  if (value >= 0.35) return '#34d399'
  if (value > 0.1) return '#a7f3d0'
  if (value > -0.1) return '#e2e8f0'
  if (value > -0.35) return '#fecaca'
  if (value > -0.7) return '#f87171'
  return '#dc2626'
}

export function CorrelationMatrix({ labels, cells }: CorrelationMatrixProps) {
  if (labels.length === 0) {
    return <p className="analyze-empty">Not enough numeric data</p>
  }

  const lookup = new Map(cells.map((cell) => [`${cell.x}|${cell.y}`, cell.value]))

  return (
    <div className="analyze-correlation">
      <div
        className="analyze-correlation-grid"
        style={{ gridTemplateColumns: `auto repeat(${labels.length}, 1fr)` }}
      >
        <div />
        {labels.map((label) => (
          <div key={`head-${label}`} className="analyze-correlation-head">{label}</div>
        ))}
        {labels.map((rowLabel) => (
          <div key={`row-${rowLabel}`} className="analyze-correlation-row">
            <div className="analyze-correlation-row-label">{rowLabel}</div>
            {labels.map((colLabel) => {
              const value = lookup.get(`${colLabel}|${rowLabel}`) ?? 0
              return (
                <div
                  key={`${rowLabel}-${colLabel}`}
                  className="analyze-correlation-cell"
                  style={{ background: cellColor(value) }}
                  title={`${colLabel} vs ${rowLabel}: ${value.toFixed(2)}`}
                >
                  {value.toFixed(2)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
