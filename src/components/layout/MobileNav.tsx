'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { UserRole } from '@/types'

interface MobileNavProps {
  userRole: UserRole
}

function openAiChat() {
  window.dispatchEvent(new CustomEvent('toggle-ai-chat'))
}

const ALL_NAV = [
  { href: '/dashboard',    label: 'Дашборд',         roles: ['owner','manager','admin'], emoji: '🏠' },
  { href: '/appointments', label: 'Расписание',       roles: ['owner','manager','admin'], emoji: '📅' },
  { href: '/crm',          label: 'Воронка заявок',   roles: ['owner','manager','admin'], emoji: '📋' },
  { href: '/inbox',        label: 'Входящие',         roles: ['owner','manager','admin'], emoji: '💬' },
  { href: '/clients',      label: 'Клиенты',          roles: ['owner','manager','admin'], emoji: '👥' },
  { href: '/daily-report', label: 'Отчёт дня',        roles: ['owner','manager','admin'], emoji: '📊' },
  { href: '/expenses',     label: 'Расходы',          roles: ['owner','manager','admin'], emoji: '💸' },
  { href: '/supplies',     label: 'Расходники',       roles: ['owner','manager'],         emoji: '📦' },
  { href: '/finance',      label: 'Финансы (ДДС/PnL)',roles: ['owner','manager'],         emoji: '💰' },
  { href: '/salary',       label: 'Зарплата',         roles: ['owner','manager'],         emoji: '💵' },
  { href: '/marketing',    label: 'Маркетинг',        roles: ['owner','manager'],         emoji: '📣' },
  { href: '/analytics',    label: 'Аналитика',        roles: ['owner','manager'],         emoji: '📈' },
  { href: '/settings',     label: 'Настройки',        roles: ['owner'],                   emoji: '⚙️' },
]

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const filteredNav = ALL_NAV.filter(item => item.roles.includes(userRole))

  // Главные 4 пункта в нижней панели
  const mainItems = [
    { href: '/dashboard',    label: 'Главная', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { href: '/crm',          label: 'Воронка', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )},
    { href: '/clients',      label: 'Клиенты', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { href: '/daily-report', label: 'Отчёт', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
  ]

  return (
    <>
      {/* Шторка «Ещё» — все разделы */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            {/* Ручка */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-4 pb-2 pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Все разделы</p>
              <div className="grid grid-cols-3 gap-2">
                {filteredNav.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-colors ${
                        isActive
                          ? 'bg-violet-50 text-violet-700'
                          : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      <span className="text-2xl leading-none">{item.emoji}</span>
                      <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
            <div style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }} />
          </div>
        </div>
      )}

      {/* Нижняя навигация */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {/* Первые 2 пункта */}
          {mainItems.slice(0, 2).map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? 'text-violet-600' : 'text-gray-400'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}

          {/* AI — центральная кнопка */}
          <button
            onClick={openAiChat}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            className="w-20 flex flex-col items-center justify-center gap-0.5 shrink-0 bg-violet-600 text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-[10px] font-bold leading-none">AI</span>
          </button>

          {/* 3-й пункт */}
          {(() => {
            const item = mainItems[2]
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                href={item.href}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? 'text-violet-600' : 'text-gray-400'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })()}

          {/* Кнопка «Ещё» */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${
              moreOpen ? 'text-violet-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-medium leading-none">Ещё</span>
          </button>
        </div>
      </nav>
    </>
  )
}
