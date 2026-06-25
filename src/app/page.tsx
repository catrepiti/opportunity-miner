'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MiningForm } from '@/components/MiningForm'
import { LeadCard } from '@/components/LeadCard'
import { MiningLog, LogEntry } from '@/components/MiningLog'
import { StatsBar } from '@/components/StatsBar'
import { Lead, LeadStatus, NicheType, NICHE_LABELS } from '@/lib/types'

type SortOption = 'score' | 'name' | 'created_at'
type FilterNiche = 'all' | NicheType

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<{
    total: number; avgScore: number; topScore: number;
    byNiche: Record<string, number>; byStatus: Record<string, number>
  } | null>(null)
  const [isMining, setIsMining] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [filterNiche, setFilterNiche] = useState<FilterNiche>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('score')
  const [activeTab, setActiveTab] = useState<'mine' | 'leads'>('mine')

  const saveLeadsToStorage = (leadsToSave: Lead[]) => {
    try { localStorage.setItem('opportunity-miner-leads', JSON.stringify(leadsToSave)) } catch {}
  }

  const loadLeadsFromStorage = (): Lead[] => {
    try {
      const raw = localStorage.getItem('opportunity-miner-leads')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  const computeStats = (all: Lead[]) => {
    const byNiche: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let totalScore = 0, topScore = 0
    for (const l of all) {
      byNiche[l.niche] = (byNiche[l.niche] ?? 0) + 1
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
      totalScore += l.score
      if (l.score > topScore) topScore = l.score
    }
    return { total: all.length, byNiche, byStatus, avgScore: all.length > 0 ? Math.round(totalScore / all.length) : 0, topScore }
  }

  const loadAndFilter = useCallback(() => {
    let all = loadLeadsFromStorage()
    if (filterNiche !== 'all') all = all.filter(l => l.niche === filterNiche)
    if (filterStatus !== 'all') all = all.filter(l => l.status === filterStatus)
    const mult = sortBy === 'name' ? 1 : -1
    all.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'created_at') return (a.createdAt > b.createdAt ? -1 : 1)
      return (b.score - a.score)
    })
    setLeads(all)
    setStats(computeStats(loadLeadsFromStorage()))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterNiche, filterStatus, sortBy])

  useEffect(() => {
    loadAndFilter()
    // also try server (works locally, may fail on Vercel)
    fetch('/api/leads?sortBy=score&sortDir=desc')
      .then(r => r.json())
      .then(data => {
        if (data.leads?.length > 0) {
          const stored = loadLeadsFromStorage()
          const merged = [...stored]
          for (const sl of data.leads) {
            if (!merged.find(m => m.id === sl.id)) merged.push(sl)
          }
          saveLeadsToStorage(merged)
          loadAndFilter()
        }
      })
      .catch(() => {})
  }, [loadAndFilter])

  const startMining = async (
    niches: NicheType[],
    regions: Array<{ city: string; state: string }>,
    depth: string
  ) => {
    setIsMining(true)
    setLogEntries([])
    setActiveTab('mine')

    try {
      const response = await fetch('/api/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niches, regions, depth }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) return

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            setLogEntries(prev => [...prev, { ...data, timestamp: Date.now() }])

            if (data.type === 'lead' && data.lead?.id) {
              const newLead = data.lead as Lead
              setLeads(prev => {
                const exists = prev.find(l => l.id === newLead.id)
                const updated = exists ? prev.map(l => l.id === newLead.id ? newLead : l) : [...prev, newLead]
                saveLeadsToStorage(updated)
                return updated
              })
              setStats(prev => prev ? { ...prev, total: (prev.total ?? 0) + 1 } : computeStats([newLead]))
            }

            if (data.type === 'complete') {
              loadAndFilter()
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (error) {
      setLogEntries(prev => [...prev, {
        type: 'error',
        message: `Erro: ${error instanceof Error ? error.message : 'Falha na mineração'}`,
        timestamp: Date.now(),
      }])
    } finally {
      setIsMining(false)
    }
  }

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch(() => {})
    setLeads(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, status } : l)
      const all = loadLeadsFromStorage().map(l => l.id === id ? { ...l, status } : l)
      saveLeadsToStorage(all)
      setStats(computeStats(all))
      return updated
    })
  }

  const handleAnalyze = async (id: string) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      const data = await res.json()
      setLeads(prev => {
        const updated = prev.map(l => l.id === id ? { ...l, aiInsight: data.insight, approachSuggestion: data.approachSuggestion } : l)
        const all = loadLeadsFromStorage().map(l => l.id === id ? { ...l, aiInsight: data.insight, approachSuggestion: data.approachSuggestion } : l)
        saveLeadsToStorage(all)
        return updated
      })
    }
  }

  const exportLeads = (format: 'csv' | 'json') => {
    window.open(`/api/export?format=${format}`, '_blank')
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-bold text-lg">
              M
            </div>
            <div>
              <h1 className="text-lg font-bold">Minerador de Oportunidades</h1>
              <p className="text-xs text-gray-500">Prospecção inteligente para gestores de tráfego</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/oportunidades"
              className="btn-primary text-xs !bg-yellow-600 hover:!bg-yellow-700"
            >
              Top Oportunidades
            </Link>
            <button
              onClick={() => exportLeads('csv')}
              className="btn-secondary text-xs"
              disabled={!stats || stats.total === 0}
            >
              Exportar CSV
            </button>
            <button
              onClick={() => exportLeads('json')}
              className="btn-secondary text-xs"
              disabled={!stats || stats.total === 0}
            >
              Exportar JSON
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <StatsBar stats={stats} />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#111827] p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'mine'
                ? 'bg-green-500/20 text-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Minerar
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'leads'
                ? 'bg-green-500/20 text-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Leads ({stats?.total ?? 0})
          </button>
        </div>

        {activeTab === 'mine' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <MiningForm onStartMining={startMining} isMining={isMining} />
              <MiningLog entries={logEntries} />
            </div>

            <div>
              {leads.length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    Últimos leads encontrados
                  </h3>
                  <div className="space-y-3">
                    {leads.slice(0, 5).map(lead => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onStatusChange={handleStatusChange}
                        onAnalyze={handleAnalyze}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <select
                value={filterNiche}
                onChange={(e) => setFilterNiche(e.target.value as FilterNiche)}
                className="input w-48"
              >
                <option value="all">Todos os nichos</option>
                {(Object.entries(NICHE_LABELS) as [NicheType, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input w-40"
              >
                <option value="all">Todos status</option>
                <option value="novo">Novo</option>
                <option value="analisando">Analisando</option>
                <option value="qualificado">Qualificado</option>
                <option value="contatado">Contatado</option>
                <option value="descartado">Descartado</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="input w-40"
              >
                <option value="score">Maior Score</option>
                <option value="name">Nome A-Z</option>
                <option value="created_at">Mais Recente</option>
              </select>
            </div>

            {/* Lead list */}
            {leads.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-4xl mb-3 opacity-30">&#9775;</div>
                <p className="text-gray-400">Nenhum lead encontrado</p>
                <p className="text-xs text-gray-600 mt-1">
                  Inicie uma mineração para descobrir oportunidades
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {leads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                    onAnalyze={handleAnalyze}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
