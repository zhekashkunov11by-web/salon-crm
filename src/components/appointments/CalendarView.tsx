'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CalendarVisit {
  id: string
  staff_id: string | null
  start_time: string | null
  service_name: string
  amount: number
  status: string | null
  notes: string | null
  client: { id: string; name: string; phone: string | null } | null
}

interface StaffMember {
  id: string
  name: string
  role: string
  is_active: boolean
}

interface StaffSchedule {
  staff_id: string
  is_worked: boolean
}

// Высота в пикселях на один час
const HOUR_HEIGHT = 80
const DAY_START = 9   // 09:00
const DAY_END   = 21  // 21:00
const TOTAL_HOURS = DAY_END - DAY_START
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START + i)

const CARD_COLORS = [
  { bg: 'bg-pink-100',   border: 'border-pink-400',   text: 'text-pink-900'   },
  { bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-900'   },
  { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900' },
  { bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-900'  },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-900' },
  { bg: 'bg-teal-100',   border: 'border-teal-400',   text: 'text-teal-900'   },
  { bg: 'bg-rose-100',   border: 'border-rose-400',   text: 'text-rose-900'   },
  { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-900' },
]

function parseTime(time: string | null): number {
  // Returns minutes since midnight, or -1 if unparseable
  if (!time) return -1
  const parts = time.split(':')
  if (parts.length < 2) return -1
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return -1
  return h * 60 + m
}

function topPx(startMin: number): number {
  const offsetMin = startMin - DAY_START * 60
  return (offsetMin / 60) * HOUR_HEIGHT
}

function heightPx(durationMin: number): number {
  return Math.max((durationMin / 60) * HOUR_HEIGHT, 36)
}

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-BY', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

interface Props {
  onNewVisit?: () => void
}

export function CalendarView({ onNewVisit }: Props) {
  const supabase = createClient()
  const [date, setDate] = useState(isoToday())
  const [visits, setVisits] = useState<CalendarVisit[]>([])
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarVisit | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [visitsRes, staffRes, schedRes] = await Promise.all([
      supabase.from('visits')
        .select('id, staff_id, start_time, service_name, amount, status, notes, client:clients(id, name, phone)')
        .eq('visit_date', date)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true }),
      supabase.from('staff').select('id, name, role, is_active').eq('is_active', true).order('name'),
      supabase.from('staff_schedules').select('staff_id, is_worked').eq('date', date),
    ])

    setVisits((visitsRes.data || []) as unknown as CalendarVisit[])
    setAllStaff((staffRes.data || []) as StaffMember[])
    setSchedules((schedRes.data || []) as StaffSchedule[])
    setLoading(false)
  }, [date, supabase])

  useEffect(() => { load() }, [load])

  // Determine which staff to show: those who work today OR have visits today
  const staffWithVisits = new Set(visits.map(v => v.staff_id).filter(Boolean))
  const staffWorking = new Set(schedules.filter(s => s.is_worked).map(s => s.staff_id))

  // Show: working today OR has visits today. If neither has data, show all.
  const visibleStaff = allStaff.filter(s =>
    staffWithVisits.has(s.id) || staffWorking.has(s.id)
  )
  const displayStaff = visibleStaff.length > 0 ? visibleStaff : allStaff

  // Visits without staff → show in a special "Без мастера" column
  const unassignedVisits = visits.filter(v => !v.staff_id)

  const gridHeight = TOTAL_HOURS * HOUR_HEIGHT

  const STATUS_COLORS: Record<string, string> = {
    completed: 'opacity-60',
    no_show:   'opacity-40 grayscale',
    cancelled: 'hidden',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => setDate(d => addDays(d, -1))} className="btn-secondary px-3 py-1.5 text-sm">←</button>
        <button onClick={() => setDate(isoToday())} className="btn-secondary px-3 py-1.5 text-sm">Сегодня</button>
        <button onClick={() => setDate(d => addDays(d, 1))} className="btn-secondary px-3 py-1.5 text-sm">→</button>
        <h2 className={`font-semibold capitalize ${date === isoToday() ? 'text-violet-700' : 'text-gray-700'}`}>
          {fmtDate(date)}
        </h2>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="btn-secondary px-3 py-1.5 text-sm">↻</button>
          {onNewVisit && (
            <button onClick={onNewVisit} className="btn-primary px-3 py-1.5 text-sm">+ Новая запись</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-64 w-full rounded-xl" />
      ) : (
        <div className="card overflow-hidden">
          {/* Scrollable calendar grid */}
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '75vh' }}>
            <div className="flex" style={{ minWidth: `${60 + displayStaff.length * 160 + (unassignedVisits.length > 0 ? 160 : 0)}px` }}>

              {/* Time column */}
              <div className="shrink-0 w-14 border-r border-gray-100">
                {/* Header spacer */}
                <div className="h-16 border-b border-gray-100 bg-white sticky top-0 z-20" />
                {/* Hour labels */}
                <div className="relative" style={{ height: gridHeight }}>
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 flex items-start justify-end pr-2"
                      style={{ top: (h - DAY_START) * HOUR_HEIGHT - 8, height: HOUR_HEIGHT }}
                    >
                      <span className="text-xs text-gray-400">{formatHour(h)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff columns */}
              {displayStaff.map((member, idx) => {
                const color = CARD_COLORS[idx % CARD_COLORS.length]
                const memberVisits = visits.filter(v => v.staff_id === member.id)
                const isWorking = staffWorking.has(member.id)

                return (
                  <div key={member.id} className="shrink-0 w-40 border-r border-gray-100">
                    {/* Staff header */}
                    <div className="h-16 border-b border-gray-100 bg-white sticky top-0 z-20 flex flex-col items-center justify-center px-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-1 ${color.bg.replace('bg-', 'bg-').replace('-100', '-400')}`}>
                        {member.name.charAt(0)}
                      </div>
                      <p className="text-xs font-medium text-gray-800 text-center leading-tight">{member.name}</p>
                      {!isWorking && schedules.length > 0 && (
                        <span className="text-[10px] text-gray-400">выходной</span>
                      )}
                    </div>

                    {/* Time grid for this staff */}
                    <div
                      className={`relative ${!isWorking && schedules.length > 0 ? 'bg-gray-50/50' : 'bg-white'}`}
                      style={{ height: gridHeight }}
                    >
                      {/* Hour lines */}
                      {HOURS.slice(0, -1).map(h => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: (h - DAY_START) * HOUR_HEIGHT }}
                        />
                      ))}
                      {/* Half-hour lines */}
                      {HOURS.slice(0, -1).map(h => (
                        <div
                          key={`${h}.5`}
                          className="absolute left-0 right-0 border-t border-gray-50"
                          style={{ top: (h - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                        />
                      ))}

                      {/* Visit cards */}
                      {memberVisits.map(visit => {
                        const startMin = parseTime(visit.start_time)
                        if (startMin < 0 || startMin < DAY_START * 60) return null

                        const top = topPx(startMin)
                        const height = heightPx(60) // default 60 min
                        const statusCls = STATUS_COLORS[visit.status || ''] || ''

                        return (
                          <div
                            key={visit.id}
                            className={`absolute left-1 right-1 rounded-lg border-l-4 px-1.5 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden ${color.bg} ${color.border} ${statusCls}`}
                            style={{ top, height }}
                            onClick={() => setSelected(visit)}
                          >
                            <p className={`text-[11px] font-bold leading-tight truncate ${color.text}`}>
                              {visit.start_time && visit.start_time.slice(0, 5)} {visit.client?.name || '—'}
                            </p>
                            {height > 50 && (
                              <p className={`text-[10px] truncate opacity-80 ${color.text}`}>
                                {visit.service_name}
                              </p>
                            )}
                            {height > 65 && visit.client?.phone && (
                              <p className={`text-[10px] opacity-60 ${color.text}`}>
                                {visit.client.phone}
                              </p>
                            )}
                            {height > 55 && visit.notes && (
                              <p className={`text-[10px] italic opacity-60 ${color.text} truncate`}>
                                {visit.notes}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Unassigned visits column */}
              {unassignedVisits.length > 0 && (
                <div className="shrink-0 w-40 border-r border-gray-100">
                  <div className="h-16 border-b border-gray-100 bg-white sticky top-0 z-20 flex flex-col items-center justify-center px-1">
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold mb-1">?</div>
                    <p className="text-xs font-medium text-gray-500 text-center">Без мастера</p>
                  </div>
                  <div className="relative bg-white" style={{ height: gridHeight }}>
                    {HOURS.slice(0, -1).map(h => (
                      <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: (h - DAY_START) * HOUR_HEIGHT }} />
                    ))}
                    {unassignedVisits.map(visit => {
                      const startMin = parseTime(visit.start_time)
                      if (startMin < 0 || startMin < DAY_START * 60) return null
                      const top = topPx(startMin)
                      const height = heightPx(60)
                      return (
                        <div
                          key={visit.id}
                          className="absolute left-1 right-1 rounded-lg border-l-4 px-1.5 py-1 cursor-pointer bg-gray-100 border-gray-400 hover:brightness-95"
                          style={{ top, height }}
                          onClick={() => setSelected(visit)}
                        >
                          <p className="text-[11px] font-bold leading-tight truncate text-gray-700">
                            {visit.start_time?.slice(0, 5)} {visit.client?.name || '—'}
                          </p>
                          {height > 50 && (
                            <p className="text-[10px] truncate text-gray-500">{visit.service_name}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Visit detail popup */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-900 text-lg">{selected.client?.name || 'Клиент не указан'}</p>
                {selected.client?.phone && <p className="text-sm text-gray-400">{selected.client.phone}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">Время</span>
                <span className="font-medium">{selected.start_time?.slice(0, 5) || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">Услуга</span>
                <span>{selected.service_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">Сумма</span>
                <span className="font-semibold text-violet-700">
                  {new Intl.NumberFormat('ru-BY').format(selected.amount)} Br
                </span>
              </div>
              {selected.notes && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Заметка</span>
                  <span className="italic text-gray-600">{selected.notes}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from('visits').update({ status: 'completed' }).eq('id', selected.id)
                  setSelected(null)
                  load()
                }}
                className="flex-1 text-sm py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 font-medium"
              >
                ✓ Завершена
              </button>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from('visits').update({ status: 'cancelled' }).eq('id', selected.id)
                  setSelected(null)
                  load()
                }}
                className="text-sm py-2 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
