'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, daysSince } from '@/lib/utils/format'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Client {
  id: string
  name: string
  phone?: string
  source?: string
  created_at: string
  last_visit_date?: string
  total_revenue?: number
  visits_count?: number
}

interface Visit {
  visit_date: string
  amount: number
  service_name: string
  staff_id?: string
}

interface ChurnSegment {
  label: string
  count: number
  color: string
  days: string
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<Client[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`
    const to = `${month}-31`

    const [clientsRes, visitsRes] = await Promise.all([
      supabase.from('clients').select('id, name, phone, source, created_at, last_visit_date, total_revenue, visits_count'),
      supabase.from('visits').select('visit_date, amount, service_name, staff_id')
        .gte('visit_date', from).lte('visit_date', to),
    ])

    if (clientsRes.data) setClients(clientsRes.data as Client[])
    if (visitsRes.data) setVisits(visitsRes.data as Visit[])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  // Churn segmentation
  const segments: ChurnSegment[] = [
    { label: 'Активные', count: 0, color: 'bg-green-500', days: '< 30 дней' },
    { label: 'В зоне риска', count: 0, color: 'bg-yellow-500', days: '30–60 дней' },
    { label: 'Потерянные', count: 0, color: 'bg-red-500', days: '> 60 дней' },
    { label: 'Без визитов', count: 0, color: 'bg-gray-400', days: 'нет визитов' },
  ]

  clients.forEach(c => {
    if (!c.last_visit_date) {
      segments[3].count++
    } else {
      const days = daysSince(c.last_visit_date)
      if (days < 30) segments[0].count++
      else if (days <= 60) segments[1].count++
      else segments[2].count++
    }
  })

  // Revenue by day
  const revenueByDay = visits.reduce((acc, v) => {
    const day = v.visit_date.slice(-2)
    acc[day] = (acc[day] || 0) + v.amount
    return acc
  }, {} as Record<string, number>)

  const revenueChartData = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, revenue]) => ({ day: parseInt(day), revenue }))

  // Service breakdown
  const serviceRevenue = visits.reduce((acc, v) => {
    const name = v.service_name || 'Без услуги'
    if (!acc[name]) acc[name] = { revenue: 0, count: 0 }
    acc[name].revenue += v.amount
    acc[name].count++
    return acc
  }, {} as Record<string, { revenue: number; count: number }>)

  const topServices = Object.entries(serviceRevenue)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 10)

  const totalRevenue = visits.reduce((s, v) => s + v.amount, 0)
  const totalClients = clients.length
  const newClientsThisMonth = clients.filter(c => c.created_at.slice(0, 7) === month).length
  const avgCheck = visits.length > 0 ? totalRevenue / visits.length : 0

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Аналитика</h1>
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
          <p className="metric-value text-violet-700">{formatMoney(totalRevenue)}</p>
          <p className="metric-label">Выручка за {month}</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{visits.length}</p>
          <p className="metric-label">Визитов</p>
        </div>
        <div className="metric-card">
          <p className="metric-value">{formatMoney(avgCheck)}</p>
          <p className="metric-label">Средний чек</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-green-600">+{newClientsThisMonth}</p>
          <p className="metric-label">Новых клиентов</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Выручка по дням</h2>
        </div>
        <div className="card-body">
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}к`} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} dot={false} name="Выручка" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Нет данных за {month}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Churn segmentation */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Сегментация по оттоку</h2>
            <span className="text-xs text-gray-400">Всего клиентов: {totalClients}</span>
          </div>
          <div className="card-body space-y-3">
            {segments.map(seg => (
              <div key={seg.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${seg.color}`} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{seg.label}</span>
                    <span className="text-gray-500">{seg.count} чел.</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${seg.color}`}
                      style={{ width: `${totalClients > 0 ? (seg.count / totalClients) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{seg.days}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Топ услуг за {month}</h2>
          </div>
          <div className="card-body">
            {topServices.length > 0 ? (
              <div className="space-y-2">
                {topServices.map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-400">{data.count} визитов</p>
                    </div>
                    <span className="text-sm font-semibold text-violet-700 ml-2">
                      {formatMoney(data.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">Нет данных</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
