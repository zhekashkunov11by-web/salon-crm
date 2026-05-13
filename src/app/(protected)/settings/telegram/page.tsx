'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TelegramSettings {
  telegram_bot_token: string
  telegram_chat_id_all: string
  telegram_chat_id_owners: string
  telegram_notify_new_lead: string
  telegram_notify_daily_report: string
  telegram_notify_missed_call: string
}

export default function TelegramPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<TelegramSettings>({
    telegram_bot_token: '',
    telegram_chat_id_all: '',
    telegram_chat_id_owners: '',
    telegram_notify_new_lead: 'true',
    telegram_notify_daily_report: 'true',
    telegram_notify_missed_call: 'true',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    async function load() {
      const keys = Object.keys(settings)
      const { data } = await supabase.from('settings').select('key, value').in('key', keys)
      if (data) {
        const map = Object.fromEntries(data.map(r => [r.key, r.value]))
        setSettings(s => ({ ...s, ...map }))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          supabase.from('settings').upsert({ key, value })
        )
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function sendTestMessage() {
    setTesting(true)
    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        alert('Тестовое сообщение отправлено! Проверьте оба чата.')
      } else {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch {
      alert('Ошибка отправки тестового сообщения')
    } finally {
      setTesting(false)
    }
  }

  function set(key: keyof TelegramSettings, value: string) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Telegram-уведомления</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Настройте бота для получения уведомлений. Создайте бота через{' '}
        <span className="font-mono text-violet-600">@BotFather</span> в Telegram.
        Используются два чата: общий (все сотрудники) и приватный (владельцы).
      </p>

      {/* Инструкция */}
      <div className="card max-w-xl mb-6 bg-blue-50 border border-blue-200">
        <div className="card-body text-sm text-blue-800 space-y-1">
          <p className="font-medium">Как настроить:</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-blue-700">
            <li>Создайте бота через @BotFather → /newbot → получите токен</li>
            <li>Добавьте бота в оба чата (общий и владельцев) как администратора</li>
            <li>Получите chat_id: напишите боту или используйте @userinfobot</li>
            <li>Вставьте токен и chat_id ниже, нажмите «Сохранить»</li>
            <li>Нажмите «Отправить тест» для проверки</li>
          </ol>
        </div>
      </div>

      <div className="card max-w-xl mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Настройки бота</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label">Bot Token</label>
            <input
              type="password"
              className="input font-mono"
              placeholder="1234567890:AABBCCDDEEFFaabbccddeeff"
              value={settings.telegram_bot_token}
              onChange={e => set('telegram_bot_token', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Chat ID — общий чат (все сотрудники)</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="-1001234567890"
              value={settings.telegram_chat_id_all}
              onChange={e => set('telegram_chat_id_all', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Chat ID — чат владельцев</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="-1009876543210"
              value={settings.telegram_chat_id_owners}
              onChange={e => set('telegram_chat_id_owners', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Настройки уведомлений */}
      <div className="card max-w-xl mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Типы уведомлений</h2>
        </div>
        <div className="card-body space-y-3">
          {[
            { key: 'telegram_notify_new_lead' as const, label: 'Новая заявка в воронку', hint: 'Общий чат' },
            { key: 'telegram_notify_daily_report' as const, label: 'Ежедневный отчёт в конце дня', hint: 'Оба чата' },
            { key: 'telegram_notify_missed_call' as const, label: 'Пропущенный звонок / обращение', hint: 'Общий чат' },
          ].map(item => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400">{item.hint}</p>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key] === 'true'}
                onChange={e => set(item.key, e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 accent-violet-600"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
        {saved && <span className="text-sm text-green-600 self-center">✓ Сохранено</span>}
        <button
          onClick={sendTestMessage}
          disabled={testing || !settings.telegram_bot_token}
          className="btn-secondary"
        >
          {testing ? '⏳ Отправка...' : '📨 Отправить тест'}
        </button>
      </div>
    </div>
  )
}
