'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface ServiceRates {
  manual_new_month: number
  manual_repeat_low: number
  manual_repeat_high: number
  kim8_primary: number
  kim8_repeat: number
  cosmo_primary: number
  cosmo_repeat: number
  cosmo_cosmetics: number
  subscription_sale: number
}

interface SalaryPeriod {
  label: string
  rate_percent: number
  subscription_rate: number
  months: number | null
  condition_type: 'none' | 'return_rate_above'
  condition_threshold: number
  fallback_rate: number
}

interface SalaryConditions {
  periods: SalaryPeriod[]
  active_period: number
  period_started: string
}

interface Staff {
  id: string
  name: string
  role: 'manual' | 'kim8' | 'cosmetologist' | 'admin'
  rate_percent: number
  start_date: string
  salary_base_per_shift?: number
  tax_rate: number
  is_active: boolean
  service_rates?: ServiceRates | null
  return_rate_threshold?: number
  salary_envelope?: number
  salary_envelope_type?: 'per_month' | 'per_shift'
  salary_conditions?: SalaryConditions | null
}

interface Visit {
  staff_id: string
  client_id: string | null
  amount: number
  visit_date: string
  service_name: string
  status: string | null
}

interface Shift {
  id: string
  staff_id: string
  date: string
  is_worked: boolean
  plan_amount?: number
  fact_amount?: number
  bonus?: number
}

interface SalaryRow {
  staff: Staff
  visits: Visit[]
  shifts: Shift[]
  revenue: number
  gross_salary: number
  tax: number
  net_salary: number
  shifts_count: number
  plan_bonus?: number
  rate_detail?: string
  envelope: number
  mgmt_total: number
  needsPeriodReview: boolean
  activePeriodLabel?: string
  nextPeriod?: SalaryPeriod
}

const ROLE_LABELS: Record<string, string> = {
  manual: 'Массаж (ручной)',
  kim8: 'Массаж (Kim8)',
  cosmetologist: 'Косметолог',
  admin: 'Администратор',
}

const ADMIN_BONUS_SCALE = [
  { threshold: 1.10, bonus: 350 },
  { threshold: 1.00, bonus: 250 },
  { threshold: 0.90, bonus: 100 },
]

function calcAdminBonus(fact: number, plan: number): number {
  if (plan === 0) return 0
  const ratio = fact / plan
  for (const { threshold, bonus } of ADMIN_BONUS_SCALE) {
    if (ratio >= threshold) return bonus
  }
  return 0
}

function calcMasterSalary(member: Staff, visits: Visit[], periodStart: string): { gross: number; detail: string } {
  const conditions = member.salary_conditions
  if (conditions) {
    const period = conditions.periods[conditions.active_period]
    if (period) {
      const subscriptionRevenue = visits
        .filter(v => (v.service_name || '').toLowerCase().includes('абонем'))
        .reduce((s, v) => s + (v.amount || 0), 0)
      const baseRevenue = visits.reduce((s, v) => s + (v.amount || 0), 0) - subscriptionRevenue
      const gross = baseRevenue * (period.rate_percent / 100) + subscriptionRevenue * (period.subscription_rate / 100)
      return { gross, detail: `${period.label}: ${period.rate_percent}% + ${period.subscription_rate}% аб.` }
    }
  }

  const rates = member.service_rates
  if (!rates) {
    const revenue = visits.reduce((s, v) => s + (v.amount || 0), 0)
    return { gross: revenue * (member.rate_percent / 100), detail: `${member.rate_percent}% (общая)` }
  }

  const threshold = member.return_rate_threshold ?? 30
  const startDate = member.start_date ? new Date(member.start_date) : null
  const periodStartDate = new Date(periodStart)
  const seenClients = new Set<string>()
  let gross = 0

  const sorted = [...visits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))

  for (const v of sorted) {
    const amount = v.amount || 0
    const isFirstMonth = startDate
      ? (periodStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) < 30
      : false
    const isPrimary = v.client_id ? !seenClients.has(v.client_id) : false
    if (v.client_id) seenClients.add(v.client_id)
    const name = (v.service_name || '').toLowerCase()
    const isSubscription = name.includes('абонем')
    const isKim8 = name.includes('ким') || name.includes('kim8')
    const isCosmo = member.role === 'cosmetologist' && !isKim8
    const isCosmetics = name.includes('космет') && name.includes('продаж')
    let rate = 0
    if (isSubscription) rate = rates.subscription_sale
    else if (isKim8 || member.role === 'kim8') rate = isPrimary ? rates.kim8_primary : rates.kim8_repeat
    else if (isCosmo || member.role === 'cosmetologist') {
      if (isCosmetics) rate = rates.cosmo_cosmetics
      else rate = isPrimary ? rates.cosmo_primary : rates.cosmo_repeat
    } else {
      if (isFirstMonth) rate = rates.manual_new_month
      else rate = isPrimary ? rates.manual_repeat_low : rates.manual_repeat_high
    }
    gross += amount * (rate / 100)
  }
  return { gross, detail: `ставки по типу визита (порог ${threshold}%)` }
}

function checkNeedsPeriodReview(staff: Staff, month: string): boolean {
  const conditions = staff.salary_conditions
  if (!conditions) return false
  const { periods, active_period, period_started } = conditions
  if (active_period >= periods.length - 1) return false
  const currentPeriod = periods[active_period]
  if (!currentPeriod.months) return false
  const started = new Date(period_started + 'T00:00:00')
  const monthDate = new Date(month + '-01T00:00:00')
  const monthsDiff = (monthDate.getFullYear() - started.getFullYear()) * 12
    + monthDate.getMonth() - started.getMonth()
  return monthsDiff >= currentPeriod.months
}

export default function SalaryPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([])
  const [monthlyPlan, setMonthlyPlan] = useState(300000)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'masters' | 'admins'>('masters')
  const [isOwner, setIsOwner] = useState(false)
  const [showMgmt, setShowMgmt] = useState(false)
  const [updatingPeriod, setUpdatingPeriod] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setIsOwner(data?.role === 'owner'))
      }
    })
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`
    const to = `${month}-31`

    const [staffRes, visitsRes, shiftsRes, settingsRes] = await Promise.all([
      supabase.from('staff').select('*').eq('is_active', true).order('name'),
      supabase.from('visits')
        .select('staff_id, client_id, amount, visit_date, service_name, status')
        .gte('visit_date', from).lte('visit_date', to)
        .neq('status', 'cancelled'),
      supabase.from('staff_schedules').select('*').gte('date', from).lte('date', to),
      supabase.from('settings').select('value').eq('key', 'monthly_plan').maybeSingle(),
    ])

    const staffList = (staffRes.data || []) as Staff[]
    const visits = (visitsRes.data || []) as Visit[]
    const shifts = (shiftsRes.data || []) as Shift[]
    const plan = settingsRes.data?.value ? parseFloat(settingsRes.data.value) : 300000
    setMonthlyPlan(plan)

    const rows: SalaryRow[] = staffList.map(member => {
      const memberVisits = visits.filter(v => v.staff_id === member.id)
      const memberShifts = shifts.filter(s => s.staff_id === member.id && s.is_worked)
      const revenue = memberVisits.reduce((s, v) => s + (v.amount || 0), 0)

      let grossSalary = 0
      let planBonus = 0
      let rateDetail: string | undefined

      if (member.role === 'admin') {
        const shiftsCount = memberShifts.length
        const baseFromShifts = shiftsCount * (member.salary_base_per_shift || 0)
        const adminPlanForMonth = plan * (shiftsCount / 26)
        planBonus = calcAdminBonus(revenue, adminPlanForMonth)
        grossSalary = baseFromShifts + planBonus
        rateDetail = `${formatMoney(member.salary_base_per_shift || 0)}/смену + бонус`
      } else {
        const { gross, detail } = calcMasterSalary(member, memberVisits, from)
        grossSalary = gross
        rateDetail = detail
      }

      const tax = grossSalary * (member.tax_rate / 100)
      const netSalary = grossSalary - tax

      let envelope = 0
      if ((member.salary_envelope || 0) > 0) {
        envelope = member.salary_envelope_type === 'per_shift'
          ? (member.salary_envelope || 0) * memberShifts.length
          : (member.salary_envelope || 0)
      }

      const needsPeriodReview = checkNeedsPeriodReview(member, month)
      const conditions = member.salary_conditions
      const activePeriodLabel = conditions?.periods[conditions.active_period]?.label
      const nextPeriod = conditions && conditions.active_period < conditions.periods.length - 1
        ? conditions.periods[conditions.active_period + 1]
        : undefined

      return {
        staff: member,
        visits: memberVisits,
        shifts: memberShifts,
        revenue,
        gross_salary: grossSalary,
        tax,
        net_salary: netSalary,
        shifts_count: memberShifts.length,
        plan_bonus: member.role === 'admin' ? planBonus : undefined,
        rate_detail: rateDetail,
        envelope,
        mgmt_total: netSalary + envelope,
        needsPeriodReview,
        activePeriodLabel,
        nextPeriod,
      }
    })

    setSalaryRows(rows)
    setLoading(false)
  }, [month, supabase])

  useEffect(() => { load() }, [load])

  async function advancePeriod(row: SalaryRow) {
    const conditions = row.staff.salary_conditions
    if (!conditions) return
    setUpdatingPeriod(row.staff.id)
    const newConditions: SalaryConditions = {
      ...conditions,
      active_period: conditions.active_period + 1,
      period_started: `${month}-01`,
    }
    await supabase.from('staff').update({ salary_conditions: newConditions }).eq('id', row.staff.id)
    await load()
    setUpdatingPeriod(null)
  }

  async function keepCurrentPeriod(row: SalaryRow) {
    const conditions = row.staff.salary_conditions
    if (!conditions) return
    setUpdatingPeriod(row.staff.id)
    const currentPeriod = conditions.periods[conditions.active_period]
    const periodMonths = currentPeriod.months || 1
    const started = new Date(conditions.period_started + 'T00:00:00')
    started.setMonth(started.getMonth() + periodMonths)
    const newConditions: SalaryConditions = { ...conditions, period_started: started.toISOString().split('T')[0] }
    await supabase.from('staff').update({ salary_conditions: newConditions }).eq('id', row.staff.id)
    await load()
    setUpdatingPeriod(null)
  }

  const masterRows = salaryRows.filter(r => r.staff.role !== 'admin')
  const adminRows = salaryRows.filter(r => r.staff.role === 'admin')
  const totalNetMasters = masterRows.reduce((s, r) => s + r.net_salary, 0)
  const totalNetAdmins = adminRows.reduce((s, r) => s + r.net_salary, 0)
  const totalEnvelope = salaryRows.reduce((s, r) => s + r.envelope, 0)
  const reviewNeeded = isOwner ? salaryRows.filter(r => r.needsPeriodReview) : []

  function exportCSV(rows: SalaryRow[]) {
    const headers = ['Сотрудник', 'Роль', 'Выручка', 'Смен', 'Начислено', 'Налог', 'К выплате']
    const data = rows.map(r => [
      r.staff.name,
      ROLE_LABELS[r.staff.role] || r.staff.role,
      r.revenue,
      r.shifts_count,
      Math.round(r.gross_salary),
      Math.round(r.tax),
      Math.round(r.net_salary),
    ])
    const csv = [headers, ...data].map(row => row.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salary-${activeTab}-${month}.csv`
    a.click()
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  const currentRows = activeTab === 'masters' ? masterRows : adminRows
  const mgmtCols = isOwner && showMgmt

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Зарплата</h1>
        <div className="flex gap-2 flex-wrap">
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
          {isOwner && (
            <button
              onClick={() => setShowMgmt(v => !v)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showMgmt
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'
              }`}
            >
              🔒 Управленческий вид
            </button>
          )}
          <button onClick={() => exportCSV(currentRows)} className="btn-secondary">↓ CSV</button>
        </div>
      </div>

      <HelpPanel id="salary" title="Как считается зарплата" items={[
        { icon: '📊', title: 'Источник данных', text: 'Зарплата считается из визитов. Внесите данные в Отчёт дня — расчёт обновится.' },
        { icon: '⚙️', title: 'Ставки мастеров', text: 'Настраиваются в Настройки → Сотрудники для каждого мастера отдельно.' },
        { icon: '📋', title: 'Периоды', text: 'Если у мастера настроены условные периоды — система напомнит когда нужно пересмотреть ставку.' },
        { icon: '🔒', title: 'Управленческий вид', text: 'Только для владельца. Показывает неофициальные надбавки (конверт) и реальный ФОТ.' },
        { icon: '👤', title: 'Администраторы', text: 'Оклад за смену × смены + бонус за выполнение плана.' },
        { icon: '⬇️', title: 'Экспорт', text: 'Выгрузите расчёт в CSV для ведомости (без управленческих данных).' },
      ]} />

      {/* Алерты пересмотра периодов */}
      {reviewNeeded.length > 0 && (
        <div className="mb-6 space-y-2">
          {reviewNeeded.map(row => (
            <div key={row.staff.id}
              className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-amber-900 text-sm">⏰ Пора пересмотреть — {row.staff.name}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Сейчас: <b>{row.activePeriodLabel}</b>
                  {row.nextPeriod && <>
                    {' → '}Следующий: <b>{row.nextPeriod.label}</b> ({row.nextPeriod.rate_percent}%
                    {row.nextPeriod.condition_type === 'return_rate_above'
                      ? ` если возвращаемость >${row.nextPeriod.condition_threshold}%, иначе ${row.nextPeriod.fallback_rate}%`
                      : ''})
                  </>}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={updatingPeriod === row.staff.id}
                  onClick={() => advancePeriod(row)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  ✓ Перейти на следующий период
                </button>
                <button
                  disabled={updatingPeriod === row.staff.id}
                  onClick={() => keepCurrentPeriod(row)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Оставить на текущем ещё месяц
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Итого (официальный) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="metric-card">
          <p className="metric-value">{formatMoney(masterRows.reduce((s, r) => s + r.revenue, 0))}</p>
          <p className="metric-label">Выручка мастеров</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-orange-600">{formatMoney(totalNetMasters)}</p>
          <p className="metric-label">ФОТ мастеров (нетто)</p>
        </div>
        <div className="metric-card">
          <p className="metric-value text-orange-600">{formatMoney(totalNetAdmins)}</p>
          <p className="metric-label">ФОТ администраторов</p>
        </div>
      </div>

      {/* Управленческий итог */}
      {mgmtCols && totalEnvelope > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-700 uppercase mb-3">🔒 Реальный ФОТ (управленческий)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-amber-600">Официально (нетто)</p>
              <p className="text-xl font-bold text-gray-900">{formatMoney(totalNetMasters + totalNetAdmins)}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600">Конверт (наличными)</p>
              <p className="text-xl font-bold text-amber-700">{formatMoney(totalEnvelope)}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600">Итого реальных выплат</p>
              <p className="text-xl font-bold text-red-700">
                {formatMoney(totalNetMasters + totalNetAdmins + totalEnvelope)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div className="flex mb-6 border border-gray-200 rounded-lg overflow-hidden w-fit">
        {(['masters', 'admins'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'masters' ? `Мастера (${masterRows.length})` : `Администраторы (${adminRows.length})`}
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Роль</th>
                {activeTab === 'masters' ? (
                  <>
                    <th>Выручка</th>
                    <th>% ставка</th>
                    <th>Начислено</th>
                  </>
                ) : (
                  <>
                    <th>Смен</th>
                    <th>Оклад/смену</th>
                    <th>Бонус</th>
                    <th>Начислено</th>
                  </>
                )}
                <th>Налог</th>
                <th>К выплате</th>
                {mgmtCols && <th className="text-amber-700 bg-amber-50">Конверт 🔒</th>}
                {mgmtCols && <th className="text-red-700 bg-amber-50">Итого реал. 🔒</th>}
              </tr>
            </thead>
            <tbody>
              {currentRows.map(row => (
                <tr key={row.staff.id}>
                  <td>
                    <div className="font-medium">{row.staff.name}</div>
                    {row.activePeriodLabel && (
                      <div className="text-xs text-violet-600">{row.activePeriodLabel}</div>
                    )}
                    {row.needsPeriodReview && (
                      <div className="text-xs text-amber-600 font-medium">⏰ Требует пересмотра</div>
                    )}
                  </td>
                  <td className="text-xs text-gray-500">{ROLE_LABELS[row.staff.role]}</td>
                  {activeTab === 'masters' ? (
                    <>
                      <td className="font-semibold text-violet-700">{formatMoney(row.revenue)}</td>
                      <td className="text-gray-500 text-xs max-w-[140px]">{row.rate_detail}</td>
                      <td>{formatMoney(row.gross_salary)}</td>
                    </>
                  ) : (
                    <>
                      <td>{row.shifts_count}</td>
                      <td className="text-gray-500">{formatMoney(row.staff.salary_base_per_shift || 0)}</td>
                      <td className="text-green-600">{formatMoney(row.plan_bonus || 0)}</td>
                      <td>{formatMoney(row.gross_salary)}</td>
                    </>
                  )}
                  <td className="text-red-500">({formatMoney(row.tax)})</td>
                  <td className="font-bold text-gray-900">{formatMoney(row.net_salary)}</td>
                  {mgmtCols && (
                    <td className={`bg-amber-50 ${row.envelope > 0 ? 'text-amber-700 font-semibold' : 'text-gray-300'}`}>
                      {row.envelope > 0 ? formatMoney(row.envelope) : '—'}
                    </td>
                  )}
                  {mgmtCols && (
                    <td className="bg-amber-50 font-bold text-red-700">{formatMoney(row.mgmt_total)}</td>
                  )}
                </tr>
              ))}
              {currentRows.length === 0 && (
                <tr>
                  <td colSpan={mgmtCols ? 10 : 8} className="text-center text-gray-400 py-8">
                    Нет данных за {month}
                  </td>
                </tr>
              )}
            </tbody>
            {currentRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={activeTab === 'masters' ? 4 : 5}>Итого</td>
                  <td>({formatMoney(currentRows.reduce((s, r) => s + r.tax, 0))})</td>
                  <td className="text-violet-700 text-lg">
                    {formatMoney(currentRows.reduce((s, r) => s + r.net_salary, 0))}
                  </td>
                  {mgmtCols && (
                    <td className="bg-amber-50 text-amber-700">
                      {formatMoney(currentRows.reduce((s, r) => s + r.envelope, 0))}
                    </td>
                  )}
                  {mgmtCols && (
                    <td className="bg-amber-50 text-red-700 text-lg">
                      {formatMoney(currentRows.reduce((s, r) => s + r.mgmt_total, 0))}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Шкала бонусов администратора */}
      {activeTab === 'admins' && (
        <div className="card mt-4 max-w-lg">
          <div className="card-header">
            <h3 className="font-semibold text-sm">Бонусная шкала администратора</h3>
          </div>
          <div className="card-body">
            <table className="table text-sm">
              <thead><tr><th>Выполнение плана</th><th>Бонус</th></tr></thead>
              <tbody>
                <tr><td>Менее 90%</td><td className="text-gray-400">без бонуса</td></tr>
                <tr><td>90–99%</td><td className="text-yellow-600">{formatMoney(100)}</td></tr>
                <tr><td>100–109%</td><td className="text-green-600">{formatMoney(250)}</td></tr>
                <tr><td>110% и выше</td><td className="text-green-800 font-bold">{formatMoney(350)}</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              План пропорционален отработанным сменам от месячного плана ({formatMoney(monthlyPlan)})
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
