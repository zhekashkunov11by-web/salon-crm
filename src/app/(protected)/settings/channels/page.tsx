'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Channel {
  id: string
  name: string
  is_active: boolean
  sort_order: number
}

export default function ChannelsPage() {
  const supabase = createClient()
  const [channels, setChannels] = useState<Channel[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase
      .from('marketing_channels')
      .select('*')
      .order('sort_order')
    if (data) setChannels(data as Channel[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addChannel() {
    if (!newName.trim()) return
    const { data } = await supabase
      .from('marketing_channels')
      .insert({ name: newName.trim(), sort_order: channels.length + 1 })
      .select()
      .single()
    if (data) {
      setChannels(c => [...c, data as Channel])
      setNewName('')
    }
  }

  async function toggleChannel(id: string, is_active: boolean) {
    await supabase.from('marketing_channels').update({ is_active }).eq('id', id)
    setChannels(c => c.map(ch => ch.id === id ? { ...ch, is_active } : ch))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Каналы трафика</h1>
      </div>

      <div className="card max-w-xl">
        <div className="card-header">
          <p className="text-sm text-gray-500">
            Каналы используются в воронке заявок и маркетинговой аналитике
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {channels.map(ch => (
            <div key={ch.id} className="px-5 py-3 flex items-center justify-between">
              <span className={`text-sm ${ch.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                {ch.name}
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ch.is_active}
                  onChange={e => toggleChannel(ch.id, e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <span className="text-xs text-gray-500">Активен</span>
              </label>
            </div>
          ))}
        </div>

        {/* Добавить новый */}
        <div className="card-body border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChannel()}
              className="input flex-1"
              placeholder="Новый канал (например: Авито, 2ГИС...)"
            />
            <button onClick={addChannel} className="btn-primary btn-sm whitespace-nowrap">
              + Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
