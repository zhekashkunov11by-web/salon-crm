// Форматирование чисел и дат (Беларусь, BYN)

// Форматировать сумму в белорусских рублях
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-BY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' Br'
}

// Форматировать число с разделителями
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-BY').format(n)
}

// Форматировать дату ДД.ММ.ГГГГ
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ru-BY').format(d)
}

// Форматировать дату и время
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ru-BY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// Форматировать дату для хранения (YYYY-MM-DD)
export function toDbDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Форматировать процент
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Сколько дней прошло с даты
export function daysSince(date: string): number {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// Статус риска оттока
export function churnRisk(lastVisit: string): 'safe' | 'warning' | 'danger' {
  const days = daysSince(lastVisit)
  if (days < 30) return 'safe'
  if (days < 60) return 'warning'
  return 'danger'
}

// Название месяца по-русски
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export function formatMonth(period: string): string {
  const [year, month] = period.split('-')
  return `${MONTHS[parseInt(month) - 1]} ${year}`
}

// Сокращение имени (Иванов Иван → Иванов И.)
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(' ')
  if (parts.length === 1) return fullName
  return `${parts[0]} ${parts[1][0]}.`
}

// Склонение числительных (1 клиент, 2 клиента, 5 клиентов)
export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const mod10 = abs % 10
  if (abs > 10 && abs < 20) return `${n} ${many}`
  if (mod10 === 1) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`
  return `${n} ${many}`
}
