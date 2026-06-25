'use client'

import { useState } from 'react'
import { NicheType, NICHE_LABELS } from '@/lib/types'

const STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
  'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

interface Region { city: string; state: string }

interface Props {
  onStartMining: (niches: NicheType[], regions: Region[], depth: string) => void
  isMining: boolean
}

const ALL_NICHES = Object.keys(NICHE_LABELS) as NicheType[]

export function MiningForm({ onStartMining, isMining }: Props) {
  const [selectedNiches, setSelectedNiches] = useState<NicheType[]>([])
  const [regions, setRegions] = useState<Region[]>([{ city: '', state: 'SP' }])
  const [depth, setDepth] = useState<string>('normal')

  const toggleNiche = (niche: NicheType) => {
    setSelectedNiches(prev =>
      prev.includes(niche)
        ? prev.filter(n => n !== niche)
        : [...prev, niche]
    )
  }

  const selectAllNiches = () => {
    setSelectedNiches(prev => prev.length === ALL_NICHES.length ? [] : [...ALL_NICHES])
  }

  const addRegion = () => {
    setRegions(prev => [...prev, { city: '', state: 'SP' }])
  }

  const removeRegion = (index: number) => {
    setRegions(prev => prev.filter((_, i) => i !== index))
  }

  const updateRegion = (index: number, field: keyof Region, value: string) => {
    setRegions(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const canStart = selectedNiches.length > 0 && regions.every(r => r.city.trim().length > 0)

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        Configurar Mineração
      </h2>

      {/* Nichos */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-400">Nichos Alvo</label>
          <button onClick={selectAllNiches} className="text-xs text-green-400 hover:text-green-300">
            {selectedNiches.length === ALL_NICHES.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_NICHES.map(niche => (
            <button
              key={niche}
              onClick={() => toggleNiche(niche)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                selectedNiches.includes(niche)
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {NICHE_LABELS[niche]}
            </button>
          ))}
        </div>
      </div>

      {/* Regiões */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-400 mb-2 block">Regiões</label>
        {regions.map((region, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Cidade (ex: São Paulo)"
              value={region.city}
              onChange={(e) => updateRegion(i, 'city', e.target.value)}
              className="input flex-1"
            />
            <select
              value={region.state}
              onChange={(e) => updateRegion(i, 'state', e.target.value)}
              className="input"
              style={{ width: '5rem', minWidth: '5rem', flex: 'none' }}
            >
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {regions.length > 1 && (
              <button
                onClick={() => removeRegion(i)}
                className="text-red-400 hover:text-red-300 px-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addRegion}
          className="text-xs text-green-400 hover:text-green-300 mt-1"
        >
          + Adicionar região
        </button>
      </div>

      {/* Profundidade */}
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-400 mb-2 block">Profundidade</label>
        <div className="flex gap-2">
          {[
            { value: 'rapida', label: 'Rápida', desc: '~2 buscas/nicho' },
            { value: 'normal', label: 'Normal', desc: '~4 buscas/nicho' },
            { value: 'profunda', label: 'Profunda', desc: 'Todas as buscas' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDepth(opt.value)}
              className={`flex-1 p-2 rounded-lg border text-sm transition-all ${
                depth === opt.value
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-xs opacity-60">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Botão */}
      <button
        onClick={() => onStartMining(selectedNiches, regions, depth)}
        disabled={!canStart || isMining}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isMining ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Minerando...
          </>
        ) : (
          'Iniciar Mineração'
        )}
      </button>

      {!canStart && !isMining && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Selecione pelo menos 1 nicho e preencha a cidade
        </p>
      )}
    </div>
  )
}
