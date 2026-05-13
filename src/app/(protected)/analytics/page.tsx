'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, daysSince, formatMonth } from '@/lib/utils/format'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface DailyReport {
  date: string
  revenue_cash: number
  revenue_card: number
  revenue_online: number
  clients_count: number
  new_clients_count: number
  avg_check: number
}

interface Client {
  id: string
  created_at: string
  last_visit_date?: string
  total_revenue?: number
  visits_count?: number
  source?: string
}

interface Visit {
  visit_date: string
  amount: number
  service_name: string
}

const MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const KPI_COLORS = {
  revenue: '#7c3aed',
  clients: '#2563eb',
  check: '#059669',
  new: '#d97706',
}

function KpiCard({
  label, value, prev, unit = '', icon, color,
}: {
  label: string; value: number; prev: number; unit?: string
  icon: string; color: string
}) {
  const diff = prev > 0 ? Math.round(((value - prev) / prev) * 100) : 0
  const isUp = diff >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {unit === 'money' ? formatMoney(value) : value.toLocaleString('ru-BY')}
          </p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
      {prev > 0 && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(diff)}%
          </span>
          <span className="text-xs text-gray-400">vs прошлый месяц</span>
        </div>
      )}
      {prev === 0 && <p className="text-xs text-gray-400">Нет данных за прошлый период</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const load = useCallback(async () => {
    setLoading(true)

    // Текущий месяц
    const from = `${month}-01`
    const to = `${month}-31`

    // Прошлый месяц
    const [y, m] = month.split('-').map(Number)
    const prevDate = new Date(y, m - 2, 1)
    const prevMonth = prevDate.toISOString().slice(0, 7)
    const prevFrom = `${prevMonth}-01`
    const prevTo = `${prevMonth}-31`

    // 12 месяцев назад для тренда
    const trend12From = new Date(y, m - 13, 1).toISOString().slice(0, 10)

    const [curReports, prevReports, allReports, clientsRes, curVisits] = await Promise.all([
      supabase.from('daily_reports').select('*').gte('date', from).lte('date', to).order('date'),
      supabase.from('daily_reports').select('*').gte('date', prevFrom).lte('date', prevTo),
      supabase.from('daily_reports').select('date,revenue_cash,revenue_card,revenue_online,clients_count,new_clients_count').gte('date', trend12From).order('date'),
      supabase.from('clients').select('id, created_at, last_visit_date, total_revenue, visits_count, source'),
      supabase.from('visits').select('visit_date, amount, service_name').gte('visit_date', from).lte('visit_date', to),
    ])

    setReports(allReports.data as DailyReport[] || [])
    setClients(clientsRes.data as Client[] || [])
    setVisits(curVisits.data as Visit[] || [])

    // Текущий месяц KPIs
    const cur = curReports.data || []
    const prev = prevReports.data || []

    const curRevenue = cur.reduce((s, r) => s + (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0), 0)
    const prevRevenue = prev.reduce((s, r) => s + (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0), 0)
    const curClients = cur.reduce((s, r) => s + (r.clients_count || 0), 0)
    const prevClients = prev.reduce((s, r) => s + (r.clients_count || 0), 0)
    const curNewClients = cur.reduce((s, r) => s + (r.new_clients_count || 0), 0)
    const prevNewClients = prev.reduce((s, r) => s + (r.new_clients_count || 0), 0)
    const curAvgCheck = curClients > 0 ? Math.round(curRevenue / curClients) : 0
    const prevAvgCheck = prevClients > 0 ? Math.round(prevRevenue / prevClients) : 0

    setKpis({ curRevenue, prevRevenue, curClients, prevClients, curNewClients, prevNewClients, curAvgCheck, prevAvgCheck })
    setLoading(false)
  }, [month])

  const [kpis, setKpis] = useState({
    curRevenue: 0, prevRevenue: 0,
    curClients: 0, prevClients: 0,
    curNewClients: 0, prevNewClients: 0,
    curAvgCheck: 0, prevAvgCheck: 0,
  })

  useEffect(() => { load() }, [load])

  // График тренда по месяцам (12 мес.)
  const monthlyTrend = (() => {
    const map: Record<string, { revenue: number; clients: number; new_clients: number }> = {}
    reports.forEach(r => {
      const key = r.date.slice(0, 7)
      if (!map[key]) map[key] = { revenue: 0, clients: 0, new_clients: 0 }
      map[key].revenue += (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0)
      map[key].clients += r.clients_count || 0
      map[key].new_clients += r.new_clients_count || 0
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => ({
        month: MONTHS_SHORT[parseInt(key.split('-')[1]) - 1],
        Выручка: Math.round(v.revenue),
        Клиентов: v.clients,
        Новых: v.new_clients,
      }))
  })()

  // Дневная выручка текущего месяца
  const dailyRevenue = (() => {
    const curMonthReports = reports.filter(r => r.date.slice(0, 7) === month)
    return curMonthReports.map(r => ({
      day: parseInt(r.date.slice(-2)),
      Выручка: (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0),
      Нал: r.revenue_cash || 0,
      Карта: r.revenue_card || 0,
      Онлайн: r.revenue_online || 0,
    }))
  })()

  // Сегментация клиентов
  const segments = [
    { label: 'Активные', color: '#16a34a', days: '< 30 дней', count: 0 },
    { label: 'В зоне риска', color: '#d97706', days: '30–60 дней', count: 0 },
    { label: 'Потерянные', color: '#dc2626', days: '> 60 дней', count: 0 },
    { label: 'Без визитов', color: '#9ca3af', days: 'нет визитов', count: 0 },
  ]
  clients.forEach(c => {
    if (!c.last_visit_date) segments[3].count++
    else {
      const d = daysSince(c.last_visit_date)
      if (d < 30) segments[0].count++
      else if (d <= 60) segments[1].count++
      else segments[2].count++
    }
  })
  const pieData = segments.filter(s => s.count > 0).map(s => ({ name: s.label, value: s.count, color: s.color }))

  // Топ услуг
  const serviceMap: Record<string, { revenue: number; count: number }> = {}
  visits.forEach(v => {
    const n = v.service_name || 'Без услуги'
    if (!serviceMap[n]) serviceMap[n] = { revenue: 0, count: 0 }
    serviceMap[n].revenue += v.amount
    serviceMap[n].count++
  })
  const topServices = Object.entries(serviceMap)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 8)
    .map(([name, data]) => ({ name, ...data }))

  const maxServiceRevenue = topServices[0]?.revenue || 1

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Аналитика</h1>
          <p className="text-sm text-gray-500">{formatMonth(month)}</p>
        </div>
        <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {/* KPI карточки — как в Power BI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Выручка" value={kpis.curRevenue} prev={kpis.prevRevenue}
          unit="money" icon="💰" color={KPI_COLORS.revenue} />
        <KpiCard label="Клиентов" value={kpis.curClients} prev={kpis.prevClients}
          icon="👥" color={KPI_COLORS.clients} />
        <KpiCard label="Средний чек" value={kpis.curAvgCheck} prev={kpis.prevAvgCheck}
          unit="money" icon="🧾" color={KPI_COLORS.check} />
        <KpiCard label="Новых клиентов" value={kpis.curNewClients} prev={kpis.prevNewClients}
          icon="✨" color={KPI_COLORS.new} />
      </div>

      {/* Тренд выручки 12 месяцев — главный график как в BI */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900">Динамика выручки и клиентов</h2>
            <p className="text-xs text-gray-400 mt-0.5">последние 12 месяцев</p>
          </div>
        </div>
        {monthlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}к` : v} />
              <Tooltip formatter={(v, name) =>
                name === 'Выручка' ? [formatMoney(Number(v)), String(name)] : [v, name]} />
              <Legend />
              <Area type="monotone" dataKey="Выручка" stroke="#7c3aed" strokeWidth={2.5}
                fill="url(#gRevenue)" dot={{ fill: '#7c3aed', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Нет данных — заполните ежедневные отчёты
          </div>
        )}
      </div>

      {/* Дневная выручка текущего месяца */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900">Выручка по дням — {formatMonth(month)}</h2>
            <p className="text-xs text-gray-400 mt-0.5">наличные / карта / онлайн</p>
          </div>
        </div>
        {dailyRevenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyRevenue} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}к` : v} />
              <Tooltip formatter={(v, name) => [formatMoney(Number(v)), String(name)]} />
              <Legend />
              <Bar dataKey="Нал" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Карта" stackId="a" fill="#2563eb" />
              <Bar dataKey="Онлайн" stackId="a" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
            Нет данных за этот месяц
          </div>
        )}
      </div>

      {/* Нижний ряд: Топ услуг + Сегментация клиентов */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Горизонтальный бар — топ услуг */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">Топ услуг по выручке</h2>
          <p className="text-xs text-gray-400 mb-4">{formatMonth(month)}</p>
          {topServices.length > 0 ? (
            <div className="space-y-3">
              {topServices.map((svc, i) => (
                <div key={svc.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 truncate max-w-[200px]">
                      <span className="text-gray-400 text-xs mr-1">#{i + 1}</span>{svc.name}
                    </span>
                    <div className="flex gap-3 text-right shrink-0">
                      <span className="text-gray-400 text-xs">{svc.count} визит.</span>
                      <span className="font-semibold text-violet-700">{formatMoney(svc.revenue)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${(svc.revenue / maxServiceRevenue) * 100}%`,
                        background: `hsl(${250 - i * 20}, 70%, ${55 + i * 3}%)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Нет данных о визитах
            </div>
          )}
        </div>

        {/* Donut chart — сегментация клиентов */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">База клиентов</h2>
          <p className="text-xs text-gray-400 mb-2">Всего: {clients.length} клиентов</p>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {pieData.length > 0 ? (
                <PieChart width={160} height={160}>
                  <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={75}
                    dataKey="value" stroke="none">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} чел.`]} />
                </PieChart>
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-gray-300 text-sm">Нет данных</div>
              )}
            </div>
            <div className="space-y-3 flex-1">
              {segments.map(seg => (
                <div key={seg.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-800">{seg.label}</span>
                      <span className="font-bold" style={{ color: seg.color }}>{seg.count}</span>
                    </div>
                    <p className="text-xs text-gray-400">{seg.days}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA для риска оттока */}
          {segments[2].count > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-red-700 font-medium">
                ⚠️ {segments[2].count} клиент{segments[2].count > 1 ? 'а' : ''} не приходил{segments[2].count > 1 ? 'о' : ''} более 60 дней
              </p>
              <a href="/clients" className="text-xs text-red-600 hover:underline font-semibold">
                → Посмотреть в базе клиентов
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Новые клиенты по месяцам */}
      {monthlyTrend.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">Новые vs повторные клиенты</h2>
          <p className="text-xs text-gray-400 mb-4">по месяцам</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Клиентов" fill="#2563eb" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Новых" fill="#d97706" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
