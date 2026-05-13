'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'

interface Service {
  id: string
  name: string
  direction: 'massage' | 'cosmetology' | 'kim8' | 'other'
  duration_min: number
  price: number
  is_active: boolean
}

const DIRECTION_LABELS: Record<string, string> = {
  massage: 'Массаж (ручной)',
  kim8: 'Массаж (Kim8)',
  cosmetology: 'Косметология',
  other: 'Прочее',
}

const DIRECTION_COLORS: Record<string, string> = {
  massage: 'badge-purple',
  kim8: 'badge-blue',
  cosmetology: 'badge-pink',
  other: 'badge-gray',
}

export default function ServicesPage() {
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [form, setForm] = useState({
    name: '',
    direction: 'massage' as Service['direction'],
    duration_min: 60,
    price: '',
  })

  async function load() {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('direction')
      .order('name')
    if (data) setServices(data as Service[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!form.name.trim()) return alert('Введите название услуги')
    if (!form.price) return alert('Введите цену')
    const { error } = await supabase.from('services').insert({
      name: form.name.trim(),
      direction: form.direction,
      duration_min: form.duration_min,
      price: parseFloat(form.price),
      is_active: true,
    })
    if (error) return alert('Ошибка: ' + error.message)
    setForm({ name: '', direction: 'massage', duration_min: 60, price: '' })
    setShowForm(false)
    load()
  }

  async function toggleActive(id: string, is_active: boolean) {
    await supabase.from('services').update({ is_active }).eq('id', id)
    setServices(s => s.map(svc => svc.id === id ? { ...svc, is_active } : svc))
  }

  const filtered = filter === 'all'
    ? services
    : services.filter(s => s.direction === filter)

  const grouped = filtered.reduce((acc, s) => {
    const key = s.direction
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {} as Record<string, Service[]>)

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Услуги</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Добавить услугу
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Услуги привязываются к визитам и используются в технологических картах и аналитике.
      </p>

      {showForm && (
        <div className="card mb-5 max-w-lg">
          <div className="card-body space-y-4">
            <h3 className="font-semibold">Новая услуга</h3>
            <div>
              <label className="label">Название *</label>
              <input
                className="input"
                placeholder="Классический массаж спины"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Направление</label>
                <select
                  className="input"
                  value={form.direction}
                  onChange={e => setForm(f => ({ ...f, direction: e.target.value as Service['direction'] }))}
                >
                  <option value="massage">Массаж (ручной)</option>
                  <option value="kim8">Массаж (Kim8)</option>
                  <option value="cosmetology">Косметология</option>
                  <option value="other">Прочее</option>
                </select>
              </div>
              <div>
                <label className="label">Длительность, мин</label>
                <input
                  type="number"
                  className="input"
                  value={form.duration_min}
                  onChange={e => setForm(f => ({ ...f, duration_min: parseInt(e.target.value) }))}
                  min="5" max="480" step="5"
                />
              </div>
            </div>
            <div>
              <label className="label">Цена, Br *</label>
              <input
                type="number"
                className="input"
                placeholder="2500"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                min="0" step="50"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} className="btn-primary">Добавить</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Фильтр */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'massage', 'kim8', 'cosmetology', 'other'].map(d => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={filter === d ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            {d === 'all' ? 'Все' : DIRECTION_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Список сгруппированный по направлению */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([direction, items]) => (
          <div key={direction} className="card">
            <div className="card-header">
              <span className={DIRECTION_COLORS[direction]}>{DIRECTION_LABELS[direction]}</span>
              <span className="text-xs text-gray-400 ml-2">{items.length} услуг</span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Длит.</th>
                    <th>Цена</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(svc => (
                    <tr key={svc.id}>
                      <td className={`font-medium ${!svc.is_active ? 'text-gray-400 line-through' : ''}`}>
                        {svc.name}
                      </td>
                      <td className="text-gray-500">{svc.duration_min} мин</td>
                      <td className="font-semibold">{formatMoney(svc.price)}</td>
                      <td>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={svc.is_active}
                            onChange={e => toggleActive(svc.id, e.target.checked)}
                            className="accent-violet-600"
                          />
                          <span className="text-xs text-gray-500">
                            {svc.is_active ? 'Активна' : 'Скрыта'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div className="card">
            <div className="card-body text-center text-gray-400 py-10">
              Услуг пока нет. Добавьте первую.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
