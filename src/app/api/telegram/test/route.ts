import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram/send'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const text = `✅ *Тест уведомлений — Восторг CRM*\n\n` +
    `Бот настроен и работает корректно.\n` +
    `Время: ${new Date().toLocaleString('ru-BY')}`

  const result = await sendTelegram(text, 'both')
  return NextResponse.json(result)
}
