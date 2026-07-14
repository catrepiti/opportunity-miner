'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Lead, LeadStatus, NICHE_LABELS, NicheType } from '@/lib/types'
import { ScoreRing } from '@/components/ScoreRing'

interface QueueData {
  queue: Lead[]
  stats: {
    total: number
    inQueue: number
    contacted: number
    contactedToday: number
    byStatus: Record<string, number>
  }
  lastRun: {
    finishedAt: string
    leadsSaved: number
    niches: string[]
    regions: string[]
  } | null
  minScore: number
}

function waLink(lead: Lead, message: string): string | null {
  const raw = lead.whatsapp ?? lead.phone
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`
}

function defaultMessage(lead: Lead): string {
  const nicheLabel = NICHE_LABELS[lead.niche as NicheType] ?? lead.niche
  return (
    lead.approachSuggestion ??
    `Olá! Encontrei a ${lead.name} pesquisando por ${nicheLabel.toLowerCase()} em ${lead.city} e notei que vocês têm potencial para atrair muito mais clientes com presença digital. Trabalho com gestão de tráfego para negócios do seu segmento — posso te mostrar rapidamente como funciona?`
  )
}

function QueueCard({ lead, onStatus, onDiagnose, diagnosing }: {
  lead: Lead
  onStatus: (id: string, status: LeadStatus) => void
  onDiagnose: (id: string) => void
  diagnosing: boolean
}) {
  const [copied, setCopied] = useState(false)
  const message = defaultMessage(lead)
  const wa = waLink(lead, message)
  const nicheLabel = NICHE_LABELS[lead.niche as NicheType] ?? lead.niche

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <ScoreRing score={lead.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{lead.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{nicheLabel}</span>
            <span className="text-xs text-gray-400">{lead.city}/{lead.state}</span>
          </div>

          <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            {lead.phone && <span>📞 {lead.phone}</span>}
            {lead.email && <span>✉️ {lead.email}</span>}
            {lead.instagram && lead.instagram !== 'detectado' && <span>📷 @{lead.instagram.replace('@', '')}</span>}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                🌐 site
              </a>
            )}
          </div>

          {lead.aiInsight ? (
            <p className="mt-2 text-sm text-gray-300">
              <span className="text-green-400 font-medium">Diagnóstico: </span>
              {lead.aiInsight}
            </p>
          ) : (
            <button
              onClick={() => onDiagnose(lead.id)}
              disabled={diagnosing}
              className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
            >
              {diagnosing ? '⏳ Gerando diagnóstico com IA...' : '✨ Gerar diagnóstico com IA'}
            </button>
          )}

          <div className="mt-3 p-3 rounded-lg bg-black/30 border border-[var(--border)] text-sm text-gray-300">
            {message}
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onStatus(lead.id, 'contatado')}
                className="btn-primary text-sm !py-1.5 !px-4"
              >
                Abrir WhatsApp
              </a>
            )}
            <button onClick={copy} className="btn-secondary text-sm !py-1.5 !px-4">
              {copied ? '✓ Copiado' : 'Copiar mensagem'}
            </button>
            <button
              onClick={() => onStatus(lead.id, 'contatado')}
              className="text-sm px-4 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            >
              Marcar contatado
            </button>
            <button
              onClick={() => onStatus(lead.id, 'descartado')}
              className="text-sm px-4 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FilaPage() {
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mining, setMining] = useState(false)
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/queue')
      setData(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: LeadStatus) => {
    setData(prev => prev ? { ...prev, queue: prev.queue.filter(l => l.id !== id) } : prev)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const diagnose = async (id: string) => {
    setDiagnosingId(id)
    try {
      await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch {}
    setDiagnosingId(null)
  }

  const mineNow = async () => {
    setMining(true)
    try {
      await fetch('/api/auto-mine', { method: 'POST' })
      await load()
    } catch {}
    setMining(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fila de Outreach</h1>
          <p className="text-sm text-gray-400">
            Leads qualificados pela mineração automática, prontos para abordagem.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary text-sm !py-1.5 !px-4">Minerador</Link>
          <Link href="/oportunidades" className="btn-secondary text-sm !py-1.5 !px-4">Oportunidades</Link>
          <button onClick={mineNow} disabled={mining} className="btn-primary text-sm !py-1.5 !px-4">
            {mining ? '⛏️ Minerando...' : '⛏️ Minerar agora'}
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card !p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{data.stats.inQueue}</div>
            <div className="text-xs text-gray-400">na fila</div>
          </div>
          <div className="card !p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">{data.stats.contactedToday}</div>
            <div className="text-xs text-gray-400">contatados hoje</div>
          </div>
          <div className="card !p-3 text-center">
            <div className="text-2xl font-bold">{data.stats.contacted}</div>
            <div className="text-xs text-gray-400">contatados total</div>
          </div>
          <div className="card !p-3 text-center">
            <div className="text-2xl font-bold">{data.stats.total}</div>
            <div className="text-xs text-gray-400">leads na base</div>
          </div>
        </div>
      )}

      {data?.lastRun && (
        <p className="text-xs text-gray-500 mb-4">
          Última mineração automática: {new Date(data.lastRun.finishedAt).toLocaleString('pt-BR')} ·{' '}
          {data.lastRun.leadsSaved} leads · {data.lastRun.regions.join(', ')}
        </p>
      )}

      {loading ? (
        <p className="text-gray-400">Carregando fila...</p>
      ) : !data || data.queue.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-300 font-medium">Fila vazia</p>
          <p className="text-sm text-gray-500 mt-1">
            Clique em &quot;Minerar agora&quot; ou aguarde a próxima mineração automática agendada.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.queue.map(lead => (
            <QueueCard
              key={lead.id}
              lead={lead}
              onStatus={setStatus}
              onDiagnose={diagnose}
              diagnosing={diagnosingId === lead.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
