import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { Lead, LeadStatus } from './types'

/**
 * Camada de dados dos leads.
 * - Com DATABASE_URL (Neon/Postgres): persiste em `miner_leads` — funciona
 *   igual no local e na Vercel, com os mesmos dados nos dois lugares.
 * - Sem DATABASE_URL: fallback para o arquivo data/leads.json (modo antigo).
 */

const isVercel = !!process.env.VERCEL
const DB_PATH = isVercel
  ? path.join('/tmp', 'leads.json')
  : path.join(process.cwd(), 'data', 'leads.json')

const usePg = !!process.env.DATABASE_URL

// ── Postgres ──────────────────────────────────────────────────────────────────

const globalForPg = globalThis as unknown as { minerPool?: Pool; minerInit?: Promise<void> }

function getPool(): Pool {
  if (!globalForPg.minerPool) {
    globalForPg.minerPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return globalForPg.minerPool
}

async function ensureTables(): Promise<void> {
  if (!globalForPg.minerInit) {
    globalForPg.minerInit = (async () => {
      const pool = getPool()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS miner_leads (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          niche TEXT NOT NULL,
          region TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'novo',
          score INT NOT NULL DEFAULT 0,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS miner_runs (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS miner_config (
          id INT PRIMARY KEY DEFAULT 1,
          data JSONB NOT NULL
        )
      `)
    })()
  }
  return globalForPg.minerInit
}

async function pgAllLeads(): Promise<Lead[]> {
  await ensureTables()
  const { rows } = await getPool().query('SELECT data FROM miner_leads')
  return rows.map(r => r.data as Lead)
}

// ── Arquivo (fallback local) ──────────────────────────────────────────────────

interface FileDB {
  leads: Record<string, Lead>
}

function readFileDb(): FileDB {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(DB_PATH)) return { leads: {} }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
  } catch {
    return { leads: {} }
  }
}

function writeFileDb(db: FileDB): void {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

// ── API pública ───────────────────────────────────────────────────────────────

function mergeLead(
  lead: Partial<Lead> & { id: string; name: string; niche: string; region: string; city: string; state: string },
  existing: Lead | null,
): Lead {
  const now = new Date().toISOString()
  return {
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
}

export async function upsertLead(
  lead: Partial<Lead> & { id: string; name: string; niche: string; region: string; city: string; state: string },
): Promise<void> {
  if (usePg) {
    await ensureTables()
    const pool = getPool()
    const { rows } = await pool.query('SELECT data FROM miner_leads WHERE id = $1', [lead.id])
    const merged = mergeLead(lead, rows[0]?.data ?? null)
    await pool.query(
      `INSERT INTO miner_leads (id, name, niche, region, status, score, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, niche = $3, region = $4, status = $5, score = $6, data = $7, updated_at = $9`,
      [merged.id, merged.name, merged.niche, merged.region, merged.status, merged.score,
       JSON.stringify(merged), merged.createdAt, merged.updatedAt],
    )
    return
  }

  const db = readFileDb()
  db.leads[lead.id] = mergeLead(lead, db.leads[lead.id] ?? null)
  writeFileDb(db)
}

export interface LeadFilters {
  niche?: string
  region?: string
  status?: LeadStatus
  minScore?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export async function getLeads(filters?: LeadFilters): Promise<{ leads: Lead[]; total: number }> {
  let all = usePg ? await pgAllLeads() : Object.values(readFileDb().leads)

  if (filters?.niche) all = all.filter(l => l.niche === filters.niche)
  if (filters?.region) all = all.filter(l => l.region === filters.region)
  if (filters?.status) all = all.filter(l => l.status === filters.status)
  if (filters?.minScore) all = all.filter(l => l.score >= filters.minScore!)

  const sortBy = filters?.sortBy ?? 'score'
  const sortDir = filters?.sortDir ?? 'desc'
  const mult = sortDir === 'desc' ? -1 : 1

  all.sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const av = (a as any)[sortBy]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bv = (b as any)[sortBy]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * mult
    return 0
  })

  const total = all.length
  const offset = filters?.offset ?? 0
  const limit = filters?.limit ?? 50
  return { leads: all.slice(offset, offset + limit), total }
}

export async function getLeadById(id: string): Promise<Lead | null> {
  if (usePg) {
    await ensureTables()
    const { rows } = await getPool().query('SELECT data FROM miner_leads WHERE id = $1', [id])
    return rows[0]?.data ?? null
  }
  return readFileDb().leads[id] ?? null
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  if (usePg) {
    await ensureTables()
    await getPool().query(
      `UPDATE miner_leads
       SET status = $2,
           data = jsonb_set(jsonb_set(data, '{status}', to_jsonb($2::text)), '{updatedAt}', to_jsonb($3::text)),
           updated_at = $3
       WHERE id = $1`,
      [id, status, new Date().toISOString()],
    )
    return
  }
  const db = readFileDb()
  if (db.leads[id]) {
    db.leads[id].status = status
    db.leads[id].updatedAt = new Date().toISOString()
    writeFileDb(db)
  }
}

export async function deleteLead(id: string): Promise<void> {
  if (usePg) {
    await ensureTables()
    await getPool().query('DELETE FROM miner_leads WHERE id = $1', [id])
    return
  }
  const db = readFileDb()
  delete db.leads[id]
  writeFileDb(db)
}

export async function getStats(): Promise<{
  total: number
  byNiche: Record<string, number>
  byStatus: Record<string, number>
  byRegion: Record<string, number>
  avgScore: number
  topScore: number
}> {
  const all = usePg ? await pgAllLeads() : Object.values(readFileDb().leads)

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

// ── Runs e config da mineração automática ────────────────────────────────────

export async function dbGetConfigJson<T>(): Promise<T | null> {
  if (!usePg) return null
  await ensureTables()
  const { rows } = await getPool().query('SELECT data FROM miner_config WHERE id = 1')
  return rows[0]?.data ?? null
}

export async function dbSaveConfigJson(data: unknown): Promise<void> {
  if (!usePg) return
  await ensureTables()
  await getPool().query(
    `INSERT INTO miner_config (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = $1`,
    [JSON.stringify(data)],
  )
}

export async function dbGetRuns<T>(limit: number): Promise<T[] | null> {
  if (!usePg) return null
  await ensureTables()
  const { rows } = await getPool().query(
    'SELECT data FROM miner_runs ORDER BY finished_at DESC LIMIT $1', [limit],
  )
  return rows.map(r => r.data as T)
}

export async function dbCountRuns(): Promise<number | null> {
  if (!usePg) return null
  await ensureTables()
  const { rows } = await getPool().query('SELECT count(*)::int AS n FROM miner_runs')
  return rows[0]?.n ?? 0
}

export async function dbAppendRun(id: string, data: unknown, finishedAt: string): Promise<boolean> {
  if (!usePg) return false
  await ensureTables()
  await getPool().query(
    'INSERT INTO miner_runs (id, data, finished_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [id, JSON.stringify(data), finishedAt],
  )
  return true
}

export function usingPostgres(): boolean {
  return usePg
}
