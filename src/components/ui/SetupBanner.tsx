'use client'

import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'setup_banner_dismissed'

export function SetupBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mt-6 bg-violet-50 border border-violet-200 rounded-xl p-5 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-violet-400 hover:text-violet-700 text-lg leading-none"
        title="Скрыть"
      >×</button>
      <h3 className="font-semibold text-violet-900 mb-2">🚀 Начало работы</h3>
      <ol className="text-sm text-violet-800 space-y-1 list-decimal list-inside">
        <li>Заполните <a href="/settings" className="underline">Настройки</a> — данные салона и план выручки</li>
        <li>Добавьте <a href="/settings/staff" className="underline">Сотрудников</a> и их ставки</li>
        <li>Настройте <a href="/settings/references" className="underline">Справочники</a> — услуги и расходники</li>
        <li>Введите Dikidi API ключ для синхронизации данных</li>
        <li>Настройте Telegram бот для уведомлений</li>
      </ol>
    </div>
  )
}
