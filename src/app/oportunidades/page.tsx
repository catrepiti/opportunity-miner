'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lead, NicheType, NICHE_LABELS, LeadStatus } from '@/lib/types'
import { ScoreRing } from '@/components/ScoreRing'
import Link from 'next/link'

export default function Oportunidades() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  const fetchTopLeads = useCallback(async () => {
    const res = await fetch('/api/leads?sortBy=score&sortDir=desc&limit=50')
    const data = await res.json()
    setLeads(data.leads ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTopLeads() }, [fetchTopLeads])

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      const data = await res.json()
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l, aiInsight: data.insight, approachSuggestion: data.approachSuggestion,
      } : l))
      if (selectedLead?.id === id) {
        setSelectedLead(prev => prev ? {
          ...prev, aiInsight: data.insight, approachSuggestion: data.approachSuggestion,
        } : null)
      }
    }
    setAnalyzing(null)
  }

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) {
      setSelectedLead(prev => prev ? { ...prev, status } : null)
    }
  }

  const topLead = leads[0] ?? null
  const goldLeads = leads.filter(l => l.score >= 80)
  const silverLeads = leads.filter(l => l.score >= 60 && l.score < 80)
  const bronzeLeads = leads.filter(l => l.score >= 40 && l.score < 60)
  const withContact = leads.filter(l => l.phone || l.whatsapp || l.email)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Carregando oportunidades...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center font-bold text-lg">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold">Top Oportunidades</h1>
              <p className="text-xs text-gray-500">As melhores empresas para contato</p>
            </div>
          </div>
          <Link href="/" className="btn-secondary text-sm">Voltar ao Minerador</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card !p-3">
            <div className="text-xs text-gray-500">Total Minerados</div>
            <div className="text-2xl font-bold">{leads.length}</div>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-gray-500">Com Contato</div>
            <div className="text-2xl font-bold text-green-400">{withContact.length}</div>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-yellow-500">Ouro (80+)</div>
            <div className="text-2xl font-bold text-yellow-400">{goldLeads.length}</div>
          </div>
          <div className="card !p-3">
            <div className="text-xs text-gray-400">Prata (60+)</div>
            <div className="text-2xl font-bold text-gray-300">{silverLeads.length}</div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4 opacity-20">&#9775;</div>
            <p className="text-gray-400 text-lg">Nenhum lead minerado ainda</p>
            <p className="text-sm text-gray-600 mt-2">Volte ao minerador e inicie uma busca</p>
            <Link href="/" className="btn-primary inline-block mt-4">Ir para o Minerador</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Ranked list */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-medium text-gray-400 mb-3">Ranking por Score</h2>
              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                {leads.map((lead, idx) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full text-left card !p-3 flex items-center gap-3 transition-all ${
                      selectedLead?.id === lead.id ? '!border-green-500 bg-green-500/5' : ''
                    }`}
                  >
                    <span className="text-xs text-gray-600 w-5 text-right font-mono">
                      {idx + 1}
                    </span>
                    <ScoreRing score={lead.score} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lead.name}</div>
                      <div className="text-xs text-gray-500">
                        {NICHE_LABELS[lead.niche as NicheType] ?? lead.niche}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {lead.whatsapp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">WhatsApp</span>}
                      {lead.email && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Email</span>}
                      {lead.phone && !lead.whatsapp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Fone</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Detail panel */}
            <div className="lg:col-span-2">
              {selectedLead ? (
                <DetailPanel
                  lead={selectedLead}
                  onAnalyze={handleAnalyze}
                  onStatusChange={handleStatusChange}
                  analyzing={analyzing === selectedLead.id}
                />
              ) : topLead ? (
                <div>
                  <div className="card text-center py-8 mb-4">
                    <p className="text-gray-400 mb-2">Selecione um lead na lista para ver os detalhes</p>
                    <p className="text-xs text-gray-600">ou veja a melhor oportunidade abaixo</p>
                  </div>
                  <DetailPanel
                    lead={topLead}
                    onAnalyze={handleAnalyze}
                    onStatusChange={handleStatusChange}
                    analyzing={analyzing === topLead.id}
                    highlight
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function DetailPanel({ lead, onAnalyze, onStatusChange, analyzing, highlight }: {
  lead: Lead
  onAnalyze: (id: string) => void
  onStatusChange: (id: string, status: LeadStatus) => void
  analyzing: boolean
  highlight?: boolean
}) {
  const nicheLabel = NICHE_LABELS[lead.niche as NicheType] ?? lead.niche
  const hasAnyContact = lead.phone || lead.whatsapp || lead.email || lead.instagram

  return (
    <div className={`space-y-4 animate-in ${highlight ? '' : ''}`}>
      {highlight && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          Melhor oportunidade identificada
        </div>
      )}

      {/* Header card */}
      <div className="card">
        <div className="flex items-start gap-4">
          <ScoreRing score={lead.score} size={72} />
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{lead.name}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
              <span>{nicheLabel}</span>
              <span className="text-gray-700">|</span>
              <span>{lead.city}/{lead.state}</span>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Digital: </span>
                <span className="text-green-400 font-semibold">{lead.digitalMaturityScore}</span>
                <span className="text-gray-600">/40</span>
              </div>
              <div>
                <span className="text-gray-500">Viabilidade: </span>
                <span className="text-blue-400 font-semibold">{lead.businessViabilityScore}</span>
                <span className="text-gray-600">/30</span>
              </div>
              <div>
                <span className="text-gray-500">Acesso: </span>
                <span className="text-purple-400 font-semibold">{lead.accessibilityScore}</span>
                <span className="text-gray-600">/30</span>
              </div>
            </div>
          </div>

          <select
            value={lead.status}
            onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
            className="input text-sm"
            style={{ width: 'auto' }}
          >
            <option value="novo">Novo</option>
            <option value="analisando">Analisando</option>
            <option value="qualificado">Qualificado</option>
            <option value="contatado">Contatado</option>
            <option value="descartado">Descartado</option>
          </select>
        </div>
      </div>

      {/* Contact card */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Dados de Contato
        </h3>

        {!hasAnyContact ? (
          <p className="text-sm text-gray-500 italic">
            Nenhum contato direto encontrado. Tente acessar o site para buscar manualmente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lead.whatsapp && (
              <ContactItem
                icon="W"
                iconColor="bg-green-500"
                label="WhatsApp"
                value={formatPhone(lead.whatsapp)}
                href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '').replace(/^55/, '')}`}
                actionLabel="Abrir WhatsApp"
                actionColor="text-green-400"
              />
            )}

            {lead.phone && (
              <ContactItem
                icon="T"
                iconColor="bg-purple-500"
                label="Telefone"
                value={formatPhone(lead.phone)}
                href={`tel:${lead.phone}`}
                actionLabel="Ligar"
                actionColor="text-purple-400"
              />
            )}

            {(lead.phones?.length ?? 0) > 1 && lead.phones?.slice(1, 4).map((p, i) => (
              <ContactItem
                key={i}
                icon="T"
                iconColor="bg-purple-500/60"
                label={`Telefone ${i + 2}`}
                value={formatPhone(p)}
                href={`tel:${p}`}
                actionLabel="Ligar"
                actionColor="text-purple-400"
              />
            ))}
            {(lead.phones?.length ?? 0) > 4 && (
              <div className="col-span-2 text-xs text-gray-500 text-center">
                +{(lead.phones?.length ?? 0) - 4} telefones adicionais disponíveis na exportação CSV
              </div>
            )}

            {lead.email && (
              <ContactItem
                icon="@"
                iconColor="bg-blue-500"
                label="Email"
                value={lead.email}
                href={`mailto:${lead.email}`}
                actionLabel="Enviar email"
                actionColor="text-blue-400"
              />
            )}

            {lead.instagram && lead.instagram !== 'detectado' && (
              <ContactItem
                icon="I"
                iconColor="bg-pink-500"
                label="Instagram"
                value={lead.instagram}
                href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                actionLabel="Abrir perfil"
                actionColor="text-pink-400"
              />
            )}

            {lead.facebook && lead.facebook !== 'detectado' && (
              <ContactItem
                icon="F"
                iconColor="bg-blue-600"
                label="Facebook"
                value="Página"
                href={lead.facebook}
                actionLabel="Abrir página"
                actionColor="text-blue-400"
              />
            )}
          </div>
        )}

        {lead.address && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-start gap-2 text-sm">
              <span className="text-gray-500 shrink-0">Endereço:</span>
              <span className="text-gray-300">{lead.address}</span>
            </div>
          </div>
        )}

        {lead.website && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Site:</span>
              <a href={lead.website} target="_blank" rel="noopener" className="text-blue-400 hover:underline truncate">
                {lead.website.replace(/^https?:\/\//, '').slice(0, 50)}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* AI Insight card */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Análise & Abordagem
          </h3>
          {!lead.aiInsight && (
            <button
              onClick={() => onAnalyze(lead.id)}
              disabled={analyzing}
              className="btn-primary text-xs !py-1.5 !px-3"
            >
              {analyzing ? 'Analisando...' : 'Gerar com IA'}
            </button>
          )}
        </div>

        {lead.aiInsight ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs font-medium text-green-400 mb-1">Insight</div>
              <p className="text-sm text-gray-300">{lead.aiInsight}</p>
            </div>
            {lead.approachSuggestion && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs font-medium text-blue-400 mb-1">Script de Abordagem</div>
                <p className="text-sm text-gray-300">{lead.approachSuggestion}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="text-xs font-medium text-gray-500 mb-1">Por que essa empresa?</div>
              <p className="text-sm text-gray-400">
                {lead.digitalMaturityScore >= 30
                  ? 'Presença digital muito fraca — grande oportunidade para tráfego pago.'
                  : lead.digitalMaturityScore >= 15
                    ? 'Presença digital básica mas com lacunas importantes para preencher.'
                    : 'Já tem presença digital, mas pode otimizar campanhas pagas.'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="text-xs font-medium text-gray-500 mb-1">Sugestão rápida</div>
              <p className="text-sm text-gray-400">
                {lead.whatsapp
                  ? 'Aborde via WhatsApp com um case de sucesso do nicho.'
                  : lead.instagram && lead.instagram !== 'detectado'
                    ? 'Envie DM no Instagram apresentando resultados de clientes similares.'
                    : lead.email
                      ? 'Envie um email personalizado com proposta de diagnóstico gratuito.'
                      : 'Busque o contato manualmente no site ou Google Maps.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Opportunity signals */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
          Sinais de Oportunidade
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Signal active={!lead.website} label="Sem site" description="Precisa de presença online" />
          <Signal active={!lead.instagram || lead.instagram === 'detectado'} label="Instagram fraco" description="Oportunidade de social ads" />
          <Signal active={!lead.facebook || lead.facebook === 'detectado'} label="Facebook ausente" description="Meta Ads não explorado" />
          <Signal active={!!lead.phone || !!lead.whatsapp} label="Contato disponível" description="Fácil de abordar" positive />
          <Signal active={(lead.googleRating ?? 0) >= 4} label="Boa reputação" description="Clientes satisfeitos" positive />
          <Signal active={lead.score >= 50} label="Score alto" description="Prioridade de contato" positive />
        </div>
      </div>
    </div>
  )
}

function ContactItem({ icon, iconColor, label, value, href, actionLabel, actionColor }: {
  icon: string; iconColor: string; label: string; value: string
  href: string; actionLabel: string; actionColor: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
      <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center text-white text-xs font-bold`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className={`text-xs font-medium ${actionColor} hover:underline shrink-0`}
      >
        {actionLabel}
      </a>
    </div>
  )
}

function Signal({ active, label, description, positive }: {
  active: boolean; label: string; description: string; positive?: boolean
}) {
  if (!active) return null
  return (
    <div className={`p-2 rounded-lg border text-xs ${
      positive
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
    }`}>
      <div className="font-medium">{positive ? '✓' : '!'} {label}</div>
      <div className="opacity-60 mt-0.5">{description}</div>
    </div>
  )
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '').replace(/^55/, '')
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  return phone
}
