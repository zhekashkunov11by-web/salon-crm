'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SupplyItem {
  id: string
  name: string
  unit: string
  last_price?: number
  is_active: boolean
}

const UNITS = ['штук', 'мл', 'г', 'литр', 'кг', 'пара', 'упак']

export default function ReferencesPage() {
  const supabase = createClient()
  const [items, setItems] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', unit: 'штук', last_price: '' })
  const [search, setSearch] = useState('')

  async function load() {
    const { data } = await supabase
      .from('supply_items')
      .select('*')
      .order('name')
    if (data) setItems(data as SupplyItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.name.trim()) return alert('Введите название')
    const { data, error } = await supabase.from('supply_items').insert({
      name: form.name.trim(),
      unit: form.unit,
      last_price: form.last_price ? parseFloat(form.last_price) : null,
      is_active: true,
    }).select().single()
    if (error) return alert('Ошибка: ' + error.message)
    if (data) {
      setItems(i => [...i, data as SupplyItem])
      setForm({ name: '', unit: 'штук', last_price: '' })
      setShowForm(false)
    }
  }

  async function updatePrice(id: string, price: string) {
    const val = parseFloat(price)
    if (isNaN(val)) return
    await supabase.from('supply_items').update({ last_price: val }).eq('id', id)
    setItems(i => i.map(item => item.id === id ? { ...item, last_price: val } : item))
  }

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Справочники — Расходники</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Добавить позицию
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Расходники используются в технологических картах для расчёта себестоимости процедур.
        Цена закупки обновляется при внесении расходов.
      </p>

      {showForm && (
        <div className="card mb-5 max-w-lg">
          <div className="card-body space-y-4">
            <h3 className="font-semibold">Новая позиция расходника</h3>
            <div>
              <label className="label">Название *</label>
              <input
                className="input"
                placeholder="Масло массажное классическое"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Единица измерения</label>
                <select
                  className="input"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Цена закупки, ₽</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={form.last_price}
                  onChange={e => setForm(f => ({ ...f, last_price: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} className="btn-primary">Добавить</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div className="mb-4">
        <input
          type="text"
          className="input max-w-sm"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Список */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Ед. изм.</th>
                <th>Цена закупки, ₽</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-gray-500">{item.unit}</td>
                  <td>
                    <input
                      type="number"
                      className="input w-28 text-right"
                      defaultValue={item.last_price ?? ''}
                      placeholder="0"
                      onBlur={e => updatePrice(item.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-400 py-8">
                    {search ? 'Ничего не найдено' : 'Расходников пока нет'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Кнопка перехода к технологическим картам */}
      <div className="mt-6">
        <a href="/settings/references/procedure-cards" className="btn-secondary">
          📋 Технологические карты процедур →
        </a>
      </div>
    </div>
  )
}
