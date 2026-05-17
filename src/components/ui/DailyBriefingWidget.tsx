'use client'

import { useState, useEffect } from 'react'

interface BriefingAction {
  priority: 'high' | 'medium' | 'low'
  text: string
}

interface Briefing {
  greeting: string
  focus: string
  actions: BriefingAction[]
  tip: string
}

const TIME_COLORS = {
  morning: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', icon: '🌅', label: 'Утренний брифинг', dot: 'bg-amber-400' },
  day:     { bg: 'from-sky-50 to-blue-50',    border: 'border-sky-200',    icon: '☀️',  label: 'Дневная сводка',   dot: 'bg-sky-400'  },
  evening: { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200', icon: '🌙', label: 'Вечерний итог',   dot: 'bg-violet-400' },
}

const PRIORITY_STYLE: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  low:    'bg-green-50 text-green-700 border border-green-200',
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-400',
  low: 'bg-green-500',
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 час

function getCacheKey(role: string, timeOfDay: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `briefing_${role}_${date}_${timeOfDay}`
}

function getTimeOfDay(): 'morning' | 'day' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'day'
  return 'evening'
}

export function DailyBriefingWidget({ role }: { role: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'day' | 'evening'>('day')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  async function load(forceRefresh = false) {
    setLoading(true)
    setError(null)

    const tod = getTimeOfDay()
    setTimeOfDay(tod)

    // Проверяем кэш
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(getCacheKey(role, tod))
        if (cached) {
          const { data, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL_MS) {
            setBriefing(data)
            setLoading(false)
            return
          }
        }
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (json.briefing) {
        setBriefing(json.briefing)
        // Кэшируем
        localStorage.setItem(getCacheKey(role, tod), JSON.stringify({ data: json.briefing, ts: Date.now() }))
      } else {
        setError(json.error || 'Не удалось загрузить брифинг')
      }
    } catch {
      setError('Ошибка сети')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [role])

  const theme = TIME_COLORS[timeOfDay]

  if (loading) {
    return (
      <div className={`card mb-6 bg-gradient-to-br ${theme.bg} border ${theme.border}`}>
        <div className="card-header flex items-center gap-2">
          <span className="text-lg">{theme.icon}</span>
          <span className="font-semibold text-gray-700">{theme.label}</span>
        </div>
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className={`w-2 h-2 rounded-full ${theme.dot} animate-bounce opacity-70`}
                style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="text-sm text-gray-500">AI анализирует данные...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card mb-6 border-gray-200">
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">{theme.icon} Брифинг недоступен: {error}</span>
          <button onClick={() => load(true)} className="text-xs text-violet-600 hover:underline">Повторить</button>
        </div>
      </div>
    )
  }

  if (!briefing) return null

  return (
    <div className={`card mb-6 bg-gradient-to-br ${theme.bg} border ${theme.border}`}>
      {/* Заголовок */}
      <div
        className="card-header flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{theme.icon}</span>
          <span className="font-semibold text-gray-800">{theme.label}</span>
          <span className="text-xs bg-white/70 text-gray-500 px-2 py-0.5 rounded-full border border-white/80">✨ AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); load(true) }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Обновить брифинг"
          >
            ↻
          </button>
          <span className="text-gray-400 text-sm">{collapsed ? '▼' : '▲'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4">
          {/* Приветствие */}
          <p className="text-sm font-medium text-gray-800">{briefing.greeting}</p>

          {/* Фокус дня */}
          <div className="bg-white/60 rounded-xl px-4 py-3 border border-white/80">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Главное сейчас</p>
            <p className="text-sm text-gray-800">{briefing.focus}</p>
          </div>

          {/* Действия */}
          {briefing.actions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Что сделать</p>
              <div className="space-y-2">
                {briefing.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[action.priority] || 'bg-gray-400'}`} />
                    <div className="flex-1 flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-700">{action.text}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${PRIORITY_STYLE[action.priority] || ''}`}>
                        {action.priority === 'high' ? 'Срочно' : action.priority === 'medium' ? 'Важно' : 'Позже'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Совет */}
          {briefing.tip && (
            <div className="bg-white/40 rounded-lg px-4 py-2.5 border border-white/60">
              <p className="text-xs text-gray-500 italic">{briefing.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
