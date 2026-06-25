import Anthropic from '@anthropic-ai/sdk'

const getClient = () => new Anthropic()

interface AIAnalysisResult {
  insight: string
  approachSuggestion: string
  estimatedPotential: 'alto' | 'medio' | 'baixo'
  painPoints: string[]
}

export async function analyzeLeadWithAI(leadData: {
  name: string
  niche: string
  city: string
  websiteQuality: string
  hasInstagram: boolean
  hasFacebook: boolean
  googleRating: number | null
  googleReviews: number | null
  score: number
  snippet: string
}): Promise<AIAnalysisResult> {
  try {
    const client = getClient()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Você é um consultor de marketing digital especialista em prospecção B2B para gestores de tráfego pago no Brasil.

Analise este lead e gere insights acionáveis:

NEGÓCIO: ${leadData.name}
NICHO: ${leadData.niche}
CIDADE: ${leadData.city}
SITE: ${leadData.websiteQuality}
INSTAGRAM: ${leadData.hasInstagram ? 'Sim' : 'Não identificado'}
FACEBOOK: ${leadData.hasFacebook ? 'Sim' : 'Não identificado'}
GOOGLE (avaliação): ${leadData.googleRating ?? 'N/A'} (${leadData.googleReviews ?? 0} avaliações)
SCORE DE OPORTUNIDADE: ${leadData.score}/100
CONTEXTO: ${leadData.snippet}

Responda em JSON:
{
  "insight": "análise concisa de por que este é um bom lead (2 frases max)",
  "approachSuggestion": "script de abordagem personalizado para primeiro contato (WhatsApp ou DM, 3 frases max)",
  "estimatedPotential": "alto|medio|baixo",
  "painPoints": ["dor 1", "dor 2"]
}`
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        insight: 'Negócio com potencial para gestão de tráfego pago.',
        approachSuggestion: 'Apresente resultados de clientes similares do nicho.',
        estimatedPotential: 'medio',
        painPoints: ['Presença digital limitada'],
      }
    }

    return JSON.parse(jsonMatch[0])
  } catch {
    return {
      insight: 'Análise automática indisponível. Avalie manualmente.',
      approachSuggestion: 'Entre em contato apresentando cases do nicho.',
      estimatedPotential: 'medio',
      painPoints: ['Avaliar presença digital manualmente'],
    }
  }
}

export async function generateBatchInsights(leads: Array<{
  name: string
  niche: string
  score: number
}>): Promise<string> {
  try {
    const client = getClient()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Como consultor de marketing digital, analise esta lista de leads prospectados e dê um resumo estratégico em 3-4 frases:

${leads.map(l => `- ${l.name} (${l.niche}, score: ${l.score})`).join('\n')}

Foque em: qual nicho tem mais oportunidade, por onde começar a prospecção, e dica de abordagem.`
      }],
    })

    return message.content[0].type === 'text' ? message.content[0].text : 'Análise indisponível.'
  } catch {
    return 'Análise em lote indisponível. Verifique os leads individualmente.'
  }
}
