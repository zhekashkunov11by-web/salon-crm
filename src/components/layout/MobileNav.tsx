'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types'

interface MobileNavProps {
  userRole: UserRole
}

function openAiChat() {
  window.dispatchEvent(new CustomEvent('toggle-ai-chat'))
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconCrm({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function IconClients({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconReport({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

const NAV_LEFT = [
  { href: '/dashboard', label: 'Главная', Icon: IconHome },
  { href: '/crm', label: 'Воронка', Icon: IconCrm },
]

const NAV_RIGHT = [
  { href: '/clients', label: 'Клиенты', Icon: IconClients },
  { href: '/daily-report', label: 'Отчёт', Icon: IconReport },
]

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname()
  void userRole

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', background: 'white', borderTop: '1px solid #e5e7eb' }}
    >
      <div className="flex h-16">

        {/* Левые пункты */}
        {NAV_LEFT.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-50 ${
                isActive ? 'text-violet-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}

        {/* Центральная AI-кнопка — всегда видна, выделена фиолетовым */}
        <button
          onClick={openAiChat}
          className="w-20 flex flex-col items-center justify-center gap-0.5 bg-violet-600 text-white shrink-0 active:bg-violet-700 transition-colors"
          aria-label="AI Помощник"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-[10px] font-bold leading-none">AI</span>
        </button>

        {/* Правые пункты */}
        {NAV_RIGHT.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-gray-50 ${
                isActive ? 'text-violet-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}

      </div>
    </nav>
  )
}
