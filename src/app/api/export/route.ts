import { NextRequest, NextResponse } from 'next/server'
import { getLeads } from '@/lib/db'
import { NICHE_LABELS, NicheType } from '@/lib/types'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const format = params.get('format') ?? 'csv'
  const minScore = params.get('minScore') ? parseInt(params.get('minScore')!) : 0

  const { leads } = await getLeads({ minScore, limit: 1000 })

  if (format === 'json') {
    return NextResponse.json(leads, {
      headers: {
        'Content-Disposition': 'attachment; filename="leads-minerados.json"',
      },
    })
  }

  const csvHeader = 'Nome,Nicho,Cidade,Estado,Score,Telefone,WhatsApp,Email,Website,Instagram,Facebook,Endereço,Insight,Abordagem,Status\n'
  const csvRows = leads.map(l => {
    const nicheLabel = NICHE_LABELS[l.niche as NicheType] ?? l.niche
    return [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${nicheLabel}"`,
      `"${l.city}"`,
      `"${l.state}"`,
      l.score,
      `"${l.phone ?? ''}"`,
      `"${l.whatsapp ?? ''}"`,
      `"${l.email ?? ''}"`,
      `"${l.website ?? ''}"`,
      `"${l.instagram ?? ''}"`,
      `"${l.facebook ?? ''}"`,
      `"${(l.address ?? '').replace(/"/g, '""')}"`,
      `"${(l.aiInsight ?? '').replace(/"/g, '""')}"`,
      `"${(l.approachSuggestion ?? '').replace(/"/g, '""')}"`,
      `"${l.status}"`,
    ].join(',')
  }).join('\n')

  return new Response('﻿' + csvHeader + csvRows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-minerados.csv"',
    },
  })
}
