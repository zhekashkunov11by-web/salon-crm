'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SyncLog {
  id: string
  synced_at: string
  clients_synced: number
  visits_synced: number
  status: 'success' | 'error'
  error_message?: string
}

export default function DikidiPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [logsRes, settingsRes] = await Promise.all([
        supabase
          .from('dikidi_sync_log')
          .select('*')
          .order('synced_at', { ascending: false })
          .limit(10),
        supabase.from('settings').select('key, value').in('key', ['dikidi_api_key', 'dikidi_company_id']),
      ])
      if (logsRes.data) setLogs(logsRes.data as SyncLog[])
      if (settingsRes.data) {
        const map = Object.fromEntries(settingsRes.data.map(r => [r.key, r.value]))
        setApiKey(map.dikidi_api_key || '')
        setCompanyId(map.dikidi_company_id || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveSettings() {
    await Promise.all([
      supabase.from('settings').upsert({ key: 'dikidi_api_key', value: apiKey }),
      supabase.from('settings').upsert({ key: 'dikidi_company_id', value: companyId }),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function triggerSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/dikidi/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка синхронизации')
      alert(`Синхронизировано: ${data.clients_synced} клиентов, ${data.visits_synced} визитов`)
      // Reload logs
      const { data: logsData } = await supabase
        .from('dikidi_sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(10)
      if (logsData) setLogs(logsData as SyncLog[])
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Интеграция с Dikidi</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Dikidi — система онлайн-записи. Синхронизация импортирует клиентов, визиты и оплаты.
        Автоматический запуск каждые 15 минут через cron-задачу.
      </p>

      {/* Настройки API */}
      <div className="card max-w-lg mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Настройки API</h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="label">API ключ Dikidi</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••••••••••"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Найдите в Dikidi: Настройки → API → Ключ доступа
            </p>
          </div>
          <div>
            <label className="label">ID компании (company_id)</label>
            <input
              type="text"
              className="input"
              placeholder="12345"
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveSettings} className="btn-primary">Сохранить</button>
            {saved && <span className="text-sm text-green-600">✓ Сохранено</span>}
          </div>
        </div>
      </div>

      {/* Ручной запуск */}
      <div className="card max-w-lg mb-6">
        <div className="card-body flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Ручная синхронизация</p>
            <p className="text-xs text-gray-400">Запускает немедленную синхронизацию данных</p>
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing || !apiKey || !companyId}
            className="btn-secondary"
          >
            {syncing ? '⏳ Синхронизация...' : '↻ Синхронизировать'}
          </button>
        </div>
      </div>

      {/* Переменные окружения */}
      <div className="card max-w-lg mb-6 bg-yellow-50 border border-yellow-200">
        <div className="card-body">
          <p className="text-sm font-medium text-yellow-800 mb-2">Важно: переменные окружения</p>
          <p className="text-xs text-yellow-700 mb-3">
            Для работы синхронизации также добавьте в .env.local на сервере:
          </p>
          <pre className="text-xs bg-yellow-100 rounded p-2 font-mono text-yellow-900">
{`DIKIDI_API_KEY=ваш_ключ
DIKIDI_COMPANY_ID=ваш_id`}
          </pre>
        </div>
      </div>

      {/* Лог синхронизаций */}
      <div className="card max-w-2xl">
        <div className="card-header">
          <h2 className="font-semibold">Последние синхронизации</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Клиенты</th>
                <th>Визиты</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-gray-500">
                    {new Date(log.synced_at).toLocaleString('ru-RU')}
                  </td>
                  <td>{log.clients_synced}</td>
                  <td>{log.visits_synced}</td>
                  <td>
                    {log.status === 'success' ? (
                      <span className="badge-green">✓ Успех</span>
                    ) : (
                      <span className="badge-red" title={log.error_message}>✕ Ошибка</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-400 py-8">
                    Синхронизаций ещё не было
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
