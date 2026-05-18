import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function getTimeOfDay(): 'morning' | 'day' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'day'
  return 'evening'
}

// Какие данные подтягивать для каждой роли
// owner видит всё, manager видит manager+admin, admin видит только admin
function getRoleLevels(role: string): string[] {
  if (role === 'owner') return ['admin', 'manager', 'owner']
  if (role === 'manager') return ['admin', 'manager']
  return ['admin']
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY не настроен' }, { status: 400 })
  }

  // Роль берём из сессии — не доверяем телу запроса
  const supabaseAuth = createServerClient()
  const { data: { session } } = await supabaseAuth.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { data: profileData } = await supabaseAuth
    .from('profiles').select('role, name').eq('id', session.user.id).single()
  const role = (profileData as { role: string; name: string } | null)?.role || 'admin'
  const userName = (profileData as { role: string; name: string } | null)?.name || ''

  // Также принимаем role из тела только если он "слабее" реального (для безопасности)
  try { await req.json() } catch { /* ignore */ }

  const supabase = createServiceClient()
  const timeOfDay = getTimeOfDay()
  const today = new Date().toISOString().slice(0, 10)
  const levels = getRoleLevels(role)

  // ── Данные для уровня ADMIN (базовые, нужны всем) ──────────────────────────
  const [
    { data: overdueTasks },
    { count: openLeads },
    { count: newLeadsToday },
    { data: atRiskClients },
    { data: todayReport },
    { data: upcomingBirthdays },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from('tasks').select('title, assigned_role, due_date')
      .eq('is_done', false).lte('due_date', today).limit(5),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .neq('status_id', 'closed'),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00'),
    supabase.from('clients').select('name, last_visit_date, phone, instagram')
      .eq('is_active', true)
      .lt('last_visit_date', new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10))
      .not('last_visit_date', 'is', null)
      .order('last_visit_date', { ascending: true })
      .limit(5),
    supabase.from('daily_reports')
      .select('revenue_cash, revenue_card, revenue_online, clients_count').eq('date', today).maybeSingle(),
    // Дни рождения в ближайшие 7 дней (сравниваем MM-DD)
    supabase.from('clients').select('name, birthday, phone')
      .not('birthday', 'is', null).eq('is_active', true).limit(50),
    supabase.from('leads').select('client_name, source, created_at, status_id')
      .order('created_at', { ascending: false }).limit(5),
  ])

  const totalRevenue = todayReport
    ? (todayReport.revenue_cash || 0) + (todayReport.revenue_card || 0) + (todayReport.revenue_online || 0)
    : null

  // Фильтруем дни рождения
  const todayMMDD = today.slice(5)
  const in7daysDate = new Date(Date.now() + 7 * 86400000)
  const birthdayClients = (upcomingBirthdays || []).filter(c => {
    if (!c.birthday) return false
    const bMMDD = c.birthday.slice(5)
    // сравниваем строки MM-DD в диапазоне [today, today+7]
    return bMMDD >= todayMMDD && bMMDD <= in7daysDate.toISOString().slice(5, 10)
  }).slice(0, 3)

  // ── Данные для уровня MANAGER ──────────────────────────────────────────────
  let managerData = ''
  if (levels.includes('manager')) {
    const monthStart = today.slice(0, 7) + '-01'
    const [
      { data: monthReports },
      { data: allStaff },
    ] = await Promise.all([
      supabase.from('daily_reports')
        .select('date, revenue_cash, revenue_card, revenue_online, clients_count')
        .gte('date', monthStart).lte('date', today),
      supabase.from('profiles').select('name, role').neq('role', 'owner'),
    ])

    const monthRevenue = (monthReports || []).reduce((s, r) =>
      s + (r.revenue_cash || 0) + (r.revenue_card || 0) + (r.revenue_online || 0), 0)
    const monthDays = parseInt(today.slice(8))
    const avgPerDay = monthDays > 0 ? Math.round(monthRevenue / monthDays) : 0
    const projectedMonth = avgPerDay * 30
    const plan = 300000

    managerData = `
ДАННЫЕ УПРАВЛЯЮЩЕГО:
- Выручка за месяц (${today.slice(0, 7)}): ${monthRevenue.toFixed(0)} Br
- Выполнение плана: ${Math.round(monthRevenue / plan * 100)}% от ${plan.toLocaleString('ru')} Br
- Средняя выручка/день: ${avgPerDay.toLocaleString('ru')} Br → прогноз на месяц: ${projectedMonth.toLocaleString('ru')} Br
- Рабочих дней с отчётом в этом месяце: ${monthReports?.length || 0}
- Команда: ${(allStaff || []).map(s => `${s.name} (${s.role})`).join(', ') || 'нет данных'}
`
  }

  // ── Данные для уровня OWNER ────────────────────────────────────────────────
  let ownerData = ''
  if (levels.includes('owner')) {
    const monthStart = today.slice(0, 7) + '-01'
    const [
      { data: monthExpenses },
      { data: sourceStats },
    ] = await Promise.all([
      supabase.from('expenses').select('amount, description, recognition_months')
        .gte('date', monthStart).lte('date', today),
      supabase.from('clients').select('source').eq('is_active', true),
    ])

    const totalExpenses = (monthExpenses || []).reduce((s, e) => {
      const months = e.recognition_months || 1
      return s + (e.amount || 0) / months
    }, 0)

    // Источники клиентов
    const sourceCounts: Record<string, number> = {}
    ;(sourceStats || []).forEach(c => {
      if (c.source) sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1
    })
    const topSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([s, n]) => `${s}: ${n}`).join(', ')

    ownerData = `
ДАННЫЕ ВЛАДЕЛЬЦА:
- Расходы за месяц (P&L): ~${totalExpenses.toFixed(0)} Br
- Топ источники клиентов: ${topSources || 'нет данных'}
`
  }

  // ── Формируем контекст ─────────────────────────────────────────────────────
  const adminData = `
ОПЕРАЦИОННЫЕ ДАННЫЕ (${today}):
- Просроченных задач: ${overdueTasks?.length || 0}${overdueTasks?.length ? '. Задачи: ' + overdueTasks.map(t => `"${t.title}" (до ${t.due_date})`).join('; ') : ''}
- Открытых заявок в воронке: ${openLeads || 0}
- Новых заявок сегодня: ${newLeadsToday || 0}
- Выручка сегодня: ${totalRevenue !== null ? totalRevenue.toFixed(0) + ' Br' : 'отчёт не заполнен'}
- Клиентов принято сегодня: ${todayReport?.clients_count ?? 'не указано'}
- Клиентов под риском оттока (45+ дней без визита): ${atRiskClients?.length || 0}${atRiskClients?.length ? '. Список: ' + atRiskClients.map(c => `${c.name} (тел: ${c.phone || '?'})`).join('; ') : ''}
- Дни рождения в ближайшие 7 дней: ${birthdayClients.length > 0 ? birthdayClients.map(c => `${c.name} (${c.birthday?.slice(5)})`).join(', ') : 'нет'}
- Последние заявки: ${recentLeads?.map(l => `${l.client_name} (${l.source || '?'})`).join(', ') || 'нет'}
`

  // ── Системный промпт по роли ───────────────────────────────────────────────
  const roleDescriptions: Record<string, string> = {
    admin: `Ты общаешься с АДМИНИСТРАТОРОМ салона «Восторг» (${userName}).
Твои рекомендации касаются: кому позвонить или написать из клиентов, какие заявки обработать, что сделать прямо сейчас на стойке ресепшн.
Давай конкретные имена клиентов для звонка, конкретные задачи.`,

    manager: `Ты общаешься с УПРАВЛЯЮЩИМ салона «Восторг» (${userName}).
Давай рекомендации двух уровней:
1. Оперативные (как у администратора): кого записать, какие заявки срочные
2. Управленческие: выполнение плана, с кем из команды поговорить, какой процесс наладить.
Называй конкретные имена, цифры, сроки.`,

    owner: `Ты общаешься с ВЛАДЕЛЬЦЕМ салона «Восторг» (${userName}).
Давай рекомендации трёх уровней:
1. Оперативные (кто из клиентов под риском)
2. Управленческие (план, команда)
3. Стратегические (прибыльность, источники клиентов, развитие).
Говори как бизнес-советник: цифры, тренды, конкретные решения.`,
  }

  const timeContext: Record<string, string> = {
    morning: 'Сейчас утро. Дай брифинг на день: фокус, приоритеты, что сделать в первую очередь.',
    day: 'Сейчас день. Что важно прямо сейчас, на что обратить внимание.',
    evening: 'Сейчас вечер. Резюме дня и что подготовить на завтра.',
  }

  const systemPrompt = `Ты — AI-помощник CRM салона красоты «Восторг».
${roleDescriptions[role] || roleDescriptions.admin}
${timeContext[timeOfDay]}

Формат ответа — строго JSON без markdown:
{
  "greeting": "короткое приветствие (1 предложение, обращайся по имени)",
  "focus": "главный фокус прямо сейчас (1-2 предложения с конкретикой)",
  "actions": [
    {"priority": "high|medium|low", "text": "конкретное действие с именем/цифрой"},
    ... максимум 5 действий
  ],
  "tip": "короткий совет или мотивация (1 предложение)"
}

Используй РЕАЛЬНЫЕ данные. Если есть конкретные имена клиентов — называй их.`

  const userMessage = adminData + managerData + ownerData

  try {
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
          { role: 'user', content: userMessage },
        ],
        temperature: 0.65,
        max_tokens: 700,
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

    return NextResponse.json({ briefing, timeOfDay, role })
  } catch (err) {
    console.error('Briefing error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
