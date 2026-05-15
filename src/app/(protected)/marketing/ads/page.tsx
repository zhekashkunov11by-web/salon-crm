'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdStat {
  ad_id: string
  ad_name: string
  adset_name: string
  campaign_name: string
  account_channel: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  cpc: number
  cpm: number
  ctr: number
  leads_count: number
}

interface AggregatedAd {
  ad_id: string
  ad_name: string
  adset_name: string
  campaign_name: string
  account_channel: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  cpc: number
  cpm: number
  ctr: number
  leads_count: number
  cost_per_lead: number
}

function fmt(n: number, digits = 2) {
  return new Intl.NumberFormat('ru-BY', { maximumFractionDigits: digits }).format(n)
}
function fmtMoney(n: number) {
  return fmt(n, 2) + ' Br'
}

const CHANNEL_LABEL: Record<string, { icon: string; label: string }> = {
  facebook: { icon: '📘', label: 'Facebook' },
  instagram: { icon: '📸', label: 'Instagram' },
}

export default function AdsAnalyticsPage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 7) + '-01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [rows, setRows] = useState<AggregatedAd[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<keyof AggregatedAd>('spend')
  const [filterChannel, setFilterChannel] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('meta_ad_stats')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo)

    if (data) {
      // Агрегируем по ad_id (суммируем все дни)
      const map: Record<string, AggregatedAd> = {}
      for (const row of data as AdStat[]) {
        if (!map[row.ad_id]) {
          map[row.ad_id] = {
            ad_id: row.ad_id,
            ad_name: row.ad_name,
            adset_name: row.adset_name,
            campaign_name: row.campaign_name,
            account_channel: row.account_channel,
            spend: 0, impressions: 0, reach: 0, clicks: 0,
            cpc: 0, cpm: 0, ctr: 0, leads_count: 0, cost_per_lead: 0,
          }
        }
        map[row.ad_id].spend += row.spend
        map[row.ad_id].impressions += row.impressions
        map[row.ad_id].reach += row.reach
        map[row.ad_id].clicks += row.clicks
        map[row.ad_id].leads_count += row.leads_count
      }

      // Пересчитываем производные метрики
      const aggs = Object.values(map).map(ad => ({
        ...ad,
        cpc: ad.clicks > 0 ? ad.spend / ad.clicks : 0,
        cpm: ad.impressions > 0 ? (ad.spend / ad.impressions) * 1000 : 0,
        ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
        cost_per_lead: ad.leads_count > 0 ? ad.spend / ad.leads_count : 0,
      }))

      setRows(aggs)
    }
    setLoading(false)
  }, [dateFrom, dateTo, supabase])

  useEffect(() => { load() }, [load])

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    // Синхронизируем все месяцы в выбранном диапазоне
    const months: string[] = []
    const d = new Date(dateFrom)
    const end = new Date(dateTo)
    while (d <= end) {
      const m = d.toISOString().slice(0, 7)
      if (!months.includes(m)) months.push(m)
      d.setMonth(d.getMonth() + 1)
    }
    try {
      const results = await Promise.all(months.map(m =>
        fetch('/api/meta/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: m }),
        }).then(r => r.json())
      ))
      const ok = results.every(r => r.ok)
      setSyncMsg(ok ? `Синхронизировано за ${months.join(', ')}` : 'Частичная ошибка при синхронизации')
      load()
    } catch {
      setSyncMsg('Ошибка сети')
    }
    setSyncing(false)
  }

  function setAllTime() {
    setDateFrom('2025-01-01')
    setDateTo(today)
  }
      const data = await res.json()
      if (data.ok) {
        const parts = Object.entries(data.results).map(([ch, r]: [string, { ads?: number; spend?: number; error?: string }]) =>
          r.error ? `${ch}: ошибка` : `${ch}: ${r.ads} объявлений, ${fmt(r.spend || 0)} Br`
        )
        setSyncMsg('Синхронизировано: ' + parts.join(' / '))
        load()
      } else {
        setSyncMsg('Ошибка: ' + (data.error || 'неизвестно'))
      }
    } catch {
      setSyncMsg('Ошибка сети')
    }
    setSyncing(false)
  }

  const filtered = rows
    .filter(r => filterChannel === 'all' || r.account_channel === filterChannel)
    .sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number))

  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0)
  const totalClicks = filtered.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = filtered.reduce((s, r) => s + r.impressions, 0)
  const totalLeads = filtered.reduce((s, r) => s + r.leads_count, 0)
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const SORT_OPTIONS: { key: keyof AggregatedAd; label: string }[] = [
    { key: 'spend', label: 'Расходы' },
    { key: 'clicks', label: 'Клики' },
    { key: 'impressions', label: 'Показы' },
    { key: 'leads_count', label: 'Лиды' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Объявления Meta</h1>
          <p className="text-sm text-gray-500">Facebook + Instagram — эффективность каждого объявления</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <input type="date" className="input text-sm py-1" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" className="input text-sm py-1" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          <button onClick={setAllTime} className="text-xs text-violet-600 hover:underline whitespace-nowrap">
            За всё время
          </button>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="btn-secondary"
          >
            {syncing ? '⏳ Синхронизация...' : '↻ Обновить'}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          {syncMsg}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Потрачено</p>
          <p className="text-lg font-bold text-red-600">{fmtMoney(totalSpend)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Показов</p>
          <p className="text-lg font-bold">{fmt(totalImpressions, 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Кликов</p>
          <p className="text-lg font-bold">{fmt(totalClicks, 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Средний CTR</p>
          <p className="text-lg font-bold">{fmt(avgCTR, 2)}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Средний CPC</p>
          <p className="text-lg font-bold">{fmtMoney(avgCPC)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Лидов</p>
          <p className="text-lg font-bold text-violet-600">{totalLeads}</p>
        </div>
      </div>

      {/* Фильтры и сортировка */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'facebook', 'instagram'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                filterChannel === ch
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {ch === 'all' ? 'Все' : `${CHANNEL_LABEL[ch].icon} ${CHANNEL_LABEL[ch].label}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-500">Сортировка:</span>
          <select
            className="input text-sm py-1"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as keyof AggregatedAd)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Таблица */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500 font-medium">Нет данных за выбранный период</p>
          <p className="text-sm text-gray-400 mt-1">Нажмите «Обновить» для синхронизации с Meta</p>
          <button onClick={syncNow} disabled={syncing} className="btn-primary mt-4">
            {syncing ? '⏳...' : '↻ Синхронизировать сейчас'}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Объявление</th>
                  <th>Кампания / Группа</th>
                  <th>Канал</th>
                  <th>Потрачено</th>
                  <th>Показов</th>
                  <th>Кликов</th>
                  <th>CTR</th>
                  <th>CPC</th>
                  <th>CPM</th>
                  <th>Лиды</th>
                  <th>Цена лида</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ad => {
                  const ch = CHANNEL_LABEL[ad.account_channel] || { icon: '📌', label: ad.account_channel }
                  return (
                    <tr key={ad.ad_id}>
                      <td>
                        <div className="max-w-[200px]">
                          <p className="font-medium text-sm truncate" title={ad.ad_name}>{ad.ad_name}</p>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs text-gray-500 max-w-[160px]">
                          <p className="truncate font-medium text-gray-700" title={ad.campaign_name}>{ad.campaign_name}</p>
                          <p className="truncate" title={ad.adset_name}>{ad.adset_name}</p>
                        </div>
                      </td>
                      <td>
                        <span className="text-sm">{ch.icon} {ch.label}</span>
                      </td>
                      <td className="font-semibold text-red-600">{fmtMoney(ad.spend)}</td>
                      <td>{fmt(ad.impressions, 0)}</td>
                      <td>{fmt(ad.clicks, 0)}</td>
                      <td>
                        <span className={`font-medium ${ad.ctr > 2 ? 'text-green-600' : ad.ctr > 1 ? 'text-gray-700' : 'text-red-500'}`}>
                          {fmt(ad.ctr, 2)}%
                        </span>
                      </td>
                      <td>{fmtMoney(ad.cpc)}</td>
                      <td>{fmtMoney(ad.cpm)}</td>
                      <td className="font-semibold text-violet-600">{ad.leads_count > 0 ? ad.leads_count : '—'}</td>
                      <td>{ad.cost_per_lead > 0 ? fmtMoney(ad.cost_per_lead) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3}>Итого ({filtered.length} объявлений)</td>
                  <td className="text-red-600">{fmtMoney(totalSpend)}</td>
                  <td>{fmt(totalImpressions, 0)}</td>
                  <td>{fmt(totalClicks, 0)}</td>
                  <td>{fmt(avgCTR, 2)}%</td>
                  <td>{fmtMoney(avgCPC)}</td>
                  <td>—</td>
                  <td className="text-violet-600">{totalLeads}</td>
                  <td>{totalLeads > 0 ? fmtMoney(totalSpend / totalLeads) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="card mt-6 bg-blue-50 border-blue-200 max-w-2xl">
        <div className="card-body text-sm text-blue-700 space-y-1">
          <p><strong>CTR</strong> — процент кликнувших от увидевших. Норма для таргета: 1–3%</p>
          <p><strong>CPC</strong> — цена за клик. Чем ниже — тем лучше объявление</p>
          <p><strong>CPM</strong> — цена за 1000 показов</p>
          <p><strong>Лиды</strong> — заявки из Lead Ads или Messenger (если подключены)</p>
          <p className="text-blue-500 text-xs pt-1">Данные синхронизируются каждый день в 06:00</p>
        </div>
      </div>
    </div>
  )
}
