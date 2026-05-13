'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Settings {
  salon_name: string
  monthly_plan: string
  timezone: string
}

export default function GeneralSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>({
    salon_name: 'Восторг',
    monthly_plan: '300000',
    timezone: 'Europe/Moscow',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('settings').select('key, value')
      if (data) {
        const map = Object.fromEntries(data.map(r => [r.key, r.value]))
        setSettings(s => ({ ...s, ...map }))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      await Promise.all([
        supabase.from('settings').upsert({ key: 'salon_name', value: settings.salon_name }),
        supabase.from('settings').upsert({ key: 'monthly_plan', value: settings.monthly_plan }),
        supabase.from('settings').upsert({ key: 'timezone', value: settings.timezone }),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="skeleton h-40 w-full" />
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost btn-sm">← Назад</button>
          <h1 className="page-title">Общие настройки</h1>
        </div>
      </div>

      <div className="card max-w-lg">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Параметры салона</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="label">Название салона</label>
              <input
                type="text"
                value={settings.salon_name}
                onChange={e => setSettings(s => ({ ...s, salon_name: e.target.value }))}
                className="input"
                placeholder="Восторг"
              />
            </div>

            <div>
              <label className="label">Ежемесячный план выручки, Br</label>
              <input
                type="number"
                value={settings.monthly_plan}
                onChange={e => setSettings(s => ({ ...s, monthly_plan: e.target.value }))}
                className="input"
                placeholder="300000"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-400 mt-1">
                Используется для расчёта плана администраторов и дашборда
              </p>
            </div>

            <div>
              <label className="label">Часовой пояс</label>
              <select
                value={settings.timezone}
                onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                className="input"
              >
                <option value="Europe/Moscow">Москва (UTC+3)</option>
                <option value="Europe/Samara">Самара (UTC+4)</option>
                <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                <option value="Asia/Krasnoyarsk">Красноярск (UTC+7)</option>
                <option value="Asia/Irkutsk">Иркутск (UTC+8)</option>
                <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">✓ Сохранено</span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
