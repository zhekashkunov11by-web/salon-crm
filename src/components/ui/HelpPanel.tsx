'use client'

import { useState, useEffect } from 'react'

interface HelpItem {
  icon?: string
  title: string
  text: string
}

interface HelpPanelProps {
  id: string           // уникальный ключ для localStorage
  title?: string
  items: HelpItem[]
  defaultOpen?: boolean
}

export function HelpPanel({ id, title = 'Как это работает', items, defaultOpen = false }: HelpPanelProps) {
  const storageKey = `help_collapsed_${id}`
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) {
      setOpen(saved === 'open')
    } else {
      setOpen(defaultOpen)
    }
    setMounted(true)
  }, [storageKey, defaultOpen])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem(storageKey, next ? 'open' : 'closed')
  }

  if (!mounted) return null

  return (
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-blue-100/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-blue-800">
          <span>💡</span>
          <span>{title}</span>
        </span>
        <span className="text-blue-400 text-xs">{open ? '▲ Скрыть' : '▼ Показать'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid gap-2.5 sm:grid-cols-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2.5">
              {item.icon && <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>}
              <div>
                <p className="text-xs font-semibold text-blue-900">{item.title}</p>
                <p className="text-xs text-blue-700 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
