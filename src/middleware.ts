import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Публичные маршруты (без авторизации)
const publicRoutes = ['/login', '/auth/callback']

// API маршруты без авторизации (вебхуки, синхронизация)
const publicApiPrefixes = [
  '/api/webhooks/',
  '/api/inbox/amocrm',
  '/api/meta/sync',
  '/api/dikidi/sync',
  '/api/telegram/',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Если Supabase не настроен — всё разрешаем (режим разработки без .env)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'ВСТАВИТЬ') {
    return res
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const pathname = req.nextUrl.pathname

  // Разрешаем API без авторизации
  if (publicApiPrefixes.some(p => pathname.startsWith(p))) {
    return res
  }

  // Разрешаем публичные маршруты
  if (publicRoutes.includes(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return res
  }

  // Не авторизован — на логин
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Получаем роль
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const profileData = profile as { role: string } | null
  const role = profileData?.role

  // Только owner
  if (pathname.startsWith('/settings') && role !== 'owner') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Только owner и manager
  if (
    (pathname.startsWith('/analytics') ||
      pathname.startsWith('/salary') ||
      pathname.startsWith('/marketing') ||
      pathname.startsWith('/finance')) &&
    role === 'admin'
  ) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
}
