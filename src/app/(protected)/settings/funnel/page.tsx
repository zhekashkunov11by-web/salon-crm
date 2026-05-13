'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeadStatus {
  id: string
  name: string
  color: string
  sort_order: number
  is_final: boolean
  is_active: boolean
}

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Серый', cls: 'bg-gray-400' },
  { value: 'blue', label: 'Синий', cls: 'bg-blue-500' },
  { value: 'yellow', label: 'Жёлтый', cls: 'bg-yellow-500' },
  { value: 'green', label: 'Зелёный', cls: 'bg-green-500' },
  { value: 'red', label: 'Красный', cls: 'bg-red-500' },
  { value: 'purple', label: 'Фиолетовый', cls: 'bg-violet-500' },
  { value: 'pink', label: 'Розовый', cls: 'bg-pink-500' },
]

export default function FunnelPage() {
  const supabase = createClient()
  const [statuses, setStatuses] = useState<LeadStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', color: 'blue', is_final: false })

  async function load() {
    const { data } = await supabase
      .from('lead_statuses')
      .select('*')
      .order('sort_order')
    if (data) setStatuses(data as LeadStatus[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.name.trim()) return alert('Введите название статуса')
    const { error } = await supabase.from('lead_statuses').insert({
      name: form.name.trim(),
      color: form.color,
      is_final: form.is_final,
      sort_order: statuses.length + 1,
      is_active: true,
    })
    if (error) return alert('Ошибка: ' + error.message)
    setForm({ name: '', color: 'blue', is_final: false })
    setShowForm(false)
    load()
  }

  async function moveUp(id: string, currentOrder: number) {
    if (currentOrder <= 1) return
    const prev = statuses.find(s => s.sort_order === currentOrder - 1)
    if (!prev) return
    await Promise.all([
      supabase.from('lead_statuses').update({ sort_order: currentOrder - 1 }).eq('id', id),
      supabase.from('lead_statuses').update({ sort_order: currentOrder }).eq('id', prev.id),
    ])
    load()
  }

  async function moveDown(id: string, currentOrder: number) {
    if (currentOrder >= statuses.length) return
    const next = statuses.find(s => s.sort_order === currentOrder + 1)
    if (!next) return
    await Promise.all([
      supabase.from('lead_statuses').update({ sort_order: currentOrder + 1 }).eq('id', id),
      supabase.from('lead_statuses').update({ sort_order: currentOrder }).eq('id', next.id),
    ])
    load()
  }

  async function toggleActive(id: string, is_active: boolean) {
    await supabase.from('lead_statuses').update({ is_active }).eq('id', id)
    setStatuses(s => s.map(st => st.id === id ? { ...st, is_active } : st))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Воронка заявок — Статусы</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Добавить статус
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Статусы определяют колонки канбан-доски. Порядок можно менять стрелками.
        Финальные статусы означают завершение сделки (продано или потеряно).
      </p>

      {showForm && (
        <div className="card mb-5 max-w-md">
          <div className="card-body space-y-4">
            <h3 className="font-semibold">Новый статус</h3>
            <div>
              <label className="label">Название *</label>
              <input
                className="input"
                placeholder="Первичный контакт"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label className="label">Цвет</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={`w-7 h-7 rounded-full ${c.cls} ${form.color === c.value ? 'ring-2 ring-offset-2 ring-violet-500' : ''}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_final}
                onChange={e => setForm(f => ({ ...f, is_final: e.target.checked }))}
                className="accent-violet-600"
              />
              <span className="text-sm">Финальный статус (продано / потеряно)</span>
            </label>
            <div className="flex gap-3">
              <button onClick={handleAdd} className="btn-primary">Добавить</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div className="card max-w-2xl">
        <div className="divide-y divide-gray-50">
          {statuses.map(st => {
            const colorCls = COLOR_OPTIONS.find(c => c.value === st.color)?.cls || 'bg-gray-400'
            return (
              <div key={st.id} className={`px-5 py-3 flex items-center gap-4 ${!st.is_active ? 'opacity-50' : ''}`}>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveUp(st.id, st.sort_order)}
                    className="text-xs text-gray-400 hover:text-gray-600 leading-none"
                    disabled={st.sort_order === 1}
                  >▲</button>
                  <button
                    onClick={() => moveDown(st.id, st.sort_order)}
                    className="text-xs text-gray-400 hover:text-gray-600 leading-none"
                    disabled={st.sort_order === statuses.length}
                  >▼</button>
                </div>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colorCls}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{st.name}</p>
                  {st.is_final && (
                    <span className="text-xs text-gray-400">финальный</span>
                  )}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={st.is_active}
                    onChange={e => toggleActive(st.id, e.target.checked)}
                    className="accent-violet-600"
                  />
                  <span className="text-xs text-gray-500">Активен</span>
                </label>
              </div>
            )
          })}
          {statuses.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">
              Статусов нет. Добавьте первый.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
