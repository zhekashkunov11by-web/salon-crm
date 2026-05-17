'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

// SVG иконки
const Icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  crm: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  clients: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  report: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  expenses: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  finance: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  salary: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  marketing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
  inbox: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  supplies: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Дашборд', icon: Icons.dashboard, roles: ['owner', 'manager', 'admin'] },
  { href: '/appointments', label: 'Расписание', icon: Icons.calendar, roles: ['owner', 'manager', 'admin'] },
  { href: '/crm', label: 'Воронка заявок', icon: Icons.crm, roles: ['owner', 'manager', 'admin'] },
  { href: '/inbox', label: 'Входящие', icon: Icons.inbox, roles: ['owner', 'manager', 'admin'] },
  { href: '/clients', label: 'Клиенты', icon: Icons.clients, roles: ['owner', 'manager', 'admin'] },
  { href: '/daily-report', label: 'Отчёт дня', icon: Icons.report, roles: ['owner', 'manager', 'admin'] },
  { href: '/expenses', label: 'Расходы', icon: Icons.expenses, roles: ['owner', 'manager', 'admin'] },
  { href: '/supplies', label: 'Расходники', icon: Icons.supplies, roles: ['owner', 'manager'] },
  { href: '/finance', label: 'Финансы (ДДС/PnL)', icon: Icons.finance, roles: ['owner', 'manager'] },
  { href: '/salary', label: 'Зарплата', icon: Icons.salary, roles: ['owner', 'manager'] },
  { href: '/marketing', label: 'Маркетинг', icon: Icons.marketing, roles: ['owner', 'manager'] },
  { href: '/analytics', label: 'Аналитика', icon: Icons.analytics, roles: ['owner', 'manager'] },
  { href: '/settings', label: 'Настройки', icon: Icons.settings, roles: ['owner'] },
]

interface SidebarProps {
  userRole: UserRole
  userName: string
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [inboxUnread, setInboxUnread] = useState(0)

  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(userRole))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Subscribe to inbox unread count
  useEffect(() => {
    async function loadUnread() {
      const { data } = await supabase
        .from('inbox_conversations')
        .select('unread_count')
        .eq('status', 'open')
      const total = (data || []).reduce((s: number, c: { unread_count: number }) => s + (c.unread_count || 0), 0)
      setInboxUnread(total)
    }
    loadUnread()

    const channel = supabase
      .channel('sidebar-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_conversations' }, () => {
        loadUnread()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      {/* Шапка */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-sm">
            В
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Восторг</p>
            <p className="text-xs text-gray-400">CRM v4.0</p>
          </div>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const showBadge = item.href === '/inbox' && inboxUnread > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="bg-violet-600 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-1">
                  {inboxUnread > 99 ? '99+' : inboxUnread}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Профиль + выход */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-400 capitalize">
            {userRole === 'owner' ? 'Владелец' : userRole === 'manager' ? 'Управляющий' : 'Администратор'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {Icons.logout}
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  )
}
