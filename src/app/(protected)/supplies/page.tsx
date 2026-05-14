'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SupplyItem {
  id: string
  name: string
  unit: string
  last_price: number | null
}

interface ProcedureCardItem {
  supply_item_id: string
  quantity: number  // norm per procedure
  // Supabase returns joined row as array in some SDK versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  procedure_card: any
}

interface ExpenseRow {
  supply_item_id: string | null
  quantity: number | null
  unit_price: number | null
  amount: number
  date: string
  description: string | null
}

interface Visit {
  service_name: string
  status: string | null
}

interface SupplyAnalyticsRow {
  item: SupplyItem
  planned_qty: number       // from procedure norms × visit count
  actual_qty: number        // from expenses
  planned_cost: number      // planned_qty × last_price
  actual_cost: number       // from expenses.amount
  deviation_qty: number     // actual - planned
  deviation_pct: number     // (actual - planned) / planned × 100
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 }).format(n) + ' Br'
}


export default function SuppliesPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<SupplyAnalyticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'over' | 'under'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const from = `${month}-01`
    const to = `${month}-31`

    const [itemsRes, cardItemsRes, expensesRes, visitsRes] = await Promise.all([
      supabase.from('supply_items').select('id, name, unit, last_price').eq('is_active', true).order('name'),
      supabase.from('procedure_card_items').select(`
        supply_item_id, quantity,
        procedure_card:procedure_cards(service_id, name)
      `),
      supabase.from('expenses')
        .select('supply_item_id, quantity, unit_price, amount, date, description')
        .gte('date', from).lte('date', to)
        .not('supply_item_id', 'is', null),
      supabase.from('visits')
        .select('service_name, status')
        .gte('visit_date', from).lte('visit_date', to)
        .neq('status', 'cancelled'),
    ])

    const items = (itemsRes.data || []) as SupplyItem[]
    const cardItems = (cardItemsRes.data || []) as unknown as ProcedureCardItem[]
    const expenses = (expensesRes.data || []) as ExpenseRow[]
    const visits = (visitsRes.data || []) as Visit[]

    // Build: supply_item_id → planned qty based on visits × norms
    // Match visit service_name to procedure_card.name (fuzzy: lower-case contains)
    const plannedQtyMap: Record<string, number> = {}
    const plannedCostMap: Record<string, number> = {}

    for (const cardItem of cardItems) {
      if (!cardItem.procedure_card) continue
      // Supabase may return joined row as array or object
      const pc = Array.isArray(cardItem.procedure_card)
        ? cardItem.procedure_card[0]
        : cardItem.procedure_card
      if (!pc?.name) continue
      const cardName = pc.name.toLowerCase()

      // Count visits matching this procedure card
      const matchingVisits = visits.filter(v =>
        v.service_name.toLowerCase().includes(cardName) ||
        cardName.includes(v.service_name.toLowerCase().slice(0, 6))
      )

      const qty = matchingVisits.length * cardItem.quantity
      plannedQtyMap[cardItem.supply_item_id] = (plannedQtyMap[cardItem.supply_item_id] || 0) + qty
    }

    // Build: supply_item_id → actual qty & cost from expenses
    const actualQtyMap: Record<string, number> = {}
    const actualCostMap: Record<string, number> = {}

    for (const exp of expenses) {
      if (!exp.supply_item_id) continue
      actualQtyMap[exp.supply_item_id] = (actualQtyMap[exp.supply_item_id] || 0) + (exp.quantity || 0)
      actualCostMap[exp.supply_item_id] = (actualCostMap[exp.supply_item_id] || 0) + exp.amount
    }

    // Compute planned cost using last_price
    for (const item of items) {
      const price = item.last_price || 0
      plannedCostMap[item.id] = (plannedQtyMap[item.id] || 0) * price
    }

    // Build analytics rows for items that have either planned or actual data
    const analyticsRows: SupplyAnalyticsRow[] = items
      .map(item => {
        const planned_qty = plannedQtyMap[item.id] || 0
        const actual_qty = actualQtyMap[item.id] || 0
        const planned_cost = plannedCostMap[item.id] || 0
        const actual_cost = actualCostMap[item.id] || 0
        const deviation_qty = actual_qty - planned_qty
        const deviation_pct = planned_qty > 0 ? (deviation_qty / planned_qty) * 100 : 0

        return { item, planned_qty, actual_qty, planned_cost, actual_cost, deviation_qty, deviation_pct }
      })
      .filter(r => r.planned_qty > 0 || r.actual_qty > 0)

    setRows(analyticsRows)
    setLoading(false)
  }, [month, supabase])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    if (filter === 'over') return r.deviation_qty > 0
    if (filter === 'under') return r.deviation_qty < 0
    return true
  })

  const totalPlannedCost = rows.reduce((s, r) => s + r.planned_cost, 0)
  const totalActualCost = rows.reduce((s, r) => s + r.actual_cost, 0)
  const overItems = rows.filter(r => r.deviation_qty > 0.001).length
  const underItems = rows.filter(r => r.deviation_qty < -0.001).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Расходники</h1>
          <p className="text-sm text-gray-500">Норма по процедурным картам vs фактические закупки</p>
        </div>
        <input
          type="month"
          className="input"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Плановые затраты</p>
          <p className="text-xl font-bold text-gray-900">{formatMoney(totalPlannedCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Фактические затраты</p>
          <p className={`text-xl font-bold ${totalActualCost > totalPlannedCost ? 'text-red-600' : 'text-green-600'}`}>
            {formatMoney(totalActualCost)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Перерасход (позиций)</p>
          <p className="text-xl font-bold text-red-600">{overItems}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 mb-1">Экономия (позиций)</p>
          <p className="text-xl font-bold text-green-600">{underItems}</p>
        </div>
      </div>

      {/* Фильтр */}
      <div className="flex gap-2 mb-4">
        {([['all', 'Все'], ['over', 'Перерасход'], ['under', 'Экономия']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filter === val
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 font-medium">Нет данных по расходникам за {month}</p>
          <p className="text-sm text-gray-400 mt-1">
            Добавьте нормы в процедурные карты и записывайте закупки в разделе «Расходы»
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Ед.</th>
                  <th>Норма (план)</th>
                  <th>Закуплено (факт)</th>
                  <th>Отклонение</th>
                  <th>Затраты план</th>
                  <th>Затраты факт</th>
                  <th>Разница</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const isOver = row.deviation_qty > 0.001
                  const isUnder = row.deviation_qty < -0.001
                  const costDiff = row.actual_cost - row.planned_cost
                  return (
                    <tr key={row.item.id}>
                      <td className="font-medium">{row.item.name}</td>
                      <td className="text-gray-500 text-xs">{row.item.unit}</td>
                      <td className="text-gray-600">
                        {row.planned_qty > 0
                          ? new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 3 }).format(row.planned_qty)
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="text-gray-600">
                        {row.actual_qty > 0
                          ? new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 3 }).format(row.actual_qty)
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td>
                        {row.planned_qty > 0 ? (
                          <span className={`text-sm font-medium ${isOver ? 'text-red-600' : isUnder ? 'text-green-600' : 'text-gray-400'}`}>
                            {isOver ? '+' : ''}{new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 1 }).format(row.deviation_qty)}
                            {' '}
                            <span className="text-xs opacity-70">
                              ({isOver ? '+' : ''}{row.deviation_pct.toFixed(0)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">нет нормы</span>
                        )}
                      </td>
                      <td className="text-gray-600">
                        {row.planned_cost > 0 ? formatMoney(row.planned_cost) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={row.actual_cost > 0 ? 'font-medium' : ''}>
                        {row.actual_cost > 0 ? formatMoney(row.actual_cost) : <span className="text-gray-300">—</span>}
                      </td>
                      <td>
                        {row.planned_cost > 0 && row.actual_cost > 0 ? (
                          <span className={`text-sm font-medium ${costDiff > 0 ? 'text-red-600' : costDiff < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {costDiff > 0 ? '+' : ''}{formatMoney(costDiff)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={5}>Итого</td>
                  <td>{formatMoney(totalPlannedCost)}</td>
                  <td className={totalActualCost > totalPlannedCost ? 'text-red-600' : 'text-green-600'}>
                    {formatMoney(totalActualCost)}
                  </td>
                  <td className={totalActualCost - totalPlannedCost > 0 ? 'text-red-600' : 'text-green-600'}>
                    {totalActualCost > totalPlannedCost ? '+' : ''}
                    {formatMoney(totalActualCost - totalPlannedCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Подсказка */}
      <div className="card mt-6 bg-amber-50 border-amber-200 max-w-2xl">
        <div className="card-body">
          <h3 className="font-semibold text-amber-800 mb-1">Как работает расчёт</h3>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li><strong>Норма (план)</strong> = количество визитов за месяц × норма из процедурной карты</li>
            <li><strong>Факт</strong> = закупки из раздела «Расходы» с привязкой к позиции расходника</li>
            <li>Сопоставление: название процедурной карты ищется в названии услуги из визита</li>
            <li>Настройте нормы в Настройки → Процедурные карты</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
