interface BarChartItem {
  label: string
  value: number
  secondary?: number
}

interface BarChartProps {
  items: BarChartItem[]
  valueFormatter?: (value: number) => string
  secondaryFormatter?: (value: number) => string
  maxItems?: number
  color?: string
  secondaryColor?: string
}

export function BarChart({
  items,
  valueFormatter = (v) => v.toLocaleString(),
  secondaryFormatter,
  maxItems = 10,
  color = '#6366f1',
  secondaryColor = '#22d3ee',
}: BarChartProps) {
  const rows = items.slice(0, maxItems)
  const maxValue = Math.max(...rows.map((row) => row.value), 1)

  if (rows.length === 0) {
    return <p className="analyze-empty">No data yet</p>
  }

  return (
    <div className="analyze-bar-chart">
      {rows.map((row) => (
        <div key={row.label} className="analyze-bar-row">
          <div className="analyze-bar-label" title={row.label}>{row.label}</div>
          <div className="analyze-bar-track">
            <div
              className="analyze-bar-fill"
              style={{
                width: `${(row.value / maxValue) * 100}%`,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              }}
            />
            {row.secondary != null && row.secondary > 0 && (
              <div
                className="analyze-bar-fill analyze-bar-fill-secondary"
                style={{
                  width: `${(row.secondary / maxValue) * 100}%`,
                  background: `linear-gradient(90deg, ${secondaryColor}, ${secondaryColor}aa)`,
                }}
              />
            )}
          </div>
          <div className="analyze-bar-value">
            {valueFormatter(row.value)}
            {row.secondary != null && secondaryFormatter && (
              <span className="analyze-bar-secondary">
                {secondaryFormatter(row.secondary)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
