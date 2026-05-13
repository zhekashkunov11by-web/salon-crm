'use client'

import { useState } from 'react'

const CHANNELS = [
  { key: 'instagram', label: 'Instagram', medium: 'social', icon: '📸' },
  { key: 'facebook', label: 'Facebook Ads', medium: 'cpc', icon: '📘' },
  { key: 'vk', label: 'VK Реклама', medium: 'cpc', icon: '💙' },
  { key: 'yandex', label: 'Яндекс Директ', medium: 'cpc', icon: '🟡' },
  { key: 'google', label: 'Google Ads', medium: 'cpc', icon: '🔵' },
  { key: 'telegram', label: 'Telegram Ads', medium: 'cpc', icon: '✈️' },
  { key: 'tiktok', label: 'TikTok Ads', medium: 'cpc', icon: '🎵' },
  { key: 'avito', label: 'Авито', medium: 'classifieds', icon: '🟢' },
  { key: 'referral', label: 'Рекомендация', medium: 'referral', icon: '🤝' },
]

interface Form {
  url: string
  source: string
  medium: string
  campaign: string
  content: string
  term: string
}

function buildUTM(form: Form): string {
  if (!form.url) return ''
  try {
    const u = new URL(form.url.startsWith('http') ? form.url : `https://${form.url}`)
    if (form.source) u.searchParams.set('utm_source', form.source)
    if (form.medium) u.searchParams.set('utm_medium', form.medium)
    if (form.campaign) u.searchParams.set('utm_campaign', form.campaign)
    if (form.content) u.searchParams.set('utm_content', form.content)
    if (form.term) u.searchParams.set('utm_term', form.term)
    return u.toString()
  } catch {
    return ''
  }
}

export default function UTMBuilderPage() {
  const [form, setForm] = useState<Form>({
    url: '',
    source: '',
    medium: 'cpc',
    campaign: '',
    content: '',
    term: '',
  })
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<{ label: string; url: string }[]>([])

  const result = buildUTM(form)

  function selectChannel(ch: typeof CHANNELS[0]) {
    setForm(f => ({ ...f, source: ch.key, medium: ch.medium }))
  }

  function copy() {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (form.campaign) {
      setHistory(h => [
        { label: `${form.source} / ${form.campaign}`, url: result },
        ...h.slice(0, 9),
      ])
    }
  }

  function field(key: keyof Form, label: string, placeholder: string, required = false) {
    return (
      <div>
        <label className="label">{label}{required && ' *'}</label>
        <input
          type="text"
          className="input"
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Генератор UTM-ссылок</h1>
          <p className="text-sm text-gray-500">Создавайте размеченные ссылки для отслеживания трафика из каждого канала</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Форма */}
        <div className="space-y-4">
          {/* Быстрый выбор канала */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold">1. Выберите канал</h2>
            </div>
            <div className="card-body">
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map(ch => (
                  <button
                    key={ch.key}
                    onClick={() => selectChannel(ch)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      form.source === ch.key
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    <span>{ch.icon}</span> {ch.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Параметры */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold">2. Заполните параметры</h2>
            </div>
            <div className="card-body space-y-3">
              {field('url', 'URL страницы (ваш сайт или Instagram)', 'https://vostorg-salon.by', true)}
              {field('source', 'utm_source (источник)', 'instagram', true)}
              {field('medium', 'utm_medium (тип трафика)', 'cpc')}
              {field('campaign', 'utm_campaign (название кампании)', 'massaz_may_2026')}
              {field('content', 'utm_content (объявление)', 'banner_1')}
              {field('term', 'utm_term (ключевое слово)', 'массаж минск')}
            </div>
          </div>

          {/* Подсказки */}
          <div className="card bg-amber-50 border-amber-200">
            <div className="card-body text-xs text-amber-800 space-y-1">
              <p><strong>utm_source</strong> — откуда пришёл: instagram, vk, yandex, google</p>
              <p><strong>utm_medium</strong> — тип: cpc (платная), social (органика), email, referral</p>
              <p><strong>utm_campaign</strong> — название кампании без пробелов: massaz_may_2026</p>
              <p><strong>utm_content</strong> — какое объявление: video_1, banner_red</p>
              <p><strong>utm_term</strong> — ключевое слово для поисковой рекламы</p>
            </div>
          </div>
        </div>

        {/* Результат */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold">3. Готовая ссылка</h2>
            </div>
            <div className="card-body">
              {result ? (
                <>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 font-mono text-xs break-all text-gray-800 border">
                    {result}
                  </div>
                  <button
                    onClick={copy}
                    className={`btn-primary w-full ${copied ? 'bg-green-600 border-green-600' : ''}`}
                  >
                    {copied ? '✓ Скопировано!' : '📋 Скопировать ссылку'}
                  </button>

                  {/* Разбивка параметров */}
                  <div className="mt-4 space-y-1 text-sm">
                    {form.source && <div className="flex gap-2"><span className="text-gray-400 w-32">utm_source</span><span className="font-mono text-violet-700">{form.source}</span></div>}
                    {form.medium && <div className="flex gap-2"><span className="text-gray-400 w-32">utm_medium</span><span className="font-mono text-violet-700">{form.medium}</span></div>}
                    {form.campaign && <div className="flex gap-2"><span className="text-gray-400 w-32">utm_campaign</span><span className="font-mono text-violet-700">{form.campaign}</span></div>}
                    {form.content && <div className="flex gap-2"><span className="text-gray-400 w-32">utm_content</span><span className="font-mono text-violet-700">{form.content}</span></div>}
                    {form.term && <div className="flex gap-2"><span className="text-gray-400 w-32">utm_term</span><span className="font-mono text-violet-700">{form.term}</span></div>}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8 text-sm">
                  Введите URL и выберите канал — ссылка появится здесь
                </div>
              )}
            </div>
          </div>

          {/* История */}
          {history.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-sm">История (эта сессия)</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {history.map((item, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 truncate">{item.label}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(item.url) }}
                      className="text-xs text-violet-600 hover:underline shrink-0"
                    >
                      Копировать
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Инструкция */}
          <div className="card bg-blue-50 border-blue-200">
            <div className="card-body text-sm text-blue-800">
              <p className="font-semibold mb-2">Как использовать:</p>
              <ol className="space-y-1 list-decimal ml-4">
                <li>Создайте ссылку для каждого рекламного канала</li>
                <li>Вставьте её в объявление вместо обычной ссылки</li>
                <li>Когда клиент перейдёт — Яндекс Метрика / GA4 запишут источник</li>
                <li>Данные появятся в разделе <strong>Маркетинг</strong></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
