'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Channel = 'instagram' | 'vk' | 'telegram' | 'whatsapp' | 'facebook'

interface Conversation {
  id: string
  channel: Channel
  external_id: string
  contact_name: string | null
  contact_phone: string | null
  status: string
  unread_count: number
  last_message_at: string | null
  created_at: string
}

interface Message {
  id: string
  conversation_id: string
  direction: 'in' | 'out'
  text: string
  created_at: string
}

const CHANNEL_ICONS: Record<Channel | string, { icon: string; color: string; label: string }> = {
  instagram: { icon: '📸', color: 'bg-pink-100 text-pink-600', label: 'Instagram' },
  vk: { icon: '💬', color: 'bg-blue-100 text-blue-700', label: 'ВКонтакте' },
  telegram: { icon: '✈️', color: 'bg-sky-100 text-sky-600', label: 'Telegram' },
  whatsapp: { icon: '📱', color: 'bg-green-100 text-green-600', label: 'WhatsApp' },
  facebook: { icon: '👥', color: 'bg-indigo-100 text-indigo-600', label: 'Facebook' },
  unknown: { icon: '💬', color: 'bg-gray-100 text-gray-500', label: 'Неизвестно' },
}

function formatTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

export default function InboxPage() {
  const supabase = createClient()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'open' | 'closed' | 'all'>('open')
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedConv = conversations.find(c => c.id === selectedId) || null

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    let q = supabase
      .from('inbox_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (filterStatus !== 'all') q = q.eq('status', filterStatus)
    if (filterChannel !== 'all') q = q.eq('channel', filterChannel)

    const { data } = await q
    setConversations((data || []) as Conversation[])
    setLoadingConvs(false)
  }, [supabase, filterStatus, filterChannel])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Real-time subscription to conversations
  useEffect(() => {
    const channel = supabase
      .channel('inbox-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_conversations' }, () => {
        loadConversations()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadConversations])

  // Load messages for selected conversation
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages((data || []) as Message[])
    setLoadingMsgs(false)

    // Mark as read
    await supabase
      .from('inbox_conversations')
      .update({ unread_count: 0 })
      .eq('id', convId)

    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
    )
  }, [supabase])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
  }, [selectedId, loadMessages])

  // Real-time subscription to messages
  useEffect(() => {
    if (!selectedId) return
    const channel = supabase
      .channel(`inbox-msgs-${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inbox_messages',
        filter: `conversation_id=eq.${selectedId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, selectedId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendReply() {
    if (!replyText.trim() || !selectedId) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedId, text: replyText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Ошибка отправки')
      } else {
        setReplyText('')
        if (!data.sent_via_amocrm && data.amocrm_error) {
          setSendError(`Сохранено локально. amoCRM: ${data.amocrm_error}`)
        }
        // Reload messages to show the new outgoing one
        loadMessages(selectedId)
      }
    } catch {
      setSendError('Ошибка сети')
    } finally {
      setSending(false)
    }
  }

  async function toggleStatus(conv: Conversation) {
    const newStatus = conv.status === 'open' ? 'closed' : 'open'
    await supabase
      .from('inbox_conversations')
      .update({ status: newStatus })
      .eq('id', conv.id)
    loadConversations()
    if (selectedId === conv.id && newStatus === 'closed') setSelectedId(null)
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0)

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 text-lg">
              Входящие
              {totalUnread > 0 && (
                <span className="ml-2 bg-violet-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  {totalUnread}
                </span>
              )}
            </h1>
          </div>

          {/* Status filter */}
          <div className="flex gap-1 mb-2">
            {(['open', 'closed', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  filterStatus === s
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s === 'open' ? 'Открытые' : s === 'closed' ? 'Закрытые' : 'Все'}
              </button>
            ))}
          </div>

          {/* Channel filter */}
          <select
            className="input text-sm py-1"
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
          >
            <option value="all">Все каналы</option>
            {Object.entries(CHANNEL_ICONS).filter(([k]) => k !== 'unknown').map(([key, v]) => (
              <option key={key} value={key}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-gray-500 text-sm font-medium">Нет диалогов</p>
              <p className="text-gray-400 text-xs mt-1">
                Они появятся когда amoCRM пришлёт вебхук
              </p>
            </div>
          ) : (
            conversations.map(conv => {
              const ch = CHANNEL_ICONS[conv.channel] || CHANNEL_ICONS.unknown
              const isSelected = selectedId === conv.id
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                    isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${ch.color}`}>
                      {ch.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {conv.contact_name || 'Неизвестный'}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {conv.unread_count > 0 && (
                            <span className="bg-violet-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                              {conv.unread_count > 9 ? '9+' : conv.unread_count}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatTime(conv.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ch.color}`}>{ch.label}</span>
                        {conv.contact_phone && (
                          <span className="text-xs text-gray-400 truncate">{conv.contact_phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel — chat */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-gray-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${
                (CHANNEL_ICONS[selectedConv.channel] || CHANNEL_ICONS.unknown).color
              }`}>
                {(CHANNEL_ICONS[selectedConv.channel] || CHANNEL_ICONS.unknown).icon}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedConv.contact_name || 'Неизвестный'}</p>
                <p className="text-xs text-gray-400">
                  {(CHANNEL_ICONS[selectedConv.channel] || CHANNEL_ICONS.unknown).label}
                  {selectedConv.contact_phone && ` · ${selectedConv.contact_phone}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                selectedConv.status === 'open'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {selectedConv.status === 'open' ? 'Открыт' : 'Закрыт'}
              </span>
              <button
                onClick={() => toggleStatus(selectedConv)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {selectedConv.status === 'open' ? 'Закрыть' : 'Открыть'}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50">
            {loadingMsgs ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className={`skeleton h-12 w-64 rounded-xl ${i % 2 === 0 ? 'ml-auto' : ''}`} />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">Нет сообщений</p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      msg.direction === 'out'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.direction === 'out' ? 'text-violet-200' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                      {msg.direction === 'out' && (
                        <span className="ml-1">{(msg as Message & { sent_via_amocrm?: boolean }).sent_via_amocrm ? '✓✓' : '✓'}</span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            {sendError && (
              <p className="text-xs text-amber-600 mb-2 bg-amber-50 px-3 py-1.5 rounded-lg">{sendError}</p>
            )}
            <div className="flex gap-2">
              <textarea
                className="input flex-1 resize-none text-sm"
                rows={2}
                placeholder="Написать ответ..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendReply()
                  }
                }}
                disabled={selectedConv.status === 'closed' || sending}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending || selectedConv.status === 'closed'}
                className="btn-primary px-4 self-end disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <span className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            {selectedConv.status === 'closed' && (
              <p className="text-xs text-gray-400 mt-1 text-center">Диалог закрыт. Откройте его чтобы ответить.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-500 font-medium">Выберите диалог</p>
            <p className="text-gray-400 text-sm mt-1">или дождитесь входящих сообщений</p>
          </div>
        </div>
      )}
    </div>
  )
}
