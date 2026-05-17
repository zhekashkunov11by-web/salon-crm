import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function getTimeOfDay(): 'morning' | 'day' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'day'
  return 'evening'
}

const ROLE_CONTEXT = {
  owner: 'владелец салона красоты «Восторг». Тебя интересуют финансы, ROMI, стратегия, развитие бизнеса.',
  manager: 'управляющий салона красоты «Восторг». Тебя интересуют операционные показатели, команда, клиенты, выполнение плана.',
  admin: 'администратор салона красоты «Восторг». Тебя интересуют: кому позвонить, кого записать, текущие задачи, клиенты на сегодня.',
}

const TIME_CONTEXT = {
  morning: 'Сейчас утро. Дай краткий брифинг на день: на чём сфокусироваться, что сделать в первую очередь.',
  day: 'Сейчас день. Дай краткую подсказку: что сейчас важно, на что обратить внимание.',
  evening: 'Сейчас вечер. Дай краткое резюме дня и что подготовить на завтра.',
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY не настроен' }, { status: 400 })
  }

  try {
    const { role } = await req.json()
    const supabase = createServiceClient()
    const timeOfDay = getTimeOfDay()
    const today = new Date().toISOString().slice(0, 10)

    // Собираем реальные данные
    const [
      { data: overdueTasks },
      { count: openLeads },
      { count: newLeadsToday },
      { data: atRiskClients },
      { data: todayReport },
      { data: pendingLeads },
    ] = await Promise.all([
      supabase.from('tasks').select('title, assigned_role, due_date').eq('is_done', false).lte('due_date', today).limit(5),
      supabase.from('leads').select('*', { count: 'exact', head: true }).neq('status_id', 'closed'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00'),
      supabase.from('clients').select('name, last_visit_date, phone')
        .eq('is_active', true)
        .lt('last_visit_date', new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10))
        .not('last_visit_date', 'is', null)
        .order('last_visit_date', { ascending: true })
        .limit(5),
      supabase.from('daily_reports').select('revenue_cash, revenue_card, revenue_online, clients_count').eq('date', today).maybeSingle(),
      supabase.from('leads').select('client_name, source, created_at').order('created_at', { ascending: false }).limit(3),
    ])

    const totalRevenue = todayReport
      ? (todayReport.revenue_cash || 0) + (todayReport.revenue_card || 0) + (todayReport.revenue_online || 0)
      : null

    const dataContext = `
ДАННЫЕ НА СЕГОДНЯ (${today}):
- Просроченных задач: ${overdueTasks?.length || 0}${overdueTasks?.length ? ': ' + overdueTasks.map(t => `"${t.title}"`).join(', ') : ''}
- Открытых заявок в воронке: ${openLeads || 0}
- Новых заявок сегодня: ${newLeadsToday || 0}
- Клиентов под риском оттока (60+ дней без визита): ${atRiskClients?.length || 0}${atRiskClients?.length ? '. Первые: ' + atRiskClients.slice(0, 3).map(c => c.name).join(', ') : ''}
- Выручка сегодня: ${totalRevenue !== null ? totalRevenue.toFixed(2) + ' Br' : 'отчёт не заполнен'}
- Клиентов сегодня: ${todayReport?.clients_count ?? 'не указано'}
- Последние заявки: ${pendingLeads?.map(l => `${l.client_name} (${l.source || 'источник не указан'})`).join(', ') || 'нет'}
`

    const systemPrompt = `Ты — AI-помощник CRM салона красоты «Восторг».
Ты общаешься с ${ROLE_CONTEXT[role as keyof typeof ROLE_CONTEXT] || ROLE_CONTEXT.admin}
${TIME_CONTEXT[timeOfDay]}

Формат ответа — строго JSON:
{
  "greeting": "короткое приветствие (1 предложение)",
  "focus": "главный фокус на сегодня (1 предложение)",
  "actions": [
    {"priority": "high|medium|low", "text": "конкретное действие"},
    ...максимум 4 действия
  ],
  "tip": "короткий совет или мотивация (1 предложение)"
}

Будь конкретным — используй реальные данные. Не используй markdown, только JSON.`

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dataContext },
        ],
        temperature: 0.6,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error?.message || `Groq error ${res.status}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '{}'
    const briefing = JSON.parse(content)

    return NextResponse.json({ briefing, timeOfDay })
  } catch (err) {
    console.error('Briefing error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
