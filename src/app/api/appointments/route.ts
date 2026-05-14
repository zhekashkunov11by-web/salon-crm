import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createDikidiAppointment } from '@/lib/dikidi/client'

// POST /api/appointments — create a visit in Восторг + optionally push to Dikidi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      client_id,
      staff_id,
      service_name,
      service_id,    // Dikidi service ID (optional)
      visit_date,
      start_time,
      amount,
      prepaid,
      notes,
      push_to_dikidi,
    } = body

    if (!client_id || !service_name || !visit_date) {
      return NextResponse.json({ error: 'client_id, service_name, visit_date обязательны' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Create visit in Supabase
    const { data: visit, error: visitErr } = await supabase
      .from('visits')
      .insert({
        client_id,
        staff_id: staff_id || null,
        service_name,
        visit_date,
        start_time: start_time || null,
        amount: amount || 0,
        prepaid: prepaid || 0,
        notes: notes || null,
        status: 'confirmed',
      })
      .select('id')
      .single()

    if (visitErr || !visit) {
      return NextResponse.json({ error: visitErr?.message || 'Ошибка создания визита' }, { status: 500 })
    }

    let dikidi_id: string | null = null
    let dikidi_error: string | null = null

    // 2. Optionally push to Dikidi
    if (push_to_dikidi && staff_id && service_id) {
      // Get Dikidi credentials from settings
      const [apiKeyRes, companyIdRes, clientRes, staffRes] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'dikidi_api_key').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'dikidi_company_id').maybeSingle(),
        supabase.from('clients').select('dikidi_id').eq('id', client_id).maybeSingle(),
        supabase.from('staff').select('dikidi_id').eq('id', staff_id).maybeSingle(),
      ])

      const apiKey = apiKeyRes.data?.value || process.env.DIKIDI_API_KEY
      const companyId = companyIdRes.data?.value || process.env.DIKIDI_COMPANY_ID
      const dikidiClientId = clientRes.data?.dikidi_id
      const dikidiMasterId = staffRes.data?.dikidi_id

      if (apiKey && companyId && dikidiClientId && dikidiMasterId) {
        const startDatetime = start_time
          ? `${visit_date}T${start_time}:00`
          : `${visit_date}T09:00:00`

        const result = await createDikidiAppointment(apiKey, companyId, {
          client_id: dikidiClientId,
          service_id,
          master_id: dikidiMasterId,
          start_datetime: startDatetime,
          comment: notes || '',
        })

        if (result.success && result.dikidi_id) {
          dikidi_id = result.dikidi_id
          // Update visit with dikidi_id
          await supabase.from('visits').update({ dikidi_id }).eq('id', visit.id)
        } else {
          dikidi_error = result.error || 'Ошибка Dikidi'
        }
      } else {
        dikidi_error = 'Нет Dikidi ID у клиента или мастера — запись создана только в Восторг'
      }
    }

    return NextResponse.json({
      success: true,
      visit_id: visit.id,
      dikidi_id,
      dikidi_error,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
