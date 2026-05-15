import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const META_API = 'https://graph.facebook.com/v19.0'

interface MetaAdInsight {
  ad_id: string
  ad_name: string
  adset_name: string
  campaign_name: string
  spend: string
  impressions: string
  reach: string
  clicks: string              // все клики (включая лайки и сохранения)
  inline_link_clicks: string  // реальные переходы по кнопке/ссылке объявления
  cpc: string
  cpm: string
  ctr: string
  actions?: { action_type: string; value: string }[]
  date_start: string
  date_stop: string
}

// Типы действий которые считаем заявками
const LEAD_ACTION_TYPES = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.messaging_conversation_started_7d',  // нажали "написать" в объявлении
  'onsite_conversion.total_messaging_connection',          // новое соединение в мессенджере
])

async function fetchAdInsights(
  accountId: string,
  token: string,
  since: string,
  until: string
): Promise<MetaAdInsight[]> {
  const params = new URLSearchParams({
    fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,cpc,cpm,ctr,actions',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    level: 'ad',
    access_token: token,
    limit: '500',
  })

  const res = await fetch(`${META_API}/act_${accountId}/insights?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message || `Meta API error ${res.status}`)
  }
  const data = await res.json()
  return (data.data || []) as MetaAdInsight[]
}

// POST /api/meta/sync
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const month: string = body.month || new Date().toISOString().slice(0, 7)
    const since = `${month}-01`
    const until = new Date(
      parseInt(month.slice(0, 4)),
      parseInt(month.slice(5, 7)),
      0
    ).toISOString().slice(0, 10)

    const supabase = createServiceClient()

    const { data: accounts } = await supabase
      .from('ad_channel_settings')
      .select('channel, account_id, access_token')
      .in('channel', ['facebook', 'instagram'])
      .eq('is_enabled', true)
      .not('account_id', 'is', null)
      .not('access_token', 'is', null)

    if (!accounts?.length) {
      return NextResponse.json({ error: 'No Meta accounts configured' }, { status: 400 })
    }

    const results: Record<string, { ads: number; spend: number; error?: string }> = {}

    for (const config of accounts) {
      try {
        const insights = await fetchAdInsights(
          config.account_id,
          config.access_token,
          since,
          until
        )

        let totalAds = 0
        let totalSpend = 0

        for (const row of insights) {
          const spend = parseFloat(row.spend || '0')
          if (spend <= 0) continue

          const leads = (row.actions || [])
            .filter(a => LEAD_ACTION_TYPES.has(a.action_type))
            .reduce((s, a) => s + parseInt(a.value || '0'), 0)

          const linkClicks = parseInt(row.inline_link_clicks || '0')

          // Upsert по дате + ad_id
          await supabase
            .from('meta_ad_stats')
            .upsert({
              date: row.date_start,
              account_channel: config.channel,
              ad_id: row.ad_id,
              ad_name: row.ad_name || '—',
              adset_name: row.adset_name || '—',
              campaign_name: row.campaign_name || '—',
              spend,
              impressions: parseInt(row.impressions || '0'),
              reach: parseInt(row.reach || '0'),
              clicks: linkClicks, // сохраняем именно переходы, не все клики
              cpc: linkClicks > 0 ? spend / linkClicks : parseFloat(row.cpc || '0'),
              cpm: parseFloat(row.cpm || '0'),
              ctr: parseFloat(row.ctr || '0'),
              leads_count: leads,
              synced_at: new Date().toISOString(),
            }, { onConflict: 'date,ad_id' })

          totalAds++
          totalSpend += spend
        }

        // Также обновляем marketing_expenses (агрегат по каналу за день)
        // чтобы общая аналитика маркетинга тоже работала
        const byDay: Record<string, { spend: number; impressions: number; reach: number; clicks: number; leads: number }> = {}
        for (const row of insights) {
          const spend = parseFloat(row.spend || '0')
          if (!byDay[row.date_start]) byDay[row.date_start] = { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 }
          byDay[row.date_start].spend += spend
          byDay[row.date_start].impressions += parseInt(row.impressions || '0')
          byDay[row.date_start].reach += parseInt(row.reach || '0')
          byDay[row.date_start].clicks += parseInt(row.clicks || '0')
          byDay[row.date_start].leads += (row.actions || [])
            .filter(a => LEAD_ACTION_TYPES.has(a.action_type))
            .reduce((s, a) => s + parseInt(a.value || '0'), 0)
          byDay[row.date_start].clicks += parseInt(row.inline_link_clicks || '0')
        }

        for (const [date, agg] of Object.entries(byDay)) {
          if (agg.spend <= 0) continue
          await supabase.from('marketing_expenses')
            .delete()
            .eq('date', date)
            .eq('source', config.channel)
            .eq('auto_synced', true)

          await supabase.from('marketing_expenses').insert({
            date,
            source: config.channel,
            amount: agg.spend,
            clicks: agg.clicks,
            impressions: agg.impressions,
            reach: agg.reach,
            leads_count: agg.leads,
            description: 'Meta Ads (авто)',
            auto_synced: true,
          })
        }

        await supabase
          .from('ad_channel_settings')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('channel', config.channel)

        results[config.channel] = { ads: totalAds, spend: totalSpend }

      } catch (e) {
        results[config.channel] = { ads: 0, spend: 0, error: String(e) }
      }
    }

    return NextResponse.json({ ok: true, month, results })
  } catch (err) {
    console.error('Meta sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
