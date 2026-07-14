import { NextResponse } from 'next/server'
import { getLeads, getStats } from '@/lib/db'
import { getConfig, getRuns } from '@/lib/auto-miner'

export const dynamic = 'force-dynamic'

/**
 * Fila de outreach: leads qualificados/novos acima do score mínimo,
 * ordenados por score, prontos para abordagem.
 */
export async function GET() {
  const config = await getConfig()

  const [{ leads: qualified }, { leads: fresh }, { leads: contacted }, stats, runs] = await Promise.all([
    getLeads({ status: 'qualificado', minScore: config.minScoreForQueue, limit: 100 }),
    getLeads({ status: 'novo', minScore: config.minScoreForQueue, limit: 100 }),
    getLeads({ status: 'contatado', limit: 200 }),
    getStats(),
    getRuns(1),
  ])

  const queue = [...qualified, ...fresh]
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)

  const lastRun = runs[0] ?? null

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
