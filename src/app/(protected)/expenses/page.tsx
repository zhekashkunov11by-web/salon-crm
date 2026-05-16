'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface ExpenseCategory {
  id: string
  name: string
  cfs_section: 'operating' | 'investing' | 'financing'
  pnl_section: 'cogs' | 'opex' | 'capex' | 'other'
  direction?: string
}

interface Account {
  id: string
  name: string
  type: string
}

interface Expense {
  id: string
  date: string
  category_id: string
  category_name?: string
  amount: number
  account_id?: string
  account_name?: string
  description?: string
  supply_item_id?: string
  supply_item_name?: string
  quantity?: number
  unit?: string
  unit_price?: number
  created_at: string
}

const CFS_LABELS: Record<string, string> = {
  operating: '💼 Операционная деятельность',
  investing: '🏗 Инвестиционная деятельность',
  financing: '💰 Финансовая деятельность',
}

const PNL_LABELS: Record<string, string> = {
  cogs: 'Себестоимость (COGS)',
  opex: 'Операционные расходы (OPEX)',
  capex: 'Капитальные затраты (CAPEX)',
  other: 'Прочие',
}

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    amount: '',
    account_id: '',
    description: '',
    quantity: '',
    unit_price: '',
  })

  const load = useCallback(async () => {
    const from = `${month}-01`
    const to = `${month}-31`
    const [expRes, catRes, accRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, expense_categories(name, cfs_section, pnl_section), accounts(name), supply_items(name)')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('accounts').select('*').order('sort_order'),
    ])
    if (expRes.data) {
      const mapped = expRes.data.map((e: Expense & {
        expense_categories?: { name: string; cfs_section: string; pnl_section: string }
        accounts?: { name: string }
        supply_items?: { name: string }
      }) => ({
        ...e,
        category_name: e.expense_categories?.name,
        account_name: e.accounts?.name,
        supply_item_name: e.supply_items?.name,
      }))
      setExpenses(mapped as Expense[])
    }
    if (catRes.data) setCategories(catRes.data as ExpenseCategory[])
    if (accRes.data) setAccounts(accRes.data as Account[])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const selectedCategory = categories.find(c => c.id === form.category_id)

  function handleQtyChange(qty: string, price: string) {
    const q = parseFloat(qty)
    const p = parseFloat(price)
    if (!isNaN(q) && !isNaN(p)) {
      setForm(f => ({ ...f, quantity: qty, unit_price: price, amount: String(q * p) }))
    } else {
      setForm(f => ({ ...f, quantity: qty, unit_price: price }))
    }
  }

  async function handleAdd() {
    if (!form.date) return alert('Укажите дату')
    if (!form.category_id) return alert('Выберите категорию')
    if (!form.amount) return alert('Введите сумму')

    const { error } = await supabase.from('expenses').insert({
      date: form.date,
      category_id: form.category_id,
      amount: parseFloat(form.amount),
      account_id: form.account_id || null,
      description: form.description || null,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
    })
    if (error) return alert('Ошибка: ' + error.message)
    setForm({
      date: new Date().toISOString().split('T')[0],
      category_id: '',
      amount: '',
      account_id: '',
      description: '',
      quantity: '',
      unit_price: '',
    })
    setShowForm(false)
    load()
  }

  // Group expenses by CFS section
  const grouped = expenses.reduce((acc, e) => {
    const cat = categories.find(c => c.id === e.category_id)
    const section = cat?.cfs_section || 'operating'
    if (!acc[section]) acc[section] = []
    acc[section].push(e)
    return acc
  }, {} as Record<string, Expense[]>)

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Журнал расходов</h1>
        <div className="flex gap-2">
          <input
            type="month"
            className="input"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Добавить расход
          </button>
        </div>
      </div>

      <HelpPanel id="expenses" title="Как вести журнал расходов" items={[
        { icon: '➕', title: 'Добавить расход', text: 'Нажмите «+ Добавить расход». Укажите дату, сумму, категорию. Расход попадёт в финансовые отчёты (ДДС и P&L).' },
        { icon: '🗂️', title: 'Категории', text: 'Каждый расход привязывается к категории — настройте их в Настройки → Категории расходов. Категория определяет строку в ДДС/P&L.' },
        { icon: '📊', title: 'Связь с финансами', text: 'Все расходы из этого журнала автоматически отображаются в разделе Финансы (ДДС и P&L) за соответствующий месяц.' },
        { icon: '🔄', title: 'Рекламные расходы', text: 'Расходы на Facebook и Instagram добавляются автоматически при синхронизации. Вручную добавлять их не нужно.' },
        { icon: '📅', title: 'Выбор месяца', text: 'Переключайте месяцы для просмотра истории расходов.' },
        { icon: '🏷️', title: 'Статья ДДС/P&L', text: 'Категория расхода определяет, куда он попадёт: операционные/инвестиционные/финансовые расходы в ДДС; себестоимость/операционные/прочие в P&L.' },
      ]} />

      {/* Add form */}
      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Новый расход</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">✕</button>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Дата</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Счёт списания</label>
                <select
                  className="input"
                  value={form.account_id}
                  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                >
                  <option value="">— не указан —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Категория *</label>
              <select
                className="input"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">— выберите категорию —</option>
                {['operating', 'investing', 'financing'].map(section => {
                  const sectionCats = categories.filter(c => c.cfs_section === section)
                  if (sectionCats.length === 0) return null
                  return (
                    <optgroup key={section} label={CFS_LABELS[section]}>
                      {sectionCats.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>

              {selectedCategory && (
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="badge-blue">ДДС: {CFS_LABELS[selectedCategory.cfs_section]?.replace(/^.+ /, '')}</span>
                  <span className="badge-purple">PnL: {PNL_LABELS[selectedCategory.pnl_section]}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Количество</label>
                <input
                  type="number"
                  className="input"
                  placeholder="1"
                  value={form.quantity}
                  onChange={e => handleQtyChange(e.target.value, form.unit_price)}
                  min="0" step="0.01"
                />
              </div>
              <div>
                <label className="label">Цена за ед., Br</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={form.unit_price}
                  onChange={e => handleQtyChange(form.quantity, e.target.value)}
                  min="0" step="0.01"
                />
              </div>
              <div>
                <label className="label">Сумма, Br *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  min="0" step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="label">Описание / поставщик</label>
              <input
                className="input"
                placeholder="Комментарий к расходу"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleAdd} className="btn-primary">Добавить</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['operating', 'investing', 'financing'].map(section => {
          const items = grouped[section] || []
          const sectionTotal = items.reduce((s, e) => s + e.amount, 0)
          return (
            <div key={section} className="metric-card">
              <p className="metric-value text-red-600">{formatMoney(sectionTotal)}</p>
              <p className="metric-label">{CFS_LABELS[section]?.replace(/^.+ /, '')}</p>
            </div>
          )
        })}
      </div>

      {/* Expense list grouped by section */}
      {['operating', 'investing', 'financing'].map(section => {
        const items = grouped[section] || []
        if (items.length === 0) return null
        return (
          <div key={section} className="card mb-4">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-sm">{CFS_LABELS[section]}</h2>
              <span className="text-sm font-semibold text-red-600">
                {formatMoney(items.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Категория</th>
                    <th>Описание</th>
                    <th>Счёт</th>
                    <th className="text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.id}>
                      <td className="text-gray-500 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="font-medium">{e.category_name}</td>
                      <td className="text-gray-500 text-sm">{e.description || '—'}</td>
                      <td className="text-gray-400 text-xs">{e.account_name || '—'}</td>
                      <td className="text-right font-semibold text-red-600">{formatMoney(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {expenses.length === 0 && (
        <div className="card">
          <div className="card-body text-center text-gray-400 py-10">
            За {month} расходов нет
          </div>
        </div>
      )}

      {/* Total */}
      {expenses.length > 0 && (
        <div className="flex justify-end mt-4">
          <div className="bg-red-50 border border-red-100 rounded-lg px-6 py-3">
            <span className="text-sm text-gray-600">Итого за {month}: </span>
            <span className="text-lg font-bold text-red-700">{formatMoney(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
