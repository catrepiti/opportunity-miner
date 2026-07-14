import { NextRequest, NextResponse } from 'next/server'
import { runAutoMine, getConfig, saveConfig, getRuns, pickTargets, computeNichePerformance } from '@/lib/auto-miner'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getConfig()
  return NextResponse.json({
    config,
    nextTargets: pickTargets(config),
    nichePerformance: computeNichePerformance(),
    runs: getRuns(30),
  })
}

export async function POST(request: NextRequest) {
  const config = getConfig()
  if (!config.enabled) {
    return NextResponse.json({ error: 'Mineração automática desativada na configuração' }, { status: 409 })
  }

  let overrides = {}
  try {
    const body = await request.json()
    overrides = body ?? {}
  } catch {}

  const run = await runAutoMine(overrides)
  return NextResponse.json(run)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const config = saveConfig(body)
  return NextResponse.json(config)
}
