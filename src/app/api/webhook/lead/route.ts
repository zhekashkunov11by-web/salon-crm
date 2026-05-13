import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendNewLeadNotification } from '@/lib/telegram/send'

// Supported sources with their webhook parsers
type WebhookSource = 'tilda' | 'instagram' | 'vk' | 'facebook' | 'yandex' | 'google' | 'avito' | 'missed_call' | 'make'

interface ParsedLead {
  client_name: string
  phone?: string
  email?: string
  source: string
  message?: string
  amount?: number
}

function parseTilda(body: Record<string, string>): ParsedLead {
  return {
    client_name: body.Name || body.name || body['Имя'] || 'Неизвестный клиент',
    phone: body.Phone || body.phone || body['Телефон'],
    email: body.Email || body.email,
    source: 'tilda',
    message: body.Message || body.message || body['Сообщение'],
  }
}

function parseMake(body: Record<string, string>): ParsedLead {
  return {
    client_name: body.name || body.client_name || 'Клиент из Make.com',
    phone: body.phone,
    email: body.email,
    source: body.source || 'make',
    message: body.message,
    amount: body.amount ? parseFloat(body.amount) : undefined,
  }
}

function parseGeneric(body: Record<string, string>, source: string): ParsedLead {
  return {
    client_name: body.name || body.client_name || body.Name || body.fullname || `Заявка из ${source}`,
    phone: body.phone || body.Phone || body.telephone,
    email: body.email || body.Email,
    source,
    message: body.message || body.comment || body.text,
  }
}

function parseBody(body: Record<string, string>, source: WebhookSource): ParsedLead {
  switch (source) {
    case 'tilda': return parseTilda(body)
    case 'make': return parseMake(body)
    default: return parseGeneric(body, source)
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const source = (url.searchParams.get('source') || 'make') as WebhookSource

  // Verify webhook secret (optional — some sources can't send headers)
  const secret = url.searchParams.get('secret') || req.headers.get('x-webhook-secret')
  const configuredSecret = process.env.WEBHOOK_SECRET
  if (configuredSecret && secret !== configuredSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  let body: Record<string, string> = {}
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      // form-urlencoded (Tilda sends this)
      const text = await req.text()
      const params = new URLSearchParams(text)
      params.forEach((v, k) => { body[k] = v })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const lead = parseBody(body, source)

  const supabase = createServiceClient()

  // Get first active status
  const { data: firstStatus } = await supabase
    .from('lead_statuses')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')
    .limit(1)
    .single()

  if (!firstStatus) {
    return NextResponse.json({ error: 'No lead statuses configured' }, { status: 500 })
  }

  // Create lead
  const { data: newLead, error } = await supabase.from('leads').insert({
    client_name: lead.client_name,
    phone: lead.phone || null,
    source: lead.source,
    notes: lead.message || null,
    amount: lead.amount || null,
    status_id: firstStatus.id,
  }).select().single()

  if (error) {
    console.error('Failed to create lead:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Record in lead_history
  await supabase.from('lead_history').insert({
    lead_id: newLead.id,
    action: 'created',
    new_status_id: firstStatus.id,
    note: `Создан через webhook (${source})`,
  })

  // Send Telegram notification
  await sendNewLeadNotification({
    client_name: lead.client_name,
    phone: lead.phone,
    source: lead.source,
    status_name: firstStatus.name,
  })

  return NextResponse.json({ ok: true, lead_id: newLead.id })
}

// Tilda sends GET request to verify endpoint
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const test = url.searchParams.get('test')
  if (test) {
    return new NextResponse(test) // Tilda verification
  }
  return NextResponse.json({ ok: true, endpoint: 'lead webhook' })
}
