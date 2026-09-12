import type { CSSProperties } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  accent?: string
}

export function StatCard({ label, value, hint, accent = '#6366f1' }: StatCardProps) {
  return (
    <div className="analyze-stat-card" style={{ '--accent': accent } as CSSProperties}>
      <div className="analyze-stat-label">{label}</div>
      <div className="analyze-stat-value">{value}</div>
      {hint && <div className="analyze-stat-hint">{hint}</div>}
    </div>
  )
}
