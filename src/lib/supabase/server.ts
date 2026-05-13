import { createServerClient as createSupabaseServerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Клиент для серверных компонентов (SSR)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createServerClient = (): ReturnType<typeof createSupabaseServerClient<any>> => {
  const cookieStore = cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseServerClient<any>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

// Клиент с service role для внутренних API (обходит RLS)
export const createServiceClient = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createClient<any>(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
