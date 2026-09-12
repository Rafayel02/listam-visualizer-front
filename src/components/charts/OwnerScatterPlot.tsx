import {
  BROKER_LISTING_THRESHOLD,
  profileTypeColor,
  type OwnerScatterPoint,
} from '../../analytics/ownerAnalytics'

interface OwnerScatterPlotProps {
  points: OwnerScatterPoint[]
}

export function OwnerScatterPlot({ points }: OwnerScatterPlotProps) {
  if (points.length === 0) {
    return <p className="analyze-empty">Need owners with ratings in your data</p>
  }

  const width = 640
  const height = 280
  const padding = { top: 20, right: 20, bottom: 48, left: 56 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs, 1)
  const maxX = Math.max(...xs, BROKER_LISTING_THRESHOLD)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 5)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1

  const scaleX = (x: number) => padding.left + ((x - minX) / spanX) * chartW
  const scaleY = (y: number) => padding.top + chartH - ((y - minY) / spanY) * chartH
  const thresholdX = scaleX(BROKER_LISTING_THRESHOLD)

  return (
    <div className="analyze-scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="analyze-svg-chart" role="img">
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          className="analyze-axis-line"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartH}
          className="analyze-axis-line"
        />
        <line
          x1={thresholdX}
          y1={padding.top}
          x2={thresholdX}
          y2={padding.top + chartH}
          className="analyze-owner-threshold"
        />
        <text x={thresholdX + 4} y={padding.top + 12} className="analyze-owner-threshold-label">
          broker ≥
        </text>
        {points.map((point) => (
          <circle
            key={point.id}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r={5}
            fill={profileTypeColor(point.profileType)}
            opacity={0.88}
          >
            <title>
              {`${point.label}\n${point.x} posts · ${point.y} rating · ${point.district}`}
            </title>
          </circle>
        ))}
        <text x={padding.left + chartW / 2} y={height - 8} textAnchor="middle" className="analyze-axis-title">
          Posts in your data
        </text>
        <text
          x={16}
          y={padding.top + chartH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${padding.top + chartH / 2})`}
          className="analyze-axis-title"
        >
          Seller rating
        </text>
      </svg>
    </div>
  )
}
