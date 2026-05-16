import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`

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
- ДДС (Движение денежных средств) — показывает РЕАЛЬНЫЕ деньги. Операционная (основная работа), Инвестиционная (оборудование), Финансовая (кредиты). ЗАЧЕМ: видно есть ли деньги прямо сейчас.
- P&L (Прибыль и убытки) — экономическая эффективность. Выручка − Расходы = Прибыль. ЗАЧЕМ: видно прибыльный ли бизнес в принципе.
- Данные: доходы из Отчёта дня, расходы из Журнала расходов.

👷 ЗАРПЛАТА: автоматически из Отчёта дня. Мастера = выручка × процент. Администраторы = ставка × смены. Ставки в Настройки → Сотрудники.

⚙️ НАСТРОЙКИ → Рекламные платформы: токен Meta действует ~60 дней. Получить: developers.facebook.com/tools/explorer → выбрать приложение → ads_read + ads_management → Generate Access Token.

=== ЗАДАЧИ ДЛЯ КОМАНДЫ ===
Ты можешь ставить задачи управляющему (manager), администратору (admin) или владельцу (owner).
Задачи видны на главной странице (дашборд). Там же их можно отметить выполненными.

Когда ставить задачи:
- Если клиент не приходил давно → задача администратору "Позвонить [имя клиента]"
- Если токен Meta истёк → задача управляющему "Обновить токен Facebook Ads"
- Если не заполнен отчёт дня → задача администратору "Внести отчёт дня за [дата]"
- Если закончились расходники → задача управляющему "Закупить [материал]"
- Если нужно проверить показатели → задача владельцу "Проверить ROMI за месяц"
- Если просят напомнить что-то сделать → ставь задачу с конкретным сроком

Обязательно указывай в задаче:
- Чёткое название что именно сделать
- Кому назначено (owner/manager/admin)
- Срок (due_date)
- Причину (ai_reason) — почему это важно

=== КАК ВНОСИТЬ ДАННЫЕ ГОЛОСОМ ===
Если пользователь диктует что-то для внесения в систему — используй инструменты:
- Купили что-то / расход / оплатили → propose_add_expense
- Пришёл новый клиент / записался / купил абонемент → propose_add_client или propose_add_lead
- Кому написать из клиентов → get_clients_to_contact

=== СОВЕТЫ ПО КЛИЕНТАМ ===
Когда показываешь список клиентов для обзвона — для каждого предлагай конкретный текст сообщения. Учитывай что это салон красоты: массаж, косметология, процедуры по уходу. Текст должен быть тёплым, личным, без спама.

Валюта: белорусские рубли (Br). Страна: Беларусь.`

// Инструменты которые AI может вызывать
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_clients_to_contact',
      description: 'Получить список клиентов которым нужно написать — давно не приходили (60+ дней без визита)',
      parameters: { type: 'OBJECT', properties: {}, required: [] },
    },
    {
      name: 'propose_add_expense',
      description: 'Предложить добавить расход или покупку в журнал расходов',
      parameters: {
        type: 'OBJECT',
        required: ['amount', 'description'],
        properties: {
          amount: { type: 'NUMBER', description: 'Сумма в белорусских рублях' },
          description: { type: 'STRING', description: 'Что купили или оплатили' },
          date: { type: 'STRING', description: 'Дата YYYY-MM-DD, по умолчанию сегодня' },
          category_hint: { type: 'STRING', description: 'Подсказка для категории: материалы/аренда/зарплата/реклама/хоз/оборудование' },
        },
      },
    },
    {
      name: 'propose_add_client',
      description: 'Предложить добавить нового клиента в базу клиентов',
      parameters: {
        type: 'OBJECT',
        required: ['name'],
        properties: {
          name: { type: 'STRING', description: 'Имя клиента' },
          phone: { type: 'STRING', description: 'Номер телефона' },
          source: { type: 'STRING', description: 'Источник: instagram/vk/avito/phone/referral/dikidi' },
          notes: { type: 'STRING', description: 'Заметки (абонемент, процедура и т.д.)' },
        },
      },
    },
    {
      name: 'propose_add_lead',
      description: 'Предложить добавить заявку в воронку продаж',
      parameters: {
        type: 'OBJECT',
        required: ['client_name'],
        properties: {
          client_name: { type: 'STRING', description: 'Имя клиента' },
          phone: { type: 'STRING', description: 'Телефон' },
          source: { type: 'STRING', description: 'Источник: instagram/facebook/phone/referral/avito' },
          amount: { type: 'NUMBER', description: 'Сумма абонемента или сделки в рублях' },
          notes: { type: 'STRING', description: 'Что купил, что интересует' },
        },
      },
    },
    {
      name: 'propose_add_task',
      description: 'Поставить задачу управляющему или администратору. Используй когда нужно напомнить, проконтролировать, сделать звонок, закупить что-то, проверить показатели.',
      parameters: {
        type: 'OBJECT',
        required: ['title', 'assigned_role'],
        properties: {
          title: { type: 'STRING', description: 'Краткое название задачи' },
          description: { type: 'STRING', description: 'Подробное описание: что именно сделать и зачем' },
          assigned_role: { type: 'STRING', description: 'Кому: owner (владелец), manager (управляющий), admin (администратор)' },
          priority: { type: 'STRING', description: 'Приоритет: high (срочно), medium (обычная), low (не спешно)' },
          due_date: { type: 'STRING', description: 'Срок в формате YYYY-MM-DD' },
          ai_reason: { type: 'STRING', description: 'Почему AI ставит эту задачу — обоснование' },
        },
      },
    },
    {
      name: 'get_pending_tasks',
      description: 'Получить список текущих невыполненных задач',
      parameters: { type: 'OBJECT', properties: {}, required: [] },
    },
  ],
}]

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
  } catch {
    return 'Не удалось загрузить задачи'
  }
}

async function executeGetClientsToContact() {
  try {
    const supabase = createServiceClient()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const { data } = await supabase
      .from('clients')
      .select('name, phone, last_visit_date, total_revenue, visits_count')
      .eq('is_active', true)
      .lt('last_visit_date', cutoffStr)
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
  } catch {
    return 'Не удалось загрузить клиентов'
  }
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key не настроен' }, { status: 400 })
  }

  try {
    const { messages } = await req.json()

    // Строим историю для Gemini
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }))

    // Первый запрос к Gemini
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: TOOLS,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err?.error?.message || `Gemini error ${res.status}`)
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Проверяем — есть ли вызов функции
    const fnCall = parts.find((p: { functionCall?: { name: string; args: Record<string, unknown> } }) => p.functionCall)

    if (fnCall) {
      const { name, args } = fnCall.functionCall as { name: string; args: Record<string, unknown> }

      // Функции которые выполняем сами (чтение данных)
      if (name === 'get_pending_tasks') {
        const result = await executeGetPendingTasks()
        const res2 = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              ...contents,
              { role: 'model', parts: [{ functionCall: { name, args } }] },
              { role: 'user', parts: [{ functionResponse: { name, response: { result } } }] },
            ],
            tools: TOOLS,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        })
        const data2 = await res2.json()
        const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text || 'Не удалось получить ответ'
        return NextResponse.json({ text: text2 })
      }

      if (name === 'get_clients_to_contact') {
        const result = await executeGetClientsToContact()

        // Отправляем результат обратно Gemini для финального ответа
        const res2 = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              ...contents,
              { role: 'model', parts: [{ functionCall: { name, args } }] },
              { role: 'user', parts: [{ functionResponse: { name, response: { result } } }] },
            ],
            tools: TOOLS,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        })
        const data2 = await res2.json()
        const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text || 'Не удалось получить ответ'
        return NextResponse.json({ text: text2 })
      }

      // Функции-предложения — возвращаем на фронт для подтверждения
      if (name === 'propose_add_expense') {
        const a = args as { amount: number; description: string; date?: string; category_hint?: string }
        return NextResponse.json({
          text: `Вношу расход — проверьте и подтвердите:`,
          pendingAction: {
            type: 'add_expense',
            label: 'Добавить расход',
            data: {
              amount: a.amount,
              description: a.description,
              date: a.date || today(),
              category_hint: a.category_hint || '',
            },
          },
        })
      }

      if (name === 'propose_add_client') {
        const a = args as { name: string; phone?: string; source?: string; notes?: string }
        return NextResponse.json({
          text: `Добавляю клиента — проверьте и подтвердите:`,
          pendingAction: {
            type: 'add_client',
            label: 'Добавить клиента',
            data: {
              name: a.name,
              phone: a.phone || '',
              source: a.source || 'phone',
              notes: a.notes || '',
            },
          },
        })
      }

      if (name === 'propose_add_lead') {
        const a = args as { client_name: string; phone?: string; source?: string; amount?: number; notes?: string }
        return NextResponse.json({
          text: `Добавляю заявку в воронку — проверьте и подтвердите:`,
          pendingAction: {
            type: 'add_lead',
            label: 'Добавить заявку',
            data: {
              client_name: a.client_name,
              phone: a.phone || '',
              source: a.source || 'phone',
              amount: a.amount || 0,
              notes: a.notes || '',
            },
          },
        })
      }

      if (name === 'propose_add_task') {
        const a = args as {
          title: string; description?: string; assigned_role: string
          priority?: string; due_date?: string; ai_reason?: string
        }
        const roleLabel: Record<string, string> = {
          owner: 'Владелец', manager: 'Управляющий', admin: 'Администратор'
        }
        const priorityLabel: Record<string, string> = {
          high: '🔴 Срочно', medium: '🟡 Обычная', low: '🟢 Не спешно'
        }
        return NextResponse.json({
          text: `Ставлю задачу — проверьте и подтвердите:`,
          pendingAction: {
            type: 'add_task',
            label: 'Поставить задачу',
            data: {
              title: a.title,
              description: a.description || '',
              assigned_role: a.assigned_role || 'manager',
              assigned_label: roleLabel[a.assigned_role] || a.assigned_role,
              priority: priorityLabel[a.priority || 'medium'],
              priority_raw: a.priority || 'medium',
              due_date: a.due_date || '',
              ai_reason: a.ai_reason || '',
            },
          },
        })
      }
    }

    // Обычный текстовый ответ
    const text = parts.find((p: { text?: string }) => p.text)?.text || 'Не удалось получить ответ'
    return NextResponse.json({ text })

  } catch (err) {
    console.error('Gemini error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
