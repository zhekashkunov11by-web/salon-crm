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
    <div className="flex h-screen bg-gray-50">
      {/* Боковая навигация (десктоп) */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar userRole={userRole} userName={userName} />
      </div>

      {/* Основной контент */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>

      {/* Нижняя навигация (мобильная) */}
      <MobileNav userRole={userRole} />

      {/* Пиксели аналитики (Метрика, GA4, VK, FB, TikTok) */}
      <PixelInjector />

      {/* AI Помощник */}
      <AiAssistant />
    </div>
  )
}
