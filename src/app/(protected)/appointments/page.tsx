'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Visit {
  id: string
  dikidi_id: string | null
  visit_date: string
  start_time: string | null
  service_name: string
  amount: number
  prepaid: number
  status: string | null
  notes: string | null
  client: {
    id: string
    name: string
    phone: string | null
  } | null
}

interface ClientOption {
  id: string
  name: string
  phone: string | null
  dikidi_id: string | null
}

interface ServiceOption {
  id: string
  name: string
  price: number
  duration_min: number
}

interface StaffOption {
  id: string
  name: string
  role: string
  dikidi_id: string | null
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  confirmed:  { label: 'Подтверждена', cls: 'badge-green' },
  completed:  { label: 'Завершена',    cls: 'bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full' },
  cancelled:  { label: 'Отменена',     cls: 'badge-red' },
  pending:    { label: 'Ожидание',     cls: 'bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full' },
  no_show:    { label: 'Не пришёл',   cls: 'bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full' },
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-BY', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-BY').format(n) + ' Br'
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM = {
  client_id: '',
  staff_id: '',
  service_name: '',
  visit_date: isoToday(),
  start_time: '',
  amount: '',
  prepaid: '',
  notes: '',
  push_to_dikidi: true,
}

export default function AppointmentsPage() {
  const supabase = createClient()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(isoToday())
  const [dateTo, setDateTo] = useState(addDays(isoToday(), 7))
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // New appointment form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [staff, setStaff] = useState<StaffOption[]>([])
  const [clientSearch, setClientSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('visits')
      .select(`
        id, dikidi_id, visit_date, start_time, service_name, amount, prepaid, status, notes,
        client:clients(id, name, phone)
      `)
      .gte('visit_date', dateFrom)
      .lte('visit_date', dateTo)
      .order('visit_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (data) setVisits(data as unknown as Visit[])
    setLoading(false)
  }, [dateFrom, dateTo, supabase])

  useEffect(() => { load() }, [load])

  // Load form options once
  useEffect(() => {
    async function loadOptions() {
      const [clientsRes, servicesRes, staffRes] = await Promise.all([
        supabase.from('clients').select('id, name, phone, dikidi_id').eq('is_active', true).order('name').limit(300),
        supabase.from('services').select('id, name, price, duration_min').eq('is_active', true).order('name'),
        supabase.from('staff').select('id, name, role, dikidi_id').eq('is_active', true).order('name'),
      ])
      setClients((clientsRes.data || []) as ClientOption[])
      setServices((servicesRes.data || []) as ServiceOption[])
      setStaff((staffRes.data || []) as StaffOption[])
    }
    loadOptions()
  }, [supabase])

  async function syncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/dikidi/sync', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setLastSync(`Синхронизировано: ${d.clients_synced} клиентов, ${d.visits_synced} визитов`)
        await load()
      } else {
        setLastSync('Ошибка: ' + (d.error || 'неизвестная'))
      }
    } catch {
      setLastSync('Ошибка подключения')
    } finally {
      setSyncing(false)
    }
  }

  async function changeStatus(visitId: string, status: string) {
    await supabase.from('visits').update({ status }).eq('id', visitId)
    setVisits(v => v.map(x => x.id === visitId ? { ...x, status } : x))
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: form.client_id,
          staff_id: form.staff_id || null,
          service_name: form.service_name,
          visit_date: form.visit_date,
          start_time: form.start_time || null,
          amount: form.amount ? parseFloat(form.amount) : 0,
          prepaid: form.prepaid ? parseFloat(form.prepaid) : 0,
          notes: form.notes || null,
          push_to_dikidi: form.push_to_dikidi,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveMsg('Ошибка: ' + (data.error || 'неизвестная'))
      } else {
        let msg = 'Запись создана'
        if (data.dikidi_id) msg += ' и добавлена в Dikidi'
        else if (data.dikidi_error) msg += ` (только в Восторг: ${data.dikidi_error})`
        setSaveMsg(msg)
        setForm({ ...EMPTY_FORM, visit_date: form.visit_date })
        await load()
        setTimeout(() => { setShowForm(false); setSaveMsg(null) }, 2000)
      }
    } catch {
      setSaveMsg('Ошибка подключения')
    } finally {
      setSaving(false)
    }
  }

  function handleServiceSelect(serviceId: string) {
    const svc = services.find(s => s.id === serviceId)
    if (svc) {
      setForm(f => ({ ...f, service_name: svc.name, amount: String(svc.price) }))
    }
  }

  // Группировка по дате
  const grouped: Record<string, Visit[]> = {}
  for (const v of visits) {
    if (!grouped[v.visit_date]) grouped[v.visit_date] = []
    grouped[v.visit_date].push(v)
  }
  const dates = Object.keys(grouped).sort()

  const todayVisits = visits.filter(v => v.visit_date === isoToday())
  const totalToday = todayVisits.reduce((s, v) => s + (v.amount || 0), 0)
  const confirmedToday = todayVisits.filter(v => v.status !== 'cancelled' && v.status !== 'no_show').length

  const filteredClients = clientSearch
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.phone || '').includes(clientSearch)
      ).slice(0, 10)
    : clients.slice(0, 10)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Расписание</h1>
          <p className="text-sm text-gray-500">Записи из Dikidi — онлайн и через администратора</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastSync && <span className="text-xs text-gray-400">{lastSync}</span>}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? '⏳ Синхронизация...' : '↻ Обновить из Dikidi'}
          </button>
          <button
            onClick={() => { setShowForm(true); setSaveMsg(null) }}
            className="btn-primary text-sm"
          >
            + Новая запись
          </button>
        </div>
      </div>

      {/* KPI сегодня */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Записей сегодня</p>
          <p className="text-2xl font-bold text-gray-900">{todayVisits.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Подтверждено</p>
          <p className="text-2xl font-bold text-violet-600">{confirmedToday}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Выручка (план сегодня)</p>
          <p className="text-2xl font-bold text-green-600">{formatMoney(totalToday)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Предоплат</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatMoney(todayVisits.reduce((s, v) => s + (v.prepaid || 0), 0))}
          </p>
        </div>
      </div>

      {/* Фильтр дат */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">С</label>
          <input type="date" className="input w-auto text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">по</label>
          <input type="date" className="input w-auto text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button onClick={() => { setDateFrom(isoToday()); setDateTo(addDays(isoToday(), 0)) }} className="btn-secondary text-sm">Сегодня</button>
        <button onClick={() => { setDateFrom(isoToday()); setDateTo(addDays(isoToday(), 6)) }} className="btn-secondary text-sm">Неделя</button>
        <button onClick={() => { setDateFrom(isoToday()); setDateTo(addDays(isoToday(), 29)) }} className="btn-secondary text-sm">Месяц</button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      ) : dates.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500 font-medium">Записей за выбранный период нет</p>
          <p className="text-sm text-gray-400 mt-1">Нажмите «Обновить из Dikidi» чтобы подтянуть актуальные данные</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className={`font-semibold capitalize ${date === isoToday() ? 'text-violet-700' : 'text-gray-700'}`}>
                  {date === isoToday() ? '📍 Сегодня — ' : ''}{formatDate(date)}
                </h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {grouped[date].length} записей
                </span>
                <span className="text-xs text-gray-400">
                  {formatMoney(grouped[date].filter(v => v.status !== 'cancelled').reduce((s, v) => s + v.amount, 0))}
                </span>
              </div>

              <div className="space-y-2">
                {grouped[date].map(visit => {
                  const st = STATUS_LABELS[visit.status || 'confirmed'] || STATUS_LABELS.confirmed
                  const isCancelled = visit.status === 'cancelled'
                  return (
                    <div
                      key={visit.id}
                      className={`card p-4 ${isCancelled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Время */}
                          <div className="text-center min-w-[44px]">
                            <p className="text-sm font-bold text-gray-900">
                              {visit.start_time || '—'}
                            </p>
                            {visit.dikidi_id && (
                              <p className="text-xs text-gray-300">Dikidi</p>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900">
                                {visit.client?.name || 'Клиент не указан'}
                              </p>
                              <span className={st.cls}>{st.label}</span>
                            </div>
                            {visit.client?.phone && (
                              <p className="text-xs text-gray-400">{visit.client.phone}</p>
                            )}
                            <p className="text-sm text-gray-600 mt-0.5">{visit.service_name}</p>
                            {visit.notes && (
                              <p className="text-xs text-gray-400 mt-1 italic">{visit.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-semibold text-gray-900">{formatMoney(visit.amount)}</p>
                          {visit.prepaid > 0 && (
                            <p className="text-xs text-green-600">Предоплата: {formatMoney(visit.prepaid)}</p>
                          )}
                          {/* Быстрое изменение статуса */}
                          {!isCancelled && (
                            <div className="flex gap-1 mt-2 justify-end flex-wrap">
                              {visit.status !== 'completed' && (
                                <button
                                  onClick={() => changeStatus(visit.id, 'completed')}
                                  className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                                >
                                  ✓ Завершена
                                </button>
                              )}
                              {visit.status !== 'no_show' && (
                                <button
                                  onClick={() => changeStatus(visit.id, 'no_show')}
                                  className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                                >
                                  Не пришёл
                                </button>
                              )}
                              <button
                                onClick={() => changeStatus(visit.id, 'cancelled')}
                                className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                              >
                                Отмена
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Подсказка про Dikidi webhook */}
      <div className="card mt-8 bg-blue-50 border-blue-200 max-w-2xl">
        <div className="card-body">
          <h3 className="font-semibold text-blue-800 mb-1">Автоматическая синхронизация</h3>
          <p className="text-sm text-blue-700 mb-2">
            Чтобы записи появлялись мгновенно — настройте webhook в Dikidi:
          </p>
          <p className="text-xs text-blue-600 mb-1">Dikidi → Настройки → API → Webhooks → URL:</p>
          <code className="text-xs bg-white px-2 py-1.5 rounded border border-blue-200 block font-mono break-all">
            https://resonant-bombolone-430790.netlify.app/api/webhooks/dikidi
          </code>
          <p className="text-xs text-blue-500 mt-1">
            Или используйте кнопку «Обновить из Dikidi» — она тянет последние 30 дней.
          </p>
        </div>
      </div>

      {/* ===== MODAL: Новая запись ===== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Новая запись</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={submitForm} className="p-5 space-y-4">

              {/* Клиент */}
              <div>
                <label className="label">Клиент *</label>
                <input
                  type="text"
                  className="input mb-1"
                  placeholder="Поиск по имени или телефону..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
                <select
                  className="input"
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  required
                >
                  <option value="">— выберите клиента —</option>
                  {filteredClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Услуга */}
              <div>
                <label className="label">Услуга *</label>
                <select
                  className="input mb-1"
                  onChange={e => handleServiceSelect(e.target.value)}
                  defaultValue=""
                >
                  <option value="">— выбрать из каталога —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.price} Br ({s.duration_min} мин)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="input"
                  placeholder="Или введите название вручную"
                  value={form.service_name}
                  onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
                  required
                />
              </div>

              {/* Мастер */}
              <div>
                <label className="label">Мастер</label>
                <select
                  className="input"
                  value={form.staff_id}
                  onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                >
                  <option value="">— без мастера —</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Дата и время */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Дата *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.visit_date}
                    onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Время</label>
                  <input
                    type="time"
                    className="input"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Сумма */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Сумма (Br)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Предоплата (Br)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={form.prepaid}
                    onChange={e => setForm(f => ({ ...f, prepaid: e.target.value }))}
                  />
                </div>
              </div>

              {/* Примечание */}
              <div>
                <label className="label">Примечание</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Пожелания, особенности..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Пуш в Dikidi */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.push_to_dikidi}
                  onChange={e => setForm(f => ({ ...f, push_to_dikidi: e.target.checked }))}
                  className="w-4 h-4 text-violet-600 rounded"
                />
                <span className="text-sm text-gray-600">Создать запись в Dikidi</span>
              </label>

              {saveMsg && (
                <p className={`text-sm rounded-lg p-3 ${saveMsg.startsWith('Ошибка') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {saveMsg}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Создаю...' : 'Создать запись'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
