import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/inbox/amocrm — webhook от amoCRM при новом сообщении или событии
// amoCRM отправляет webhook при входящем сообщении из любого канала
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // amoCRM webhook payload structure:
    // { message: { id, type, chat_id, contact: { id, name, phone }, text, created_at, channel: 'instagram'|'vk'|'telegram'|'whatsapp'|'facebook' } }
    // OR for lead: { leads: { add: [...] } }

    // Handle incoming message
    if (body.message) {
      const msg = body.message
      const channelType = msg.channel || 'unknown'
      const externalChatId = String(msg.chat_id || msg.contact?.id || '')
      const contactName = msg.contact?.name || 'Неизвестный'
      const contactPhone = msg.contact?.phone || null

      // Upsert conversation
      let { data: conv } = await supabase
        .from('inbox_conversations')
        .select('id')
        .eq('external_id', externalChatId)
        .eq('channel', channelType)
        .single()

      if (!conv) {
        const { data: newConv, error: convErr } = await supabase
          .from('inbox_conversations')
          .insert({
            channel: channelType,
            external_id: externalChatId,
            contact_name: contactName,
            contact_phone: contactPhone,
            status: 'open',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select('id')
          .single()

        if (convErr) {
          console.error('Error creating conversation:', convErr)
          return NextResponse.json({ error: 'DB error' }, { status: 500 })
        }
        conv = newConv
      } else {
        // Update last_message_at and unread_count
        await supabase
          .from('inbox_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            contact_name: contactName,
            unread_count: supabase.rpc('increment', { row_id: conv.id }),
          })
          .eq('id', conv.id)
      }

      // Insert message
      const { error: msgErr } = await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: conv!.id,
          direction: 'in',
          text: msg.text || '',
          external_id: String(msg.id || ''),
          created_at: msg.created_at
            ? new Date(msg.created_at * 1000).toISOString()
            : new Date().toISOString(),
        })

      if (msgErr) {
        console.error('Error inserting message:', msgErr)
      }

      // Update unread_count simply (increment via raw update)
      await supabase.rpc('inbox_increment_unread', { p_conversation_id: conv!.id })

      return NextResponse.json({ ok: true })
    }

    // Handle lead creation from amoCRM (new lead = possible new client inquiry)
    if (body.leads?.add) {
      // Just acknowledge — lead handling is in /api/webhook/lead
      return NextResponse.json({ ok: true, note: 'Lead webhook received' })
    }

    return NextResponse.json({ ok: true, note: 'Unknown payload' })
  } catch (err) {
    console.error('amoCRM webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET — verification endpoint for amoCRM webhook setup
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ status: 'amoCRM inbox webhook active' })
}
