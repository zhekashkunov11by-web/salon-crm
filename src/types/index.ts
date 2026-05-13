// ============================================================
// Типы системы управления салоном "Восторг"
// ============================================================

// --- Роли пользователей ---
export type UserRole = 'owner' | 'manager' | 'admin'

// --- Направления ---
export type Direction = 'massage' | 'cosmetology'

// --- Тип мастера ---
export type StaffType = 'manual' | 'kim8' | 'cosmetologist' | 'admin'

// --- Статусы заявок (воронка) ---
export type LeadStatus =
  | 'new'          // Новый
  | 'processing'   // В обработке
  | 'booked'       // Запись создана
  | 'paid'         // Оплачено
  | 'regular'      // Постоянный
  | 'rejected'     // Отказ

// --- Источники трафика ---
export type TrafficSource =
  | 'instagram'
  | 'vk'
  | 'facebook'
  | 'yandex'
  | 'google'
  | 'tilda'
  | 'call'
  | 'referral'
  | 'other'

// --- Типы счетов ---
export type AccountType = 'cash' | 'card' | 'bank'

// --- Цвет визита из Dikidi ---
export type DikidiVisitColor = 'green' | 'blue' | 'red'

// ============================================================
// ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export interface Profile {
  id: string
  email: string
  role: UserRole
  name: string
  created_at: string
}

// ============================================================
// КЛИЕНТ
// ============================================================
export interface Client {
  id: string
  client_id: string          // CL-00001
  dikidi_id?: string         // ID в Dikidi
  name: string
  phone: string
  birth_date?: string        // ДД.ММ
  birth_year?: number
  direction: Direction | 'both'
  preferences?: string       // Предпочтения (свободный текст)
  notes?: string             // Особые пометки (аллергии, противопоказания)
  source_channel?: string    // Источник привлечения
  acquisition_cost?: number  // CAC
  first_visit?: string       // Дата первого визита
  last_visit?: string        // Дата последнего визита
  ltv?: number               // LTV
  // Статус анкет
  questionnaire_massage: boolean
  questionnaire_massage_date?: string
  questionnaire_cosmo: boolean
  questionnaire_cosmo_date?: string
  created_at: string
  updated_at: string
}

// ============================================================
// ЗАЯВКА (ВОРОНКА)
// ============================================================
export interface Lead {
  id: string
  client_id?: string
  status: LeadStatus
  source_channel?: string
  direction?: Direction
  service?: string
  assigned_to?: string       // ID администратора
  notes?: string
  rejection_reason?: string  // Причина отказа (обязательна при статусе rejected)
  created_at: string
  updated_at: string
  // Связанные данные
  client?: Client
  tasks?: Task[]
}

export interface LeadHistory {
  id: string
  lead_id: string
  from_status: LeadStatus
  to_status: LeadStatus
  by: string                 // ID пользователя
  comment?: string
  created_at: string
}

// ============================================================
// ЗАДАЧИ-НАПОМИНАНИЯ
// ============================================================
export interface Task {
  id: string
  lead_id?: string
  client_id?: string
  due_date: string
  text: string
  done: boolean
  created_by: string
  created_at: string
}

// ============================================================
// СОТРУДНИК
// ============================================================
export interface Staff {
  id: string
  name: string
  role: StaffType
  massage_type?: 'manual' | 'kim8'
  rate_percent: number       // % от чека
  start_date: string
  dikidi_id?: string
  salary_base_per_shift?: number  // Оклад за смену (для администраторов)
  tax_rate: number           // НДФЛ (обычно 13%)
  is_active: boolean
  created_at: string
}

// ============================================================
// РАСХОДЫ
// ============================================================
export interface ExpenseCategory {
  id: string
  name: string
  group: string              // Группа (Расходники-Массаж, Аренда и т.д.)
  color?: string
  in_cfs: boolean            // Входит в ДДС
  in_pnl: boolean            // Входит в PnL
  hint?: string              // Подсказка для формы
  sort_order: number
}

export interface SupplyItem {
  id: string
  name: string
  unit: string               // штук / мл / г
  last_price?: number        // Цена последней закупки
  category_id?: string
  is_active: boolean
}

export interface Expense {
  id: string
  date: string
  category_id: string
  supply_item_id?: string    // Для расходников
  description?: string
  quantity?: number
  unit?: string
  amount: number
  account: AccountType
  created_by: string
  created_at: string
  // Связанные данные
  category?: ExpenseCategory
  supply_item?: SupplyItem
}

// ============================================================
// ТЕХНОЛОГИЧЕСКИЕ КАРТЫ ПРОЦЕДУР
// ============================================================
export interface ProcedureCard {
  id: string
  name: string               // Название процедуры
  direction: Direction
  dikidi_service_id?: string
  is_active: boolean
  items?: ProcedureCardItem[]
}

export interface ProcedureCardItem {
  id: string
  card_id: string
  supply_item_id: string
  quantity: number
  unit: string
  supply_item?: SupplyItem
}

// ============================================================
// КАНАЛЫ ТРАФИКА
// ============================================================
export interface MarketingChannel {
  id: string
  name: string
  is_active: boolean
  sort_order: number
}

// ============================================================
// СЧЕТА
// ============================================================
export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
}

// ============================================================
// ЕЖЕДНЕВНЫЙ ОТЧЁТ АДМИНИСТРАТОРА
// ============================================================
export interface DailyReport {
  id: string
  date: string
  admin_id: string
  // Касса
  cash_start?: number        // Остаток наличных в начале дня
  // План выручки
  plan_manual?: number       // Ручной массаж
  plan_kim8?: number         // Аппаратный Kim8
  plan_cosmo?: number        // Косметология
  // Факт выручки (из Dikidi)
  fact_manual?: number
  fact_kim8?: number
  fact_cosmo?: number
  // Метрики за день
  new_leads?: number         // Новых заявок
  scheduled?: number         // Записаны на сеансы
  visited?: number           // Пришли
  cancelled?: number         // Отменили
  rescheduled?: number       // Перенесли
  abon5?: number             // Куплено абонементов на 5 сеансов
  abon7?: number             // Куплено абонементов на 7 сеансов
  abon10?: number            // Куплено абонементов на 10 сеансов
  certs?: number             // Куплено сертификатов
  repeat_from_base?: number  // Записались повторно из базы
  needs_questionnaire?: number // Клиентам нужна анкета
  // Чек-лист
  checklist_json?: ChecklistData
  created_at: string
  updated_at: string
}

export interface ChecklistData {
  subscription_dates_marked: boolean   // В таблице аб/сертификатов отмечена дата
  price_color_duration_correct: boolean // Цена, цвет и длительность корректны
  client_card_filled: boolean           // В карточке клиента есть данные из анкеты
  visit_comments_added: boolean         // К созданным визитам есть комментарии
}

// ============================================================
// ИНВЕНТАРИЗАЦИЯ
// ============================================================
export interface Inventory {
  id: string
  date: string
  supply_item_id: string
  actual_qty: number         // Фактический остаток
  planned_qty?: number       // Плановый расход по нормативам
  delta?: number             // Отклонение
  supply_item?: SupplyItem
}

// ============================================================
// ПРОДАЖИ КОСМЕТИКИ
// ============================================================
export interface CosmeticsSale {
  id: string
  date: string
  client_id?: string
  staff_id: string
  amount: number
  description?: string
  created_at: string
}

// ============================================================
// РАСЧЁТ ЗАРПЛАТЫ
// ============================================================
export interface SalaryCalc {
  id: string
  staff_id: string
  period: string             // YYYY-MM
  amount: number             // ФОТ (основное начисление)
  bonus?: number             // Бонус за продажу абонементов
  total_gross: number        // ФОТ + бонус
  tax: number                // НДФЛ
  pension: number            // Пенсионные отчисления
  advance?: number           // Аванс
  to_card: number            // Итого на карту
  cash?: number              // Наличными на руки
  total: number              // Итого с округлением
  breakdown_json?: SalaryBreakdown[]
  created_at: string
  staff?: Staff
}

export interface SalaryBreakdown {
  client_name: string
  date: string
  visit_type: 'primary' | 'repeat'
  check: number
  percent: number
  amount: number
}

// ============================================================
// ГРАФИК СМЕН АДМИНИСТРАТОРОВ
// ============================================================
export interface StaffSchedule {
  id: string
  staff_id: string
  date: string
  staff?: Staff
}

// ============================================================
// МАРКЕТИНГОВЫЕ РАСХОДЫ
// ============================================================
export interface MarketingExpense {
  id: string
  channel_id: string
  amount: number
  period_start: string
  period_end: string
  leads_count?: number       // Заявок с канала
  paid_count?: number        // Оплативших с канала
  channel?: MarketingChannel
}

// ============================================================
// СОГЛАСИЯ КЛИЕНТОВ
// ============================================================
export interface ClientConsent {
  id: string
  client_id: string
  direction: Direction
  file_url: string           // URL в Supabase Storage
  date: string
  created_at: string
}

// ============================================================
// ЛОГ СИНХРОНИЗАЦИИ DIKIDI
// ============================================================
export interface DikidiSyncLog {
  id: string
  timestamp: string
  status: 'success' | 'error' | 'partial'
  records_synced?: number
  error_message?: string
}

// ============================================================
// НАСТРОЙКИ
// ============================================================
export interface Setting {
  key: string
  value: string
}

// ============================================================
// ДАННЫЕ ИЗ DIKIDI (не хранятся локально)
// ============================================================
export interface DikidiVisit {
  id: string
  client_id: string
  client_name: string
  service_name: string
  staff_name: string
  date: string
  amount: number
  color: DikidiVisitColor    // green=первый, blue=абонемент, red=повторный
  direction: Direction
}

export interface DikidiSubscription {
  id: string
  client_id: string
  client_name: string
  service_name: string
  total_sessions: number
  remaining_sessions: number
  sold_date: string
  last_use_date?: string
  amount: number
}

// ============================================================
// АНАЛИТИКА
// ============================================================
export interface ChannelMetrics {
  channel_id: string
  channel_name: string
  period: string
  budget: number
  leads_count: number
  paid_count: number
  revenue: number
  cpl: number                // Стоимость заявки
  cac: number                // Стоимость клиента
  conversion: number         // % конверсии
  romi: number               // ROMI %
  avg_ltv: number            // Средний LTV клиентов с канала
}

export interface ClientSegment {
  client_id: string
  client: Client
  days_since_last_visit: number
  segment: '2w' | '1m' | '2m' | '3m' | '6m' | '1y'
  ltv: number
  avg_check: number
  visit_frequency: number    // Дней между визитами
  is_churn_risk: boolean     // 60+ дней
}

// ============================================================
// API ОТВЕТЫ
// ============================================================
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}
