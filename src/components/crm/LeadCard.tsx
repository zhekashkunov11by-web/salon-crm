'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatMoney, daysSince } from '@/lib/utils/format'

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

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  isDragging?: boolean
}

const SOURCE_ICONS: Record<string, string> = {
  instagram: '📸',
  vk: '💬',
  avito: '🏷️',
  '2gis': '🗺️',
  yandex: '🔍',
  google: '🔍',
  dikidi: '📅',
  phone: '📞',
  walk_in: '🚶',
  referral: '👥',
}

export function LeadCard({ lead, onClick, isDragging }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const days = daysSince(lead.created_at)
  const isOverdue = lead.next_contact_at && new Date(lead.next_contact_at) < new Date()
  const sourceIcon = lead.source ? (SOURCE_ICONS[lead.source] || '📱') : null

  if (isDragging) {
    return (
      <div className="bg-white rounded-lg p-3 shadow-xl border-2 border-violet-400 rotate-1 cursor-grabbing">
        <p className="font-medium text-sm text-gray-900">{lead.client_name}</p>
        {lead.amount && <p className="text-xs text-violet-600">{formatMoney(lead.amount)}</p>}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all select-none ${
        isOverdue ? 'border-l-2 border-l-red-400' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-medium text-sm text-gray-900 leading-tight">{lead.client_name}</p>
        {sourceIcon && <span className="text-xs flex-shrink-0">{sourceIcon}</span>}
      </div>

      {lead.phone && (
        <p className="text-xs text-gray-400 mb-1">{lead.phone}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          {lead.amount && (
            <span className="text-xs font-semibold text-violet-700">{formatMoney(lead.amount)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {lead.staff_name && (
            <span className="text-xs text-gray-400">{lead.staff_name.split(' ')[0]}</span>
          )}
          <span className={`text-xs ${days > 7 ? 'text-red-500' : days > 3 ? 'text-yellow-500' : 'text-gray-300'}`}>
            {days}д
          </span>
        </div>
      </div>

      {isOverdue && (
        <p className="text-xs text-red-500 mt-1">⚠ Просрочен контакт</p>
      )}
    </div>
  )
}
