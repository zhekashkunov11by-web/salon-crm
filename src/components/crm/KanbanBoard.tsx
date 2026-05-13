'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { KanbanColumn } from './KanbanColumn'
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

interface KanbanBoardProps {
  statuses: LeadStatus[]
  leads: Lead[]
  onLeadMove: (leadId: string, newStatusId: string) => void
  onLeadClick: (lead: Lead) => void
  onAddLead: (statusId: string) => void
}

export function KanbanBoard({ statuses, leads, onLeadMove, onLeadClick, onAddLead }: KanbanBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find(l => l.id === event.active.id)
    if (lead) setActiveLead(lead)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if over a column (status)
    const overStatus = statuses.find(s => s.id === overId)
    if (overStatus) {
      const activeLead = leads.find(l => l.id === activeId)
      if (activeLead && activeLead.status_id !== overId) {
        onLeadMove(activeId, overId)
      }
      return
    }

    // Check if over another card — move to same column
    const overLead = leads.find(l => l.id === overId)
    if (overLead) {
      const activeLead = leads.find(l => l.id === activeId)
      if (activeLead && activeLead.status_id !== overLead.status_id) {
        onLeadMove(activeId, overLead.status_id)
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null)
    const { active, over } = event
    if (!over) return
    // Final position already set in dragOver
    const activeId = active.id as string
    const overId = over.id as string
    const overStatus = statuses.find(s => s.id === overId)
    if (overStatus) {
      onLeadMove(activeId, overId)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {statuses.map(status => {
          const columnLeads = leads.filter(l => l.status_id === status.id)
          return (
            <SortableContext
              key={status.id}
              items={columnLeads.map(l => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                status={status}
                leads={columnLeads}
                onLeadClick={onLeadClick}
                onAddLead={onAddLead}
              />
            </SortableContext>
          )
        })}
      </div>

      <DragOverlay>
        {activeLead && (
          <LeadCard lead={activeLead} onClick={() => {}} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  )
}
