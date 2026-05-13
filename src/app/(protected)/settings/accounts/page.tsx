'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney } from '@/lib/utils/format'

interface Account {
  id: string
  name: string
  type: 'cash' | 'card' | 'bank'
  balance: number
}

const TYPE_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта / Терминал',
  bank: 'Расчётный счёт',
}

export default function AccountsPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editBalance, setEditBalance] = useState('')

  async function load() {
    const { data } = await supabase.from('accounts').select('*').order('sort_order')
    if (data) setAccounts(data as Account[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveBalance(id: string) {
    const val = parseFloat(editBalance)
    if (isNaN(val)) return
    await supabase.from('accounts').update({ balance: val }).eq('id', id)
    setAccounts(a => a.map(ac => ac.id === id ? { ...ac, balance: val } : ac))
    setEditId(null)
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Счета</h1>
      </div>

      <div className="card max-w-xl">
        <div className="card-header">
          <p className="text-sm text-gray-500">
            Остатки на счетах используются в ДДС и анализе кассового разрыва
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {accounts.map(ac => (
            <div key={ac.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{ac.name}</p>
                <p className="text-xs text-gray-400">{TYPE_LABELS[ac.type]}</p>
              </div>
              <div className="flex items-center gap-3">
                {editId === ac.id ? (
                  <>
                    <input
                      type="number"
                      value={editBalance}
                      onChange={e => setEditBalance(e.target.value)}
                      className="input w-32 text-right"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && saveBalance(ac.id)}
                    />
                    <button onClick={() => saveBalance(ac.id)} className="btn-primary btn-sm">✓</button>
                    <button onClick={() => setEditId(null)} className="btn-secondary btn-sm">✕</button>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-gray-900">{formatMoney(ac.balance)}</span>
                    <button
                      onClick={() => { setEditId(ac.id); setEditBalance(String(ac.balance)) }}
                      className="btn-ghost btn-sm"
                    >
                      Изменить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="card-body border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Итого на всех счетах:</span>
            <span className="text-lg font-bold text-gray-900">
              {formatMoney(accounts.reduce((s, a) => s + a.balance, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
