// Migração única: importa data/leads.json e data/auto-mine-runs.json
// para o Postgres (Neon). Rodar com: node --env-file=.env.local scripts/migrate-to-pg.mjs
import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

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

const leadsPath = path.join(process.cwd(), 'data', 'leads.json')
let leadCount = 0
if (fs.existsSync(leadsPath)) {
  const db = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'))
  for (const lead of Object.values(db.leads ?? {})) {
    await pool.query(
      `INSERT INTO miner_leads (id, name, niche, region, status, score, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, niche = $3, region = $4, status = $5, score = $6, data = $7, updated_at = $9`,
      [lead.id, lead.name, lead.niche, lead.region, lead.status, lead.score,
       JSON.stringify(lead), lead.createdAt, lead.updatedAt],
    )
    leadCount++
  }
}

const runsPath = path.join(process.cwd(), 'data', 'auto-mine-runs.json')
let runCount = 0
if (fs.existsSync(runsPath)) {
  const runs = JSON.parse(fs.readFileSync(runsPath, 'utf-8'))
  for (const run of runs) {
    await pool.query(
      'INSERT INTO miner_runs (id, data, finished_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [run.id, JSON.stringify(run), run.finishedAt],
    )
    runCount++
  }
}

const configPath = path.join(process.cwd(), 'data', 'auto-mine-config.json')
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  await pool.query(
    'INSERT INTO miner_config (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
    [JSON.stringify(config)],
  )
}

const { rows } = await pool.query('SELECT count(*)::int AS n FROM miner_leads')
console.log(`Migrados: ${leadCount} leads, ${runCount} runs. Total no banco: ${rows[0].n} leads.`)
await pool.end()
