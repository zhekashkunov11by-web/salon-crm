import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const today = () => new Date().toISOString().slice(0, 10)

// Матрица прав доступа AI по ролям
const ROLE_CONTEXT: Record<string, string> = {
  owner: `Ты общаешься с ВЛАДЕЛЬЦЕМ салона. Полный доступ: финансы, зарплаты, управленческий учёт, конверты, настройки сотрудников. Можешь вносить любые расходы без лимита. Можешь добавлять сотрудников и изменять ставки (скажи пользователю зайти в Настройки → Сотрудники).`,
  manager: `Ты общаешься с УПРАВЛЯЮЩИМ салона. Доступ: все расходы без лимита, клиенты, заявки, задачи, расписание, финансовые итоги. Управленческий учёт зарплат (конверты) и настройки сотрудников доступны только владельцу.`,
  admin: `Ты общаешься с АДМИНИСТРАТОРОМ салона. Доступ ограничен: внесение расходов до 500 Br (более крупные — только с разрешения управляющего), добавление клиентов и заявок, диктовка заметок о клиентах, работа с расписанием. Финансовые отчёты, зарплаты и настройки — только для управляющего и владельца. Если просят что-то вне прав — вежливо объясни и предложи обратиться к управляющему.`,
}

const ROLE_EXPENSE_LIMIT: Record<string, number> = {
  owner: Infinity,
  manager: Infinity,
  admin: 500,
}

const BASE_SYSTEM_PROMPT = `Ты — встроенный помощник CRM-системы «Восторг» для салона красоты в Беларуси.
Ты знаешь эту систему досконально и помогаешь команде работать с ней.
Отвечай на русском языке, кратко и по делу.

=== СТРУКТУРА CRM ===
📋 ВОРОНКА ЗАЯВОК: канбан-доска. Добавить заявку — «+ Новая заявка». Источник (Instagram/телефон/рекомендация) — обязателен.
👥 БАЗА КЛИЕНТОВ: все клиенты. Красная строка = не приходил 60+ дней. Есть заметки и Instagram.
📅 ОТЧЁТ ДНЯ: вносить каждый день — выручка (нал/карта/онлайн), клиентов, из них новых.
📈 АНАЛИТИКА: KPI за месяц. Данные из Отчёта дня.
📣 МАРКЕТИНГ: CPL, CAC, ROMI по каналам.
💰 ЖУРНАЛ РАСХОДОВ: «+ Добавить расход» → дата, категория, сумма. Можно указать период признания в P&L (1/2/3/6/12 мес).
📑 ФИНАНСЫ (ДДС и P&L):
- ДДС — реальные деньги. ЗАЧЕМ: есть ли деньги прямо сейчас.
- P&L — экономика. ЗАЧЕМ: прибыльный ли бизнес. Расходы с амортизацией размазываются по месяцам.
👷 ЗАРПЛАТА: мастера = выручка × %, администраторы = ставка × смены + бонус.
⚙️ НАСТРОЙКИ → Рекламные платформы: токен Meta ~60 дней.

=== КАК ВНОСИТЬ ГОЛОСОМ ===
- Расход → propose_add_expense
- Новый клиент → propose_add_client
- Новая заявка → propose_add_lead
- Задача команде → propose_add_task
- Кому написать → get_clients_to_contact

Валюта: Br (белорусские рубли). Страна: Беларусь.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_clients_to_contact',
      description: 'Получить список клиентов которым нужно написать — давно не приходили (60+ дней)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_tasks',
      description: 'Получить список невыполненных задач',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_expense',
      description: 'Предложить добавить расход. Если упоминается период (на 2 месяца, на год) — заполни recognition_months.',
      parameters: {
        type: 'object',
        required: ['amount', 'description'],
        properties: {
          amount: { type: 'number', description: 'Сумма в Br' },
          description: { type: 'string', description: 'Что купили или оплатили' },
          date: { type: 'string', description: 'Дата YYYY-MM-DD, по умолчанию сегодня' },
          category_hint: { type: 'string', description: 'материалы/аренда/зарплата/реклама/хоз/оборудование' },
          recognition_months: { type: 'number', description: 'На сколько месяцев размазывать в P&L: 1/2/3/6/12. По умолчанию 1.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_client',
      description: 'Предложить добавить нового клиента',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Имя клиента' },
          phone: { type: 'string', description: 'Телефон' },
          source: { type: 'string', description: 'instagram/vk/avito/phone/referral/dikidi' },
          notes: { type: 'string', description: 'Заметки' },
          instagram: { type: 'string', description: 'Instagram ник или ссылка' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_lead',
      description: 'Предложить добавить заявку в воронку',
      parameters: {
        type: 'object',
        required: ['client_name'],
        properties: {
          client_name: { type: 'string', description: 'Имя клиента' },
          phone: { type: 'string', description: 'Телефон' },
          source: { type: 'string', description: 'instagram/facebook/phone/referral/avito' },
          amount: { type: 'number', description: 'Сумма сделки в рублях' },
          notes: { type: 'string', description: 'Что интересует' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_task',
      description: 'Поставить задачу для команды',
      parameters: {
        type: 'object',
        required: ['title', 'assigned_role'],
        properties: {
          title: { type: 'string', description: 'Краткое название задачи' },
          description: { type: 'string', description: 'Подробное описание' },
          assigned_role: { type: 'string', description: 'owner / manager / admin' },
          priority: { type: 'string', description: 'high / medium / low' },
          due_date: { type: 'string', description: 'Срок YYYY-MM-DD' },
          ai_reason: { type: 'string', description: 'Почему ставится задача' },
        },
      },
    },
  },
]

async function executeGetClientsToContact() {
  try {
    const supabase = createServiceClient()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const { data } = await supabase
      .from('clients')
      .select('name, phone, last_visit_date, total_revenue, visits_count')
      .eq('is_active', true)
      .lt('last_visit_date', cutoff.toISOString().slice(0, 10))
      .not('last_visit_date', 'is', null)
      .order('last_visit_date', { ascending: true })
      .limit(10)
    if (!data?.length) return 'Нет клиентов без визита 60+ дней — все активны!'
    return JSON.stringify(data.map(c => ({
      name: c.name,
      phone: c.phone,
      days_ago: Math.floor((Date.now() - new Date(c.last_visit_date).getTime()) / 86400000),
      visits: c.visits_count,
      revenue: c.total_revenue,
    })))
  } catch { return 'Не удалось загрузить клиентов' }
}

async function executeGetPendingTasks() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('tasks')
      .select('title, description, assigned_role, priority, due_date, is_ai_generated, ai_reason')
      .eq('is_done', false)
      .order('due_date', { ascending: true })
      .limit(20)
    if (!data?.length) return 'Нет активных задач'
    return JSON.stringify(data)
  } catch { return 'Не удалось загрузить задачи' }
}

async function callGroq(messages: { role: string; content: string }[], useTools = true) {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  }
  if (useTools) body.tools = TOOLS

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message || `Groq error ${res.status}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY не настроен' }, { status: 400 })
  }

  try {
    const { messages } = await req.json()

    // Получаем роль пользователя из сессии
    let userRole = 'admin'
    try {
      const supabase = createServerClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', session.user.id).single()
        if (profile?.role) userRole = profile.role
      }
    } catch { /* используем дефолтную роль */ }

    // Формируем системный промпт с учётом роли
    const roleContext = ROLE_CONTEXT[userRole] || ROLE_CONTEXT.admin
    const expenseLimit = ROLE_EXPENSE_LIMIT[userRole] || 500
    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n=== РОЛЬ ПОЛЬЗОВАТЕЛЯ ===\n${roleContext}\n\nЛимит расхода через голосовой ввод: ${expenseLimit === Infinity ? 'без лимита' : expenseLimit + ' Br'}`

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    ]

    const data = await callGroq(groqMessages)
    const choice = data.choices?.[0]
    const msg = choice?.message

    if (msg?.tool_calls?.length > 0) {
      const toolCall = msg.tool_calls[0]
      const name = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments || '{}')

      // Читающие функции
      if (name === 'get_clients_to_contact' || name === 'get_pending_tasks') {
        const result = name === 'get_clients_to_contact'
          ? await executeGetClientsToContact()
          : await executeGetPendingTasks()

        const data2 = await callGroq([
          ...groqMessages,
          { role: 'assistant', content: null, tool_calls: msg.tool_calls } as unknown as { role: string; content: string },
          { role: 'tool', content: result, tool_call_id: toolCall.id } as unknown as { role: string; content: string },
        ], false)
        const text2 = data2.choices?.[0]?.message?.content || 'Не удалось получить ответ'
        return NextResponse.json({ text: text2 })
      }

      // Проверка лимита расхода для admin
      if (name === 'propose_add_expense') {
        const limit = ROLE_EXPENSE_LIMIT[userRole] || 500
        if (args.amount > limit) {
          return NextResponse.json({
            text: `Сумма ${args.amount} Br превышает ваш лимит (${limit} Br). Обратитесь к управляющему или владельцу для внесения крупных расходов.`,
          })
        }
        const recMonths = Math.max(1, Math.min(12, parseInt(args.recognition_months) || 1))
        const amountPerMonth = recMonths > 1 ? (args.amount / recMonths).toFixed(2) : null
        const periodNote = recMonths > 1
          ? ` (ДДС: ${args.amount} Br сразу · P&L: ${amountPerMonth} Br/мес × ${recMonths} мес)`
          : ''
        return NextResponse.json({
          text: `Вношу расход${periodNote} — проверьте и подтвердите:`,
          pendingAction: {
            type: 'add_expense', label: 'Добавить расход',
            data: {
              amount: args.amount, description: args.description,
              date: args.date || today(), category_hint: args.category_hint || '',
              recognition_months: recMonths,
            },
          },
        })
      }

      if (name === 'propose_add_client') {
        return NextResponse.json({
          text: 'Добавляю клиента — проверьте:',
          pendingAction: {
            type: 'add_client', label: 'Добавить клиента',
            data: {
              name: args.name, phone: args.phone || '',
              source: args.source || 'phone', notes: args.notes || '',
              instagram: args.instagram || '',
            },
          },
        })
      }

      if (name === 'propose_add_lead') {
        return NextResponse.json({
          text: 'Добавляю заявку в воронку — проверьте:',
          pendingAction: {
            type: 'add_lead', label: 'Добавить заявку',
            data: {
              client_name: args.client_name, phone: args.phone || '',
              source: args.source || 'phone', amount: args.amount || 0,
              notes: args.notes || '',
            },
          },
        })
      }

      if (name === 'propose_add_task') {
        // Admin может ставить задачи только admin и manager, не owner
        let assignedRole = args.assigned_role || 'manager'
        if (userRole === 'admin' && assignedRole === 'owner') {
          assignedRole = 'manager'
        }
        const roleLabel: Record<string, string> = { owner: 'Владелец', manager: 'Управляющий', admin: 'Администратор' }
        const priorityLabel: Record<string, string> = { high: '🔴 Срочно', medium: '🟡 Обычная', low: '🟢 Не спешно' }
        return NextResponse.json({
          text: 'Ставлю задачу — проверьте:',
          pendingAction: {
            type: 'add_task', label: 'Поставить задачу',
            data: {
              title: args.title, description: args.description || '',
              assigned_role: assignedRole,
              assigned_label: roleLabel[assignedRole] || assignedRole,
              priority: priorityLabel[args.priority || 'medium'],
              priority_raw: args.priority || 'medium',
              due_date: args.due_date || '', ai_reason: args.ai_reason || '',
            },
          },
        })
      }
    }

    const text = msg?.content || 'Не удалось получить ответ'
    return NextResponse.json({ text })

  } catch (err) {
    console.error('Groq error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
