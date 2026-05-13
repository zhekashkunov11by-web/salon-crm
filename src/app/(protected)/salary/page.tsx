'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'

interface Staff {
  id: string
  name: string
  role: 'manual' | 'kim8' | 'cosmetologist' | 'admin'
  rate_percent: number
  salary_base_per_shift?: number
  tax_rate: number
  is_active: boolean
}

interface Visit {
  staff_id: string
  amount: number
  visit_date: string
  service_name: string
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
}

const ROLE_LABELS: Record<string, string> = {
  manual: 'Массаж (ручной)',
  kim8: 'Массаж (Kim8)',
  cosmetologist: 'Косметолог',
  admin: 'Администратор',
}

const ADMIN_BONUS_SCALE = [
  { threshold: 0.8, bonus: 0 },
  { threshold: 0.9, bonus: 2000 },
  { threshold: 1.0, bonus: 4000 },
  { threshold: 1.1, bonus: 6000 },
  { threshold: Infinity, bonus: 8000 },
]

function calcAdminBonus(fact: number, plan: number): number {
  if (plan === 0) return 0
  const ratio = fact / plan
  for (let i = ADMIN_BONUS_SCALE.length - 1; i >= 0; i--) {
    if (ratio >= ADMIN_BONUS_SCALE[i].threshold) {
      return ADMIN_BONUS_SCALE[i].bonus
    }
  }
  return 0
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
      supabase.from('visits').select('staff_id, amount, visit_date, service_name')
        .gte('visit_date', from).lte('visit_date', to),
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

      if (member.role === 'admin') {
        const shiftsCount = memberShifts.length
        const baseFromShifts = shiftsCount * (member.salary_base_per_shift || 0)
        // Admin plan is proportional to shifts worked
        const adminPlanForMonth = plan * (shiftsCount / 26) // ~26 working days/month
        const adminFact = memberVisits.reduce((s, v) => s + (v.amount || 0), 0)
        planBonus = calcAdminBonus(adminFact, adminPlanForMonth)
        grossSalary = baseFromShifts + planBonus
      } else {
        // Masters: % of revenue
        grossSalary = revenue * (member.rate_percent / 100)
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
    const headers = ['Сотрудник', 'Роль', 'Выручка', 'Смен', 'Начислено (гросс)', 'НДФЛ', 'К выплате (нетто)']
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
                <th>НДФЛ</th>
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
                      <td className="text-gray-500">{row.staff.rate_percent}%</td>
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
                <tr><td>Менее 80%</td><td className="text-gray-400">без бонуса</td></tr>
                <tr><td>80–90%</td><td className="text-yellow-600">{formatMoney(2000)}</td></tr>
                <tr><td>90–100%</td><td className="text-green-600">{formatMoney(4000)}</td></tr>
                <tr><td>100–110%</td><td className="text-green-700">{formatMoney(6000)}</td></tr>
                <tr><td>Более 110%</td><td className="text-green-800 font-bold">{formatMoney(8000)}</td></tr>
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
