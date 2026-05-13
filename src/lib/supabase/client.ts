import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

// Клиент для компонентов (браузер)
// После создания проекта в Supabase: npx supabase gen types typescript --project-id YOUR_ID
// и добавить: createBrowserClient<Database>(url, key)
export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(url, key)
}
