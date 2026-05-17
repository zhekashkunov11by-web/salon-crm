'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface Expense {
  date: string
  amount: number
  category_name: string
  cfs_section: string
  pnl_section: string
  recognition_months: number
  recognition_start_date: string | null
}

interface DailyReport {
  date: string
  revenue_cash: number
  revenue_card: number
  revenue_online: number
}

const CFS_SECTIONS = [
  { key: 'operating', label: 'Операционная деятельность' },
  { key: 'investing', label: 'Инвестиционная деятельность' },
  { key: 'financing', label: 'Финансовая деятельность' },
]

const PNL_SECTIONS = [
  { key: 'revenue', label: 'Выручка' },
  { key: 'cogs', label: 'Себестоимость (COGS)' },
  { key: 'opex', label: 'Операционные расходы (OPEX)' },
  { key: 'capex', label: 'Капитальные затраты' },
  { key: 'other', label: 'Прочие расходы' },
]

// Add N months to a YYYY-MM string
function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Subtract N months from a YYYY-MM string
function subtractMonths(yyyymm: string, n: number): string {
  return addMonths(yyyymm, -n)
}

// Compute the recognized P&L amount for an expense in a given month
function recognizedAmount(expense: Expense, selectedMonth: string): number {
  const recMonths = expense.recognition_months || 1
  // Start month: recognition_start_date if set, else expense.date month
  const startMonth = expense.recognition_start_date
    ? expense.recognition_start_date.slice(0, 7)
    : expense.date.slice(0, 7)
  const endMonth = addMonths(startMonth, recMonths - 1)

  if (selectedMonth >= startMonth && selectedMonth <= endMonth) {
    return expense.amount / recMonths
  }
  return 0
}

export default function FinancePage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'cfs' | 'pnl'>('cfs')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  // DDS expenses: only this month
  const [cfsExpenses, setCfsExpenses] = useState<Expense[]>([])
  // P&L expenses: up to 12 months back (for amortized recognition)
  const [pnlExpenses, setPnlExpenses] = useState<Expense[]>([])
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`
    const to = `${month}-31`
    // For P&L amortization, look back up to 12 months
    const pnlFrom = subtractMonths(month, 12) + '-01'

    const [cfsRes, pnlRes, repRes] = await Promise.all([
      // DDS: expenses in current month only
      supabase
        .from('expenses')
        .select('date, amount, recognition_months, recognition_start_date, expense_categories(name, cfs_section, pnl_section)')
        .gte('date', from)
        .lte('date', to),
      // P&L: wide range for amortized expenses
      supabase
        .from('expenses')
        .select('date, amount, recognition_months, recognition_start_date, expense_categories(name, cfs_section, pnl_section)')
        .gte('date', pnlFrom)
        .lte('date', to),
      supabase
        .from('daily_reports')
        .select('date, revenue_cash, revenue_card, revenue_online')
        .gte('date', from)
        .lte('date', to),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapExpense = (e: any): Expense => ({
      ...e,
      category_name: e.expense_categories?.name || 'Без категории',
      cfs_section: e.expense_categories?.cfs_section || 'operating',
      pnl_section: e.expense_categories?.pnl_section || 'other',
      recognition_months: e.recognition_months || 1,
    })

    if (cfsRes.data) setCfsExpenses(cfsRes.data.map(mapExpense))
    if (pnlRes.data) setPnlExpenses(pnlRes.data.map(mapExpense))
    if (repRes.data) setReports(repRes.data as DailyReport[])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const totalRevenue = reports.reduce((s, r) =>
    s + (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0), 0)

  // CFS data — uses full expense amounts in payment month
  const cfsBySection = CFS_SECTIONS.reduce((acc, s) => {
    acc[s.key] = cfsExpenses
      .filter(e => e.cfs_section === s.key)
      .reduce((sum, e) => sum + e.amount, 0)
    return acc
  }, {} as Record<string, number>)

  const totalOutflow = Object.values(cfsBySection).reduce((s, v) => s + v, 0)
  const netCashFlow = totalRevenue - totalOutflow

  // P&L data — uses recognized (amortized) amounts
  const pnlBySection = PNL_SECTIONS.slice(1).reduce((acc, s) => {
    acc[s.key] = pnlExpenses
      .filter(e => e.pnl_section === s.key)
      .reduce((sum, e) => sum + recognizedAmount(e, month), 0)
    return acc
  }, {} as Record<string, number>)

  const grossProfit = totalRevenue - (pnlBySection.cogs || 0)
  const operatingProfit = grossProfit - (pnlBySection.opex || 0)
  const netProfit = operatingProfit - (pnlBySection.capex || 0) - (pnlBySection.other || 0)
  const marginPct = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0

  // Check if any expense has amortization (for showing note)
  const hasAmortized = pnlExpenses.some(e => (e.recognition_months || 1) > 1)

  function exportCSV() {
    const rows = tab === 'cfs'
      ? [
          ['Раздел', 'Сумма'],
          ['Входящий поток (выручка)', totalRevenue],
          ...CFS_SECTIONS.map(s => [s.label, -cfsBySection[s.key]]),
          ['Чистый денежный поток', netCashFlow],
        ]
      : [
          ['Статья', 'Сумма'],
          ['Выручка', totalRevenue],
          ['Себестоимость (COGS)', -pnlBySection.cogs],
          ['Валовая прибыль', grossProfit],
          ['OPEX', -pnlBySection.opex],
          ['Операционная прибыль', operatingProfit],
          ['Чистая прибыль', netProfit],
          ['Рентабельность %', marginPct],
        ]

    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tab}-${month}.csv`
    a.click()
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Финансовые отчёты</h1>
        <div className="flex gap-2">
          <input
            type="month"
            className="input"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button onClick={exportCSV} className="btn-secondary">↓ CSV</button>
        </div>
      </div>

      <HelpPanel id="finance" title="Как читать финансовые отчёты" items={[
        { icon: '📊', title: 'ДДС (Cash Flow)', text: 'Движение денег: сколько пришло и ушло по операционной, инвестиционной и финансовой деятельности. Показывает реальные деньги на счету.' },
        { icon: '📈', title: 'P&L (Прибыль и убыток)', text: 'Выручка минус расходы = прибыль. Расходы с амортизацией (на несколько месяцев) распределяются равномерно. ДДС показывает полную сумму в день оплаты.' },
        { icon: '🗂️', title: 'Категории расходов', text: 'Настройте категории в Настройки → Категории расходов. Каждой категории назначьте статью ДДС и P&L.' },
        { icon: '📅', title: 'Выбор месяца', text: 'Данные берутся из Журнала расходов и Отчётов дня за выбранный месяц.' },
        { icon: '⬇️', title: 'Экспорт CSV', text: 'Выгрузите данные в Excel/Google Sheets для детального анализа или передачи бухгалтеру.' },
        { icon: '🔗', title: 'Источник данных', text: 'Доходы — из раздела Отчёт дня. Расходы — из раздела Журнал расходов. Вносите данные там, здесь видите итог.' },
      ]} />

      {/* Tab switch */}
      <div className="flex gap-0 mb-6 border border-gray-200 rounded-lg overflow-hidden w-fit">
        <button
          onClick={() => setTab('cfs')}
          className={`px-5 py-2 text-sm font-medium transition-colors ${
            tab === 'cfs' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          ДДС (CFS)
        </button>
        <button
          onClick={() => setTab('pnl')}
          className={`px-5 py-2 text-sm font-medium transition-colors ${
            tab === 'pnl' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          PnL (Прибыли и убытки)
        </button>
      </div>

      {/* CFS Report */}
      {tab === 'cfs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="metric-card">
              <p className="metric-value text-green-600">{formatMoney(totalRevenue)}</p>
              <p className="metric-label">Входящий поток</p>
            </div>
            <div className="metric-card">
              <p className="metric-value text-red-600">{formatMoney(totalOutflow)}</p>
              <p className="metric-label">Исходящий поток</p>
            </div>
            <div className="metric-card">
              <p className={`metric-value ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(netCashFlow)}
              </p>
              <p className="metric-label">Чистый поток</p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold">ДДС за {month}</h2>
            </div>
            <div className="card-body">
              <table className="table">
                <tbody>
                  <tr className="bg-green-50">
                    <td className="font-semibold text-green-800">+ Поступления (выручка)</td>
                    <td className="text-right font-semibold text-green-700">{formatMoney(totalRevenue)}</td>
                  </tr>
                  {CFS_SECTIONS.map(s => (
                    <tr key={s.key} className="bg-red-50">
                      <td className="text-red-700 pl-4">— {s.label}</td>
                      <td className="text-right text-red-700">({formatMoney(cfsBySection[s.key] || 0)})</td>
                    </tr>
                  ))}
                  <tr className={`font-bold border-t-2 border-gray-300 ${netCashFlow >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <td className={netCashFlow >= 0 ? 'text-green-800' : 'text-red-800'}>
                      Чистый денежный поток
                    </td>
                    <td className={`text-right text-lg ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatMoney(netCashFlow)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by category */}
          {CFS_SECTIONS.map(section => {
            const items = cfsExpenses.filter(e => e.cfs_section === section.key)
            if (items.length === 0) return null
            const grouped = items.reduce((acc, e) => {
              if (!acc[e.category_name]) acc[e.category_name] = 0
              acc[e.category_name] += e.amount
              return acc
            }, {} as Record<string, number>)

            return (
              <div key={section.key} className="card">
                <div className="card-header">
                  <h3 className="font-medium text-sm text-gray-700">{section.label} — детализация</h3>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Категория</th><th className="text-right">Сумма</th></tr></thead>
                    <tbody>
                      {Object.entries(grouped).map(([cat, amt]) => (
                        <tr key={cat}>
                          <td>{cat}</td>
                          <td className="text-right text-red-600">{formatMoney(amt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PnL Report */}
      {tab === 'pnl' && (
        <div className="space-y-4">
          {hasAmortized && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700">
              P&L учитывает амортизацию: расходы на несколько месяцев распределены равномерно. ДДС показывает полную сумму в день оплаты.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="metric-card">
              <p className="metric-value text-green-600">{formatMoney(totalRevenue)}</p>
              <p className="metric-label">Выручка</p>
            </div>
            <div className="metric-card">
              <p className="metric-value">{formatMoney(grossProfit)}</p>
              <p className="metric-label">Валовая прибыль</p>
            </div>
            <div className="metric-card">
              <p className={`metric-value ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(netProfit)}
              </p>
              <p className="metric-label">Чистая прибыль</p>
            </div>
            <div className="metric-card">
              <p className={`metric-value ${marginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {marginPct}%
              </p>
              <p className="metric-label">Рентабельность</p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold">P&L за {month}</h2>
            </div>
            <div className="card-body">
              <table className="table">
                <tbody>
                  <tr className="bg-green-50">
                    <td className="font-semibold text-green-800">Выручка</td>
                    <td className="text-right font-semibold text-green-700">{formatMoney(totalRevenue)}</td>
                  </tr>
                  <tr>
                    <td className="pl-4 text-gray-600">— Себестоимость (COGS)</td>
                    <td className="text-right text-red-600">({formatMoney(pnlBySection.cogs || 0)})</td>
                  </tr>
                  <tr className="bg-blue-50 font-medium">
                    <td className="text-blue-800">= Валовая прибыль</td>
                    <td className="text-right text-blue-700">{formatMoney(grossProfit)}</td>
                  </tr>
                  <tr>
                    <td className="pl-4 text-gray-600">— Операционные расходы (OPEX)</td>
                    <td className="text-right text-red-600">({formatMoney(pnlBySection.opex || 0)})</td>
                  </tr>
                  <tr className="bg-blue-50 font-medium">
                    <td className="text-blue-800">= Операционная прибыль (EBITDA)</td>
                    <td className="text-right text-blue-700">{formatMoney(operatingProfit)}</td>
                  </tr>
                  <tr>
                    <td className="pl-4 text-gray-600">— Капзатраты / Прочие</td>
                    <td className="text-right text-red-600">
                      ({formatMoney((pnlBySection.capex || 0) + (pnlBySection.other || 0))})
                    </td>
                  </tr>
                  <tr className={`font-bold border-t-2 border-gray-300 ${netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <td className={netProfit >= 0 ? 'text-green-800' : 'text-red-800'}>= Чистая прибыль</td>
                    <td className={`text-right text-lg ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatMoney(netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
