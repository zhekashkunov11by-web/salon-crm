import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Webhook для коллтрекинга (Calltouch, CoMagic, Callibri)
// Входящий звонок → автоматически создаёт лид в CRM
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Calltouch передаёт: phoneFrom, phoneTo, callSource, sessionId, utmSource, utmMedium, utmCampaign
    // CoMagic передаёт: caller_number, call_source, utm_source, utm_medium, utm_campaign
    // Callibri: phone, source, utm_source, utm_medium, utm_campaign

    const phone = body.phoneFrom || body.caller_number || body.phone || 'Неизвестен'
    const source = body.callSource || body.call_source || body.source || 'phone'
    const utmSource = body.utmSource || body.utm_source || ''
    const utmMedium = body.utmMedium || body.utm_medium || ''
    const utmCampaign = body.utmCampaign || body.utm_campaign || ''

    // Определяем канал по utm_source
    const channelMap: Record<string, string> = {
      'instagram': 'instagram',
      'facebook': 'facebook',
      'vk': 'vk',
      'vkontakte': 'vk',
      'yandex': 'yandex_direct',
      'google': 'google',
      'telegram': 'telegram',
    }
    const leadSource = channelMap[utmSource?.toLowerCase()] || source || 'phone'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Ищем статус "Новая" или первый статус в воронке
    const { data: statuses } = await supabase
      .from('lead_statuses')
      .select('id, name')
      .order('sort_order')
      .limit(1)

    const statusId = statuses?.[0]?.id

    // Создаём лид
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        name: `Звонок ${phone}`,
        phone: phone,
        source: leadSource,
        status_id: statusId,
        notes: [
          `📞 Автоматически из коллтрекинга`,
          utmSource ? `UTM Source: ${utmSource}` : '',
          utmMedium ? `UTM Medium: ${utmMedium}` : '',
          utmCampaign ? `UTM Campaign: ${utmCampaign}` : '',
        ].filter(Boolean).join('\n'),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead_id: lead.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}

// Calltouch иногда отправляет GET для проверки webhook
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'Восторг CRM calltracking webhook' })
}
