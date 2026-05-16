'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate, daysSince, churnRisk } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface Client {
  id: string
  code: string
  name: string
  phone?: string
  email?: string
  source?: string
  birthday?: string
  last_visit_date?: string
  total_revenue?: number
  visits_count?: number
  is_active: boolean
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  vk: 'ВКонтакте',
  avito: 'Авито',
  '2gis': '2ГИС',
  yandex: 'Яндекс',
  dikidi: 'Dikidi',
  phone: 'Звонок',
  referral: 'Рекомендация',
  walk_in: 'Зашёл сам',
}

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState<'all' | 'safe' | 'warning' | 'danger'>('all')
  const [selected, setSelected] = useState<Client | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name')
    if (data) setClients(data as Client[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.code || '').toLowerCase().includes(search.toLowerCase())

    const risk = c.last_visit_date ? churnRisk(c.last_visit_date) : 'danger'
    const matchRisk = filterRisk === 'all' || risk === filterRisk || (filterRisk === 'danger' && !c.last_visit_date)

    return matchSearch && matchRisk
  })

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">База клиентов</h1>
        <p className="text-sm text-gray-500 self-center">{clients.length} клиентов</p>
      </div>

      <HelpPanel id="clients" title="Как работает база клиентов" items={[
        { icon: '🔍', title: 'Поиск', text: 'Ищите по имени или телефону. Красная строка — клиент не приходил больше 60 дней (риск потери).' },
        { icon: '📅', title: 'Последний визит', text: 'Дата обновляется автоматически при внесении отчёта дня. Цвет показывает давность визита.' },
        { icon: '💰', title: 'Выручка', text: 'Общая сумма всех оплат клиента. Считается из отчётов дня.' },
        { icon: '📌', title: 'Источник', text: 'Откуда пришёл клиент — учитывается в маркетинговой аналитике для расчёта стоимости привлечения.' },
        { icon: '🎂', title: 'День рождения', text: 'Укажите дату — можно использовать для поздравительных рассылок и персональных скидок.' },
        { icon: '➕', title: 'Добавление клиента', text: 'Нажмите «+ Клиент», введите имя и телефон. Остальные поля необязательны.' },
      ]} />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          className="input max-w-sm"
          placeholder="Поиск по имени, телефону, коду..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'Все' },
            { key: 'safe', label: '✓ Активные' },
            { key: 'warning', label: '⚠ В зоне риска' },
            { key: 'danger', label: '✕ Потерянные' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterRisk(f.key as typeof filterRisk)}
              className={filterRisk === f.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Client table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Источник</th>
                <th>Визитов</th>
                <th>Выручка</th>
                <th>Последний визит</th>
                <th>Риск</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const risk = c.last_visit_date ? churnRisk(c.last_visit_date) : 'danger'
                const riskBadge = {
                  safe: <span className="badge-green">Активный</span>,
                  warning: <span className="badge-yellow">В риске</span>,
                  danger: <span className="badge-red">Потерян</span>,
                }[risk]

                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  >
                    <td className="text-xs text-gray-400 font-mono">{c.code}</td>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-gray-500">{c.phone || '—'}</td>
                    <td className="text-xs text-gray-400">{SOURCE_LABELS[c.source || ''] || c.source || '—'}</td>
                    <td>{c.visits_count || 0}</td>
                    <td className="font-semibold text-violet-700">{formatMoney(c.total_revenue || 0)}</td>
                    <td className="text-gray-500">
                      {c.last_visit_date ? (
                        <span title={formatDate(c.last_visit_date)}>
                          {daysSince(c.last_visit_date)} дн. назад
                        </span>
                      ) : '—'}
                    </td>
                    <td>{riskBadge}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">
                    {search ? 'Ничего не найдено' : 'База клиентов пуста'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client detail side panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelected(null)}>
          <div
            className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="btn-ghost btn-sm">✕</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div>
                <p className="label">Код клиента</p>
                <p className="font-mono text-gray-600">{selected.code}</p>
              </div>
              {selected.phone && (
                <div>
                  <p className="label">Телефон</p>
                  <p>{selected.phone}</p>
                </div>
              )}
              {selected.email && (
                <div>
                  <p className="label">Email</p>
                  <p>{selected.email}</p>
                </div>
              )}
              {selected.birthday && (
                <div>
                  <p className="label">День рождения</p>
                  <p>{formatDate(selected.birthday)}</p>
                </div>
              )}
              <div>
                <p className="label">Источник</p>
                <p>{SOURCE_LABELS[selected.source || ''] || selected.source || 'Не указан'}</p>
              </div>
              <hr className="border-gray-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Визитов</p>
                  <p className="font-bold text-lg">{selected.visits_count || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Выручка</p>
                  <p className="font-bold text-violet-700">{formatMoney(selected.total_revenue || 0)}</p>
                </div>
              </div>
              {selected.last_visit_date && (
                <div>
                  <p className="label">Последний визит</p>
                  <p>{formatDate(selected.last_visit_date)} ({daysSince(selected.last_visit_date)} дн. назад)</p>
                </div>
              )}
              <div>
                <p className="label">В базе с</p>
                <p>{formatDate(selected.created_at)}</p>
              </div>
              <hr className="border-gray-100" />
              <a href="/crm" className="btn-primary btn-sm w-full text-center block">
                Открыть в CRM →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
