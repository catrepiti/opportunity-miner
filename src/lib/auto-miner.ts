import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { mineByNicheAndRegion, RawSearchResult } from './miners/google-search'
import { analyzeWebsite } from './miners/website-analyzer'
import { calculateScore } from './scorer'
import { analyzeLeadWithAI } from './ai-analyzer'
import {
  upsertLead, getLeads, usingPostgres,
  dbGetConfigJson, dbSaveConfigJson, dbGetRuns, dbCountRuns, dbAppendRun,
} from './db'
import { NicheType, RegionConfig, NICHE_LABELS } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'auto-mine-config.json')
const RUNS_PATH = path.join(DATA_DIR, 'auto-mine-runs.json')

export interface AutoMineConfig {
  enabled: boolean
  niches: NicheType[]
  regions: RegionConfig[]
  nichesPerRun: number
  regionsPerRun: number
  minScoreForQueue: number
  minScoreForAI: number
  maxLeadsPerRun: number
}

export interface AutoMineRun {
  id: string
  startedAt: string
  finishedAt: string
  niches: NicheType[]
  regions: string[]
  processed: number
  leadsSaved: number
  aiDiagnoses: number
  errors: string[]
}

const DEFAULT_CONFIG: AutoMineConfig = {
  enabled: true,
  niches: ['clinica_estetica', 'odontologia', 'salao_barbearia', 'fisioterapia', 'nutricionista', 'dermatologia'],
  regions: [
    { city: 'São Paulo', state: 'SP' },
    { city: 'Campinas', state: 'SP' },
    { city: 'Guarulhos', state: 'SP' },
    { city: 'Santo André', state: 'SP' },
    { city: 'Osasco', state: 'SP' },
  ],
  nichesPerRun: 2,
  regionsPerRun: 2,
  minScoreForQueue: 40,
  minScoreForAI: 50,
  maxLeadsPerRun: 20,
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function getConfig(): Promise<AutoMineConfig> {
  if (usingPostgres()) {
    const stored = await dbGetConfigJson<Partial<AutoMineConfig>>()
    if (stored) return { ...DEFAULT_CONFIG, ...stored }
    await dbSaveConfigJson(DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }

  ensureDataDir()
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
    }
  } catch {}
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
  return DEFAULT_CONFIG
}

export async function saveConfig(config: Partial<AutoMineConfig>): Promise<AutoMineConfig> {
  const merged = { ...(await getConfig()), ...config }
  if (usingPostgres()) {
    await dbSaveConfigJson(merged)
  } else {
    ensureDataDir()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
  }
  return merged
}

export async function getRuns(limit = 30): Promise<AutoMineRun[]> {
  if (usingPostgres()) {
    return (await dbGetRuns<AutoMineRun>(limit)) ?? []
  }
  try {
    if (fs.existsSync(RUNS_PATH)) {
      const runs: AutoMineRun[] = JSON.parse(fs.readFileSync(RUNS_PATH, 'utf-8'))
      return runs.slice(-limit).reverse()
    }
  } catch {}
  return []
}

async function countRuns(): Promise<number> {
  if (usingPostgres()) return (await dbCountRuns()) ?? 0
  try {
    if (fs.existsSync(RUNS_PATH)) return JSON.parse(fs.readFileSync(RUNS_PATH, 'utf-8')).length
  } catch {}
  return 0
}

async function appendRun(run: AutoMineRun): Promise<void> {
  if (await dbAppendRun(run.id, run, run.finishedAt)) return
  ensureDataDir()
  const runs = fs.existsSync(RUNS_PATH) ? JSON.parse(fs.readFileSync(RUNS_PATH, 'utf-8')) : []
  runs.push(run)
  fs.writeFileSync(RUNS_PATH, JSON.stringify(runs.slice(-200), null, 2))
}

/**
 * Loop de auto-aprendizado: mede a taxa de aproveitamento por nicho
 * (leads que viraram qualificado/contatado sobre o total minerado)
 * e prioriza os nichos que mais convertem nas próximas rodadas.
 */
export async function computeNichePerformance(): Promise<Record<string, { total: number; converted: number; rate: number }>> {
  const { leads } = await getLeads({ limit: 10000 })
  const perf: Record<string, { total: number; converted: number; rate: number }> = {}
  for (const l of leads) {
    if (!perf[l.niche]) perf[l.niche] = { total: 0, converted: 0, rate: 0 }
    perf[l.niche].total++
    if (l.status === 'qualificado' || l.status === 'contatado') perf[l.niche].converted++
  }
  for (const k of Object.keys(perf)) {
    perf[k].rate = perf[k].total > 0 ? perf[k].converted / perf[k].total : 0
  }
  return perf
}

/**
 * Seleciona os alvos da rodada: rotaciona nichos/regiões pelo número de runs
 * já feitos, mas dá prioridade extra a nichos com melhor conversão histórica.
 */
export async function pickTargets(config: AutoMineConfig): Promise<{ niches: NicheType[]; regions: RegionConfig[] }> {
  const runCount = await countRuns()
  const perf = await computeNichePerformance()

  const ranked = [...config.niches].sort((a, b) => {
    const ra = perf[a]?.total >= 5 ? perf[a].rate : 0.15 // nichos sem histórico ganham taxa neutra
    const rb = perf[b]?.total >= 5 ? perf[b].rate : 0.15
    return rb - ra
  })

  // Metade das vagas para os melhores nichos, metade rotaciona para explorar
  const niches: NicheType[] = []
  const half = Math.max(1, Math.floor(config.nichesPerRun / 2))
  niches.push(...ranked.slice(0, half))
  for (let i = 0; niches.length < config.nichesPerRun && i < config.niches.length; i++) {
    const candidate = config.niches[(runCount + i) % config.niches.length]
    if (!niches.includes(candidate)) niches.push(candidate)
  }

  const regions: RegionConfig[] = []
  for (let i = 0; regions.length < Math.min(config.regionsPerRun, config.regions.length); i++) {
    regions.push(config.regions[(runCount + i) % config.regions.length])
  }

  return { niches, regions }
}

function generateId(name: string, city: string): string {
  return crypto.createHash('md5').update(`${name}-${city}`).digest('hex').slice(0, 12)
}

function isRelevantResult(result: RawSearchResult, niche: NicheType): boolean {
  const combined = `${result.title} ${result.snippet}`.toLowerCase()

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
    'dicio.com', 'dicionário', 'significado de', 'o que é',
    'tuasaude.com', 'minhavida.com', 'drauzio',
    'sebrae', 'gov.br', 'edu.br',
  ]
  const urlExcludes = ['dicio.com', 'wikipedia.org', 'youtube.com', 'tuasaude.com', 'minhavida.com', 'gov.br', 'edu.br']
  if (urlExcludes.some(p => result.url.toLowerCase().includes(p))) return false
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

export async function runAutoMine(overrides?: Partial<AutoMineConfig>): Promise<AutoMineRun> {
  const config = { ...(await getConfig()), ...overrides }
  const { niches, regions } = await pickTargets(config)
  const startedAt = new Date().toISOString()
  const errors: string[] = []

  let processed = 0
  let leadsSaved = 0
  let aiDiagnoses = 0

  const hasAI = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sua_chave_aqui'

  for (const region of regions) {
    for (const niche of niches) {
      if (leadsSaved >= config.maxLeadsPerRun) break
      try {
        const rawResults = await mineByNicheAndRegion(niche, region.city, region.state, 'normal')
        let relevant = rawResults.filter(r => isRelevantResult(r, niche))
        if (rawResults.length > 0 && relevant.length === 0) relevant = rawResults.slice(0, 10)

        for (const result of relevant.slice(0, 8)) {
          if (leadsSaved >= config.maxLeadsPerRun) break
          processed++

          const websiteAnalysis = await analyzeWebsite(result.url)
          const contacts = websiteAnalysis.extractedContacts
          const instagramHandle = contacts.instagramHandle
          const hasInstagram = !!instagramHandle || websiteAnalysis.socialLinks.some(l => l.startsWith('instagram'))
          const hasFacebook = !!contacts.facebookUrl || websiteAnalysis.socialLinks.some(l => l.startsWith('facebook'))

          const scoring = calculateScore(
            websiteAnalysis, hasInstagram, hasFacebook, null, null,
            !!result.phone, websiteAnalysis.hasWhatsapp, niche,
          )
          if (scoring.total < 10) continue

          let aiInsight = null
          let approachSuggestion = null
          if (scoring.total >= config.minScoreForAI && hasAI) {
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
              aiDiagnoses++
            } catch {}
          }

          await upsertLead({
            id: generateId(result.title, region.city),
            name: result.title,
            niche,
            region: `${region.city}/${region.state}`,
            city: region.city,
            state: region.state,
            phone: contacts.phones[0] ?? result.phone,
            phones: contacts.phones,
            email: contacts.emails[0] ?? null,
            whatsapp: contacts.whatsapp ?? contacts.phones[0] ?? null,
            website: websiteAnalysis.hasWebsite ? result.url : null,
            instagram: instagramHandle ?? (hasInstagram ? 'detectado' : null),
            facebook: contacts.facebookUrl ?? (hasFacebook ? 'detectado' : null),
            address: contacts.address ?? result.address,
            score: scoring.total,
            digitalMaturityScore: scoring.digital,
            businessViabilityScore: scoring.viability,
            accessibilityScore: scoring.access,
            aiInsight,
            approachSuggestion,
            status: scoring.total >= config.minScoreForQueue ? 'qualificado' : 'novo',
          })
          leadsSaved++
        }
      } catch (err) {
        errors.push(`${NICHE_LABELS[niche]}/${region.city}: ${err instanceof Error ? err.message : 'erro'}`)
      }
    }
  }

  const run: AutoMineRun = {
    id: crypto.randomUUID().slice(0, 8),
    startedAt,
    finishedAt: new Date().toISOString(),
    niches,
    regions: regions.map(r => `${r.city}/${r.state}`),
    processed,
    leadsSaved,
    aiDiagnoses,
    errors,
  }
  await appendRun(run)
  return run
}
