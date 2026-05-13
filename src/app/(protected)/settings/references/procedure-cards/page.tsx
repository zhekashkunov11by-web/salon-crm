'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'

interface Service {
  id: string
  name: string
}

interface SupplyItem {
  id: string
  name: string
  unit: string
  last_price?: number
}

interface CardItem {
  id?: string
  supply_item_id: string
  quantity: number
  unit: string
  supply_item?: SupplyItem
}

interface ProcedureCard {
  id: string
  service_id: string
  name: string
  duration_min: number
  cost_calculated?: number
  is_active: boolean
  services?: Service
  procedure_card_items?: CardItem[]
}

export default function ProcedureCardsPage() {
  const supabase = createClient()
  const [cards, setCards] = useState<ProcedureCard[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    service_id: '',
    name: '',
    duration_min: 60,
  })
  const [editItems, setEditItems] = useState<CardItem[]>([])
  const [editCardId, setEditCardId] = useState<string | null>(null)

  async function load() {
    const [cardsRes, servicesRes, itemsRes] = await Promise.all([
      supabase
        .from('procedure_cards')
        .select('*, services(name), procedure_card_items(*, supply_items(name, unit, last_price))')
        .order('name'),
      supabase.from('services').select('id, name').order('name'),
      supabase.from('supply_items').select('id, name, unit, last_price').eq('is_active', true).order('name'),
    ])
    if (cardsRes.data) setCards(cardsRes.data as ProcedureCard[])
    if (servicesRes.data) setServices(servicesRes.data as Service[])
    if (itemsRes.data) setSupplyItems(itemsRes.data as SupplyItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function calcCost(items: CardItem[]): number {
    return items.reduce((sum, ci) => {
      const price = ci.supply_item?.last_price ?? 0
      return sum + price * ci.quantity
    }, 0)
  }

  async function handleAddCard() {
    if (!form.name.trim()) return alert('Введите название карты')
    const { data, error } = await supabase.from('procedure_cards').insert({
      service_id: form.service_id || null,
      name: form.name.trim(),
      duration_min: form.duration_min,
      is_active: true,
    }).select().single()
    if (error) return alert('Ошибка: ' + error.message)
    if (data) {
      setShowForm(false)
      setForm({ service_id: '', name: '', duration_min: 60 })
      load()
      setEditCardId(data.id)
      setEditItems([])
    }
  }

  function startEditItems(card: ProcedureCard) {
    setEditCardId(card.id)
    setEditItems(
      (card.procedure_card_items || []).map(ci => ({
        id: ci.id,
        supply_item_id: ci.supply_item_id,
        quantity: ci.quantity,
        unit: ci.unit,
        supply_item: ci.supply_item,
      }))
    )
  }

  function addIngredientRow() {
    const first = supplyItems[0]
    if (!first) return
    setEditItems(items => [...items, {
      supply_item_id: first.id,
      quantity: 1,
      unit: first.unit,
      supply_item: first,
    }])
  }

  function updateIngredient(idx: number, field: keyof CardItem, value: string | number) {
    setEditItems(items => items.map((item, i) => {
      if (i !== idx) return item
      if (field === 'supply_item_id') {
        const found = supplyItems.find(s => s.id === value)
        return { ...item, supply_item_id: value as string, unit: found?.unit || item.unit, supply_item: found }
      }
      return { ...item, [field]: value }
    }))
  }

  async function saveItems(cardId: string) {
    // Delete existing
    await supabase.from('procedure_card_items').delete().eq('procedure_card_id', cardId)
    // Insert new
    if (editItems.length > 0) {
      const toInsert = editItems.map(ci => ({
        procedure_card_id: cardId,
        supply_item_id: ci.supply_item_id,
        quantity: ci.quantity,
        unit: ci.unit,
      }))
      const { error } = await supabase.from('procedure_card_items').insert(toInsert)
      if (error) return alert('Ошибка сохранения: ' + error.message)
    }
    // Update cost
    const cost = editItems.reduce((sum, ci) => {
      const price = ci.supply_item?.last_price ?? 0
      return sum + price * ci.quantity
    }, 0)
    await supabase.from('procedure_cards').update({ cost_calculated: cost }).eq('id', cardId)
    setEditCardId(null)
    load()
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Технологические карты</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Новая карта
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Технологическая карта привязана к услуге и содержит список расходников с нормами расхода.
        Себестоимость рассчитывается автоматически по ценам закупки.
      </p>

      {showForm && (
        <div className="card mb-5 max-w-lg">
          <div className="card-body space-y-4">
            <h3 className="font-semibold">Новая технологическая карта</h3>
            <div>
              <label className="label">Название карты *</label>
              <input
                className="input"
                placeholder="Классический массаж спины"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Услуга</label>
                <select
                  className="input"
                  value={form.service_id}
                  onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
                >
                  <option value="">— не привязана —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
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
            <div className="flex gap-3">
              <button onClick={handleAddCard} className="btn-primary">Создать</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.id} className="card">
            <div
              className="card-body flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
            >
              <div>
                <p className="font-medium text-gray-900">{card.name}</p>
                <p className="text-xs text-gray-400">
                  {card.services?.name || 'Без услуги'} · {card.duration_min} мин
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatMoney(card.cost_calculated ?? calcCost(card.procedure_card_items || []))}
                  </p>
                  <p className="text-xs text-gray-400">себестоимость</p>
                </div>
                <span className="text-gray-400">{expandedId === card.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedId === card.id && (
              <div className="border-t border-gray-100 card-body">
                {editCardId === card.id ? (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Состав расходников:</h4>
                    {editItems.map((ci, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          className="input flex-1"
                          value={ci.supply_item_id}
                          onChange={e => updateIngredient(idx, 'supply_item_id', e.target.value)}
                        >
                          {supplyItems.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="input w-24"
                          placeholder="Кол-во"
                          value={ci.quantity}
                          onChange={e => updateIngredient(idx, 'quantity', parseFloat(e.target.value))}
                          min="0.01" step="0.01"
                        />
                        <span className="text-sm text-gray-500 w-12">{ci.unit}</span>
                        <button
                          onClick={() => setEditItems(items => items.filter((_, i) => i !== idx))}
                          className="btn-ghost btn-sm text-red-500"
                        >✕</button>
                      </div>
                    ))}
                    <button onClick={addIngredientRow} className="btn-secondary btn-sm">
                      + Добавить расходник
                    </button>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => saveItems(card.id)} className="btn-primary">Сохранить</button>
                      <button onClick={() => setEditCardId(null)} className="btn-secondary">Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(card.procedure_card_items || []).length === 0 ? (
                      <p className="text-sm text-gray-400">Расходники не добавлены</p>
                    ) : (
                      <table className="table text-sm mb-3">
                        <thead>
                          <tr>
                            <th>Расходник</th>
                            <th>Кол-во</th>
                            <th>Ед.</th>
                            <th>Цена/ед.</th>
                            <th>Итого</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(card.procedure_card_items || []).map((ci, idx) => (
                            <tr key={idx}>
                              <td>{ci.supply_item?.name}</td>
                              <td>{ci.quantity}</td>
                              <td className="text-gray-400">{ci.unit}</td>
                              <td>{formatMoney(ci.supply_item?.last_price ?? 0)}</td>
                              <td className="font-medium">
                                {formatMoney((ci.supply_item?.last_price ?? 0) * ci.quantity)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button onClick={() => startEditItems(card)} className="btn-secondary btn-sm">
                      Редактировать состав
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {cards.length === 0 && (
          <div className="card">
            <div className="card-body text-center text-gray-400 py-10">
              Технологических карт пока нет. Создайте первую.
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <a href="/settings/references" className="btn-secondary">
          ← Назад к расходникам
        </a>
      </div>
    </div>
  )
}
