'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PixelSetting {
  key: string
  value: string
  is_enabled: boolean
}

const PIXELS = [
  {
    key: 'yandex_metrika',
    label: 'Яндекс Метрика',
    icon: '🟡',
    placeholder: '12345678',
    hint: 'Номер счётчика (8 цифр)',
    howto: 'Метрика → Счётчики → ID счётчика (число в левом столбце)',
    field: 'ID счётчика',
  },
  {
    key: 'google_analytics',
    label: 'Google Analytics 4',
    icon: '🔵',
    placeholder: 'G-XXXXXXXXXX',
    hint: 'Measurement ID начинается с G-',
    howto: 'GA4 → Администратор → Потоки данных → выберите поток → Идентификатор измерений',
    field: 'Measurement ID',
  },
  {
    key: 'vk_pixel',
    label: 'VK Pixel',
    icon: '💙',
    placeholder: 'VK-RTRG-000000-XXXXX',
    hint: 'ID пикселя из рекламного кабинета VK',
    howto: 'VK Реклама → Аудитории → Пиксели → Создать пиксель → скопируйте ID',
    field: 'ID пикселя',
  },
  {
    key: 'fb_pixel',
    label: 'Meta Pixel (Facebook/Instagram)',
    icon: '📘',
    placeholder: '1234567890123456',
    hint: '15-16 значный ID пикселя',
    howto: 'Meta Business Suite → Events Manager → Пиксели → скопируйте Pixel ID',
    field: 'Pixel ID',
  },
  {
    key: 'tiktok_pixel',
    label: 'TikTok Pixel',
    icon: '🎵',
    placeholder: 'ABCDEFGHIJ1234567890',
    hint: 'ID пикселя из TikTok Ads Manager',
    howto: 'TikTok Ads Manager → Assets → Events → Web Events → скопируйте Pixel ID',
    field: 'Pixel ID',
  },
  {
    key: 'calltouch',
    label: 'Calltouch (коллтрекинг)',
    icon: '📞',
    placeholder: 'abc12345',
    hint: 'Site ID из личного кабинета Calltouch',
    howto: 'Calltouch → Настройки → Общие → Site ID (короткий код)',
    field: 'Site ID',
  },
]

export default function AnalyticsSettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, PixelSetting>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('analytics_settings').select('*')
      if (data) {
        const map: Record<string, PixelSetting> = {}
        data.forEach((row: PixelSetting) => { map[row.key] = row })
        setSettings(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(key: string) {
    setSaving(key)
    const s = settings[key]
    await supabase.from('analytics_settings').upsert({
      key,
      value: s?.value || '',
      is_enabled: !!(s?.value),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  function update(key: string, value: string) {
    setSettings(s => ({
      ...s,
      [key]: Object.assign({}, s[key] || {}, { key, value, is_enabled: !!value }),
    }))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Аналитика и пиксели</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Введите ID пикселей — они автоматически встроятся в сайт и начнут отслеживать посетителей.
        Это позволит настраивать ретаргетинг и видеть эффективность рекламы.
      </p>

      <div className="space-y-4 max-w-2xl">
        {PIXELS.map(pixel => {
          const s = settings[pixel.key]
          const isConnected = !!(s?.value)

          return (
            <div key={pixel.key} className={`card ${isConnected ? 'border-green-200' : ''}`}>
              <div className="card-body">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{pixel.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{pixel.label}</h3>
                      {isConnected && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          ✓ Подключено
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{pixel.hint}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="label">{pixel.field}</label>
                    <input
                      type="text"
                      className="input font-mono text-sm"
                      placeholder={pixel.placeholder}
                      value={s?.value || ''}
                      onChange={e => update(pixel.key, e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => save(pixel.key)}
                      disabled={saving === pixel.key}
                      className="btn-primary btn-sm"
                    >
                      {saved === pixel.key ? '✓ Сохранено' : saving === pixel.key ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500">
                  <strong>Где взять:</strong> {pixel.howto}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* UTM подсказка */}
      <div className="card mt-6 bg-blue-50 border-blue-200 max-w-2xl">
        <div className="card-body">
          <h3 className="font-semibold text-blue-800 mb-1">📎 UTM-метки</h3>
          <p className="text-sm text-blue-700 mb-2">
            Чтобы пиксели знали из какой рекламы пришёл клиент — используйте UTM-метки во всех ссылках.
          </p>
          <a href="/marketing/utm" className="text-sm font-semibold text-blue-700 hover:underline">
            → Генератор UTM-ссылок
          </a>
        </div>
      </div>

      {/* Коллтрекинг инфо */}
      <div className="card mt-4 bg-violet-50 border-violet-200 max-w-2xl">
        <div className="card-body">
          <h3 className="font-semibold text-violet-800 mb-1">📞 Автоматический лид из звонка</h3>
          <p className="text-sm text-violet-700 mb-2">
            Если у вас подключён Calltouch или CoMagic — настройте webhook, чтобы входящий звонок
            автоматически создавал заявку в CRM.
          </p>
          <code className="text-xs bg-white px-2 py-1 rounded border border-violet-200 block font-mono">
            https://resonant-bombolone-430790.netlify.app/api/webhooks/calltracking
          </code>
          <p className="text-xs text-violet-500 mt-1">Вставьте этот URL в настройки вашего коллтрекинга как Webhook URL</p>
        </div>
      </div>
    </div>
  )
}
