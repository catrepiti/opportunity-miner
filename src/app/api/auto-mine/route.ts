import { NextRequest, NextResponse } from 'next/server'
import { runAutoMine, getConfig, saveConfig, getRuns, pickTargets, computeNichePerformance } from '@/lib/auto-miner'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await getConfig()
  const [nextTargets, nichePerformance, runs] = await Promise.all([
    pickTargets(config),
    computeNichePerformance(),
    getRuns(30),
  ])
  return NextResponse.json({ config, nextTargets, nichePerformance, runs })
}

export async function POST(request: NextRequest) {
  const config = await getConfig()
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
  const config = await saveConfig(body)
  return NextResponse.json(config)
}
