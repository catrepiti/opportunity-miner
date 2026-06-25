'use client'

import { useState } from 'react'
import { Lead, LeadStatus, NICHE_LABELS, NicheType } from '@/lib/types'
import { ScoreRing, ScoreLabel } from './ScoreRing'

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'novo', label: 'Novo', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'analisando', label: 'Analisando', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-green-500/20 text-green-400' },
  { value: 'contatado', label: 'Contatado', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'descartado', label: 'Descartado', color: 'bg-red-500/20 text-red-400' },
]

export function LeadCard({ lead, onStatusChange, onAnalyze }: {
  lead: Lead
  onStatusChange: (id: string, status: LeadStatus) => void
  onAnalyze: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const statusConfig = STATUS_OPTIONS.find(s => s.value === lead.status) ?? STATUS_OPTIONS[0]
  const nicheLabel = NICHE_LABELS[lead.niche as NicheType] ?? lead.niche

  const handleAnalyze = async () => {
    setAnalyzing(true)
    await onAnalyze(lead.id)
    setAnalyzing(false)
  }

  return (
    <div className="card animate-in">
      <div className="flex items-start gap-3">
        <ScoreRing score={lead.score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
            <ScoreLabel score={lead.score} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <span>{nicheLabel}</span>
            <span>|</span>
            <span>{lead.city}/{lead.state}</span>
          </div>

          {/* Indicadores */}
          <div className="flex gap-2 mb-2 flex-wrap">
            <Indicator
              label="Site"
              active={!!lead.website}
              good={false}
            />
            <Indicator
              label="Instagram"
              active={!!lead.instagram}
              good={false}
            />
            <Indicator
              label="Facebook"
              active={!!lead.facebook}
              good={false}
            />
            <Indicator
              label="Telefone"
              active={!!lead.phone}
              good={true}
            />
          </div>

          {/* Score breakdown */}
          <div className="flex gap-4 text-xs text-gray-500 mb-2">
            <span>Digital: <span className="text-green-400">{lead.digitalMaturityScore}</span>/40</span>
            <span>Viabilidade: <span className="text-blue-400">{lead.businessViabilityScore}</span>/30</span>
            <span>Acesso: <span className="text-purple-400">{lead.accessibilityScore}</span>/30</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <select
              value={lead.status}
              onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
              className={`text-xs px-2 py-1 rounded-full border-none cursor-pointer ${statusConfig.color}`}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {expanded ? 'Menos' : 'Mais'}
            </button>

            {!lead.aiInsight && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-xs text-green-400 hover:text-green-300 ml-auto"
              >
                {analyzing ? 'Analisando...' : 'Analisar com IA'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 text-sm space-y-2">
          {lead.phone && (
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500 w-20">Telefone:</span>
              <a href={`tel:${lead.phone}`} className="text-green-400 hover:underline">{lead.phone}</a>
            </div>
          )}
          {lead.website && (
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500 w-20">Site:</span>
              <a href={lead.website} target="_blank" rel="noopener" className="text-blue-400 hover:underline truncate">
                {lead.website.replace(/^https?:\/\//, '').slice(0, 40)}
              </a>
            </div>
          )}
          {lead.instagram && (
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500 w-20">Instagram:</span>
              <span className="text-pink-400">{lead.instagram}</span>
            </div>
          )}
          {lead.address && (
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-gray-500 w-20">Endereço:</span>
              <span>{lead.address}</span>
            </div>
          )}
          {lead.aiInsight && (
            <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs font-medium text-green-400 mb-1">Insight IA</div>
              <p className="text-xs text-gray-300">{lead.aiInsight}</p>
            </div>
          )}
          {lead.approachSuggestion && (
            <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-xs font-medium text-blue-400 mb-1">Sugestão de Abordagem</div>
              <p className="text-xs text-gray-300">{lead.approachSuggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Indicator({ label, active, good }: { label: string; active: boolean; good: boolean }) {
  const isOpportunity = !active && !good
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      active
        ? good
          ? 'bg-green-500/15 text-green-400'
          : 'bg-gray-500/15 text-gray-400'
        : isOpportunity
          ? 'bg-yellow-500/15 text-yellow-400'
          : 'bg-gray-700/50 text-gray-600'
    }`}>
      {!active && !good ? '!' : active ? '✓' : '—'} {label}
    </span>
  )
}
