'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate, daysSince, churnRisk } from '@/lib/utils/format'

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
  notes?: string
  client_id?: string
}

interface ClientCardProps {
  lead: Lead
  onClose: () => void
  onStatusChange: (statusId: string) => void
  statuses: Array<{ id: string; name: string; color: string }>
  staff: Array<{ id: string; name: string }>
  onDelete: (leadId: string) => void
}

interface Visit {
  id: string
  visit_date: string
  service_name: string
  amount: number
  prepaid: number
  status: string
}

interface Task {
  id: string
  title: string
  due_date?: string
  is_done: boolean
  created_at: string
}

interface Consent {
  id: string
  type: string
  signed_at: string
  valid_until?: string
}

const TABS = [
  { key: 'info', label: 'Основное' },
  { key: 'visits', label: 'Визиты' },
  { key: 'tasks', label: 'Задачи' },
  { key: 'consents', label: 'Согласия' },
  { key: 'analytics', label: 'Аналитика' },
]

export function ClientCard({ lead, onClose, onStatusChange, statuses, staff, onDelete }: ClientCardProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('info')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_name: lead.client_name || '',
    phone: lead.phone || '',
    source: lead.source || '',
    amount: lead.amount ? String(lead.amount) : '',
    notes: lead.notes || '',
    next_contact_at: lead.next_contact_at ? lead.next_contact_at.split('T')[0] : '',
    staff_id: lead.staff_id || '',
    status_id: lead.status_id,
  })

  // Client-linked data
  const [visits, setVisits] = useState<Visit[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [newTask, setNewTask] = useState('')
  const [clientData, setClientData] = useState<{
    id?: string
    birthday?: string
    email?: string
    last_visit_date?: string
    total_revenue?: number
    visits_count?: number
    avg_check?: number
  }>({})

  useEffect(() => {
    if (lead.client_id) {
      loadClientData(lead.client_id)
    } else if (lead.phone) {
      findClientByPhone(lead.phone)
    }
  }, [lead.id])

  async function findClientByPhone(phone: string) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()
    if (data) {
      setClientData(data)
      loadVisits(data.id)
      loadTasks(data.id)
      loadConsents(data.id)
    }
  }

  async function loadClientData(clientId: string) {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
    if (data) setClientData(data)
    loadVisits(clientId)
    loadTasks(clientId)
    loadConsents(clientId)
  }

  async function loadVisits(clientId: string) {
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', clientId)
      .order('visit_date', { ascending: false })
      .limit(20)
    if (data) setVisits(data as Visit[])
  }

  async function loadTasks(clientId: string) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (data) setTasks(data as Task[])
  }

  async function loadConsents(clientId: string) {
    const { data } = await supabase
      .from('client_consents')
      .select('*')
      .eq('client_id', clientId)
      .order('signed_at', { ascending: false })
    if (data) setConsents(data as Consent[])
  }

  async function handleSave() {
    setSaving(true)
    const updates: Record<string, unknown> = {
      client_name: form.client_name,
      phone: form.phone || null,
      source: form.source || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      notes: form.notes || null,
      next_contact_at: form.next_contact_at || null,
      staff_id: form.staff_id || null,
      status_id: form.status_id,
    }
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id)
    setSaving(false)
    if (error) return alert('Ошибка: ' + error.message)
    if (form.status_id !== lead.status_id) {
      onStatusChange(form.status_id)
    }
    onClose()
  }

  async function addTask() {
    if (!newTask.trim()) return
    if (!clientData.id) {
      alert('Сначала найдите или создайте клиента')
      return
    }
    const { data } = await supabase.from('tasks').insert({
      client_id: clientData.id,
      lead_id: lead.id,
      title: newTask.trim(),
      is_done: false,
    }).select().single()
    if (data) {
      setTasks(t => [data as Task, ...t])
      setNewTask('')
    }
  }

  async function toggleTask(taskId: string, is_done: boolean) {
    await supabase.from('tasks').update({ is_done }).eq('id', taskId)
    setTasks(t => t.map(task => task.id === taskId ? { ...task, is_done } : task))
  }

  async function addConsent(type: string) {
    if (!clientData.id) return
    const { data } = await supabase.from('client_consents').insert({
      client_id: clientData.id,
      type,
      signed_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single()
    if (data) setConsents(c => [data as Consent, ...c])
  }

  const totalRevenue = visits.reduce((s, v) => s + (v.amount || 0), 0)
  const avgCheck = visits.length ? totalRevenue / visits.length : 0
  const lastVisit = visits[0]?.visit_date
  const risk = lastVisit ? churnRisk(lastVisit) : 'safe'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">{lead.client_name}</h2>
            <p className="text-xs text-gray-400">
              Заявка #{lead.id.slice(0, 8)} · {daysSince(lead.created_at)} дн. назад
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm('Удалить заявку?')) onDelete(lead.id) }}
              className="btn-ghost btn-sm text-red-500"
            >✕</button>
            <button onClick={onClose} className="btn-ghost btn-sm">← Закрыть</button>
          </div>
        </div>

        {/* Status selector */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1 flex-wrap">
            {statuses.map(s => (
              <button
                key={s.id}
                onClick={() => setForm(f => ({ ...f, status_id: s.id }))}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  form.status_id === s.id
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-sm py-3 px-3 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-violet-600 text-violet-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key === 'tasks' && tasks.filter(t => !t.is_done).length > 0 && (
                <span className="ml-1 badge-red text-xs">{tasks.filter(t => !t.is_done).length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* TAB: Info */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="label">Имя *</label>
                <input
                  className="input"
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Телефон</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Источник</label>
                  <select
                    className="input"
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  >
                    <option value="">— не выбран —</option>
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
                <div>
                  <label className="label">Сумма, ₽</label>
                  <input
                    type="number"
                    className="input"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ответственный</label>
                  <select
                    className="input"
                    value={form.staff_id}
                    onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  >
                    <option value="">— не назначен —</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Следующий контакт</label>
                  <input
                    type="date"
                    className="input"
                    value={form.next_contact_at}
                    onChange={e => setForm(f => ({ ...f, next_contact_at: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Заметки</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Особые пожелания, аллергии, история общения..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button onClick={onClose} className="btn-secondary">Отмена</button>
              </div>
            </div>
          )}

          {/* TAB: Visits */}
          {activeTab === 'visits' && (
            <div>
              {visits.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Визитов пока нет</p>
              ) : (
                <div className="space-y-2">
                  {visits.map(v => (
                    <div key={v.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{v.service_name}</p>
                          <p className="text-xs text-gray-400">{formatDate(v.visit_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-violet-700">{formatMoney(v.amount)}</p>
                          {v.prepaid > 0 && (
                            <p className="text-xs text-gray-400">предоплата: {formatMoney(v.prepaid)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Tasks */}
          {activeTab === 'tasks' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  className="input flex-1"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Новая задача..."
                />
                <button onClick={addTask} className="btn-primary btn-sm">+</button>
              </div>
              <div className="space-y-2">
                {tasks.map(task => (
                  <label key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={task.is_done}
                      onChange={e => toggleTask(task.id, e.target.checked)}
                      className="mt-0.5 accent-violet-600"
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${task.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-gray-400">{formatDate(task.due_date)}</p>
                      )}
                    </div>
                  </label>
                ))}
                {tasks.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Задач нет</p>
                )}
              </div>
            </div>
          )}

          {/* TAB: Consents */}
          {activeTab === 'consents' && (
            <div>
              <div className="flex gap-2 flex-wrap mb-4">
                {['Обработка персональных данных', 'Согласие на процедуру', 'Анестезия', 'Фото/видео'].map(type => (
                  <button
                    key={type}
                    onClick={() => addConsent(type)}
                    className="btn-secondary btn-sm"
                  >+ {type}</button>
                ))}
              </div>
              <div className="space-y-2">
                {consents.map(c => (
                  <div key={c.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.type}</p>
                      <p className="text-xs text-gray-400">
                        Подписано: {formatDate(c.signed_at)}
                        {c.valid_until && ` · До: ${formatDate(c.valid_until)}`}
                      </p>
                    </div>
                    <span className="badge-green">✓ Подписано</span>
                  </div>
                ))}
                {consents.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Согласий нет</p>
                )}
              </div>
            </div>
          )}

          {/* TAB: Analytics */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="metric-card">
                  <p className="metric-value">{formatMoney(totalRevenue)}</p>
                  <p className="metric-label">Суммарная выручка</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">{visits.length}</p>
                  <p className="metric-label">Визитов всего</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">{formatMoney(avgCheck)}</p>
                  <p className="metric-label">Средний чек</p>
                </div>
                <div className="metric-card">
                  <p className="metric-value">{lastVisit ? `${daysSince(lastVisit)} дн.` : '—'}</p>
                  <p className="metric-label">С последнего визита</p>
                </div>
              </div>

              {lastVisit && (
                <div className={`p-3 rounded-lg border ${
                  risk === 'danger' ? 'bg-red-50 border-red-200' :
                  risk === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    risk === 'danger' ? 'text-red-700' :
                    risk === 'warning' ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {risk === 'danger' ? '⚠ Высокий риск оттока — последний визит более 60 дней назад' :
                     risk === 'warning' ? '⏰ Средний риск — последний визит более 30 дней назад' :
                     '✓ Активный клиент'}
                  </p>
                </div>
              )}

              {clientData.birthday && (
                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <p className="text-sm text-gray-500">День рождения</p>
                  <p className="font-medium">{formatDate(clientData.birthday)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
