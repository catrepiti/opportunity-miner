import { NextRequest, NextResponse } from 'next/server'
import { getLeadById } from '@/lib/db'
import { analyzeLeadWithAI } from '@/lib/ai-analyzer'
import { upsertLead } from '@/lib/db'
import { NICHE_LABELS, NicheType } from '@/lib/types'

export async function POST(request: NextRequest) {
  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
  }

  const lead = getLeadById(id)
  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sua_chave_aqui') {
    return NextResponse.json({ error: 'Configure ANTHROPIC_API_KEY no .env.local' }, { status: 400 })
  }

  const result = await analyzeLeadWithAI({
    name: lead.name,
    niche: NICHE_LABELS[lead.niche as NicheType] ?? lead.niche,
    city: lead.city,
    websiteQuality: lead.website ? 'possui' : 'inexistente',
    hasInstagram: !!lead.instagram,
    hasFacebook: !!lead.facebook,
    googleRating: lead.googleRating,
    googleReviews: lead.googleReviews,
    score: lead.score,
    snippet: '',
  })

  upsertLead({
    ...lead,
    aiInsight: result.insight,
    approachSuggestion: result.approachSuggestion,
  })

  return NextResponse.json({
    insight: result.insight,
    approachSuggestion: result.approachSuggestion,
    estimatedPotential: result.estimatedPotential,
    painPoints: result.painPoints,
  })
}
