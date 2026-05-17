import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const today = () => new Date().toISOString().slice(0, 10)

const SYSTEM_PROMPT = `Ты — встроенный помощник CRM-системы «Восторг» для салона красоты в Беларуси.
Ты знаешь эту систему досконально и помогаешь владельцу и менеджерам работать с ней.
Отвечай на русском языке, кратко и по делу. Если объясняешь где нажать — давай пошаговую инструкцию.

=== СТРУКТУРА CRM ===

📋 ВОРОНКА ЗАЯВОК: канбан-доска. Добавить заявку — кнопка «+ Новая заявка». Указывать источник (Instagram/Facebook/телефон/рекомендация) — обязательно, иначе маркетинговая аналитика не считается.

👥 БАЗА КЛИЕНТОВ: все клиенты. Красная строка = не приходил 60+ дней. Добавить — «+ Клиент». Данные о визитах и выручке обновляются из Отчёта дня.

📅 ОТЧЁТ ДНЯ: заполняется каждый день. Вносить: выручка (наличные/карта/онлайн), количество клиентов, из них новых. Это основа для Аналитики, Финансов, Зарплаты.

📈 АНАЛИТИКА: KPI за месяц. Стрелка ▲ = лучше чем в прошлом месяце. Данные из Отчёта дня.

📣 МАРКЕТИНГ: эффективность каналов. CPL = расходы÷заявки, CAC = расходы÷клиенты, ROMI = (выручка−расходы)÷расходы×100%. Заявки берутся из Воронки. Расходы Meta подтягиваются автоматически.

📊 ОБЪЯВЛЕНИЯ META: статистика по каждому объявлению. CTR норма 1-3%. Если данные не обновляются — токен истёк (Настройки → Рекламные платформы → обновить токен).

💰 ЖУРНАЛ РАСХОДОВ: все расходы салона. «+ Добавить расход» → дата, категория, сумма.

📑 ФИНАНСЫ (ДДС и P&L):
- ДДС (Движение денежных средств) — РЕАЛЬНЫЕ деньги. Операционная (основная работа), Инвестиционная (оборудование), Финансовая (кредиты). ЗАЧЕМ: видно есть ли деньги прямо сейчас.
- P&L (Прибыль и убытки) — экономическая эффективность. Выручка − Расходы = Прибыль. ЗАЧЕМ: видно прибыльный ли бизнес в принципе.
- Данные: доходы из Отчёта дня, расходы из Журнала расходов.

👷 ЗАРПЛАТА: автоматически из Отчёта дня. Мастера = выручка × процент. Администраторы = ставка × смены. Ставки в Настройки → Сотрудники.

⚙️ НАСТРОЙКИ → Рекламные платформы: токен Meta действует ~60 дней. Получить: developers.facebook.com/tools/explorer → выбрать приложение → ads_read + ads_management → Generate Access Token.

=== ЗАДАЧИ ДЛЯ КОМАНДЫ ===
Ты можешь ставить задачи управляющему (manager), администратору (admin) или владельцу (owner).
Задачи видны на главной странице (дашборд).
Когда ставить задачи: клиент не приходил давно, токен истёк, не заполнен отчёт, закончились расходники, нужно проверить показатели.

=== КАК ВНОСИТЬ ДАННЫЕ ГОЛОСОМ ===
Если пользователь диктует что-то для внесения в систему — используй инструменты:
- Купили что-то / расход / оплатили → propose_add_expense
- Пришёл новый клиент → propose_add_client
- Новая заявка → propose_add_lead
- Поставить задачу команде → propose_add_task
- Кому написать из клиентов → get_clients_to_contact

Валюта: белорусские рубли (Br). Страна: Беларусь.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_clients_to_contact',
      description: 'Получить список клиентов которым нужно написать — давно не приходили (60+ дней без визита)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_tasks',
      description: 'Получить список текущих невыполненных задач',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_expense',
      description: 'Предложить добавить расход или покупку в журнал расходов',
      parameters: {
        type: 'object',
        required: ['amount', 'description'],
        properties: {
          amount: { type: 'number', description: 'Сумма в белорусских рублях' },
          description: { type: 'string', description: 'Что купили или оплатили' },
          date: { type: 'string', description: 'Дата YYYY-MM-DD, по умолчанию сегодня' },
          category_hint: { type: 'string', description: 'материалы/аренда/зарплата/реклама/хоз/оборудование' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_client',
      description: 'Предложить добавить нового клиента в базу',
      parameters: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Имя клиента' },
          phone: { type: 'string', description: 'Номер телефона' },
          source: { type: 'string', description: 'instagram/vk/avito/phone/referral/dikidi' },
          notes: { type: 'string', description: 'Заметки' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_lead',
      description: 'Предложить добавить заявку в воронку продаж',
      parameters: {
        type: 'object',
        required: ['client_name'],
        properties: {
          client_name: { type: 'string', description: 'Имя клиента' },
          phone: { type: 'string', description: 'Телефон' },
          source: { type: 'string', description: 'instagram/facebook/phone/referral/avito' },
          amount: { type: 'number', description: 'Сумма сделки в рублях' },
          notes: { type: 'string', description: 'Что купил, что интересует' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_add_task',
      description: 'Поставить задачу управляющему или администратору',
      parameters: {
        type: 'object',
        required: ['title', 'assigned_role'],
        properties: {
          title: { type: 'string', description: 'Краткое название задачи' },
          description: { type: 'string', description: 'Подробное описание что сделать и зачем' },
          assigned_role: { type: 'string', description: 'owner / manager / admin' },
          priority: { type: 'string', description: 'high / medium / low' },
          due_date: { type: 'string', description: 'Срок YYYY-MM-DD' },
          ai_reason: { type: 'string', description: 'Почему AI ставит эту задачу' },
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

    const groqMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    ]

    const data = await callGroq(groqMessages)
    const choice = data.choices?.[0]
    const msg = choice?.message

    // Проверяем — есть ли вызов функции
    if (msg?.tool_calls?.length > 0) {
      const toolCall = msg.tool_calls[0]
      const name = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments || '{}')

      // Читающие функции — выполняем сами и возвращаем финальный ответ
      if (name === 'get_clients_to_contact' || name === 'get_pending_tasks') {
        const result = name === 'get_clients_to_contact'
          ? await executeGetClientsToContact()
          : await executeGetPendingTasks()

        const data2 = await callGroq([
          ...groqMessages,
          { role: 'assistant', content: JSON.stringify(msg) },
          { role: 'tool', content: result, name } as { role: string; content: string; name: string },
        ], false)
        const text2 = data2.choices?.[0]?.message?.content || 'Не удалось получить ответ'
        return NextResponse.json({ text: text2 })
      }

      // Функции-предложения — возвращаем на фронт
      if (name === 'propose_add_expense') {
        return NextResponse.json({
          text: 'Вношу расход — проверьте и подтвердите:',
          pendingAction: {
            type: 'add_expense', label: 'Добавить расход',
            data: { amount: args.amount, description: args.description, date: args.date || today(), category_hint: args.category_hint || '' },
          },
        })
      }
      if (name === 'propose_add_client') {
        return NextResponse.json({
          text: 'Добавляю клиента — проверьте и подтвердите:',
          pendingAction: {
            type: 'add_client', label: 'Добавить клиента',
            data: { name: args.name, phone: args.phone || '', source: args.source || 'phone', notes: args.notes || '' },
          },
        })
      }
      if (name === 'propose_add_lead') {
        return NextResponse.json({
          text: 'Добавляю заявку в воронку — проверьте и подтвердите:',
          pendingAction: {
            type: 'add_lead', label: 'Добавить заявку',
            data: { client_name: args.client_name, phone: args.phone || '', source: args.source || 'phone', amount: args.amount || 0, notes: args.notes || '' },
          },
        })
      }
      if (name === 'propose_add_task') {
        const roleLabel: Record<string, string> = { owner: 'Владелец', manager: 'Управляющий', admin: 'Администратор' }
        const priorityLabel: Record<string, string> = { high: '🔴 Срочно', medium: '🟡 Обычная', low: '🟢 Не спешно' }
        return NextResponse.json({
          text: 'Ставлю задачу — проверьте и подтвердите:',
          pendingAction: {
            type: 'add_task', label: 'Поставить задачу',
            data: {
              title: args.title, description: args.description || '',
              assigned_role: args.assigned_role || 'manager',
              assigned_label: roleLabel[args.assigned_role] || args.assigned_role,
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
