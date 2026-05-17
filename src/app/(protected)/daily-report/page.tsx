'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface DailyReport {
  id?: string
  date: string
  revenue_cash: number
  revenue_card: number
  revenue_online: number
  clients_count: number
  new_clients_count: number
  avg_check: number
  monthly_plan: number
  expenses_cash: number
  notes?: string
  checklist?: Record<string, boolean>
}

const CHECKLIST_ITEMS = [
  'Открытие кассы',
  'Проверка брони на день',
  'Подтверждение визитов клиентам',
  'Уборка и подготовка кабинетов',
  'Закрытие кассы',
  'Сверка выручки',
  'Отчёт отправлен администратору',
  'Закрытие и сдача смены',
]

export default function DailyReportPage() {
  const supabase = createClient()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [monthlyPlan, setMonthlyPlan] = useState(300000)
  const [monthRevenue, setMonthRevenue] = useState(0)

  const [form, setForm] = useState<DailyReport>({
    date,
    revenue_cash: 0,
    revenue_card: 0,
    revenue_online: 0,
    clients_count: 0,
    new_clients_count: 0,
    avg_check: 0,
    monthly_plan: 300000,
    expenses_cash: 0,
    notes: '',
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map(item => [item, false])),
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: reportData } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('date', date)
      .maybeSingle()

    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'monthly_plan')
      .maybeSingle()

    const plan = settingsData?.value ? parseFloat(settingsData.value) : 300000
    setMonthlyPlan(plan)

    const monthStart = date.slice(0, 7) + '-01'
    const monthEnd = date.slice(0, 7) + '-31'
    const { data: monthReports } = await supabase
      .from('daily_reports')
      .select('revenue_cash, revenue_card, revenue_online')
      .gte('date', monthStart)
      .lte('date', monthEnd)

    if (monthReports) {
      const total = monthReports.reduce((s, r) =>
        s + (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0), 0)
      setMonthRevenue(total)
    }

    if (reportData) {
      setForm({
        ...reportData,
        checklist: reportData.checklist || Object.fromEntries(CHECKLIST_ITEMS.map(i => [i, false])),
      } as DailyReport)
    } else {
      setForm({
        date,
        revenue_cash: 0,
        revenue_card: 0,
        revenue_online: 0,
        clients_count: 0,
        new_clients_count: 0,
        avg_check: 0,
        monthly_plan: plan,
        expenses_cash: 0,
        notes: '',
        checklist: Object.fromEntries(CHECKLIST_ITEMS.map(item => [item, false])),
      })
    }
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const totalRevenue = (form.revenue_cash || 0) + (form.revenue_card || 0) + (form.revenue_online || 0)
  const planProgress = monthlyPlan > 0 ? Math.round((monthRevenue / monthlyPlan) * 100) : 0
  const daysInMonth = new Date(new Date(date).getFullYear(), new Date(date).getMonth() + 1, 0).getDate()
  const dayOfMonth = new Date(date).getDate()
  const dayPlan = monthlyPlan / daysInMonth
  const isAheadOfPlan = monthRevenue >= dayPlan * dayOfMonth

  function setChecked(item: string, checked: boolean) {
    setForm(f => ({
      ...f,
      checklist: { ...(f.checklist || {}), [item]: checked }
    }))
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      date: form.date,
      revenue_cash: form.revenue_cash,
      revenue_card: form.revenue_card,
      revenue_online: form.revenue_online,
      clients_count: form.clients_count,
      new_clients_count: form.new_clients_count,
      avg_check: totalRevenue > 0 && form.clients_count > 0
        ? Math.round(totalRevenue / form.clients_count)
        : form.avg_check,
      monthly_plan: monthlyPlan,
      expenses_cash: form.expenses_cash,
      notes: form.notes,
      checklist: form.checklist,
    }

    const { error } = await supabase
      .from('daily_reports')
      .upsert(payload, { onConflict: 'date' })

    setSaving(false)
    if (error) return alert('Ошибка: ' + error.message)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    load()
  }

  async function sendToTelegram() {
    const text = `📊 *Отчёт за ${formatDate(date)}*\n\n` +
      `💵 Наличные: ${formatMoney(form.revenue_cash)}\n` +
      `💳 Карта: ${formatMoney(form.revenue_card)}\n` +
      `📱 Онлайн: ${formatMoney(form.revenue_online)}\n` +
      `📦 *Итого: ${formatMoney(totalRevenue)}*\n\n` +
      `👥 Клиентов: ${form.clients_count} (новых: ${form.new_clients_count})\n` +
      `📈 План месяца: ${planProgress}%` +
      (form.notes ? `\n\n💬 ${form.notes}` : '')

    try {
      await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chat: 'all' }),
      })
      alert('Отчёт отправлен в Telegram')
    } catch {
      alert('Ошибка отправки в Telegram')
    }
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  const checklistDone = Object.values(form.checklist || {}).filter(Boolean).length
  const checklistTotal = CHECKLIST_ITEMS.length

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Ежедневный отчёт</h1>
        <input
          type="date"
          className="input"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      <HelpPanel id="daily-report" title="Как заполнять ежедневный отчёт" items={[
        { icon: '💵', title: 'Выручка по типам оплаты', text: 'Внесите суммы по наличным, карте и онлайн-оплате. Итог попадёт в Аналитику и Финансы.' },
        { icon: '👥', title: 'Количество клиентов', text: 'Сколько клиентов было за день, из них новых. Считается конверсия и LTV.' },
        { icon: '✅', title: 'Чек-лист', text: 'Отметьте выполненные задачи дня — уборка, открытие/закрытие, звонки клиентам и т.д.' },
        { icon: '📊', title: 'Куда идут данные', text: 'Отчёт → Аналитика (выручка, средний чек, динамика), Финансы (доходная часть ДДС/P&L), Зарплата (база для расчёта).' },
        { icon: '📅', title: 'Дата', text: 'По умолчанию — сегодня. Можно выбрать любой день для внесения пропущенных данных.' },
        { icon: '🔒', title: 'Сохранение', text: 'Нажмите «Сохранить отчёт» внизу страницы. Данные сохраняются и отображаются во всех отчётах системы.' },
      ]} />

      {/* Plan progress */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Выполнение плана {date.slice(0, 7)}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${isAheadOfPlan ? 'text-green-600' : 'text-red-600'}`}>
                {planProgress}%
              </span>
              <span className={`badge-${isAheadOfPlan ? 'green' : 'red'}`}>
                {isAheadOfPlan ? '↑ Опережение' : '↓ Отставание'}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${isAheadOfPlan ? 'bg-green-500' : 'bg-violet-500'}`}
              style={{ width: `${Math.min(planProgress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Факт: {formatMoney(monthRevenue)}</span>
            <span>План: {formatMoney(monthlyPlan)}</span>
          </div>
        </div>
      </div>

      {/* Revenue form */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Выручка за {formatDate(date)}</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">💵 Наличные, Br</label>
              <input
                type="number"
                className="input text-right"
                value={form.revenue_cash || ''}
                onChange={e => setForm(f => ({ ...f, revenue_cash: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="label">💳 Карта, Br</label>
              <input
                type="number"
                className="input text-right"
                value={form.revenue_card || ''}
                onChange={e => setForm(f => ({ ...f, revenue_card: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="label">📱 Онлайн, Br</label>
              <input
                type="number"
                className="input text-right"
                value={form.revenue_online || ''}
                onChange={e => setForm(f => ({ ...f, revenue_online: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="bg-violet-50 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-violet-900">Итого выручка</span>
            <span className="text-2xl font-bold text-violet-700">{formatMoney(totalRevenue)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Клиентов за день</label>
              <input
                type="number"
                className="input text-right"
                value={form.clients_count || ''}
                onChange={e => setForm(f => ({ ...f, clients_count: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="label">Из них новых</label>
              <input
                type="number"
                className="input text-right"
                value={form.new_clients_count || ''}
                onChange={e => setForm(f => ({ ...f, new_clients_count: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="label">💸 Расходы нал., Br</label>
              <input
                type="number"
                className="input text-right"
                value={form.expenses_cash || ''}
                onChange={e => setForm(f => ({ ...f, expenses_cash: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {form.clients_count > 0 && totalRevenue > 0 && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Средний чек</p>
                <p className="font-semibold text-gray-900">{formatMoney(totalRevenue / form.clients_count)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Нал. остаток (прим.)</p>
                <p className="font-semibold text-gray-900">{formatMoney(form.revenue_cash - form.expenses_cash)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="card mb-6">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">Чек-лист смены</h2>
          <span className="text-sm text-gray-500">{checklistDone}/{checklistTotal}</span>
        </div>
        <div className="card-body space-y-2">
          {CHECKLIST_ITEMS.map(item => (
            <label key={item} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={form.checklist?.[item] || false}
                onChange={e => setChecked(item, e.target.checked)}
                className="accent-violet-600 w-4 h-4"
              />
              <span className={`text-sm ${form.checklist?.[item] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item}
              </span>
            </label>
          ))}
          <div className="mt-2">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-green-500"
                style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Заметки / события дня</h2>
        </div>
        <div className="card-body">
          <textarea
            className="input min-h-[100px] resize-none w-full"
            value={form.notes || ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Что произошло сегодня? Проблемы, достижения, задачи на завтра..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Сохранение...' : 'Сохранить отчёт'}
        </button>
        {saved && <span className="text-sm text-green-600 self-center">✓ Сохранено</span>}
        <button onClick={sendToTelegram} className="btn-secondary">
          📨 Отправить в Telegram
        </button>
      </div>
    </div>
  )
}
