import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import PixelInjector from '@/components/PixelInjector'
import { AiAssistant } from '@/components/ui/AiAssistant'
import type { UserRole } from '@/types'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', session.user.id)
    .single()

  const profile = profileData as { role: string; name: string } | null

  if (!profile) {
    redirect('/login')
  }

  const userRole = profile.role as UserRole
  const userName = profile.name

  return (
    // min-h-dvh + flex-col на мобильном, flex-row на десктопе
    <div className="flex min-h-screen bg-gray-50">
      {/* Боковая навигация (только на десктопе ≥768px) */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar userRole={userRole} userName={userName} />
      </div>

      {/* Основной контент — скроллится, с паддингом для нижней навигации */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* pb-32 на мобильном — место для нижнего нава (64px) + safe area + запас */}
        <div className="p-4 md:p-6 pb-32 md:pb-8">
          {children}
        </div>
      </main>

      {/* Нижняя навигация (мобильная — JS определяет показывать или нет) */}
      <MobileNav userRole={userRole} />

      {/* Пиксели аналитики */}
      <PixelInjector />

      {/* AI Помощник */}
      <AiAssistant />
    </div>
  )
}
