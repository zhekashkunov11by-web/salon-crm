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

export default function AppointmentsPage() {
  const supabase = createClient()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(isoToday())
  const [dateTo, setDateTo] = useState(addDays(isoToday(), 7))
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Расписание</h1>
          <p className="text-sm text-gray-500">Записи из Dikidi — онлайн и через администратора</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-xs text-gray-400">{lastSync}</span>}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? '⏳ Синхронизация...' : '↻ Обновить из Dikidi'}
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
    </div>
  )
}
