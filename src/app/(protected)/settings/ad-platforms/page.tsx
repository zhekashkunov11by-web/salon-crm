'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AdChannelSetting {
  id: string
  channel: string
  is_enabled: boolean
  access_token?: string
  account_id?: string
  extra?: Record<string, string>
  last_synced_at?: string
}

const PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook Ads',
    icon: '📘',
    color: 'blue',
    description: 'Реклама в Facebook и Instagram через Meta Business',
    fields: [
      { key: 'access_token', label: 'Access Token (Meta)', placeholder: 'EAAxxxxx...', type: 'password' },
      { key: 'account_id', label: 'ID рекламного кабинета', placeholder: 'act_123456789', type: 'text' },
    ],
    howto: 'Получите токен в Meta for Developers → Tools → Graph API Explorer. Нужны права: ads_read, ads_management.',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
  },
  {
    key: 'instagram',
    label: 'Instagram Ads',
    icon: '📸',
    color: 'pink',
    description: 'Рекламные кампании в Instagram (через тот же Meta Business)',
    fields: [
      { key: 'access_token', label: 'Access Token (Meta)', placeholder: 'EAAxxxxx...', type: 'password' },
      { key: 'account_id', label: 'ID рекламного кабинета', placeholder: 'act_123456789', type: 'text' },
    ],
    howto: 'Используется тот же токен и кабинет, что и для Facebook Ads — Meta управляет обеими платформами.',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
  },
  {
    key: 'yandex_direct',
    label: 'Яндекс Директ',
    icon: '🟡',
    color: 'yellow',
    description: 'Контекстная реклама в Яндекс Поиске и РСЯ',
    fields: [
      { key: 'access_token', label: 'OAuth токен', placeholder: 'y0_AgAAAA...', type: 'password' },
      { key: 'account_id', label: 'Логин рекламного аккаунта', placeholder: 'your-login', type: 'text' },
    ],
    howto: 'Получите токен на oauth.yandex.ru → Создайте приложение → Выдайте права на Яндекс Директ.',
    docsUrl: 'https://yandex.ru/dev/direct/',
  },
  {
    key: 'vk',
    label: 'VK Реклама',
    icon: '💙',
    color: 'blue',
    description: 'Таргетированная реклама ВКонтакте',
    fields: [
      { key: 'access_token', label: 'Access Token VK', placeholder: 'vk1.a.xxxxx...', type: 'password' },
      { key: 'account_id', label: 'ID рекламного кабинета', placeholder: '123456789', type: 'text' },
    ],
    howto: 'Получите токен в VK для разработчиков → Создайте приложение → Авторизуйтесь, нужно разрешение ads.',
    docsUrl: 'https://dev.vk.com/ru/api/ads/getting-started',
  },
  {
    key: 'google',
    label: 'Google Ads',
    icon: '🔵',
    color: 'blue',
    description: 'Реклама в поиске Google и YouTube',
    fields: [
      { key: 'access_token', label: 'OAuth Refresh Token', placeholder: '1//xxxxx...', type: 'password' },
      { key: 'account_id', label: 'Customer ID', placeholder: '123-456-7890', type: 'text' },
      { key: 'developer_token', label: 'Developer Token', placeholder: 'xxxxx', type: 'password' },
    ],
    howto: 'Google Ads API требует Developer Token (заявка через Google Ads → API Center). Потом OAuth через Google Console.',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
  },
  {
    key: 'telegram',
    label: 'Telegram Ads',
    icon: '✈️',
    color: 'cyan',
    description: 'Реклама в Telegram-каналах через Fragment',
    fields: [
      { key: 'access_token', label: 'API Token (Fragment)', placeholder: 'xxxxx...', type: 'password' },
      { key: 'account_id', label: 'ID аккаунта', placeholder: '123456', type: 'text' },
    ],
    howto: 'Telegram Ads управляется через fragment.com. API находится в разработке — пока вносите данные вручную.',
    docsUrl: 'https://fragment.com',
  },
]

export default function AdPlatformsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, AdChannelSetting>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('ad_channel_settings').select('*')
      if (data) {
        const map: Record<string, AdChannelSetting> = {}
        const fmap: Record<string, Record<string, string>> = {}
        data.forEach((row: AdChannelSetting) => {
          map[row.channel] = row
          fmap[row.channel] = {
            access_token: row.access_token || '',
            account_id: row.account_id || '',
            ...(row.extra || {}),
          }
        })
        setSettings(map)
        setForms(fmap)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(channelKey: string) {
    setSaving(channelKey)
    const platform = PLATFORMS.find(p => p.key === channelKey)!
    const formData = forms[channelKey] || {}

    const extraFields: Record<string, string> = {}
    platform.fields.forEach(f => {
      if (f.key !== 'access_token' && f.key !== 'account_id') {
        extraFields[f.key] = formData[f.key] || ''
      }
    })

    const payload = {
      channel: channelKey,
      is_enabled: !!(formData.access_token && formData.account_id),
      access_token: formData.access_token || null,
      account_id: formData.account_id || null,
      extra: Object.keys(extraFields).length > 0 ? extraFields : null,
      updated_at: new Date().toISOString(),
    }

    const existing = settings[channelKey]
    if (existing) {
      await supabase.from('ad_channel_settings').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('ad_channel_settings').insert(payload)
    }

    setSettings(s => ({ ...s, [channelKey]: { ...(s[channelKey] || { id: '', channel: channelKey }), ...payload } }))
    setSaving(null)
    setExpanded(null)
  }

  async function disconnect(channelKey: string) {
    const existing = settings[channelKey]
    if (!existing) return
    await supabase.from('ad_channel_settings').update({
      is_enabled: false, access_token: null, account_id: null, extra: null,
    }).eq('id', existing.id)
    setSettings(s => ({ ...s, [channelKey]: { ...s[channelKey], is_enabled: false, access_token: undefined, account_id: undefined } }))
    setForms(f => ({ ...f, [channelKey]: {} }))
  }

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Рекламные платформы</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Подключите API рекламных кабинетов — тогда расходы, клики и показы будут подтягиваться автоматически
        в раздел <a href="/marketing" className="text-violet-600 hover:underline">Маркетинговая аналитика</a>.
        Пока платформа не подключена — вносите данные вручную.
      </p>

      <div className="space-y-4 max-w-2xl">
        {PLATFORMS.map(platform => {
          const setting = settings[platform.key]
          const isConnected = setting?.is_enabled && setting?.access_token
          const isOpen = expanded === platform.key
          const form = forms[platform.key] || {}

          return (
            <div key={platform.key} className={`card transition-all ${isConnected ? 'border-green-200' : ''}`}>
              <div
                className="card-header flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpanded(isOpen ? null : platform.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <h3 className="font-semibold">{platform.label}</h3>
                    <p className="text-xs text-gray-500">{platform.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                      ✓ Подключено
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Не подключено
                    </span>
                  )}
                  <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="card-body border-t border-gray-100">
                  {/* Поля */}
                  <div className="space-y-3 mb-4">
                    {platform.fields.map(field => (
                      <div key={field.key}>
                        <label className="label">{field.label}</label>
                        <input
                          type={field.type}
                          className="input"
                          placeholder={field.placeholder}
                          value={form[field.key] || ''}
                          onChange={e => setForms(f => ({
                            ...f,
                            [platform.key]: { ...(f[platform.key] || {}), [field.key]: e.target.value }
                          }))}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Инструкция */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-800">
                      <strong>Как получить:</strong> {platform.howto}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => save(platform.key)}
                      disabled={saving === platform.key}
                      className="btn-primary btn-sm"
                    >
                      {saving === platform.key ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    {isConnected && (
                      <button onClick={() => disconnect(platform.key)} className="btn-danger btn-sm">
                        Отключить
                      </button>
                    )}
                    <button onClick={() => setExpanded(null)} className="btn-secondary btn-sm">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card mt-6 bg-gray-50 border-gray-200 max-w-2xl">
        <div className="card-body">
          <h3 className="font-semibold text-gray-700 mb-1">📋 Пока API не подключён</h3>
          <p className="text-sm text-gray-500">
            Вносите расходы, клики и показы вручную в разделе{' '}
            <a href="/marketing" className="text-violet-600 hover:underline">Маркетинг → Добавить расходы</a>.
            Все метрики (CPL, CAC, CPC, ROMI) считаются автоматически.
          </p>
        </div>
      </div>
    </div>
  )
}
