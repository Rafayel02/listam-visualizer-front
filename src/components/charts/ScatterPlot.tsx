import type { ScatterPoint } from '../../analytics/listingAnalytics'
import { formatCompact } from '../../analytics/listingAnalytics'

interface ScatterPlotProps {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  maxPoints?: number
}

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  maxPoints = 120,
}: ScatterPlotProps) {
  const sample = points.length > maxPoints
    ? points.filter((_, i) => i % Math.ceil(points.length / maxPoints) === 0)
    : points

  if (sample.length === 0) {
    return <p className="analyze-empty">Need area + price data</p>
  }

  const width = 640
  const height = 280
  const padding = { top: 20, right: 20, bottom: 48, left: 56 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const xs = sample.map((p) => p.x)
  const ys = sample.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1

  const scaleX = (x: number) => padding.left + ((x - minX) / spanX) * chartW
  const scaleY = (y: number) => padding.top + chartH - ((y - minY) / spanY) * chartH

  const n = sample.length
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (const p of sample) {
    num += (p.x - meanX) * (p.y - meanY)
    den += (p.x - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX
  const trendStart = { x: minX, y: slope * minX + intercept }
  const trendEnd = { x: maxX, y: slope * maxX + intercept }

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
          x1={scaleX(trendStart.x)}
          y1={scaleY(trendStart.y)}
          x2={scaleX(trendEnd.x)}
          y2={scaleY(trendEnd.y)}
          className="analyze-trend-line"
        />
        {sample.map((point) => (
          <circle
            key={point.id}
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r={4}
            className="analyze-scatter-dot"
          >
            <title>{`${point.label} · ${point.district}\n${point.x} m² · ${formatCompact(point.y)}`}</title>
          </circle>
        ))}
        <text x={padding.left + chartW / 2} y={height - 8} textAnchor="middle" className="analyze-axis-title">
          {xLabel}
        </text>
        <text
          x={16}
          y={padding.top + chartH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${padding.top + chartH / 2})`}
          className="analyze-axis-title"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  )
}
