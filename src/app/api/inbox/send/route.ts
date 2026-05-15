import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/inbox/send — отправить ответ клиенту через amoCRM
// Body: { conversation_id: string, text: string }
export async function POST(req: NextRequest) {
  try {
    const { conversation_id, text } = await req.json()

    if (!conversation_id || !text?.trim()) {
      return NextResponse.json({ error: 'conversation_id and text required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get conversation details
    const { data: conv, error: convErr } = await supabase
      .from('inbox_conversations')
      .select('id, channel, external_id, amocrm_chat_id')
      .eq('id', conversation_id)
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get amoCRM settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'amocrm_config')
      .single()

    const amoCrmConfig = settings?.value as {
      subdomain?: string
      access_token?: string
    } | null

    let amoCrmSent = false
    let amoCrmError: string | null = null

    if (amoCrmConfig?.subdomain && amoCrmConfig?.access_token) {
      // Send via amoCRM Chats API
      // POST https://{subdomain}.amocrm.ru/api/v4/chats/messages
      const chatId = conv.amocrm_chat_id || conv.external_id
      try {
        const res = await fetch(
          `https://${amoCrmConfig.subdomain}.amocrm.ru/api/v4/chats/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${amoCrmConfig.access_token}`,
            },
            body: JSON.stringify({
              chat_id: chatId,
              message: { type: 'text', text },
            }),
          }
        )
        if (res.ok) {
          amoCrmSent = true
        } else {
          const errText = await res.text()
          amoCrmError = `amoCRM API ${res.status}: ${errText.slice(0, 200)}`
        }
      } catch (e) {
        amoCrmError = String(e)
      }
    } else {
      amoCrmError = 'amoCRM credentials not configured'
    }

    // Always save message locally regardless of amoCRM status
    const { error: msgErr } = await supabase.from('inbox_messages').insert({
      conversation_id,
      direction: 'out',
      text: text.trim(),
      sent_via_amocrm: amoCrmSent,
      created_at: new Date().toISOString(),
    })

    if (msgErr) {
      return NextResponse.json({ error: 'DB error saving message' }, { status: 500 })
    }

    // Update conversation last_message_at
    await supabase
      .from('inbox_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id)

    return NextResponse.json({
      ok: true,
      sent_via_amocrm: amoCrmSent,
      amocrm_error: amoCrmError,
    })
  } catch (err) {
    console.error('inbox send error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
