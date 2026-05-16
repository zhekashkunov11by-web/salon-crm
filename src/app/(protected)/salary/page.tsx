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
}

const ROLE_LABELS: Record<string, string> = {
  manual: 'Массаж (ручной)',
  kim8: 'Массаж (Kim8)',
  cosmetologist: 'Косметолог',
  admin: 'Администратор',
}

// Бонусная шкала администратора (в BYN)
// < 90% → 0, 90–99% → 100 Br, 100–109% → 250 Br, 110%+ → 350 Br
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

// Рассчитать зарплату мастера по service_rates
function calcMasterSalary(
  member: Staff,
  visits: Visit[],
  periodStart: string,
): { gross: number; detail: string } {
  const rates = member.service_rates
  if (!rates) {
    // Fallback: flat rate_percent if no service_rates set
    const revenue = visits.reduce((s, v) => s + (v.amount || 0), 0)
    return { gross: revenue * (member.rate_percent / 100), detail: `${member.rate_percent}% (общая)` }
  }

  const threshold = member.return_rate_threshold ?? 30
  const startDate = member.start_date ? new Date(member.start_date) : null
  const periodStartDate = new Date(periodStart)

  // Считаем уникальных клиентов по порядку появления в периоде (для primary/repeat)
  const seenClients = new Set<string>()
  let gross = 0

  // Сортируем по дате для правильного порядка primary/repeat
  const sorted = [...visits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))

  for (const v of sorted) {
    const amount = v.amount || 0
    const isFirstMonth = startDate
      ? (periodStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) < 30
      : false
    const isPrimary = v.client_id ? !seenClients.has(v.client_id) : false
    if (v.client_id) seenClients.add(v.client_id)

    const name = v.service_name?.toLowerCase() || ''
    const isSubscription = name.includes('абонем')
    const isKim8 = name.includes('ким') || name.includes('kim8')
    const isCosmo = member.role === 'cosmetologist' && !isKim8
    const isCosmetics = name.includes('космет') && name.includes('продаж')

    let rate = 0
    if (isSubscription) {
      rate = rates.subscription_sale
    } else if (isKim8 || member.role === 'kim8') {
      rate = isPrimary ? rates.kim8_primary : rates.kim8_repeat
    } else if (isCosmo || member.role === 'cosmetologist') {
      if (isCosmetics) rate = rates.cosmo_cosmetics
      else rate = isPrimary ? rates.cosmo_primary : rates.cosmo_repeat
    } else {
      // Manual
      if (isFirstMonth) rate = rates.manual_new_month
      else rate = isPrimary ? rates.manual_repeat_low : rates.manual_repeat_high
    }

    gross += amount * (rate / 100)
  }

  const detail = `ставки по типу визита (порог возврата ${threshold}%)`
  return { gross, detail }
}

export default function SalaryPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([])
  const [monthlyPlan, setMonthlyPlan] = useState(300000)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'masters' | 'admins'>('masters')

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

    // Calculate salary for each staff member
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
        // Admin plan proportional to shifts worked (~26 working days/month)
        const adminPlanForMonth = plan * (shiftsCount / 26)
        const adminFact = memberVisits.reduce((s, v) => s + (v.amount || 0), 0)
        planBonus = calcAdminBonus(adminFact, adminPlanForMonth)
        grossSalary = baseFromShifts + planBonus
        rateDetail = `${formatMoney(member.salary_base_per_shift || 0)}/смену + бонус`
      } else {
        const { gross, detail } = calcMasterSalary(member, memberVisits, from)
        grossSalary = gross
        rateDetail = detail
      }

      const tax = grossSalary * (member.tax_rate / 100)
      const netSalary = grossSalary - tax

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
      }
    })

    setSalaryRows(rows)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const masterRows = salaryRows.filter(r => r.staff.role !== 'admin')
  const adminRows = salaryRows.filter(r => r.staff.role === 'admin')
  const totalNetMasters = masterRows.reduce((s, r) => s + r.net_salary, 0)
  const totalNetAdmins = adminRows.reduce((s, r) => s + r.net_salary, 0)

  function exportCSV(rows: SalaryRow[]) {
    const headers = ['Сотрудник', 'Роль', 'Выручка', 'Смен', 'Начислено (гросс)', 'Подоходный налог', 'К выплате (нетто)']
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Зарплата</h1>
        <div className="flex gap-2">
          <input
            type="month"
            className="input"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button onClick={() => exportCSV(currentRows)} className="btn-secondary">↓ CSV</button>
        </div>
      </div>

      <HelpPanel id="salary" title="Как считается зарплата" items={[
        { icon: '📊', title: 'Источник данных', text: 'Зарплата считается из Отчётов дня. Внесите данные в Отчёт дня — расчёт обновится автоматически.' },
        { icon: '⚙️', title: 'Ставки мастеров', text: 'Процент от выручки, фиксированная ставка за смену — настраивается в Настройки → Сотрудники для каждого мастера отдельно.' },
        { icon: '🧮', title: 'Как считается', text: 'Выручка мастера × его процент = начислено. Затем вычитается налог (если указан). Итог — «к выплате».' },
        { icon: '👤', title: 'Администраторы', text: 'Вкладка «Администраторы» — фиксированная ставка за смену × количество смен в месяце.' },
        { icon: '💰', title: 'Налог', text: 'Если у сотрудника указан процент налога — он вычитается из начисленного. Настраивается в карточке сотрудника.' },
        { icon: '⬇️', title: 'Экспорт', text: 'Выгрузите расчёт в CSV для ведомости или передачи в бухгалтерию.' },
      ]} />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border border-gray-200 rounded-lg overflow-hidden w-fit">
        <button
          onClick={() => setActiveTab('masters')}
          className={`px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'masters' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Мастера ({masterRows.length})
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === 'admins' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Администраторы ({adminRows.length})
        </button>
      </div>

      {/* Salary table */}
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
                    <th>Смен отработано</th>
                    <th>Оклад/смену</th>
                    <th>Бонус план</th>
                    <th>Начислено</th>
                  </>
                )}
                <th>Подоходный налог</th>
                <th className="text-right">К выплате</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map(row => (
                <tr key={row.staff.id}>
                  <td className="font-medium">{row.staff.name}</td>
                  <td>
                    <span className="text-xs text-gray-500">{ROLE_LABELS[row.staff.role]}</span>
                  </td>
                  {activeTab === 'masters' ? (
                    <>
                      <td className="font-semibold text-violet-700">{formatMoney(row.revenue)}</td>
                      <td className="text-gray-500 text-xs">{row.rate_detail}</td>
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
                  <td className="text-right font-bold text-gray-900">{formatMoney(row.net_salary)}</td>
                </tr>
              ))}
              {currentRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">
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
                  <td className="text-right text-violet-700 text-lg">
                    {formatMoney(currentRows.reduce((s, r) => s + r.net_salary, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Admin bonus scale info */}
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
              План администратора рассчитывается пропорционально отработанным сменам от месячного плана ({formatMoney(monthlyPlan)})
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
