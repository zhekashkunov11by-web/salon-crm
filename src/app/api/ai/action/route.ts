import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const today = () => new Date().toISOString().slice(0, 10)

export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    const supabase = createServiceClient()

    if (type === 'add_expense') {
      // Ищем подходящую категорию по подсказке
      const { data: categories } = await supabase
        .from('expense_categories')
        .select('id, name')
        .limit(50)

      let categoryId: string | null = null
      if (categories?.length) {
        const hint = (data.category_hint || '').toLowerCase()
        const keywords: Record<string, string[]> = {
          'материал': ['материал', 'расходник', 'краска', 'средств', 'косметик'],
          'аренда': ['аренд', 'помещ'],
          'зарплат': ['зарплат', 'оклад', 'выплат'],
          'реклам': ['реклам', 'таргет', 'продвижен'],
          'хоз': ['хоз', 'уборк', 'чистящ', 'моющ'],
          'оборудован': ['оборудован', 'техник', 'аппарат'],
        }
        for (const cat of categories) {
          const catName = cat.name.toLowerCase()
          for (const [key, words] of Object.entries(keywords)) {
            if (words.some(w => hint.includes(w) || catName.includes(key))) {
              categoryId = cat.id
              break
            }
          }
          if (categoryId) break
        }
        // Если не нашли — берём первую категорию
        if (!categoryId) categoryId = categories[0].id
      }

      const { error } = await supabase.from('expenses').insert({
        date: data.date || today(),
        amount: data.amount,
        description: data.description,
        category_id: categoryId,
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      return NextResponse.json({ ok: true, message: `Расход ${data.amount} Br «${data.description}» добавлен` })
    }

    if (type === 'add_client') {
      const { error } = await supabase.from('clients').insert({
        name: data.name,
        phone: data.phone || null,
        source: data.source || null,
        notes: data.notes || null,
        is_active: true,
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      return NextResponse.json({ ok: true, message: `Клиент «${data.name}» добавлен в базу` })
    }

    if (type === 'add_lead') {
      // Берём первый статус воронки
      const { data: statuses } = await supabase
        .from('lead_statuses')
        .select('id')
        .order('sort_order', { ascending: true })
        .limit(1)

      const statusId = statuses?.[0]?.id || null

      const { error } = await supabase.from('leads').insert({
        client_name: data.client_name,
        phone: data.phone || null,
        source: data.source || null,
        amount: data.amount || null,
        notes: data.notes || null,
        status_id: statusId,
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      return NextResponse.json({ ok: true, message: `Заявка «${data.client_name}» добавлена в воронку` })
    }

    if (type === 'add_task') {
      const dueDate = data.due_date
        ? new Date(data.due_date).toISOString()
        : new Date(Date.now() + 86400000).toISOString() // завтра по умолчанию

      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || null,
        assigned_role: data.assigned_role || 'manager',
        priority: data.priority_raw || 'medium',
        due_date: dueDate,
        is_done: false,
        is_ai_generated: true,
        ai_reason: data.ai_reason || null,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      return NextResponse.json({ ok: true, message: `Задача «${data.title}» поставлена для ${data.assigned_label || data.assigned_role}` })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (err) {
    console.error('AI action error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
