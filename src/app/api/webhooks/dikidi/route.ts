import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Dikidi webhook endpoint
// Настройте в Dikidi: Настройки → API → Webhooks → URL = https://your-site.netlify.app/api/webhooks/dikidi
// События: appointment.created, appointment.updated, appointment.cancelled

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('375')) return '+' + digits
  if (digits.length === 11 && digits.startsWith('7')) return '+' + digits
  if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1)
  if (digits.length === 10) return '+375' + digits
  return '+' + digits
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Dikidi может присылать массив событий или одно событие
    const events = Array.isArray(body) ? body : [body]

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results = []

    for (const event of events) {
      // Формат Dikidi webhook: { event: 'appointment.created', data: { appointment: {...}, client: {...} } }
      const eventType = event.event || event.type || 'appointment.created'
      const apptData = event.data?.appointment || event.appointment || event
      const clientData = event.data?.client || event.client || {}

      if (!apptData?.id) continue

      const dikidiAppointmentId = String(apptData.id)

      // Если запись удалена/отменена — помечаем в Supabase
      if (eventType === 'appointment.cancelled' || eventType === 'appointment.deleted' || apptData.status === 'cancelled') {
        await supabase
          .from('visits')
          .update({ status: 'cancelled' })
          .eq('dikidi_id', dikidiAppointmentId)
        results.push({ id: dikidiAppointmentId, action: 'cancelled' })
        continue
      }

      // Найти или создать клиента
      let clientId: string | null = null

      if (clientData?.id || apptData?.client_id) {
        const dikidiClientId = String(clientData.id || apptData.client_id)
        const clientPhone = clientData.phone ? normalizePhone(clientData.phone) : null

        // Ищем существующего клиента
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .or([
            `dikidi_id.eq.${dikidiClientId}`,
            clientPhone ? `phone.eq.${clientPhone}` : null,
          ].filter(Boolean).join(','))
          .maybeSingle()

        if (existing) {
          clientId = existing.id
          // Обновляем dikidi_id если не был привязан
          await supabase.from('clients').update({ dikidi_id: dikidiClientId }).eq('id', clientId)
        } else if (clientData?.name || apptData?.client_name) {
          // Создаём нового клиента
          const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true })
          const seq = (count || 0) + 1
          const code = 'CL-' + String(seq).padStart(5, '0')

          const { data: newClient } = await supabase.from('clients').insert({
            dikidi_id: dikidiClientId,
            code,
            name: clientData.name || apptData.client_name || 'Клиент из Dikidi',
            phone: clientPhone,
            email: clientData.email || null,
            source: 'dikidi',
            is_active: true,
          }).select('id').single()

          clientId = newClient?.id || null
        }
      }

      if (!clientId) {
        results.push({ id: dikidiAppointmentId, action: 'skipped_no_client' })
        continue
      }

      // Upsert визита
      const visitDate = apptData.start_datetime
        ? apptData.start_datetime.split('T')[0]
        : apptData.date || new Date().toISOString().split('T')[0]

      const startTime = apptData.start_datetime
        ? apptData.start_datetime.split('T')[1]?.slice(0, 5)
        : apptData.start_time || null

      const { error } = await supabase.from('visits').upsert({
        dikidi_id: dikidiAppointmentId,
        client_id: clientId,
        visit_date: visitDate,
        start_time: startTime,
        service_name: apptData.service_name || apptData.services?.[0]?.name || 'Услуга',
        amount: apptData.price || apptData.amount || 0,
        prepaid: apptData.prepaid || 0,
        status: apptData.status || 'confirmed',
        notes: apptData.comment || null,
        staff_id: null, // TODO: маппинг мастеров по dikidi master_id
      }, { onConflict: 'dikidi_id' })

      if (error) {
        results.push({ id: dikidiAppointmentId, action: 'error', error: error.message })
      } else {
        results.push({ id: dikidiAppointmentId, action: eventType === 'appointment.updated' ? 'updated' : 'created' })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}

// Dikidi может слать GET для проверки доступности
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'Восторг CRM — Dikidi webhook' })
}
