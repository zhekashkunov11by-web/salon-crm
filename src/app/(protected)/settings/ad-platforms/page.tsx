'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HelpPanel } from '@/components/ui/HelpPanel'

interface AdChannelSetting {
  id: string
  channel: string
  is_enabled: boolean
  access_token?: string
  account_id?: string
  extra?: Record<string, string>
  last_synced_at?: string
}

interface Step {
  text: string
  link?: { label: string; url: string }
}

interface PlatformField {
  key: string
  label: string
  placeholder: string
  type: string
  hint?: string
}

interface Platform {
  key: string
  label: string
  icon: string
  description: string
  fields: PlatformField[]
  steps: Step[]
  syncApi?: string   // если есть — показываем кнопку «Синхронизировать сейчас»
  comingSoon?: boolean
}

const PLATFORMS: Platform[] = [
  {
    key: 'facebook',
    label: 'Facebook Ads',
    icon: '📘',
    description: 'Реклама в Facebook через Meta Business',
    syncApi: '/api/meta/sync',
    fields: [
      {
        key: 'access_token',
        label: 'Access Token',
        placeholder: 'EAAxxxxx...',
        type: 'password',
        hint: 'Токен действует ~60 дней — обновляйте раз в месяц',
      },
      {
        key: 'account_id',
        label: 'ID рекламного кабинета',
        placeholder: '830225054218987',
        type: 'text',
        hint: 'Только цифры — без "act_"',
      },
    ],
    steps: [
      {
        text: '1. Откройте Graph API Explorer (нужен аккаунт Facebook)',
        link: { label: '→ developers.facebook.com/tools/explorer', url: 'https://developers.facebook.com/tools/explorer' },
      },
      { text: '2. Вверху справа в выпадающем списке выберите приложение «Восторг CRM»' },
      { text: '3. Справа раздел Permissions → нажмите «Add a Permission» → выберите ads_read → добавьте также ads_management' },
      { text: '4. Нажмите синюю кнопку «Generate Access Token» → в появившемся окне Facebook нажмите «Продолжить» → «Готово»' },
      { text: '5. Скопируйте весь токен (начинается с EAA...) — вставьте в поле Access Token выше' },
      {
        text: '6. ID рекламного кабинета: войдите в Ads Manager → в адресной строке act_XXXXXXXXX — скопируйте только цифры',
        link: { label: '→ facebook.com/adsmanager', url: 'https://www.facebook.com/adsmanager' },
      },
      { text: '⚠️ Токен действует ~60 дней. Когда данные перестанут обновляться — повторите шаги 1–5 и сохраните новый токен.' },
    ],
  },
  {
    key: 'instagram',
    label: 'Instagram Ads',
    icon: '📸',
    description: 'Рекламные кампании в Instagram (второй рекламный кабинет)',
    syncApi: '/api/meta/sync',
    fields: [
      {
        key: 'access_token',
        label: 'Access Token',
        placeholder: 'EAAxxxxx...',
        type: 'password',
        hint: 'Тот же токен, что и для Facebook Ads',
      },
      {
        key: 'account_id',
        label: 'ID рекламного кабинета (второй)',
        placeholder: '705927454584982',
        type: 'text',
        hint: 'Только цифры — без "act_"',
      },
    ],
    steps: [
      { text: '✓ Instagram работает через ту же платформу Meta — тот же токен, другой ID кабинета.' },
      { text: '1. Токен — тот же, что вы сгенерировали для Facebook Ads (скопируйте оттуда)' },
      {
        text: '2. ID кабинета — зайдите в Ads Manager, вверху выберите нужный аккаунт (массаж/Instagram) → скопируйте цифры из URL',
        link: { label: '→ facebook.com/adsmanager', url: 'https://www.facebook.com/adsmanager' },
      },
      { text: '3. Вставьте токен и ID второго кабинета → сохраните' },
      { text: '⚠️ При обновлении токена для Facebook — обновите его здесь тоже (тот же токен).' },
    ],
  },
  {
    key: 'yandex_direct',
    label: 'Яндекс Директ',
    icon: '🟡',
    description: 'Контекстная реклама в Яндекс Поиске и РСЯ',
    comingSoon: true,
    fields: [
      {
        key: 'access_token',
        label: 'OAuth токен',
        placeholder: 'y0_AgAAAA...',
        type: 'password',
      },
      {
        key: 'account_id',
        label: 'Логин рекламного аккаунта',
        placeholder: 'your-login',
        type: 'text',
      },
    ],
    steps: [
      {
        text: '1. Откройте Яндекс OAuth',
        link: { label: 'oauth.yandex.ru', url: 'https://oauth.yandex.ru' },
      },
      { text: '2. Создайте приложение → выдайте права на Яндекс Директ (direct:api)' },
      { text: '3. Получите токен через OAuth-авторизацию' },
      {
        text: '4. Документация Яндекс Директ API',
        link: { label: 'yandex.ru/dev/direct', url: 'https://yandex.ru/dev/direct/' },
      },
    ],
  },
  {
    key: 'vk',
    label: 'VK Реклама',
    icon: '💙',
    description: 'Таргетированная реклама ВКонтакте',
    comingSoon: true,
    fields: [
      {
        key: 'access_token',
        label: 'Access Token VK',
        placeholder: 'vk1.a.xxxxx...',
        type: 'password',
      },
      {
        key: 'account_id',
        label: 'ID рекламного кабинета',
        placeholder: '123456789',
        type: 'text',
      },
    ],
    steps: [
      {
        text: '1. Откройте VK для разработчиков',
        link: { label: 'dev.vk.com', url: 'https://dev.vk.com/ru' },
      },
      { text: '2. Создайте приложение (тип: Standalone)' },
      { text: '3. Получите токен через OAuth — нужно разрешение ads' },
      {
        text: '4. ID кабинета: вкл.рф/ads → Настройки',
        link: { label: 'vk.com/ads', url: 'https://vk.com/ads' },
      },
    ],
  },
]

function fmtDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdPlatformsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<Record<string, AdChannelSetting>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 7)

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

    const dbPayload = {
      channel: channelKey,
      is_enabled: !!(formData.access_token && formData.account_id),
      access_token: formData.access_token || null,
      account_id: formData.account_id || null,
      extra: Object.keys(extraFields).length > 0 ? extraFields : null,
      updated_at: new Date().toISOString(),
    }

    const existing = settings[channelKey]
    if (existing) {
      await supabase.from('ad_channel_settings').update(dbPayload).eq('id', existing.id)
    } else {
      await supabase.from('ad_channel_settings').insert(dbPayload)
    }

    const stateEntry: AdChannelSetting = {
      id: settings[channelKey]?.id || '',
      channel: channelKey,
      is_enabled: dbPayload.is_enabled,
      access_token: dbPayload.access_token ?? undefined,
      account_id: dbPayload.account_id ?? undefined,
      extra: dbPayload.extra as Record<string, string> | undefined,
    }
    setSettings(s => ({ ...s, [channelKey]: stateEntry }))
    setSaving(null)
    setExpanded(null)
  }

  async function syncNow(channelKey: string, apiPath: string) {
    setSyncing(channelKey)
    setSyncMsg(m => ({ ...m, [channelKey]: '' }))
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: today }),
      })
      const data = await res.json()
      if (data.ok) {
        const result = data.results?.[channelKey]
        if (result?.error) {
          setSyncMsg(m => ({ ...m, [channelKey]: '❌ ' + result.error }))
        } else {
          setSyncMsg(m => ({ ...m, [channelKey]: `✓ Синхронизировано: ${result?.ads ?? 0} объявлений, ${(result?.spend ?? 0).toFixed(2)} Br` }))
          // обновляем last_synced_at в локальном стейте
          setSettings(s => ({
            ...s,
            [channelKey]: { ...s[channelKey], last_synced_at: new Date().toISOString() },
          }))
        }
      } else {
        setSyncMsg(m => ({ ...m, [channelKey]: '❌ ' + (data.error || 'Ошибка') }))
      }
    } catch {
      setSyncMsg(m => ({ ...m, [channelKey]: '❌ Ошибка сети' }))
    }
    setSyncing(null)
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
        <div>
          <h1 className="page-title">Рекламные платформы</h1>
          <p className="text-sm text-gray-500">
            Подключите API → данные будут подтягиваться автоматически каждый день в <strong>06:00</strong>
          </p>
        </div>
      </div>

      <HelpPanel id="ad-platforms" title="Как работает подключение рекламных платформ" defaultOpen={true} items={[
        { icon: '🔑', title: 'Что такое токен', text: 'Токен — это ключ доступа к вашему рекламному кабинету. Без него CRM не может читать статистику. Токен нужно получить один раз, потом обновлять раз в 60 дней.' },
        { icon: '📊', title: 'Что подтягивается', text: 'Расходы, показы, клики, CTR, CPC по каждому объявлению за каждый день. Видно в Маркетинг → Объявления Meta.' },
        { icon: '⏰', title: 'Автосинхронизация', text: 'Каждый день в 06:00 утра данные за прошедший день подтягиваются автоматически. Вручную ничего делать не нужно.' },
        { icon: '🔄', title: 'Обновление токена', text: 'Токен Meta действует ~60 дней. Когда данные перестанут обновляться — зайдите сюда, раскройте карточку Facebook Ads и замените токен.' },
        { icon: '🆔', title: 'ID кабинета', text: 'Если у вас два рекламных кабинета (основной Восторг + массаж) — подключите оба: Facebook Ads и Instagram Ads с разными ID но тем же токеном.' },
        { icon: '✅', title: 'Проверка', text: 'После сохранения нажмите «↻ Синхронизировать сейчас» — если всё верно, увидите количество объявлений и сумму расходов.' },
      ]} />

      <div className="space-y-4 max-w-2xl">
        {PLATFORMS.map(platform => {
          const setting = settings[platform.key]
          const isConnected = setting?.is_enabled && setting?.access_token
          const isOpen = expanded === platform.key
          const form = forms[platform.key] || {}
          const msg = syncMsg[platform.key]
          const lastSync = fmtDate(setting?.last_synced_at)

          return (
            <div key={platform.key} className={`card transition-all ${isConnected ? 'border-green-200' : ''} ${platform.comingSoon ? 'opacity-60' : ''}`}>
              {/* Заголовок */}
              <div
                className="card-header flex items-center justify-between cursor-pointer select-none"
                onClick={() => !platform.comingSoon && setExpanded(isOpen ? null : platform.key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{platform.label}</h3>
                      {platform.comingSoon && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">скоро</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{platform.description}</p>
                    {lastSync && (
                      <p className="text-xs text-gray-400 mt-0.5">Последняя синхронизация: {lastSync}</p>
                    )}
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
                  {!platform.comingSoon && (
                    <span className="text-gray-400 text-lg">{isOpen ? '▲' : '▼'}</span>
                  )}
                </div>
              </div>

              {/* Сообщение синхронизации (вне раскрытой панели) */}
              {msg && !isOpen && (
                <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs ${msg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {msg}
                </div>
              )}

              {isOpen && (
                <div className="card-body border-t border-gray-100 space-y-4">

                  {/* Пошаговая инструкция */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Как получить токен и ID:</p>
                    <ol className="space-y-1.5">
                      {platform.steps.map((step, i) => (
                        <li key={i} className="text-xs text-blue-800">
                          {step.text}
                          {step.link && (
                            <>
                              {' '}→{' '}
                              <a
                                href={step.link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium hover:text-blue-600"
                              >
                                {step.link.label}
                              </a>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Поля */}
                  <div className="space-y-3">
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
                        {field.hint && (
                          <p className="text-xs text-gray-400 mt-1">{field.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Сообщение */}
                  {msg && (
                    <div className={`px-3 py-2 rounded-lg text-xs ${msg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {msg}
                    </div>
                  )}

                  {/* Кнопки */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => save(platform.key)}
                      disabled={saving === platform.key}
                      className="btn-primary btn-sm"
                    >
                      {saving === platform.key ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    {isConnected && platform.syncApi && (
                      <button
                        onClick={() => syncNow(platform.key, platform.syncApi!)}
                        disabled={syncing === platform.key}
                        className="btn-secondary btn-sm"
                      >
                        {syncing === platform.key ? '⏳ Синхронизация...' : '↻ Синхронизировать сейчас'}
                      </button>
                    )}
                    {isConnected && (
                      <button onClick={() => disconnect(platform.key)} className="btn-danger btn-sm">
                        Отключить
                      </button>
                    )}
                    <button onClick={() => setExpanded(null)} className="btn-secondary btn-sm ml-auto">
                      Закрыть
                    </button>
                  </div>

                  {isConnected && (
                    <p className="text-xs text-gray-400">
                      Автосинхронизация каждый день в 06:00 — данные за прошедший день подтягиваются автоматически
                    </p>
                  )}
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
