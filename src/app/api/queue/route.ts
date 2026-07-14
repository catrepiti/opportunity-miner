import { NextResponse } from 'next/server'
import { getLeads, getStats } from '@/lib/db'
import { getConfig, getRuns } from '@/lib/auto-miner'

export const dynamic = 'force-dynamic'

/**
 * Fila de outreach: leads qualificados/novos acima do score mínimo,
 * ordenados por score, prontos para abordagem.
 */
export async function GET() {
  const config = getConfig()

  const { leads: qualified } = getLeads({ status: 'qualificado', minScore: config.minScoreForQueue, limit: 100 })
  const { leads: fresh } = getLeads({ status: 'novo', minScore: config.minScoreForQueue, limit: 100 })
  const { leads: contacted } = getLeads({ status: 'contatado', limit: 200 })

  const queue = [...qualified, ...fresh]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)

  const stats = getStats()
  const lastRun = getRuns(1)[0] ?? null

  const today = new Date().toISOString().slice(0, 10)
  const contactedToday = contacted.filter(l => l.updatedAt.slice(0, 10) === today).length

  return NextResponse.json({
    queue,
    stats: {
      total: stats.total,
      inQueue: queue.length,
      contacted: contacted.length,
      contactedToday,
      byStatus: stats.byStatus,
    },
    lastRun,
    minScore: config.minScoreForQueue,
  })
}
