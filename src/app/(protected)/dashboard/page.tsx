import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils/format'
import { AiTasksWidget } from '@/components/ui/AiTasksWidget'
import { DailyBriefingWidget } from '@/components/ui/DailyBriefingWidget'
import { SetupBanner } from '@/components/ui/SetupBanner'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', session!.user.id)
    .single()

  const profile = profileData as { role: string; name: string } | null

  const today = new Date().toISOString().split('T')[0]

  // Загружаем ключевые метрики
  const [
    { count: leadsNew },
    { count: leadsTasks },
    { data: recentLeads },
    { data: todayReport },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('is_done', false).lte('due_date', today),
    supabase.from('leads')
      .select('id, status_id, created_at, source, client_name, phone')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('daily_reports')
      .select('revenue_cash, revenue_card, revenue_online, clients_count')
      .eq('date', today)
      .maybeSingle(),
  ])

  const greeting = getGreeting()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {profile?.name?.split(' ')[0]}!</h1>
          <p className="text-sm text-gray-500">{formatDate(today)} · Восторг CRM</p>
        </div>
      </div>

      {/* Быстрые метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          value={leadsNew ?? 0}
          label="Новых заявок"
          color="green"
          href="/crm"
        />
        <MetricCard
          value={leadsTasks ?? 0}
          label="Просроченных задач"
          color={leadsTasks && leadsTasks > 0 ? 'red' : 'gray'}
          href="/crm"
        />
        <MetricCard
          value={todayReport ? new Intl.NumberFormat('ru-BY').format(
            (todayReport.revenue_cash || 0) + (todayReport.revenue_card || 0) + (todayReport.revenue_online || 0)
          ) + ' Br' : '—'}
          label="Выручка сегодня"
          color="purple"
          href="/daily-report"
          sub="Из ежедн. отчёта"
        />
        <MetricCard
          value={todayReport?.clients_count ?? '—'}
          label="Клиентов сегодня"
          color="blue"
          href="/daily-report"
          sub="По ежедн. отчёту"
        />
      </div>

      {/* Ежедневный брифинг от AI */}
      <DailyBriefingWidget role={profile?.role || 'admin'} />

      {/* Задачи от AI и обычные */}
      <AiTasksWidget />

      {/* Последние заявки */}
      <div className="card mb-6">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Последние заявки</h2>
          <a href="/crm" className="text-sm text-violet-600 hover:underline">Все заявки →</a>
        </div>
        <div className="divide-y divide-gray-50">
          {recentLeads && recentLeads.length > 0 ? (
            recentLeads.map((lead: { id: string; client_name: string; phone?: string; source?: string; created_at: string }) => (
              <a key={lead.id} href="/crm" className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{lead.client_name}</p>
                  <p className="text-xs text-gray-400">
                    {lead.phone && `${lead.phone} · `}{formatDate(lead.created_at)}
                    {lead.source && ` · ${lead.source}`}
                  </p>
                </div>
                <span className="badge-green text-xs">Новая</span>
              </a>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Заявок пока нет
            </div>
          )}
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction href="/crm" icon="➕" label="Новая заявка" />
        <QuickAction href="/expenses" icon="💸" label="Добавить расход" />
        <QuickAction href="/daily-report" icon="📋" label="Отчёт дня" />
        <QuickAction href="/clients" icon="🔍" label="Найти клиента" />
      </div>

      {/* Баннер настройки (показываем если нет данных) */}
      <SetupBanner />
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Доброе утро'
  if (hour < 17) return 'Добрый день'
  return 'Добрый вечер'
}

function MetricCard({
  value,
  label,
  color,
  href,
  sub,
}: {
  value: number | string
  label: string
  color: 'green' | 'red' | 'purple' | 'blue' | 'gray'
  href: string
  sub?: string
}) {
  const colorMap = {
    green: 'text-green-600 bg-green-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-violet-600 bg-violet-50',
    blue: 'text-blue-600 bg-blue-50',
    gray: 'text-gray-600 bg-gray-50',
  }

  return (
    <a href={href} className="metric-card hover:shadow-md transition-shadow">
      <p className={`text-2xl font-bold ${colorMap[color].split(' ')[0]}`}>{value}</p>
      <p className="metric-label">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </a>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all text-center"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </a>
  )
}

