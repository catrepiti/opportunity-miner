import { NextRequest, NextResponse } from 'next/server'
import { getLeads, updateLeadStatus, deleteLead, getStats } from '@/lib/db'
import { LeadStatus } from '@/lib/types'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const action = params.get('action')

  if (action === 'stats') {
    const stats = getStats()
    return NextResponse.json(stats)
  }

  const filters = {
    niche: params.get('niche') ?? undefined,
    region: params.get('region') ?? undefined,
    status: (params.get('status') as LeadStatus) ?? undefined,
    minScore: params.get('minScore') ? parseInt(params.get('minScore')!) : undefined,
    limit: params.get('limit') ? parseInt(params.get('limit')!) : 50,
    offset: params.get('offset') ? parseInt(params.get('offset')!) : 0,
    sortBy: params.get('sortBy') ?? 'score',
    sortDir: (params.get('sortDir') as 'asc' | 'desc') ?? 'desc',
  }

  const result = getLeads(filters)
  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, status } = body as { id: string; status: LeadStatus }

  if (!id || !status) {
    return NextResponse.json({ error: 'ID e status são obrigatórios' }, { status: 400 })
  }

  updateLeadStatus(id, status)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
  }

  deleteLead(id)
  return NextResponse.json({ ok: true })
}
