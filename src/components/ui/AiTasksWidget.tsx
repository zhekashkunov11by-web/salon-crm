'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Task {
  id: string
  title: string
  description?: string
  assigned_role?: string
  priority?: string
  due_date?: string
  is_done: boolean
  is_ai_generated?: boolean
  ai_reason?: string
  created_at: string
}

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
}
const PRIORITY_LABEL: Record<string, string> = {
  high: 'Срочно', medium: 'Обычная', low: 'Не спешно',
}
const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец', manager: 'Управляющий', admin: 'Администратор',
}

function fmtDate(d?: string) {
  if (!d) return null
  const date = new Date(d)
  const now = new Date()
  const diff = Math.ceil((date.getTime() - now.setHours(0,0,0,0)) / 86400000)
  if (diff < 0) return { text: `просрочено ${Math.abs(diff)} дн.`, overdue: true }
  if (diff === 0) return { text: 'сегодня', overdue: false }
  if (diff === 1) return { text: 'завтра', overdue: false }
  return { text: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }), overdue: false }
}

export function AiTasksWidget() {
  const supabase = createClient()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_done', false)
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true })
      .limit(15)
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markDone(id: string) {
    await supabase.from('tasks').update({ is_done: true }).eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  if (loading) return <div className="skeleton h-20 w-full mb-6" />
  if (tasks.length === 0) return null

  const aiTasks = tasks.filter(t => t.is_ai_generated)

  return (
    <div className="card mb-6">
      <div
        className="card-header flex items-center justify-between cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <h2 className="font-semibold text-gray-900">Задачи</h2>
          {aiTasks.length > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {aiTasks.length} от AI
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {tasks.length} активных
          </span>
        </div>
        <span className="text-gray-400 text-sm">{collapsed ? '▼' : '▲'}</span>
      </div>

      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {tasks.map(task => {
            const dateInfo = fmtDate(task.due_date)
            const priority = task.priority || 'medium'
            return (
              <div key={task.id} className={`px-5 py-3 flex items-start gap-3 group ${dateInfo?.overdue ? 'bg-red-50/40' : ''}`}>
                {/* Чекбокс */}
                <button
                  onClick={() => markDone(task.id)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-gray-300 hover:border-violet-500 flex items-center justify-center shrink-0 transition-colors"
                  title="Отметить выполненной"
                >
                  <span className="opacity-0 group-hover:opacity-100 text-violet-600 text-xs">✓</span>
                </button>

                {/* Содержимое */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>
                    {task.is_ai_generated && (
                      <span className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium shrink-0">✨ AI</span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>
                  )}

                  {task.ai_reason && (
                    <p className="text-xs text-violet-500 mt-0.5 italic">{task.ai_reason}</p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {task.assigned_role && (
                      <span className="text-xs text-gray-400">
                        → {ROLE_LABEL[task.assigned_role] || task.assigned_role}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLE[priority]}`}>
                      {PRIORITY_LABEL[priority]}
                    </span>
                    {dateInfo && (
                      <span className={`text-xs font-medium ${dateInfo.overdue ? 'text-red-600' : 'text-gray-400'}`}>
                        📅 {dateInfo.text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Удалить */}
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg leading-none transition-all shrink-0"
                  title="Удалить задачу"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
