import fs from 'fs'
import path from 'path'
import { Lead, LeadStatus } from './types'

const DB_PATH = path.join(process.cwd(), 'data', 'leads.json')

interface DB {
  leads: Record<string, Lead>
}

function readDb(): DB {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DB_PATH)) return { leads: {} }
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { leads: {} }
  }
}

function writeDb(db: DB): void {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export function upsertLead(lead: Partial<Lead> & { id: string; name: string; niche: string; region: string; city: string; state: string }): void {
  const db = readDb()
  const existing = db.leads[lead.id]
  const now = new Date().toISOString()

  db.leads[lead.id] = {
    id: lead.id,
    name: lead.name,
    niche: lead.niche as Lead['niche'],
    region: lead.region,
    city: lead.city,
    state: lead.state,
    phone: lead.phone ?? existing?.phone ?? null,
    phones: lead.phones ?? existing?.phones ?? [],
    email: lead.email ?? existing?.email ?? null,
    whatsapp: lead.whatsapp ?? existing?.whatsapp ?? null,
    website: lead.website ?? existing?.website ?? null,
    instagram: lead.instagram ?? existing?.instagram ?? null,
    facebook: lead.facebook ?? existing?.facebook ?? null,
    googleMapsUrl: lead.googleMapsUrl ?? existing?.googleMapsUrl ?? null,
    googleRating: lead.googleRating ?? existing?.googleRating ?? null,
    googleReviews: lead.googleReviews ?? existing?.googleReviews ?? null,
    address: lead.address ?? existing?.address ?? null,
    score: lead.score ?? existing?.score ?? 0,
    digitalMaturityScore: lead.digitalMaturityScore ?? existing?.digitalMaturityScore ?? 0,
    businessViabilityScore: lead.businessViabilityScore ?? existing?.businessViabilityScore ?? 0,
    accessibilityScore: lead.accessibilityScore ?? existing?.accessibilityScore ?? 0,
    aiInsight: lead.aiInsight ?? existing?.aiInsight ?? null,
    approachSuggestion: lead.approachSuggestion ?? existing?.approachSuggestion ?? null,
    status: lead.status ?? existing?.status ?? 'novo',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  writeDb(db)
}

export function getLeads(filters?: {
  niche?: string
  region?: string
  status?: LeadStatus
  minScore?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}): { leads: Lead[]; total: number } {
  const db = readDb()
  let all = Object.values(db.leads)

  if (filters?.niche) all = all.filter(l => l.niche === filters.niche)
  if (filters?.region) all = all.filter(l => l.region === filters.region)
  if (filters?.status) all = all.filter(l => l.status === filters.status)
  if (filters?.minScore) all = all.filter(l => l.score >= filters.minScore!)

  const sortBy = filters?.sortBy ?? 'score'
  const sortDir = filters?.sortDir ?? 'desc'
  const mult = sortDir === 'desc' ? -1 : 1

  all.sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortBy]
    const bv = (b as Record<string, unknown>)[sortBy]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * mult
    return 0
  })

  const total = all.length
  const offset = filters?.offset ?? 0
  const limit = filters?.limit ?? 50
  const leads = all.slice(offset, offset + limit)

  return { leads, total }
}

export function getLeadById(id: string): Lead | null {
  const db = readDb()
  return db.leads[id] ?? null
}

export function updateLeadStatus(id: string, status: LeadStatus): void {
  const db = readDb()
  if (db.leads[id]) {
    db.leads[id].status = status
    db.leads[id].updatedAt = new Date().toISOString()
    writeDb(db)
  }
}

export function deleteLead(id: string): void {
  const db = readDb()
  delete db.leads[id]
  writeDb(db)
}

export function getStats(): {
  total: number
  byNiche: Record<string, number>
  byStatus: Record<string, number>
  byRegion: Record<string, number>
  avgScore: number
  topScore: number
} {
  const db = readDb()
  const all = Object.values(db.leads)

  const byNiche: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byRegion: Record<string, number> = {}
  let totalScore = 0
  let topScore = 0

  for (const l of all) {
    byNiche[l.niche] = (byNiche[l.niche] ?? 0) + 1
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
    byRegion[l.region] = (byRegion[l.region] ?? 0) + 1
    totalScore += l.score
    if (l.score > topScore) topScore = l.score
  }

  return {
    total: all.length,
    byNiche,
    byStatus,
    byRegion,
    avgScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
    topScore,
  }
}
