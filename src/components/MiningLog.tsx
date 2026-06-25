'use client'

import { useEffect, useRef } from 'react'

export interface LogEntry {
  type: string
  message: string
  timestamp: number
}

export function MiningLog({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div className="card mt-4">
      <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse"></span>
        Log de Mineração
      </h3>
      <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono">
        {entries.map((entry, i) => (
          <div
            key={i}
            className={`log-entry ${entry.type === 'found' ? 'found' : entry.type === 'lead' ? 'lead' : ''}`}
          >
            <span className="text-gray-600 mr-2">
              {new Date(entry.timestamp).toLocaleTimeString('pt-BR')}
            </span>
            {entry.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
