import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createServerClient } from '@/lib/supabase/server'

const today = () => new Date().toISOString().slice(0, 10)

const ROLE_EXPENSE_LIMIT: Record<string, number> = {
  owner: Infinity,
  manager: Infinity,
  admin: 500,
}

export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    const supabase = createServiceClient()

    // Get user role from session
    let userRole = 'admin'
    try {
      const serverSupabase = createServerClient()
      const { data: { session } } = await serverSupabase.auth.getSession()
      if (session?.user?.id) {
        const { data: profile } = await serverSupabase
          .from('profiles').select('role').eq('id', session.user.id).single()
        if (profile?.role) userRole = profile.role
      }
    } catch { /* use default */ }

    if (type === 'add_expense') {
      // Secondary role-based expense limit guard (chat route checks first)
      const limit = ROLE_EXPENSE_LIMIT[userRole] || 500
      if (data.amount > limit) {
        return NextResponse.json({
          ok: false,
          message: `Сумма ${data.amount} Br превышает ваш лимит (${limit} Br). Обратитесь к управляющему.`,
        }, { status: 403 })
      }

      // Match category by hint
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
        if (!categoryId) categoryId = categories[0].id
      }

      const paymentDate = data.date || today()
      const recMonths = Math.max(1, Math.min(12, parseInt(data.recognition_months) || 1))
      const recognitionStartDate = paymentDate.slice(0, 7) + '-01'

      const { error } = await supabase.from('expenses').insert({
        date: paymentDate,
        amount: data.amount,
        description: data.description,
        category_id: categoryId,
        recognition_months: recMonths,
        recognition_start_date: recMonths > 1 ? recognitionStartDate : null,
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      const amortNote = recMonths > 1
        ? ` (ДДС: ${data.amount} Br сразу · P&L: ${(data.amount / recMonths).toFixed(2)} Br/мес × ${recMonths} мес)`
        : ''
      return NextResponse.json({ ok: true, message: `Расход ${data.amount} Br «${data.description}» добавлен${amortNote}` })
    }

    if (type === 'add_client') {
      const { error } = await supabase.from('clients').insert({
        name: data.name,
        phone: data.phone || null,
        source: data.source || null,
        notes: data.notes || null,
        instagram: data.instagram || null,
        is_active: true,
        created_at: new Date().toISOString(),
      })

      if (error) throw error
      return NextResponse.json({ ok: true, message: `Клиент «${data.name}» добавлен в базу` })
    }

    if (type === 'add_lead') {
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
      // Admin cannot create tasks for owner
      let assignedRole = data.assigned_role || 'manager'
      if (userRole === 'admin' && assignedRole === 'owner') {
        assignedRole = 'manager'
      }

      const dueDate = data.due_date
        ? new Date(data.due_date).toISOString()
        : new Date(Date.now() + 86400000).toISOString()

      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || null,
        assigned_role: assignedRole,
        priority: data.priority_raw || 'medium',
        due_date: dueDate,
        is_done: false,
        is_ai_generated: true,
        ai_reason: data.ai_reason || null,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      return NextResponse.json({ ok: true, message: `Задача «${data.title}» поставлена для ${data.assigned_label || assignedRole}` })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
  } catch (err) {
    console.error('AI action error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
