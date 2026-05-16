'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface Lead {
  source: string
  status_id: string
  amount?: number
  created_at: string
}

interface LeadStatus {
  id: string
  name: string
  is_final: boolean
}

interface MarketingExpense {
  id: string
  amount: number
  source?: string
  date: string
  clicks?: number
  impressions?: number
  description?: string
}

interface ChannelStats {
  source: string
  leads: number
  converted: number
  revenue: number
  spend: number
  clicks: number
  impressions: number
  cpl: number
  cac: number
  cpc: number
  romi: number
  cr: number
}

interface ExpenseForm {
  date: string
  source: string
  amount: string
  clicks: string
  impressions: string
  description: string
}

const CHANNELS: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'instagram',     label: 'Instagram',       icon: '📸', color: '#E1306C' },
  { key: 'facebook',      label: 'Facebook Ads',    icon: '📘', color: '#1877F2' },
  { key: 'yandex_direct', label: 'Яндекс Директ',  icon: '🟡', color: '#FFCC00' },
  { key: 'vk',            label: 'VK Реклама',      icon: '💙', color: '#0077FF' },
  { key: 'google',        label: 'Google Ads',      icon: '🔵', color: '#4285F4' },
  { key: 'telegram',      label: 'Telegram Ads',    icon: '✈️', color: '#26A5E4' },
  { key: 'avito',         label: 'Авито',           icon: '🟢', color: '#00AAFF' },
  { key: '2gis',          label: '2ГИС',            icon: '📍', color: '#1DA462' },
  { key: 'dikidi',        label: 'Dikidi',          icon: '📅', color: '#7c3aed' },
  { key: 'referral',      label: 'Рекомендация',    icon: '🤝', color: '#16a34a' },
  { key: 'phone',         label: 'Звонок',          icon: '📞', color: '#6b7280' },
  { key: 'walk_in',       label: 'Зашёл сам',       icon: '🚶', color: '#92400e' },
  { key: 'other',         label: 'Другое',          icon: '📌', color: '#9ca3af' },
]

const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.key, c]))
const CHART_COLORS = CHANNELS.map(c => c.color)

const emptyForm = (): ExpenseForm => ({
  date: new Date().toISOString().split('T')[0],
  source: 'instagram',
  amount: '',
  clicks: '',
  impressions: '',
  description: '',
})

export default function MarketingPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [leads, setLeads] = useState<Lead[]>([])
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [expenses, setExpenses] = useState<MarketingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ExpenseForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01T00:00:00`
    const to = `${month}-31T23:59:59`

    const [leadsRes, statusesRes, expRes] = await Promise.all([
      supabase.from('leads').select('source, status_id, amount, created_at')
        .gte('created_at', from).lte('created_at', to),
      supabase.from('lead_statuses').select('id, name, is_final'),
      supabase.from('marketing_expenses').select('*')
        .gte('date', `${month}-01`).lte('date', `${month}-31`)
        .order('date', { ascending: false }),
    ])

    if (leadsRes.data) setLeads(leadsRes.data as Lead[])
    if (statusesRes.data) setStatuses(statusesRes.data as LeadStatus[])
    if (expRes.data) setExpenses(expRes.data as MarketingExpense[])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const finalStatusIds = new Set(statuses.filter(s => s.is_final).map(s => s.id))

  // Все каналы у которых есть лиды или расходы
  const activeSources = Array.from(new Set([
    ...leads.map(l => l.source || 'other'),
    ...expenses.map(e => e.source || 'other'),
  ]))

  const channelStats: ChannelStats[] = activeSources.map(source => {
    const channelLeads = leads.filter(l => (l.source || 'other') === source)
    const converted = channelLeads.filter(l => finalStatusIds.has(l.status_id))
    const revenue = converted.reduce((s, l) => s + (l.amount || 0), 0)
    const channelExp = expenses.filter(e => (e.source || 'other') === source)
    const spend = channelExp.reduce((s, e) => s + e.amount, 0)
    const clicks = channelExp.reduce((s, e) => s + (e.clicks || 0), 0)
    const impressions = channelExp.reduce((s, e) => s + (e.impressions || 0), 0)

    return {
      source,
      leads: channelLeads.length,
      converted: converted.length,
      revenue,
      spend,
      clicks,
      impressions,
      cpl: channelLeads.length > 0 && spend > 0 ? Math.round(spend / channelLeads.length) : 0,
      cac: converted.length > 0 && spend > 0 ? Math.round(spend / converted.length) : 0,
      cpc: clicks > 0 && spend > 0 ? Math.round(spend / clicks * 100) / 100 : 0,
      romi: spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : 0,
      cr: channelLeads.length > 0 ? Math.round((converted.length / channelLeads.length) * 100) : 0,
    }
  }).sort((a, b) => b.leads - a.leads)

  const totalLeads = leads.length
  const totalConverted = leads.filter(l => finalStatusIds.has(l.status_id)).length
  const totalRevenue = channelStats.reduce((s, c) => s + c.revenue, 0)
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0)
  const totalClicks = expenses.reduce((s, e) => s + (e.clicks || 0), 0)
  const conversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0
  const overallROI = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0
  const avgCPL = totalLeads > 0 && totalSpend > 0 ? Math.round(totalSpend / totalLeads) : 0

  const leadsChartData = channelStats.map(c => ({
    name: CHANNEL_MAP[c.source]?.label || c.source,
    Заявок: c.leads,
    Продаж: c.converted,
  }))

  const pieData = channelStats
    .filter(c => c.leads > 0)
    .map(c => ({ name: CHANNEL_MAP[c.source]?.label || c.source, value: c.leads }))

  const spendChartData = channelStats
    .filter(c => c.spend > 0)
    .map(c => ({ name: CHANNEL_MAP[c.source]?.label || c.source, Расходы: c.spend }))

  async function saveExpense() {
    if (!form.amount || !form.source || !form.date) return
    setSaving(true)

    const payload = {
      date: form.date,
      source: form.source,
      amount: parseFloat(form.amount),
      clicks: form.clicks ? parseInt(form.clicks) : 0,
      impressions: form.impressions ? parseInt(form.impressions) : 0,
      description: form.description || null,
    }

    if (editingId) {
      await supabase.from('marketing_expenses').update(payload).eq('id', editingId)
    } else {
      await supabase.from('marketing_expenses').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
    load()
  }

  function startEdit(exp: MarketingExpense) {
    setForm({
      date: exp.date,
      source: exp.source || 'other',
      amount: String(exp.amount),
      clicks: String(exp.clicks || ''),
      impressions: String(exp.impressions || ''),
      description: exp.description || '',
    })
    setEditingId(exp.id)
    setShowForm(true)
  }

  async function deleteExpense(id: string) {
    await supabase.from('marketing_expenses').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Маркетинговая аналитика</h1>
        <div className="flex gap-2">
          <a href="/marketing/ads" className="btn-secondary">
            📊 Объявления Meta
          </a>
          <input
            type="month"
            className="input"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()) }}
            className="btn-primary"
          >
            + Добавить расходы
          </button>
        </div>
      </div>

      <HelpPanel id="marketing" title="Как работает маркетинговая аналитика" items={[
        { icon: '💸', title: 'Расходы на рекламу', text: 'Добавляйте вручную кнопкой «+ Добавить расходы», или они подтянутся автоматически если подключены Facebook/Instagram в Настройки → Рекламные платформы.' },
        { icon: '📊', title: 'CPL — стоимость лида', text: 'Сумма расходов ÷ количество заявок из этого канала. Чем меньше — тем эффективнее реклама.' },
        { icon: '💰', title: 'CAC — стоимость клиента', text: 'Расходы ÷ количество оплативших клиентов. Показывает, во сколько обходится один новый клиент.' },
        { icon: '📈', title: 'ROMI — окупаемость', text: '(Выручка − Расходы) ÷ Расходы × 100%. Если больше 0% — реклама окупается. 200% — на каждый рубль расходов 2 рубля прибыли.' },
        { icon: '🖱️', title: 'CPC — цена клика', text: 'Расходы ÷ количество кликов. Берётся из данных рекламного кабинета при автосинхронизации.' },
        { icon: '📱', title: 'Объявления Meta', text: 'Кнопка «Объявления Meta» — детальная статистика по каждому объявлению Facebook и Instagram.' },
        { icon: '🔢', title: 'Откуда берутся заявки', text: 'Из раздела Воронка заявок. Укажите источник у каждой заявки (Instagram, Facebook и т.д.) — тогда сойдётся аналитика.' },
      ]} />

      {/* Форма добавления расходов */}
      {showForm && (
        <div className="card mb-6 border-violet-200 bg-violet-50">
          <div className="card-header">
            <h2 className="font-semibold">{editingId ? 'Редактировать расход' : 'Новый рекламный расход'}</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Дата</label>
                <input type="date" className="input" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Канал</label>
                <select className="input" value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {CHANNELS.map(ch => (
                    <option key={ch.key} value={ch.key}>{ch.icon} {ch.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Сумма расходов, Br</label>
                <input type="number" className="input" placeholder="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Кликов</label>
                <input type="number" className="input" placeholder="0" value={form.clicks}
                  onChange={e => setForm(f => ({ ...f, clicks: e.target.value }))} />
              </div>
              <div>
                <label className="label">Показов</label>
                <input type="number" className="input" placeholder="0" value={form.impressions}
                  onChange={e => setForm(f => ({ ...f, impressions: e.target.value }))} />
              </div>
              <div>
                <label className="label">Комментарий</label>
                <input type="text" className="input" placeholder="Описание кампании" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveExpense} disabled={saving} className="btn-primary">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <p className="metric-value">{totalLeads}</p>
          <p className="metric-label">Заявок за месяц</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-green-600">{conversionRate}%</p>
          <p className="metric-label">Конверсия в продажу</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-red-600">{formatMoney(totalSpend)}</p>
          <p className="metric-label">Рекламные расходы</p>
        </div>
        <div className="metric-card">
          <p className={`metric-value ${overallROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overallROI > 0 ? '+' : ''}{overallROI}%
          </p>
          <p className="metric-label">ROMI</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-violet-700">{formatMoney(avgCPL)}</p>
          <p className="metric-label">Средний CPL (цена заявки)</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{totalClicks.toLocaleString('ru-BY')}</p>
          <p className="metric-label">Кликов всего</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-orange-600">{totalConverted}</p>
          <p className="metric-label">Стало клиентами</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-violet-700">{formatMoney(totalRevenue)}</p>
          <p className="metric-label">Выручка с рекл. клиентов</p>
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Заявки по каналам</h2>
          </div>
          <div className="card-body">
            {leadsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Заявок" fill="#7c3aed" />
                  <Bar dataKey="Продаж" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm py-10 text-center">Нет данных — добавьте заявки в CRM</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Расходы по каналам</h2>
          </div>
          <div className="card-body">
            {spendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [formatMoney(Number(v)), 'Расходы']} />
                  <Bar dataKey="Расходы" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm py-10 text-center">Нет расходов — добавьте через кнопку выше</p>
            )}
          </div>
        </div>

        <div className="card col-span-2 md:col-span-1">
          <div className="card-header">
            <h2 className="font-semibold">Доля заявок по каналу</h2>
          </div>
          <div className="card-body flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                    dataKey="value" label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={true}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-sm">Нет данных</p>
            )}
          </div>
        </div>
      </div>

      {/* Таблица по каналам */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Эффективность каналов</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Канал</th>
                <th>Заявок</th>
                <th>Продаж</th>
                <th>CR</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>Клики</th>
                <th>CPL</th>
                <th>CAC</th>
                <th>CPC</th>
                <th>ROMI</th>
              </tr>
            </thead>
            <tbody>
              {channelStats.map(c => {
                const ch = CHANNEL_MAP[c.source]
                return (
                  <tr key={c.source}>
                    <td className="font-medium">
                      <span className="mr-1">{ch?.icon || '📌'}</span>
                      {ch?.label || c.source}
                    </td>
                    <td>{c.leads}</td>
                    <td className="text-green-600">{c.converted}</td>
                    <td>{c.cr}%</td>
                    <td className="font-semibold text-violet-700">{formatMoney(c.revenue)}</td>
                    <td className="text-red-600">{c.spend > 0 ? formatMoney(c.spend) : '—'}</td>
                    <td>{c.clicks > 0 ? c.clicks.toLocaleString('ru-BY') : '—'}</td>
                    <td>{c.cpl > 0 ? formatMoney(c.cpl) : '—'}</td>
                    <td>{c.cac > 0 ? formatMoney(c.cac) : '—'}</td>
                    <td>{c.cpc > 0 ? formatMoney(c.cpc) : '—'}</td>
                    <td className={c.spend > 0 ? (c.romi >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold') : ''}>
                      {c.spend > 0 ? `${c.romi > 0 ? '+' : ''}${c.romi}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {channelStats.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center text-gray-400 py-8">
                    Добавьте заявки в CRM и внесите рекламные расходы
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* История расходов */}
      {expenses.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">История расходов за {month}</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Канал</th>
                  <th>Сумма</th>
                  <th>Клики</th>
                  <th>Показы</th>
                  <th>Комментарий</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const ch = CHANNEL_MAP[exp.source || 'other']
                  return (
                    <tr key={exp.id}>
                      <td>{exp.date}</td>
                      <td>{ch?.icon || '📌'} {ch?.label || exp.source}</td>
                      <td className="font-semibold">{formatMoney(exp.amount)}</td>
                      <td>{exp.clicks ? exp.clicks.toLocaleString('ru-BY') : '—'}</td>
                      <td>{exp.impressions ? exp.impressions.toLocaleString('ru-BY') : '—'}</td>
                      <td className="text-gray-500 text-sm">{exp.description || '—'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(exp)}
                            className="text-xs text-violet-600 hover:underline">✏️</button>
                          <button onClick={() => deleteExpense(exp.id)}
                            className="text-xs text-red-500 hover:underline">🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Инфо об API интеграциях */}
      <div className="card mt-6 bg-blue-50 border-blue-200">
        <div className="card-body">
          <h3 className="font-semibold text-blue-800 mb-2">🔌 Автоматическая синхронизация</h3>
          <p className="text-sm text-blue-700 mb-3">
            Чтобы расходы, клики и показы подтягивались автоматически из рекламных кабинетов — подключите API в настройках.
          </p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.filter(ch => ['instagram','facebook','yandex_direct','vk','google','telegram'].includes(ch.key)).map(ch => (
              <span key={ch.key} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white border border-blue-200 text-blue-800">
                {ch.icon} {ch.label}
              </span>
            ))}
          </div>
          <a href="/settings/channels" className="mt-3 inline-block text-sm text-blue-700 font-medium hover:underline">
            → Перейти в настройки каналов
          </a>
        </div>
      </div>
    </div>
  )
}
