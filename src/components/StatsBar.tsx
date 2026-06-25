'use client'

interface Stats {
  total: number
  avgScore: number
  topScore: number
  byNiche: Record<string, number>
  byStatus: Record<string, number>
}

export function StatsBar({ stats }: { stats: Stats | null }) {
  if (!stats || stats.total === 0) return null

  const qualificados = stats.byStatus?.['qualificado'] ?? 0
  const novos = stats.byStatus?.['novo'] ?? 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <StatCard label="Total de Leads" value={stats.total} />
      <StatCard label="Score Médio" value={stats.avgScore} suffix="/100" />
      <StatCard label="Top Score" value={stats.topScore} suffix="/100" highlight />
      <StatCard label="Novos" value={novos} />
      <StatCard label="Qualificados" value={qualificados} highlight />
    </div>
  )
}

function StatCard({ label, value, suffix, highlight }: {
  label: string
  value: number
  suffix?: string
  highlight?: boolean
}) {
  return (
    <div className="card !p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${highlight ? 'text-green-400' : 'text-white'}`}>
        {value}{suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  )
}
