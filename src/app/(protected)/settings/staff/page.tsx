'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'

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

export default function StaffPage() {
  const supabase = createClient()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Staff>>({
    role: 'manual',
    rate_percent: 35,
    tax_rate: 13,
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
  })

  async function load() {
    const { data } = await supabase.from('staff').select('*').order('is_active', { ascending: false })
    if (data) setStaff(data as Staff[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!form.name) return alert('Введите имя')

    const { error } = await supabase.from('staff').insert({
      name: form.name,
      role: form.role!,
      rate_percent: form.rate_percent!,
      start_date: form.start_date!,
      salary_base_per_shift: form.salary_base_per_shift,
      tax_rate: form.tax_rate!,
      is_active: true,
      dikidi_id: form.dikidi_id || null,
    })

    if (error) {
      alert('Ошибка: ' + error.message)
      return
    }

    setShowForm(false)
    setForm({ role: 'manual', rate_percent: 35, tax_rate: 13, is_active: true, start_date: new Date().toISOString().split('T')[0] })
    load()
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
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Добавить
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="card mb-6 max-w-2xl">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold">Новый сотрудник</h2>
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
                <select
                  className="input"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Staff['role'] }))}
                >
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
                <input
                  type="date"
                  className="input"
                  value={form.start_date || ''}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">НДФЛ, %</label>
                <input
                  type="number"
                  className="input"
                  value={form.tax_rate || 13}
                  onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) }))}
                  min="0" max="30" step="0.5"
                />
              </div>
            </div>

            {form.role !== 'admin' ? (
              <div>
                <label className="label">% от чека</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    className="input w-32"
                    value={form.rate_percent || 35}
                    onChange={e => setForm(f => ({ ...f, rate_percent: parseFloat(e.target.value) }))}
                    min="0" max="100" step="0.5"
                  />
                  <span className="text-sm text-gray-500">
                    {form.role === 'manual' ? '35% стандарт, 30% 1-й месяц работы' : '20-30% в зависимости от визита'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="label">Оклад за смену, ₽</label>
                <input
                  type="number"
                  className="input"
                  placeholder="1500"
                  value={form.salary_base_per_shift || ''}
                  onChange={e => setForm(f => ({ ...f, salary_base_per_shift: parseFloat(e.target.value) }))}
                />
              </div>
            )}

            <div>
              <label className="label">ID в Dikidi (если есть)</label>
              <input
                type="text"
                className="input"
                placeholder="Необязательно — для синхронизации"
                value={form.dikidi_id || ''}
                onChange={e => setForm(f => ({ ...f, dikidi_id: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} className="btn-primary">Сохранить</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Список сотрудников */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Роль</th>
                <th>Ставка</th>
                <th>Начало работы</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td><span className={ROLE_COLORS[m.role]}>{ROLE_LABELS[m.role]}</span></td>
                  <td>
                    {m.role === 'admin'
                      ? `${m.salary_base_per_shift || 0} ₽/смену`
                      : `${m.rate_percent}%`
                    }
                  </td>
                  <td>{formatDate(m.start_date)}</td>
                  <td>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.is_active}
                        onChange={e => toggleActive(m.id, e.target.checked)}
                        className="accent-violet-600"
                      />
                      <span className="text-xs text-gray-500">
                        {m.is_active ? 'Активен' : 'Уволен'}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-8">
                    Сотрудников ещё нет. Добавьте первого.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
