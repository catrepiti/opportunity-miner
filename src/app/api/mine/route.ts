import { NextRequest, NextResponse } from 'next/server'
import { mineByNicheAndRegion, RawSearchResult } from '@/lib/miners/google-search'
import { analyzeWebsite } from '@/lib/miners/website-analyzer'
import { calculateScore } from '@/lib/scorer'
import { analyzeLeadWithAI } from '@/lib/ai-analyzer'
import { upsertLead } from '@/lib/db'
import { MiningRequest, NicheType, NICHE_LABELS } from '@/lib/types'
import crypto from 'crypto'

export const maxDuration = 60

function generateId(name: string, city: string): string {
  return crypto.createHash('md5').update(`${name}-${city}`).digest('hex').slice(0, 12)
}

function isRelevantResult(result: RawSearchResult, niche: NicheType): boolean {
  const title = result.title.toLowerCase()
  const snippet = result.snippet.toLowerCase()
  const combined = `${title} ${snippet}`

  const excludePatterns = [
    'wikipedia', 'youtube.com', 'linkedin.com/in/', 'twitter.com',
    'vagas', 'emprego', 'concurso', 'curso online', 'ead',
    'notícia', 'g1.com', 'uol.com', 'folha.com',
    'ifood', 'rappi', 'amazon', 'mercadolivre', 'magazineluiza',
    'melhores', 'top 10', 'top 5', 'ranking', 'lista de',
    'encontra', 'guiatelefone', 'guiamais', 'telelistas', 'apontador',
    'yelp', 'tripadvisor', 'reclameaqui', 'jusbrasil',
    'qual o telefone', 'telefones e endereços',
    'pinterest', 'reddit', 'quora',
  ]

  if (excludePatterns.some(p => combined.includes(p))) return false

  const nicheKeywords: Record<string, string[]> = {
    clinica_estetica: ['estética', 'estetica', 'beleza', 'harmonização', 'botox', 'peeling', 'skin'],
    saude_bem_estar: ['saúde', 'saude', 'bem-estar', 'wellness', 'clínica', 'clinica'],
    salao_barbearia: ['salão', 'salao', 'barbearia', 'cabelo', 'cabeleireiro', 'beauty', 'beleza', 'nail'],
    nutricionista: ['nutri', 'nutrição', 'nutricao', 'dieta', 'alimentação'],
    fisioterapia: ['fisio', 'fisioterapia', 'reabilitação', 'rpg'],
    psicologia: ['psicólog', 'psicolog', 'terapia', 'saúde mental'],
    personal_trainer: ['personal', 'treino', 'fitness', 'academia', 'crossfit'],
    odontologia: ['dentist', 'odonto', 'dental', 'sorriso', 'ortodont'],
    dermatologia: ['dermato', 'dermatolog', 'pele', 'skin'],
    spa_massagem: ['spa', 'massagem', 'relaxamento', 'massoterapia'],
  }

  const keywords = nicheKeywords[niche] ?? []
  return keywords.some(k => combined.includes(k))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as MiningRequest
    const { niches, regions, depth } = body

    if (!niches?.length || !regions?.length) {
      return NextResponse.json({ error: 'Nichos e regiões são obrigatórios' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        let totalProcessed = 0
        let totalLeads = 0
        const startTime = Date.now()

        send({ type: 'start', message: 'Iniciando mineração...' })

        for (const region of regions) {
          for (const niche of niches) {
            send({
              type: 'progress',
              message: `Minerando ${NICHE_LABELS[niche]} em ${region.city}/${region.state}...`,
            })

            const rawResults = await mineByNicheAndRegion(niche, region.city, region.state, depth)
            console.log(`[mine] Raw results for ${niche} in ${region.city}: ${rawResults.length}`)
            if (rawResults.length > 0) {
              console.log(`[mine] Sample: ${rawResults[0].title} | ${rawResults[0].url}`)
            }

            let relevant = rawResults.length > 0
              ? rawResults.filter(r => isRelevantResult(r, niche))
              : rawResults

            if (rawResults.length > 0 && relevant.length === 0) {
              console.log(`[mine] All ${rawResults.length} filtered out by niche, using unfiltered`)
              relevant = rawResults.slice(0, 10)
            }

            send({
              type: 'found',
              message: `${relevant.length} resultados relevantes de ${rawResults.length} encontrados`,
              count: relevant.length,
            })

            for (const result of relevant.slice(0, 15)) {
              totalProcessed++

              send({
                type: 'analyzing',
                message: `Analisando: ${result.title.slice(0, 50)}...`,
                current: totalProcessed,
              })

              const websiteAnalysis = await analyzeWebsite(result.url)
              const contacts = websiteAnalysis.extractedContacts

              const instagramHandle = contacts.instagramHandle
              const hasInstagram = !!instagramHandle ||
                websiteAnalysis.socialLinks.some(l => l.startsWith('instagram'))
              const hasFacebook = !!contacts.facebookUrl ||
                websiteAnalysis.socialLinks.some(l => l.startsWith('facebook'))

              const scoring = calculateScore(
                websiteAnalysis,
                hasInstagram,
                hasFacebook,
                null,
                null,
                !!result.phone,
                websiteAnalysis.hasWhatsapp,
                niche,
              )

              if (scoring.total < 25) continue

              const leadId = generateId(result.title, region.city)

              let aiInsight = null
              let approachSuggestion = null

              if (scoring.total >= 50 && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sua_chave_aqui') {
                try {
                  const aiResult = await analyzeLeadWithAI({
                    name: result.title,
                    niche: NICHE_LABELS[niche],
                    city: region.city,
                    websiteQuality: websiteAnalysis.quality,
                    hasInstagram,
                    hasFacebook,
                    googleRating: null,
                    googleReviews: null,
                    score: scoring.total,
                    snippet: result.snippet,
                  })
                  aiInsight = aiResult.insight
                  approachSuggestion = aiResult.approachSuggestion
                } catch {
                  // continue without AI analysis
                }
              }

              const primaryPhone = contacts.phones[0] ?? result.phone
              const whatsappNumber = contacts.whatsapp ?? (contacts.phones[0] ? contacts.phones[0] : null)

              upsertLead({
                id: leadId,
                name: result.title,
                niche,
                region: `${region.city}/${region.state}`,
                city: region.city,
                state: region.state,
                phone: primaryPhone,
                phones: contacts.phones,
                email: contacts.emails[0] ?? null,
                whatsapp: whatsappNumber,
                website: websiteAnalysis.hasWebsite ? result.url : null,
                instagram: instagramHandle ?? (hasInstagram ? 'detectado' : null),
                facebook: contacts.facebookUrl ?? (hasFacebook ? 'detectado' : null),
                googleMapsUrl: null,
                googleRating: null,
                googleReviews: null,
                address: contacts.address ?? result.address,
                score: scoring.total,
                digitalMaturityScore: scoring.digital,
                businessViabilityScore: scoring.viability,
                accessibilityScore: scoring.access,
                aiInsight,
                approachSuggestion,
                status: 'novo',
              })

              totalLeads++

              const now = new Date().toISOString()
              send({
                type: 'lead',
                message: `Lead salvo: ${result.title} (Score: ${scoring.total})`,
                lead: {
                  id: leadId,
                  name: result.title,
                  niche,
                  region: `${region.city}/${region.state}`,
                  city: region.city,
                  state: region.state,
                  phone: primaryPhone,
                  phones: contacts.phones,
                  email: contacts.emails[0] ?? null,
                  whatsapp: whatsappNumber,
                  website: websiteAnalysis.hasWebsite ? result.url : null,
                  instagram: instagramHandle ?? (hasInstagram ? 'detectado' : null),
                  facebook: contacts.facebookUrl ?? (hasFacebook ? 'detectado' : null),
                  googleMapsUrl: null,
                  googleRating: null,
                  googleReviews: null,
                  address: contacts.address ?? result.address,
                  score: scoring.total,
                  digitalMaturityScore: scoring.digital,
                  businessViabilityScore: scoring.viability,
                  accessibilityScore: scoring.access,
                  aiInsight,
                  approachSuggestion,
                  status: 'novo',
                  createdAt: now,
                  updatedAt: now,
                },
              })
            }
          }
        }

        const duration = Math.round((Date.now() - startTime) / 1000)

        send({
          type: 'complete',
          message: `Mineração concluída! ${totalLeads} leads encontrados em ${duration}s`,
          totalLeads,
          totalProcessed,
          duration,
        })

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: `Erro na mineração: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    )
  }
}

