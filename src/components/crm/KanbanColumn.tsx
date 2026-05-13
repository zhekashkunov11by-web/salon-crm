'use client'

import { useDroppable } from '@dnd-kit/core'
import { LeadCard } from './LeadCard'

interface LeadStatus {
  id: string
  name: string
  color: string
}

interface Lead {
  id: string
  status_id: string
  client_name: string
  phone?: string
  source?: string
  amount?: number
  created_at: string
  next_contact_at?: string
  staff_name?: string
}

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-violet-100 text-violet-700',
  pink: 'bg-pink-100 text-pink-700',
}

const DOT_MAP: Record<string, string> = {
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  purple: 'bg-violet-500',
  pink: 'bg-pink-500',
}

interface KanbanColumnProps {
  status: LeadStatus
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
  onAddLead: (statusId: string) => void
}

export function KanbanColumn({ status, leads, onLeadClick, onAddLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  const headerColor = COLOR_MAP[status.color] || COLOR_MAP.gray
  const dotColor = DOT_MAP[status.color] || DOT_MAP.gray

  return (
    <div className="kanban-column flex-shrink-0" style={{ width: 280 }}>
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${headerColor}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold">{status.name}</span>
          <span className="text-xs opacity-60">({leads.length})</span>
        </div>
        <button
          onClick={() => onAddLead(status.id)}
          className="text-xs opacity-60 hover:opacity-100 font-medium"
        >+ Добавить</button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 rounded-b-lg min-h-[200px] transition-colors ${
          isOver ? 'bg-violet-50' : 'bg-gray-50'
        }`}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
        ))}
        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-300 py-8">
            Пусто
          </div>
        )}
      </div>
    </div>
  )
}
