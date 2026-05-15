import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const META_API = 'https://graph.facebook.com/v19.0'

interface MetaInsight {
  spend: string
  impressions: string
  reach: string
  clicks: string
  actions?: { action_type: string; value: string }[]
  date_start: string
  date_stop: string
}

interface AdAccountConfig {
  channel: string     // 'facebook' | 'instagram'
  account_id: string
  access_token: string
  label: string
}

async function fetchInsights(
  accountId: string,
  token: string,
  since: string,
  until: string
): Promise<MetaInsight[]> {
  const params = new URLSearchParams({
    fields: 'spend,impressions,reach,clicks,actions',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',   // один ряд = один день
    level: 'account',
    access_token: token,
  })

  const res = await fetch(`${META_API}/act_${accountId}/insights?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message || `Meta API error ${res.status}`)
  }
  const data = await res.json()
  return (data.data || []) as MetaInsight[]
}

// POST /api/meta/sync
// Синхронизирует данные из Meta Ads за указанный месяц (или текущий)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const month: string = body.month || new Date().toISOString().slice(0, 7)
    const since = `${month}-01`
    // last day of month
    const until = new Date(
      parseInt(month.slice(0, 4)),
      parseInt(month.slice(5, 7)),
      0
    ).toISOString().slice(0, 10)

    const supabase = createServiceClient()

    // Get all enabled Meta accounts (facebook + instagram both use Meta)
    const { data: accounts, error: accErr } = await supabase
      .from('ad_channel_settings')
      .select('channel, account_id, access_token')
      .in('channel', ['facebook', 'instagram'])
      .eq('is_enabled', true)
      .not('account_id', 'is', null)
      .not('access_token', 'is', null)

    if (accErr || !accounts?.length) {
      return NextResponse.json({ error: 'No Meta accounts configured' }, { status: 400 })
    }

    const configs = accounts as AdAccountConfig[]
    const results: Record<string, { days: number; spend: number; error?: string }> = {}

    for (const config of configs) {
      try {
        const insights = await fetchInsights(
          config.account_id,
          config.access_token,
          since,
          until
        )

        let totalDays = 0
        let totalSpend = 0

        for (const day of insights) {
          const spend = parseFloat(day.spend || '0')
          if (spend <= 0) continue

          const impressions = parseInt(day.impressions || '0')
          const reach = parseInt(day.reach || '0')
          const clicks = parseInt(day.clicks || '0')

          // Count leads from actions
          const leads = (day.actions || [])
            .filter(a =>
              a.action_type === 'lead' ||
              a.action_type === 'onsite_conversion.lead_grouped' ||
              a.action_type === 'offsite_conversion.fb_pixel_lead'
            )
            .reduce((s, a) => s + parseInt(a.value || '0'), 0)

          // Upsert: delete existing row for this date+source, then insert fresh
          await supabase
            .from('marketing_expenses')
            .delete()
            .eq('date', day.date_start)
            .eq('source', config.channel)
            .eq('auto_synced', true)

          await supabase.from('marketing_expenses').insert({
            date: day.date_start,
            source: config.channel,
            amount: spend,
            clicks,
            impressions,
            reach,
            leads_count: leads,
            description: `Meta Ads (синхронизировано автоматически)`,
            auto_synced: true,
          })

          totalDays++
          totalSpend += spend
        }

        results[config.channel] = { days: totalDays, spend: totalSpend }

        // Update last_synced_at
        await supabase
          .from('ad_channel_settings')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('channel', config.channel)

      } catch (e) {
        results[config.channel] = { days: 0, spend: 0, error: String(e) }
      }
    }

    return NextResponse.json({ ok: true, month, results })
  } catch (err) {
    console.error('Meta sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
