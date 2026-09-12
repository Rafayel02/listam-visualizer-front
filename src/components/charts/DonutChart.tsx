interface DonutSlice {
  label: string
  count: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
}

export function DonutChart({ slices }: DonutChartProps) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  if (total === 0) {
    return <p className="analyze-empty">No data yet</p>
  }

  const size = 220
  const radius = 78
  const stroke = 28
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="analyze-donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="analyze-donut" role="img">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={stroke}
          opacity={0.35}
        />
        {slices.map((slice) => {
          const length = (slice.count / total) * circumference
          const dashArray = `${length} ${circumference - length}`
          const element = (
            <circle
              key={slice.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={dashArray}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
            >
              <title>{`${slice.label}: ${slice.count}`}</title>
            </circle>
          )
          offset += length
          return element
        })}
        <text x={center} y={center - 4} textAnchor="middle" className="analyze-donut-total">
          {total}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" className="analyze-donut-sub">
          listings
        </text>
      </svg>
      <div className="analyze-donut-legend">
        {slices.map((slice) => (
          <div key={slice.label} className="analyze-legend-row">
            <span className="analyze-legend-swatch" style={{ background: slice.color }} />
            <span className="analyze-legend-label">{slice.label}</span>
            <span className="analyze-legend-value">
              {slice.count} ({Math.round((slice.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
