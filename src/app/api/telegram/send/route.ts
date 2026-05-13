import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram, type TelegramChat } from '@/lib/telegram/send'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify session — only authenticated users can send messages
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { text, chat = 'all' } = body as { text: string; chat?: TelegramChat }

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const result = await sendTelegram(text, chat)
  return NextResponse.json(result)
}
