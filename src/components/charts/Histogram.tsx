import type { HistogramBin } from '../../analytics/listingAnalytics'

interface HistogramProps {
  bins: HistogramBin[]
  color?: string
}

export function Histogram({ bins, color = '#8b5cf6' }: HistogramProps) {
  if (bins.length === 0) {
    return <p className="analyze-empty">No data yet</p>
  }

  const max = Math.max(...bins.map((bin) => bin.count), 1)
  const width = 640
  const height = 220
  const padding = { top: 16, right: 12, bottom: 42, left: 12 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const barW = chartW / bins.length - 4

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="analyze-svg-chart" role="img">
      {bins.map((bin, index) => {
        const barH = (bin.count / max) * chartH
        const x = padding.left + index * (chartW / bins.length) + 2
        const y = padding.top + chartH - barH
        return (
          <g key={bin.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill={color}
              opacity={0.85}
            >
              <title>{`${bin.label}: ${bin.count}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={height - 10}
              textAnchor="middle"
              className="analyze-axis-label"
            >
              {bin.label.length > 10 ? `${bin.label.slice(0, 9)}…` : bin.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
