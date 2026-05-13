'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { ClientCard } from '@/components/crm/ClientCard'

interface LeadStatus {
  id: string
  name: string
  color: string
  sort_order: number
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
  staff_id?: string
  staff_name?: string
  notes?: string
  client_id?: string
}

interface Staff {
  id: string
  name: string
}

export default function CrmPage() {
  const supabase = createClient()
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addStatusId, setAddStatusId] = useState('')
  const [addForm, setAddForm] = useState({ client_name: '', phone: '', source: '', amount: '' })
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    const [statusesRes, leadsRes, staffRes] = await Promise.all([
      supabase.from('lead_statuses').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('leads').select('*, staff(name)').order('created_at', { ascending: false }),
      supabase.from('staff').select('id, name').eq('is_active', true).order('name'),
    ])

    if (statusesRes.data) setStatuses(statusesRes.data as LeadStatus[])
    if (leadsRes.data) {
      const mapped = leadsRes.data.map((l: Lead & { staff?: { name: string } }) => ({
        ...l,
        staff_name: l.staff?.name,
      }))
      setLeads(mapped as Lead[])
    }
    if (staffRes.data) setStaff(staffRes.data as Staff[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleLeadMove(leadId: string, newStatusId: string) {
    // Optimistic update
    setLeads(ls => ls.map(l => l.id === leadId ? { ...l, status_id: newStatusId } : l))
    await supabase.from('leads').update({ status_id: newStatusId }).eq('id', leadId)
  }

  async function handleAddLead() {
    if (!addForm.client_name.trim()) return alert('Введите имя')
    const { data, error } = await supabase.from('leads').insert({
      client_name: addForm.client_name.trim(),
      phone: addForm.phone || null,
      source: addForm.source || null,
      amount: addForm.amount ? parseFloat(addForm.amount) : null,
      status_id: addStatusId,
    }).select().single()
    if (error) return alert('Ошибка: ' + error.message)
    if (data) {
      setLeads(ls => [data as Lead, ...ls])
      setAddForm({ client_name: '', phone: '', source: '', amount: '' })
      setShowAddForm(false)
    }
  }

  async function handleDeleteLead(leadId: string) {
    await supabase.from('leads').delete().eq('id', leadId)
    setLeads(ls => ls.filter(l => l.id !== leadId))
    setSelectedLead(null)
  }

  function openAddForm(statusId: string) {
    setAddStatusId(statusId)
    setShowAddForm(true)
  }

  const filteredLeads = filter
    ? leads.filter(l =>
        l.client_name.toLowerCase().includes(filter.toLowerCase()) ||
        (l.phone || '').includes(filter)
      )
    : leads

  const totalAmount = leads.reduce((s, l) => s + (l.amount || 0), 0)
  const newLeads = leads.filter(l => {
    const status = statuses.find(s => s.id === l.status_id)
    return status && status.sort_order === 1
  }).length

  if (loading) return <div className="skeleton h-screen w-full" />

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">Воронка заявок</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {leads.length} заявок · Потенциал: {new Intl.NumberFormat('ru-BY').format(totalAmount)} Br · Новых: {newLeads}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input max-w-xs text-sm"
            placeholder="Поиск по имени/телефону..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <button
            onClick={() => {
              const firstStatus = statuses[0]
              if (firstStatus) openAddForm(firstStatus.id)
            }}
            className="btn-primary"
          >
            + Новая заявка
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto">
        <KanbanBoard
          statuses={statuses}
          leads={filteredLeads}
          onLeadMove={handleLeadMove}
          onLeadClick={setSelectedLead}
          onAddLead={openAddForm}
        />
      </div>

      {/* Add Lead Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold">Новая заявка</h2>
              <button onClick={() => setShowAddForm(false)} className="btn-ghost btn-sm">✕</button>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="label">Имя клиента *</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="Иванова Мария"
                  value={addForm.client_name}
                  onChange={e => setAddForm(f => ({ ...f, client_name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddLead()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Телефон</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+7 (999) 000-00-00"
                    value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Источник</label>
                  <select
                    className="input"
                    value={addForm.source}
                    onChange={e => setAddForm(f => ({ ...f, source: e.target.value }))}
                  >
                    <option value="">— выберите —</option>
                    <option value="instagram">Instagram</option>
                    <option value="vk">ВКонтакте</option>
                    <option value="avito">Авито</option>
                    <option value="2gis">2ГИС</option>
                    <option value="yandex">Яндекс</option>
                    <option value="dikidi">Dikidi</option>
                    <option value="phone">Звонок</option>
                    <option value="referral">Рекомендация</option>
                    <option value="walk_in">Зашёл сам</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Сумма, Br</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={addForm.amount}
                  onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Статус</label>
                <select
                  className="input"
                  value={addStatusId}
                  onChange={e => setAddStatusId(e.target.value)}
                >
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddLead} className="btn-primary">Добавить</button>
                <button onClick={() => setShowAddForm(false)} className="btn-secondary">Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead detail panel */}
      {selectedLead && (
        <ClientCard
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={newStatusId => {
            setLeads(ls => ls.map(l => l.id === selectedLead.id ? { ...l, status_id: newStatusId } : l))
          }}
          statuses={statuses}
          staff={staff}
          onDelete={handleDeleteLead}
        />
      )}
    </div>
  )
}
