'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'

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
  months: number | null           // null = бессрочно
  condition_type: 'none' | 'return_rate_above'
  condition_threshold: number     // например 20 (%)
  fallback_rate: number           // ставка если условие не выполнено
}

interface SalaryConditions {
  periods: SalaryPeriod[]
  active_period: number           // индекс текущего периода
  period_started: string          // дата начала текущего периода
}

const DEFAULT_PERIOD: SalaryPeriod = {
  label: 'Основной период',
  rate_percent: 30,
  subscription_rate: 5,
  months: null,
  condition_type: 'none',
  condition_threshold: 20,
  fallback_rate: 30,
}

const DEFAULT_RATES: Record<string, ServiceRates> = {
  manual: {
    manual_new_month: 33,
    manual_repeat_low: 35,
    manual_repeat_high: 40,
    kim8_primary: 0, kim8_repeat: 0,
    cosmo_primary: 0, cosmo_repeat: 0, cosmo_cosmetics: 0,
    subscription_sale: 5,
  },
  kim8: {
    manual_new_month: 0, manual_repeat_low: 0, manual_repeat_high: 0,
    kim8_primary: 20, kim8_repeat: 30,
    cosmo_primary: 0, cosmo_repeat: 0, cosmo_cosmetics: 0,
    subscription_sale: 5,
  },
  cosmetologist: {
    manual_new_month: 0, manual_repeat_low: 0, manual_repeat_high: 0,
    kim8_primary: 0, kim8_repeat: 0,
    cosmo_primary: 20, cosmo_repeat: 30, cosmo_cosmetics: 5,
    subscription_sale: 5,
  },
  admin: {
    manual_new_month: 0, manual_repeat_low: 0, manual_repeat_high: 0,
    kim8_primary: 0, kim8_repeat: 0,
    cosmo_primary: 0, cosmo_repeat: 0, cosmo_cosmetics: 0,
    subscription_sale: 5,
  },
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
  dikidi_id?: string
  service_rates?: ServiceRates
  return_rate_threshold?: number
  // Управленческий учёт (только для владельца)
  salary_envelope?: number
  salary_envelope_type?: 'per_month' | 'per_shift'
  salary_conditions?: SalaryConditions | null
}

const ROLE_LABELS: Record<string, string> = {
  manual: 'Массаж (ручной)',
  kim8: 'Массаж (Kim8)',
  cosmetologist: 'Косметолог',
  admin: 'Администратор',
}

const ROLE_COLORS: Record<string, string> = {
  manual: 'badge-purple',
  kim8: 'badge-blue',
  cosmetologist: 'badge-pink',
  admin: 'badge-yellow',
}

function RatesEditor({ role, rates, onChange }: {
  role: string
  rates: ServiceRates
  onChange: (r: ServiceRates) => void
}) {
  function f(key: keyof ServiceRates, label: string) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-600">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="input w-16 text-center text-sm py-1"
            value={rates[key]}
            min={0} max={100} step={0.5}
            onChange={e => onChange({ ...rates, [key]: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-gray-400">%</span>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ставки по типу услуги</p>
      {role === 'manual' && <>
        {f('manual_new_month', 'Ручной массаж — 1-й месяц работы')}
        {f('manual_repeat_low', 'Ручной массаж — возврат < 30%')}
        {f('manual_repeat_high', 'Ручной массаж — возврат ≥ 30%')}
      </>}
      {role === 'kim8' && <>
        {f('kim8_primary', 'Kim8 — первичный визит')}
        {f('kim8_repeat', 'Kim8 — повторный визит')}
      </>}
      {role === 'cosmetologist' && <>
        {f('cosmo_primary', 'Косметология — первичный визит')}
        {f('cosmo_repeat', 'Косметология — повторный визит')}
        {f('cosmo_cosmetics', 'Продажа косметики')}
      </>}
      {f('subscription_sale', 'Продажа абонемента (бонус)')}
    </div>
  )
}

// Редактор периодов зарплаты (только владелец)
function SalaryConditionsEditor({ conditions, onChange }: {
  conditions: SalaryConditions
  onChange: (c: SalaryConditions) => void
}) {
  function updatePeriod(idx: number, patch: Partial<SalaryPeriod>) {
    const periods = conditions.periods.map((p, i) => i === idx ? { ...p, ...patch } : p)
    onChange({ ...conditions, periods })
  }

  function addPeriod() {
    if (conditions.periods.length >= 4) return
    const last = conditions.periods[conditions.periods.length - 1]
    onChange({
      ...conditions,
      periods: [...conditions.periods, {
        ...DEFAULT_PERIOD,
        label: `Период ${conditions.periods.length + 1}`,
        rate_percent: last?.rate_percent ?? 30,
        subscription_rate: last?.subscription_rate ?? 5,
      }],
    })
  }

  function removePeriod(idx: number) {
    if (conditions.periods.length <= 1) return
    const periods = conditions.periods.filter((_, i) => i !== idx)
    onChange({ ...conditions, periods, active_period: Math.min(conditions.active_period, periods.length - 1) })
  }

  return (
    <div className="space-y-3">
      {conditions.periods.map((p, idx) => {
        const isActive = idx === conditions.active_period
        return (
          <div key={idx} className={`rounded-xl border p-3 ${isActive ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isActive && <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Текущий</span>}
                <input
                  className="input text-sm py-1 w-40"
                  value={p.label}
                  onChange={e => updatePeriod(idx, { label: e.target.value })}
                  placeholder="Название периода"
                />
              </div>
              {conditions.periods.length > 1 && (
                <button onClick={() => removePeriod(idx)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Ставка, %</p>
                <input type="number" className="input text-sm py-1" min={0} max={100} step={0.5}
                  value={p.rate_percent}
                  onChange={e => updatePeriod(idx, { rate_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Бонус за абонемент, %</p>
                <input type="number" className="input text-sm py-1" min={0} max={100} step={0.5}
                  value={p.subscription_rate}
                  onChange={e => updatePeriod(idx, { subscription_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Длительность (мес.)</p>
                <input type="number" className="input text-sm py-1" min={1} max={24}
                  value={p.months ?? ''}
                  placeholder="∞"
                  onChange={e => updatePeriod(idx, { months: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Условие перехода */}
            <div className="mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-violet-600"
                  checked={p.condition_type === 'return_rate_above'}
                  onChange={e => updatePeriod(idx, { condition_type: e.target.checked ? 'return_rate_above' : 'none' })}
                />
                Ставка зависит от % возвращаемости клиентов
              </label>
              {p.condition_type === 'return_rate_above' && (
                <div className="grid grid-cols-2 gap-2 mt-2 pl-5">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Если возвращаемость выше, %</p>
                    <input type="number" className="input text-sm py-1" min={1} max={99}
                      value={p.condition_threshold}
                      onChange={e => updatePeriod(idx, { condition_threshold: parseFloat(e.target.value) || 20 })}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ставка если условие НЕ выполнено, %</p>
                    <input type="number" className="input text-sm py-1" min={0} max={100} step={0.5}
                      value={p.fallback_rate}
                      onChange={e => updatePeriod(idx, { fallback_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {conditions.periods.length < 4 && (
        <button onClick={addPeriod} className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1">
          + Добавить следующий период
        </button>
      )}
    </div>
  )
}

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Staff> & { service_rates?: ServiceRates }>({
    role: 'manual',
    rate_percent: 35,
    tax_rate: 13,
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
    return_rate_threshold: 30,
    service_rates: DEFAULT_RATES.manual,
    salary_envelope: 0,
    salary_envelope_type: 'per_month',
    salary_conditions: null,
  })

  async function load() {
    const { data } = await supabase.from('staff').select('*').order('is_active', { ascending: false })
    if (data) setStaff(data as Staff[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => setIsOwner(data?.role === 'owner'))
      }
    })
  }, [])

  function openAdd() {
    setEditId(null)
    setForm({
      role: 'manual',
      rate_percent: 35,
      tax_rate: 13,
      is_active: true,
      start_date: new Date().toISOString().split('T')[0],
      return_rate_threshold: 30,
      service_rates: DEFAULT_RATES.manual,
      salary_envelope: 0,
      salary_envelope_type: 'per_month',
      salary_conditions: null,
    })
    setShowForm(true)
  }

  function openEdit(s: Staff) {
    setEditId(s.id)
    setForm({
      ...s,
      service_rates: s.service_rates || DEFAULT_RATES[s.role],
      salary_envelope: s.salary_envelope ?? 0,
      salary_envelope_type: s.salary_envelope_type ?? 'per_month',
      salary_conditions: s.salary_conditions ?? null,
    })
    setShowForm(true)
  }

  function onRoleChange(role: string) {
    setForm(f => ({
      ...f,
      role: role as Staff['role'],
      service_rates: DEFAULT_RATES[role],
      rate_percent: role === 'manual' ? 35 : role === 'kim8' ? 30 : role === 'cosmetologist' ? 30 : 0,
    }))
  }

  function initConditions() {
    setForm(f => ({
      ...f,
      salary_conditions: {
        periods: [
          {
            label: '1-й месяц',
            rate_percent: 30,
            subscription_rate: 5,
            months: 1,
            condition_type: 'none',
            condition_threshold: 20,
            fallback_rate: 30,
          },
          {
            label: 'С 2-го месяца',
            rate_percent: 35,
            subscription_rate: 5,
            months: null,
            condition_type: 'return_rate_above',
            condition_threshold: 20,
            fallback_rate: 30,
          },
        ],
        active_period: 0,
        period_started: f.start_date || new Date().toISOString().split('T')[0],
      },
    }))
  }

  async function handleSave() {
    if (!form.name) return alert('Введите имя')
    setSaving(true)

    const payload = {
      name: form.name,
      role: form.role!,
      rate_percent: form.rate_percent!,
      start_date: form.start_date!,
      salary_base_per_shift: form.salary_base_per_shift || null,
      tax_rate: form.tax_rate!,
      is_active: form.is_active ?? true,
      dikidi_id: form.dikidi_id || null,
      service_rates: form.service_rates || DEFAULT_RATES[form.role!],
      return_rate_threshold: form.return_rate_threshold || 30,
      // Управленческие поля
      salary_envelope: form.salary_envelope ?? 0,
      salary_envelope_type: form.salary_envelope_type ?? 'per_month',
      salary_conditions: form.salary_conditions ?? null,
    }

    let error
    if (editId) {
      ;({ error } = await supabase.from('staff').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('staff').insert(payload))
    }

    if (error) alert('Ошибка: ' + error.message)
    else { setShowForm(false); load() }
    setSaving(false)
  }

  async function toggleActive(id: string, is_active: boolean) {
    await supabase.from('staff').update({ is_active }).eq('id', id)
    setStaff(s => s.map(m => m.id === id ? { ...m, is_active } : m))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Сотрудники</h1>
        <button onClick={openAdd} className="btn-primary">+ Добавить</button>
      </div>

      {/* Форма */}
      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">{editId ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">✕</button>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Имя и фамилия *</label>
                <input
                  className="input"
                  placeholder="Иванова Мария"
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Роль *</label>
                <select className="input" value={form.role} onChange={e => onRoleChange(e.target.value)}>
                  <option value="manual">Массаж (ручной)</option>
                  <option value="kim8">Массаж (Kim8)</option>
                  <option value="cosmetologist">Косметолог</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Дата начала работы</label>
                <input type="date" className="input"
                  value={form.start_date || ''}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Подоходный налог, %</label>
                <input type="number" className="input"
                  value={form.tax_rate || 13}
                  onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) }))}
                  min="0" max="30" step="0.5"
                />
              </div>
            </div>

            {form.role === 'admin' ? (
              <div>
                <label className="label">Оклад за смену, Br</label>
                <input type="number" className="input" placeholder="1500"
                  value={form.salary_base_per_shift || ''}
                  onChange={e => setForm(f => ({ ...f, salary_base_per_shift: parseFloat(e.target.value) }))}
                />
                <p className="text-xs text-gray-400 mt-1">Бонусная шкала настраивается в Настройках → Общие</p>
              </div>
            ) : (
              <div>
                <label className="label">Базовый % (для справки)</label>
                <input type="number" className="input w-32"
                  value={form.rate_percent || 35}
                  onChange={e => setForm(f => ({ ...f, rate_percent: parseFloat(e.target.value) }))}
                  min="0" max="100" step="0.5"
                />
              </div>
            )}

            {form.role !== 'admin' && form.service_rates && (
              <RatesEditor
                role={form.role!}
                rates={form.service_rates}
                onChange={r => setForm(f => ({ ...f, service_rates: r }))}
              />
            )}

            {form.role === 'manual' && (
              <div>
                <label className="label">Порог возвращаемости для 40%, %</label>
                <input type="number" className="input w-32"
                  value={form.return_rate_threshold || 30}
                  onChange={e => setForm(f => ({ ...f, return_rate_threshold: parseInt(e.target.value) }))}
                  min="10" max="60"
                />
                <p className="text-xs text-gray-400 mt-1">Если % вернувшихся ≥ этого значения — применяется повышенная ставка</p>
              </div>
            )}

            <div>
              <label className="label">ID в Dikidi (для синхронизации)</label>
              <input type="text" className="input" placeholder="Необязательно"
                value={form.dikidi_id || ''}
                onChange={e => setForm(f => ({ ...f, dikidi_id: e.target.value }))}
              />
            </div>

            {/* ====================== УПРАВЛЕНЧЕСКИЙ УЧЁТ (только владелец) ====================== */}
            {isOwner && (
              <div className="mt-2 pt-4 border-t border-dashed border-violet-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">🔒 Управленческий учёт</span>
                  <span className="text-xs text-gray-400">Видно только вам</span>
                </div>

                {/* Конверт (неофициальная часть) */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-800">Надбавка наличными (конверт)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Сумма, Br</label>
                      <input type="number" className="input"
                        placeholder="0"
                        value={form.salary_envelope || ''}
                        onChange={e => setForm(f => ({ ...f, salary_envelope: parseFloat(e.target.value) || 0 }))}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Начисление</label>
                      <select className="input"
                        value={form.salary_envelope_type || 'per_month'}
                        onChange={e => setForm(f => ({ ...f, salary_envelope_type: e.target.value as 'per_month' | 'per_shift' }))}>
                        <option value="per_month">Фиксированно в месяц</option>
                        <option value="per_shift">За каждую смену</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 opacity-70">
                    {form.salary_envelope_type === 'per_shift'
                      ? 'Сумма × количество отработанных смен за месяц'
                      : 'Фиксированная сумма вне зависимости от числа смен'}
                  </p>
                </div>

                {/* Периоды и условия */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">Условия по периодам работы</p>
                    {!form.salary_conditions && (
                      <button onClick={initConditions} className="text-xs text-violet-600 hover:underline">
                        + Добавить условия
                      </button>
                    )}
                    {form.salary_conditions && (
                      <button
                        onClick={() => setForm(f => ({ ...f, salary_conditions: null }))}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        Убрать условия
                      </button>
                    )}
                  </div>

                  {form.salary_conditions && (
                    <SalaryConditionsEditor
                      conditions={form.salary_conditions}
                      onChange={c => setForm(f => ({ ...f, salary_conditions: c }))}
                    />
                  )}

                  {!form.salary_conditions && (
                    <p className="text-xs text-gray-400 italic">
                      Без условий — ставки фиксированные. Добавьте условия если ставка зависит от стажа или возвращаемости.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Список сотрудников */}
      <div className="space-y-3 max-w-2xl">
        {staff.map(m => {
          const rates = m.service_rates
          const hasEnvelope = isOwner && (m.salary_envelope || 0) > 0
          const conditions = m.salary_conditions
          const activePeriod = conditions?.periods[conditions.active_period]

          return (
            <div key={m.id} className={`card p-4 ${!m.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-semibold text-sm">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{m.name}</span>
                      <span className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</span>
                      {!m.is_active && <span className="badge-red">Уволен</span>}
                      {conditions && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                          {activePeriod?.label || `Период ${(conditions.active_period + 1)}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      С {formatDate(m.start_date)} · Налог {m.tax_rate}%
                      {m.dikidi_id ? ` · Dikidi #${m.dikidi_id}` : ''}
                    </p>

                    {m.role !== 'admin' && rates && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        {m.role === 'manual' && <>
                          <span>1-й мес: {rates.manual_new_month}%</span>
                          <span>повт. {'<'}30%: {rates.manual_repeat_low}%</span>
                          <span>повт. ≥30%: {rates.manual_repeat_high}%</span>
                        </>}
                        {m.role === 'kim8' && <>
                          <span>первичный: {rates.kim8_primary}%</span>
                          <span>повторный: {rates.kim8_repeat}%</span>
                        </>}
                        {m.role === 'cosmetologist' && <>
                          <span>первичный: {rates.cosmo_primary}%</span>
                          <span>повторный: {rates.cosmo_repeat}%</span>
                          <span>косметика: {rates.cosmo_cosmetics}%</span>
                        </>}
                        <span>продажа аб.: {rates.subscription_sale}%</span>
                      </div>
                    )}
                    {m.role === 'admin' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Оклад {m.salary_base_per_shift || 0} Br/смену
                      </p>
                    )}
                    {/* Конверт (только владелец) */}
                    {hasEnvelope && (
                      <p className="text-xs text-amber-600 mt-1">
                        🔒 Конверт: {m.salary_envelope} Br / {m.salary_envelope_type === 'per_shift' ? 'смену' : 'месяц'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(m)} className="text-xs text-violet-600 hover:underline">
                    Изменить
                  </button>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m.is_active}
                      onChange={e => toggleActive(m.id, e.target.checked)}
                      className="accent-violet-600"
                    />
                    <span className="text-xs text-gray-400">{m.is_active ? 'Активен' : 'Уволен'}</span>
                  </label>
                </div>
              </div>
            </div>
          )
        })}
        {staff.length === 0 && (
          <div className="card p-10 text-center text-gray-400">
            Сотрудников ещё нет. Нажмите «Добавить».
          </div>
        )}
      </div>
    </div>
  )
}
