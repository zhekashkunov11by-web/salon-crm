'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  text: string
  pendingAction?: PendingAction
  actionResult?: string
}

interface PendingAction {
  type: 'add_expense' | 'add_client' | 'add_lead' | 'add_task'
  label: string
  data: Record<string, unknown>
}

const ACTION_ICONS: Record<string, string> = {
  add_expense: '💰',
  add_client: '👤',
  add_lead: '📋',
  add_task: '✅',
}

function ActionCard({ action, onConfirm, onCancel, done }: {
  action: PendingAction
  onConfirm: () => void
  onCancel: () => void
  done?: string
}) {
  const hidden = new Set(['assigned_role', 'priority_raw', 'category_hint'])
  const entries = Object.entries(action.data).filter(([k, v]) => v && !hidden.has(k))
  const labels: Record<string, string> = {
    amount: 'Сумма', description: 'Описание', date: 'Дата',
    name: 'Имя', phone: 'Телефон', source: 'Источник', notes: 'Заметки',
    client_name: 'Имя клиента',
    title: 'Задача', assigned_label: 'Кому', priority: 'Приоритет',
    due_date: 'Срок', ai_reason: 'Причина',
  }

  if (done) {
    return (
      <div className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
        <p className="text-xs text-green-700 font-medium">✓ {done}</p>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
      <div className="px-3 py-2 bg-violet-100 flex items-center gap-1.5">
        <span>{ACTION_ICONS[action.type]}</span>
        <span className="text-xs font-semibold text-violet-800">{action.label}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="text-gray-500 w-20 shrink-0">{labels[k] || k}:</span>
            <span className="text-gray-800 font-medium">{String(v)}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 flex gap-2 border-t border-violet-200">
        <button onClick={onConfirm} className="flex-1 text-xs py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 font-medium transition-colors">
          ✓ Подтвердить
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  )
}

export function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  // JS-based mobile detection (надёжнее CSS md:hidden)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Определяем мобильный экран по ширине окна
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Слушаем событие от нижнего меню (мобильная AI-кнопка)
  useEffect(() => {
    const handler = () => setOpen(o => !o)
    window.addEventListener('toggle-ai-chat', handler)
    return () => window.removeEventListener('toggle-ai-chat', handler)
  }, [])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: 'Привет! Я помощник CRM «Восторг». Могу подсказать кому из клиентов написать, объяснить любой раздел системы, внести данные под диктовку или написать пост для Instagram. Спрашивайте!',
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      alert('Голосовой ввод поддерживается только в Chrome')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR()
    r.lang = 'ru-RU'
    r.continuous = false
    r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      setInput(text)
      setTimeout(() => send(text), 300)
    }
    r.onerror = () => setListening(false)
    r.start()
    recognitionRef.current = r
  }

  async function send(text?: string) {
    const userText = (text || input).trim()
    if (!userText || loading) return
    const newMessages: Message[] = [...messages, { role: 'user', text: userText }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, text: m.text })) }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', text: data.text || data.error || 'Ошибка', pendingAction: data.pendingAction }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Ошибка сети. Попробуйте ещё раз.' }])
    }
    setLoading(false)
  }

  async function confirmAction(msgIndex: number, action: PendingAction) {
    try {
      const res = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: action.type, data: action.data }),
      })
      const data = await res.json()
      setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, actionResult: data.ok ? data.message : ('Ошибка: ' + data.error) } : msg))
    } catch {
      setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, actionResult: 'Ошибка сети' } : msg))
    }
  }

  function cancelAction(msgIndex: number) {
    setMessages(m => m.map((msg, i) => i === msgIndex ? { ...msg, actionResult: 'Отменено' } : msg))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const ChatWindow = () => (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="bg-violet-600 px-4 py-3 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm">✨</div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">AI Помощник Восторг</p>
          <p className="text-violet-200 text-xs">Llama · знает систему и клиентов</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setMessages([])} className="text-white/60 hover:text-white text-xs">Сбросить</button>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] ${m.role === 'user' ? '' : 'w-full'}`}>
              <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {m.text}
              </div>
              {m.pendingAction && (
                m.actionResult
                  ? <ActionCard action={m.pendingAction} onConfirm={() => {}} onCancel={() => {}} done={m.actionResult} />
                  : <ActionCard action={m.pendingAction} onConfirm={() => confirmAction(i, m.pendingAction!)} onCancel={() => cancelAction(i)} />
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Ввод */}
      <div
        className="border-t border-gray-100 px-3 py-2.5 flex gap-2 shrink-0"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={startVoice}
          disabled={loading}
          style={{ touchAction: 'manipulation' }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          title="Голосовой ввод"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={listening ? 'Слушаю...' : 'Спросите или продиктуйте...'}
          disabled={loading || listening}
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-violet-400 bg-gray-50 disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ touchAction: 'manipulation' }}
          className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Десктопная кнопка — только на широких экранах (≥768px) */}
      {!isMobile && (
        <button
          onClick={() => setOpen(o => !o)}
          className="fixed bottom-6 right-6 z-[60] rounded-full shadow-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center transition-all active:scale-95"
          style={{ width: 56, height: 56 }}
          title="AI Помощник"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          )}
        </button>
      )}

      {/* Мобильный чат — выезжает снизу как шторка (для узких экранов) */}
      {open && isMobile && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="relative bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ height: '90vh' }}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <ChatWindow />
          </div>
        </div>
      )}

      {/* Десктопное окно чата (для широких экранов) */}
      {open && !isMobile && (
        <div
          className="fixed bottom-24 right-6 z-[60] w-[390px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: 560 }}
        >
          <ChatWindow />
        </div>
      )}
    </>
  )
}
