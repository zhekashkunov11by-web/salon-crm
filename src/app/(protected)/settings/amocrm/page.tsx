'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHANNELS = [
  { id: 'instagram', icon: '📸', label: 'Instagram Direct', desc: 'Сообщения из Instagram' },
  { id: 'vk', icon: '💬', label: 'ВКонтакте', desc: 'Сообщения из ВК' },
  { id: 'facebook', icon: '👥', label: 'Facebook Messenger', desc: 'Сообщения из FB' },
  { id: 'telegram', icon: '✈️', label: 'Telegram', desc: 'Через amoCRM SalesBot' },
  { id: 'whatsapp', icon: '📱', label: 'WhatsApp', desc: 'Через amoCRM интеграцию' },
]

export default function AmoCrmSettingsPage() {
  const supabase = createClient()
  const [subdomain, setSubdomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'amocrm_config')
        .single()

      if (data?.value) {
        const cfg = data.value as { subdomain?: string; access_token?: string }
        setSubdomain(cfg.subdomain || '')
        setAccessToken(cfg.access_token || '')
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function saveSettings() {
    await supabase.from('settings').upsert({
      key: 'amocrm_config',
      value: { subdomain: subdomain.trim(), access_token: accessToken.trim() },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testConnection() {
    if (!subdomain || !accessToken) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(
        `https://${subdomain.trim()}.amocrm.ru/api/v4/account`,
        {
          headers: { Authorization: `Bearer ${accessToken.trim()}` },
        }
      )
      if (res.ok) {
        const data = await res.json()
        setTestResult({ ok: true, message: `Подключено: ${data.name || subdomain}` })
      } else {
        setTestResult({ ok: false, message: `Ошибка ${res.status}: ${res.statusText}` })
      }
    } catch (e) {
      setTestResult({ ok: false, message: `Ошибка сети: ${String(e)}` })
    }
    setTesting(false)
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  const webhookUrl = 'https://resonant-bombolone-430790.netlify.app/api/inbox/amocrm'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Интеграция с amoCRM</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-xl">
        amoCRM — омниканальная труба: Instagram, ВКонтакте, Facebook, Telegram, WhatsApp.
        Все входящие сообщения попадают во <strong>Входящие</strong> в Восторге.
      </p>

      {/* Архитектура */}
      <div className="card max-w-xl mb-6 bg-violet-50 border-violet-200">
        <div className="card-body">
          <p className="text-sm font-semibold text-violet-800 mb-3">Как это работает</p>
          <div className="flex items-center gap-2 text-sm text-violet-700 flex-wrap">
            {CHANNELS.map((ch, i) => (
              <span key={ch.id}>
                <span className="bg-white px-2 py-1 rounded-lg border border-violet-200 text-xs">
                  {ch.icon} {ch.label}
                </span>
                {i < CHANNELS.length - 1 && <span className="mx-1 text-violet-400">→</span>}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-violet-700">
            <span className="text-violet-400">↓ webhook</span>
            <span className="bg-violet-100 border border-violet-300 px-2 py-1 rounded-lg text-xs font-medium">
              amoCRM
            </span>
            <span className="text-violet-400">→</span>
            <span className="bg-violet-600 text-white px-2 py-1 rounded-lg text-xs font-bold">
              Восторг (Входящие)
            </span>
          </div>
        </div>
      </div>

      {/* API настройки */}
      <div className="card max-w-lg mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Настройки API amoCRM</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label">Поддомен amoCRM</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="mycompany"
                value={subdomain}
                onChange={e => setSubdomain(e.target.value)}
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">.amocrm.ru</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Из URL вашего amoCRM: <code>mycompany.amocrm.ru</code>
            </p>
          </div>
          <div>
            <label className="label">Access Token (долгосрочный)</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••••••••••••••"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              amoCRM → Настройки → Интеграции → Ваша интеграция → Access Token
            </p>
          </div>

          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult.ok ? '✓' : '✕'} {testResult.message}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={saveSettings} className="btn-primary">Сохранить</button>
            <button
              onClick={testConnection}
              disabled={testing || !subdomain || !accessToken}
              className="btn-secondary"
            >
              {testing ? '⏳ Проверка...' : 'Проверить соединение'}
            </button>
            {saved && <span className="text-sm text-green-600">✓ Сохранено</span>}
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="card max-w-lg mb-6 bg-green-50 border border-green-200">
        <div className="card-body">
          <p className="text-sm font-medium text-green-800 mb-2">Webhook URL для amoCRM</p>
          <p className="text-xs text-green-700 mb-3">
            Вставьте этот URL в amoCRM: <strong>Настройки → Уведомления → Уведомления на почту/webhooks</strong>
            <br />или в настройках каждой интеграции (Instagram, ВК, Telegram, WhatsApp)
          </p>
          <code className="text-xs bg-white px-2 py-1.5 rounded border border-green-200 block font-mono break-all select-all">
            {webhookUrl}
          </code>
          <p className="text-xs text-green-600 mt-2">
            Выберите события: <strong>Сообщения — Входящее сообщение</strong>
          </p>
        </div>
      </div>

      {/* Инструкция подключения каналов */}
      <div className="card max-w-xl mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Как подключить каналы в amoCRM</h2>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {CHANNELS.map(ch => (
              <div key={ch.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">{ch.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{ch.label}</p>
                  <p className="text-xs text-gray-500">{ch.desc}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    amoCRM → Настройки → Источники лидов → {ch.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Статус */}
      <div className="card max-w-lg bg-amber-50 border border-amber-200">
        <div className="card-body">
          <p className="text-sm font-medium text-amber-800 mb-1">Текущий статус</p>
          <p className="text-xs text-amber-700">
            {subdomain && accessToken
              ? `amoCRM настроен: ${subdomain}.amocrm.ru. Webhook принимает сообщения.`
              : 'amoCRM не настроен. Введите поддомен и Access Token выше.'}
          </p>
          {!subdomain && (
            <p className="text-xs text-amber-600 mt-2">
              Для работы раздела &laquo;Входящие&raquo; нужно получить API-ключ от amoCRM и настроить каналы.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
