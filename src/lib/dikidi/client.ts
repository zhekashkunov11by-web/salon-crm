// Dikidi Business API client
// Docs: https://dikidi.ru/api (partner access required)

const DIKIDI_BASE_URL = 'https://api.dikidi.ru/v2'

interface DikidiClient {
  id: string
  name: string
  phone?: string
  email?: string
  birthday?: string
  comment?: string
  created_at: string
}

interface DikidiAppointment {
  id: string
  client_id: string
  master_id: string
  service_id: string
  service_name: string
  start_datetime: string
  end_datetime: string
  status: string
  price: number
  prepaid: number
  comment?: string
}

interface DikidiPayment {
  id: string
  appointment_id: string
  client_id: string
  amount: number
  method: string // cash | card | online
  created_at: string
}

export interface DikidiSyncResult {
  clients_synced: number
  visits_synced: number
  payments_synced: number
  errors: string[]
}

async function dikidiFetch(path: string, apiKey: string, companyId: string) {
  const url = `${DIKIDI_BASE_URL}${path}?company_id=${companyId}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Dikidi API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function fetchDikidiClients(apiKey: string, companyId: string, page = 1): Promise<DikidiClient[]> {
  try {
    const data = await dikidiFetch(`/clients?page=${page}&per_page=100`, apiKey, companyId)
    return data.data || data.clients || data || []
  } catch {
    return []
  }
}

export async function fetchDikidiAppointments(
  apiKey: string,
  companyId: string,
  from: string,
  to: string,
  page = 1
): Promise<DikidiAppointment[]> {
  try {
    const data = await dikidiFetch(
      `/appointments?from=${from}&to=${to}&page=${page}&per_page=100`,
      apiKey,
      companyId
    )
    return data.data || data.appointments || data || []
  } catch {
    return []
  }
}

export async function fetchDikidiPayments(
  apiKey: string,
  companyId: string,
  from: string,
  to: string,
): Promise<DikidiPayment[]> {
  try {
    const data = await dikidiFetch(
      `/payments?from=${from}&to=${to}`,
      apiKey,
      companyId
    )
    return data.data || data.payments || data || []
  } catch {
    return []
  }
}

export interface CreateDikidiAppointmentInput {
  client_id: string       // Dikidi client ID
  service_id: string      // Dikidi service ID
  master_id: string       // Dikidi master (staff) ID
  start_datetime: string  // ISO 8601: "2026-05-14T10:00:00"
  comment?: string
}

export interface CreateDikidiAppointmentResult {
  success: boolean
  dikidi_id?: string
  error?: string
}

export async function createDikidiAppointment(
  apiKey: string,
  companyId: string,
  input: CreateDikidiAppointmentInput
): Promise<CreateDikidiAppointmentResult> {
  try {
    const url = `${DIKIDI_BASE_URL}/appointments?company_id=${companyId}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        company_id: companyId,
        client_id: input.client_id,
        service_id: input.service_id,
        master_id: input.master_id,
        start_datetime: input.start_datetime,
        comment: input.comment || '',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Dikidi API ${res.status}: ${text}` }
    }

    const data = await res.json()
    const id = data.data?.id || data.id || data.appointment_id
    return { success: true, dikidi_id: String(id) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export interface DikidiService {
  id: string
  name: string
  duration: number
  price: number
  category?: string
}

export interface DikidiMaster {
  id: string
  name: string
  specialization?: string
}

export async function fetchDikidiServices(apiKey: string, companyId: string): Promise<DikidiService[]> {
  try {
    const data = await dikidiFetch('/services', apiKey, companyId)
    return data.data || data.services || data || []
  } catch {
    return []
  }
}

export async function fetchDikidiMasters(apiKey: string, companyId: string): Promise<DikidiMaster[]> {
  try {
    const data = await dikidiFetch('/masters', apiKey, companyId)
    return data.data || data.masters || data || []
  } catch {
    return []
  }
}
