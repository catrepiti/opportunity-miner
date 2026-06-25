'use client'

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#eab308' : score >= 60 ? '#94a3b8' : score >= 40 ? '#d97706' : '#6b7280'

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1e3a5f" strokeWidth="4"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="value" style={{ color }}>{score}</div>
    </div>
  )
}

export function ScoreLabel({ score }: { score: number }) {
  if (score >= 80) return <span className="badge bg-yellow-500/20 text-yellow-400">Ouro</span>
  if (score >= 60) return <span className="badge bg-gray-400/20 text-gray-300">Prata</span>
  if (score >= 40) return <span className="badge bg-orange-500/20 text-orange-400">Bronze</span>
  return <span className="badge bg-gray-600/20 text-gray-500">Baixo</span>
}
