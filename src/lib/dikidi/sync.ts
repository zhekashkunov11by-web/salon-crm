import { createServiceClient } from '@/lib/supabase/server'
import { fetchDikidiClients, fetchDikidiAppointments, type DikidiSyncResult } from './client'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('7')) {
    return '+' + digits
  }
  if (digits.length === 10) {
    return '+7' + digits
  }
  return '+' + digits
}

function generateClientCode(seq: number): string {
  return 'CL-' + String(seq).padStart(5, '0')
}

export async function runDikidiSync(): Promise<DikidiSyncResult & { error?: string }> {
  const supabase = createServiceClient()
  const errors: string[] = []

  // Get API credentials from settings or env
  let apiKey = process.env.DIKIDI_API_KEY || ''
  let companyId = process.env.DIKIDI_COMPANY_ID || ''

  // Try from settings table as fallback
  if (!apiKey || !companyId) {
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['dikidi_api_key', 'dikidi_company_id'])
    if (settingsData) {
      const map = Object.fromEntries(settingsData.map((r: { key: string; value: string }) => [r.key, r.value]))
      apiKey = apiKey || map.dikidi_api_key || ''
      companyId = companyId || map.dikidi_company_id || ''
    }
  }

  if (!apiKey || !companyId) {
    return { clients_synced: 0, visits_synced: 0, payments_synced: 0, errors: ['API key or company ID not configured'] }
  }

  let clientsSynced = 0
  let visitsSynced = 0

  try {
    // --- Sync clients ---
    const dikidiClients = await fetchDikidiClients(apiKey, companyId)

    for (const dc of dikidiClients) {
      try {
        const phone = dc.phone ? normalizePhone(dc.phone) : null

        // Check if client exists by dikidi_id or phone
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .or(`dikidi_id.eq.${dc.id}${phone ? `,phone.eq.${phone}` : ''}`)
          .maybeSingle()

        if (existing) {
          // Update existing
          await supabase.from('clients').update({
            dikidi_id: String(dc.id),
            name: dc.name,
            phone: phone || undefined,
            email: dc.email || undefined,
            birthday: dc.birthday || undefined,
          }).eq('id', existing.id)
        } else {
          // Get next sequence number
          const { count } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
          const seq = (count || 0) + 1

          await supabase.from('clients').insert({
            dikidi_id: String(dc.id),
            code: generateClientCode(seq),
            name: dc.name,
            phone: phone || null,
            email: dc.email || null,
            birthday: dc.birthday || null,
            source: 'dikidi',
            is_active: true,
          })
        }
        clientsSynced++
      } catch (e: unknown) {
        errors.push(`Client ${dc.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // --- Sync appointments (last 30 days + next 7 days) ---
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)
    const toDate = new Date()
    toDate.setDate(toDate.getDate() + 7)

    const from = fromDate.toISOString().split('T')[0]
    const to = toDate.toISOString().split('T')[0]

    const appointments = await fetchDikidiAppointments(apiKey, companyId, from, to)

    for (const appt of appointments) {
      try {
        // Find client by dikidi_id
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('dikidi_id', String(appt.client_id))
          .maybeSingle()

        if (!client) continue

        // Upsert visit
        await supabase.from('visits').upsert({
          dikidi_id: String(appt.id),
          client_id: client.id,
          visit_date: appt.start_datetime.split('T')[0],
          service_name: appt.service_name,
          amount: appt.price,
          prepaid: appt.prepaid || 0,
          status: appt.status,
          notes: appt.comment || null,
        }, { onConflict: 'dikidi_id' })

        visitsSynced++
      } catch (e: unknown) {
        errors.push(`Appointment ${appt.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push('Sync failed: ' + msg)
    // Log failed sync
    await supabase.from('dikidi_sync_log').insert({
      clients_synced: clientsSynced,
      visits_synced: visitsSynced,
      status: 'error',
      error_message: msg,
    })
    return { clients_synced: clientsSynced, visits_synced: visitsSynced, payments_synced: 0, errors, error: msg }
  }

  // Log successful sync
  await supabase.from('dikidi_sync_log').insert({
    clients_synced: clientsSynced,
    visits_synced: visitsSynced,
    status: 'success',
  })

  return { clients_synced: clientsSynced, visits_synced: visitsSynced, payments_synced: 0, errors }
}
