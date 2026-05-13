'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

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
  amount: number
  source?: string
  date: string
}

interface ChannelStats {
  source: string
  leads: number
  converted: number
  revenue: number
  spend: number
  cpl: number
  cac: number
  romi: number
}

const SOURCE_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  vk: 'ВКонтакте',
  avito: 'Авито',
  '2gis': '2ГИС',
  yandex: 'Яндекс',
  google: 'Google',
  dikidi: 'Dikidi',
  phone: 'Звонок',
  referral: 'Рекомендация',
  walk_in: 'Зашёл сам',
  make: 'Make.com',
}

const CHART_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#be185d', '#65a30d']

export default function MarketingPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [leads, setLeads] = useState<Lead[]>([])
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [expenses, setExpenses] = useState<MarketingExpense[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01T00:00:00`
    const to = `${month}-31T23:59:59`

    const [leadsRes, statusesRes, expRes] = await Promise.all([
      supabase.from('leads').select('source, status_id, amount, created_at')
        .gte('created_at', from).lte('created_at', to),
      supabase.from('lead_statuses').select('id, name, is_final'),
      supabase.from('marketing_expenses').select('amount, source, date')
        .gte('date', `${month}-01`).lte('date', `${month}-31`),
    ])

    if (leadsRes.data) setLeads(leadsRes.data as Lead[])
    if (statusesRes.data) setStatuses(statusesRes.data as LeadStatus[])
    if (expRes.data) setExpenses(expRes.data as MarketingExpense[])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const finalStatusIds = new Set(statuses.filter(s => s.is_final).map(s => s.id))

  // Calculate channel stats
  const allSources = Array.from(new Set(leads.map(l => l.source || 'unknown')))
  const channelStats: ChannelStats[] = allSources.map(source => {
    const channelLeads = leads.filter(l => (l.source || 'unknown') === source)
    const converted = channelLeads.filter(l => finalStatusIds.has(l.status_id))
    const revenue = converted.reduce((s, l) => s + (l.amount || 0), 0)
    const spend = expenses
      .filter(e => e.source === source || (!e.source && source === 'unknown'))
      .reduce((s, e) => s + e.amount, 0)

    return {
      source,
      leads: channelLeads.length,
      converted: converted.length,
      revenue,
      spend,
      cpl: channelLeads.length > 0 && spend > 0 ? Math.round(spend / channelLeads.length) : 0,
      cac: converted.length > 0 && spend > 0 ? Math.round(spend / converted.length) : 0,
      romi: spend > 0 ? Math.round(((revenue - spend) / spend) * 100) : 0,
    }
  })

  const totalLeads = leads.length
  const totalConverted = leads.filter(l => finalStatusIds.has(l.status_id)).length
  const totalRevenue = channelStats.reduce((s, c) => s + c.revenue, 0)
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0)
  const conversionRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0
  const overallROI = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0

  // Chart data
  const leadsChartData = channelStats
    .sort((a, b) => b.leads - a.leads)
    .map(c => ({ name: SOURCE_NAMES[c.source] || c.source, leads: c.leads, converted: c.converted }))

  const pieData = channelStats
    .filter(c => c.leads > 0)
    .map(c => ({ name: SOURCE_NAMES[c.source] || c.source, value: c.leads }))

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Маркетинговая аналитика</h1>
        <input
          type="month"
          className="input"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      {/* KPIs */}
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
          <p className="metric-label">Маркетинговые расходы</p>
        </div>
        <div className="metric-card">
          <p className={`metric-value ${overallROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overallROI}%
          </p>
          <p className="metric-label">ROMI</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Заявки по каналам</h2>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#7c3aed" name="Заявок" />
                <Bar dataKey="converted" fill="#16a34a" name="Продаж" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Распределение заявок</h2>
          </div>
          <div className="card-body flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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

      {/* Channel detail table */}
      <div className="card">
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
                <th>Конверсия</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>CPL</th>
                <th>CAC</th>
                <th>ROMI</th>
              </tr>
            </thead>
            <tbody>
              {channelStats
                .sort((a, b) => b.leads - a.leads)
                .map(c => (
                  <tr key={c.source}>
                    <td className="font-medium">{SOURCE_NAMES[c.source] || c.source}</td>
                    <td>{c.leads}</td>
                    <td className="text-green-600">{c.converted}</td>
                    <td>
                      {c.leads > 0 ? Math.round((c.converted / c.leads) * 100) : 0}%
                    </td>
                    <td className="font-semibold text-violet-700">{formatMoney(c.revenue)}</td>
                    <td className="text-red-600">{c.spend > 0 ? formatMoney(c.spend) : '—'}</td>
                    <td>{c.cpl > 0 ? formatMoney(c.cpl) : '—'}</td>
                    <td>{c.cac > 0 ? formatMoney(c.cac) : '—'}</td>
                    <td className={c.romi >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {c.spend > 0 ? `${c.romi}%` : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
