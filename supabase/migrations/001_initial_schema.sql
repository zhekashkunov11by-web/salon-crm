-- ============================================================
-- Начальная схема БД салона "Восторг"
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ПРОФИЛИ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'admin')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Автоматически создавать профиль при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- НАПРАВЛЕНИЯ
-- ============================================================
CREATE TABLE IF NOT EXISTS directions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0
);

INSERT INTO directions (name, slug, sort_order) VALUES
  ('Массаж', 'massage', 1),
  ('Косметология', 'cosmetology', 2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- КАНАЛЫ ТРАФИКА
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketing_channels (name, sort_order) VALUES
  ('Instagram', 1),
  ('ВКонтакте', 2),
  ('Facebook', 3),
  ('Яндекс Директ', 4),
  ('Google Ads', 5),
  ('Тильда (сайт)', 6),
  ('Пропущенный звонок', 7),
  ('Сарафан / Рекомендация', 8),
  ('Другое', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- КАТЕГОРИИ РАСХОДОВ
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  in_cfs BOOLEAN DEFAULT TRUE,
  in_pnl BOOLEAN DEFAULT TRUE,
  hint TEXT,
  sort_order INT DEFAULT 0
);

INSERT INTO expense_categories (name, group_name, color, in_cfs, in_pnl, hint, sort_order) VALUES
  -- Расходники — массаж
  ('Масло массажное классическое', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 10),
  ('Масло для антицеллюлитного массажа', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 11),
  ('Масло для Kim8 (аппаратный)', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 12),
  ('Шоколадная масса (СПА-программа)', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 13),
  ('Плёнка для обёртывания', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 14),
  ('Простыни одноразовые', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 15),
  ('Ватные диски / палочки', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 16),
  ('Перчатки', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 17),
  ('Шапочки одноразовые', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 18),
  ('Средства для тела', 'Расходники — Массаж', '#8B5CF6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 19),
  -- Расходники — косметология
  ('Средства для очищения', 'Расходники — Косметология', '#EC4899', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 20),
  ('Маски и сыворотки', 'Расходники — Косметология', '#EC4899', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 21),
  ('Расходные материалы для аппаратных процедур', 'Расходники — Косметология', '#EC4899', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 22),
  ('Одноразовые принадлежности косметолога', 'Расходники — Косметология', '#EC4899', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 23),
  ('Косметика для продажи', 'Расходники — Косметология', '#EC4899', true, false, '✓ ДДС: да   ✗ PnL: нет   Пояснение: уменьшает кассу, не влияет на PnL (оборот)', 24),
  -- Хозяйство
  ('Вода (клиентам)', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 30),
  ('Чай / кофе (клиентам)', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 31),
  ('Конфеты / угощения (клиентам)', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 32),
  ('Бахилы', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 33),
  ('Чистящие и моющие средства', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 34),
  ('Туалетные принадлежности', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 35),
  ('Прочие расходники', 'Хозяйство', '#14B8A6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 36),
  -- Аренда и постоянные
  ('Аренда помещения', 'Постоянные расходы', '#F59E0B', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 40),
  ('Коммунальные услуги / Интернет', 'Постоянные расходы', '#F59E0B', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 41),
  ('Уборка / клининг', 'Постоянные расходы', '#F59E0B', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 42),
  ('Ремонт и оборудование', 'Постоянные расходы', '#F59E0B', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 43),
  ('Подписки и ПО', 'Постоянные расходы', '#F59E0B', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 44),
  -- Маркетинг
  ('Instagram таргет', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 50),
  ('ВКонтакте таргет', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 51),
  ('Facebook таргет', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 52),
  ('Яндекс Директ', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 53),
  ('Google Ads', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 54),
  ('Создание контента / Таргетолог', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 55),
  ('Прочая реклама', 'Маркетинг', '#3B82F6', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 56),
  -- ФОТ
  ('Зарплата мастеров', 'ФОТ', '#10B981', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 60),
  ('Зарплата косметологов', 'ФОТ', '#10B981', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 61),
  ('Зарплата администраторов', 'ФОТ', '#10B981', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 62),
  ('Прочий персонал (уборщица, SMM и др.)', 'ФОТ', '#10B981', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 63),
  ('Премии', 'ФОТ', '#10B981', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 64),
  -- Налоги и финансы
  ('УСН / патент / страховые взносы', 'Налоги и финансы', '#EF4444', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 70),
  ('Бухгалтерия / Банковские комиссии', 'Налоги и финансы', '#EF4444', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 71),
  -- Прочее
  ('Прочее', 'Прочее', '#6B7280', true, true, '✓ ДДС: да   ✓ PnL: да   Пояснение: уменьшает кассу и прибыль', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ПОЗИЦИИ РАСХОДНИКОВ
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'штук',
  last_price DECIMAL(10,2),
  category_id UUID REFERENCES expense_categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ТЕХНОЛОГИЧЕСКИЕ КАРТЫ ПРОЦЕДУР
-- ============================================================
CREATE TABLE IF NOT EXISTS procedure_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('massage', 'cosmetology')),
  dikidi_service_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedure_card_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES procedure_cards(id) ON DELETE CASCADE,
  supply_item_id UUID NOT NULL REFERENCES supply_items(id),
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL
);

-- ============================================================
-- СЧЕТА (КОШЕЛЬКИ)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'card', 'bank')),
  balance DECIMAL(12,2) DEFAULT 0,
  sort_order INT DEFAULT 0
);

INSERT INTO accounts (name, type, sort_order) VALUES
  ('Наличные', 'cash', 1),
  ('Карта / Терминал', 'card', 2),
  ('Расчётный счёт', 'bank', 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- КЛИЕНТЫ
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS client_seq START 1;

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL UNIQUE DEFAULT ('CL-' || LPAD(nextval('client_seq')::TEXT, 5, '0')),
  dikidi_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  birth_date TEXT,
  birth_year INT,
  direction TEXT NOT NULL DEFAULT 'massage',
  preferences TEXT,
  notes TEXT,
  source_channel UUID REFERENCES marketing_channels(id),
  acquisition_cost DECIMAL(10,2),
  first_visit DATE,
  last_visit DATE,
  ltv DECIMAL(12,2) DEFAULT 0,
  questionnaire_massage BOOLEAN DEFAULT FALSE,
  questionnaire_massage_date DATE,
  questionnaire_cosmo BOOLEAN DEFAULT FALSE,
  questionnaire_cosmo_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Дополнительные поля карточки (настраиваемые владельцем)
CREATE TABLE IF NOT EXISTS client_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES client_fields(id),
  value TEXT,
  UNIQUE(client_id, field_id)
);

-- Согласия клиентов
CREATE TABLE IF NOT EXISTS client_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('massage', 'cosmetology')),
  file_url TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЗАЯВКИ (ВОРОНКА)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'processing', 'booked', 'paid', 'regular', 'rejected')
  ),
  source_channel UUID REFERENCES marketing_channels(id),
  direction TEXT CHECK (direction IN ('massage', 'cosmetology')),
  service TEXT,
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  rejection_reason TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- История переходов по воронке
CREATE TABLE IF NOT EXISTS lead_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  by UUID REFERENCES profiles(id),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Дополнительные поля воронки (настраиваемые)
CREATE TABLE IF NOT EXISTS lead_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lead_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES lead_fields(id),
  value TEXT,
  UNIQUE(lead_id, field_id)
);

-- Статусы воронки (настраиваемые владельцем)
CREATE TABLE IF NOT EXISTS lead_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INT DEFAULT 0,
  is_final BOOLEAN DEFAULT FALSE
);

INSERT INTO lead_statuses (slug, name, color, sort_order, is_final) VALUES
  ('new', 'Новый', '#10B981', 1, false),
  ('processing', 'В обработке', '#F59E0B', 2, false),
  ('booked', 'Запись создана', '#3B82F6', 3, false),
  ('paid', 'Оплачено', '#8B5CF6', 4, false),
  ('regular', 'Постоянный', '#EC4899', 5, false),
  ('rejected', 'Отказ', '#EF4444', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- ЗАДАЧИ-НАПОМИНАНИЯ
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- СОТРУДНИКИ
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manual', 'kim8', 'cosmetologist', 'admin')),
  massage_type TEXT CHECK (massage_type IN ('manual', 'kim8')),
  rate_percent DECIMAL(5,2) NOT NULL DEFAULT 35,
  start_date DATE NOT NULL,
  dikidi_id TEXT UNIQUE,
  salary_base_per_shift DECIMAL(10,2),
  tax_rate DECIMAL(5,2) DEFAULT 13,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- График смен администраторов
CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  UNIQUE(staff_id, date)
);

-- ============================================================
-- РАСХОДЫ
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  supply_item_id UUID REFERENCES supply_items(id),
  description TEXT,
  quantity DECIMAL(10,3),
  unit TEXT,
  amount DECIMAL(12,2) NOT NULL,
  account TEXT NOT NULL CHECK (account IN ('cash', 'card', 'bank')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ПРОДАЖИ КОСМЕТИКИ
-- ============================================================
CREATE TABLE IF NOT EXISTS cosmetics_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES clients(id),
  staff_id UUID NOT NULL REFERENCES staff(id),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ИНВЕНТАРИЗАЦИЯ
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  supply_item_id UUID NOT NULL REFERENCES supply_items(id),
  actual_qty DECIMAL(10,3) NOT NULL,
  planned_qty DECIMAL(10,3),
  delta DECIMAL(10,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЕЖЕДНЕВНЫЙ ОТЧЁТ АДМИНИСТРАТОРА
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  admin_id UUID NOT NULL REFERENCES profiles(id),
  -- Касса
  cash_start DECIMAL(12,2),
  -- Планы по направлениям
  plan_manual DECIMAL(12,2),
  plan_kim8 DECIMAL(12,2),
  plan_cosmo DECIMAL(12,2),
  -- Факт из Dikidi
  fact_manual DECIMAL(12,2),
  fact_kim8 DECIMAL(12,2),
  fact_cosmo DECIMAL(12,2),
  -- Метрики дня
  new_leads INT DEFAULT 0,
  scheduled INT DEFAULT 0,
  visited INT DEFAULT 0,
  cancelled INT DEFAULT 0,
  rescheduled INT DEFAULT 0,
  abon5 INT DEFAULT 0,
  abon7 INT DEFAULT 0,
  abon10 INT DEFAULT 0,
  certs INT DEFAULT 0,
  repeat_from_base INT DEFAULT 0,
  needs_questionnaire INT DEFAULT 0,
  -- Чек-лист
  checklist_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, admin_id)
);

-- ============================================================
-- РАСЧЁТ ЗАРПЛАТЫ
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_calc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period TEXT NOT NULL,          -- YYYY-MM
  amount DECIMAL(12,2) NOT NULL, -- Основное начисление (ФОТ)
  bonus DECIMAL(12,2) DEFAULT 0, -- Бонус за абонементы
  total_gross DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) DEFAULT 0,
  pension DECIMAL(12,2) DEFAULT 0,
  advance DECIMAL(12,2) DEFAULT 0,
  to_card DECIMAL(12,2) DEFAULT 0,
  cash DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  breakdown_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, period)
);

-- ============================================================
-- МАРКЕТИНГОВЫЕ РАСХОДЫ
-- ============================================================
CREATE TABLE IF NOT EXISTS marketing_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES marketing_channels(id),
  amount DECIMAL(12,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  leads_count INT DEFAULT 0,
  paid_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЛОГ СИНХРОНИЗАЦИИ DIKIDI
-- ============================================================
CREATE TABLE IF NOT EXISTS dikidi_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  records_synced INT DEFAULT 0,
  error_message TEXT
);

-- ============================================================
-- НАСТРОЙКИ
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('monthly_plan', '300000'),
  ('salon_name', 'Восторг'),
  ('timezone', 'Europe/Moscow')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ФУНКЦИЯ ОБНОВЛЕНИЯ updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS ПОЛИТИКИ
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmetics_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция: получить роль текущего пользователя
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: каждый видит только себя, owner/manager видит всех
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() IN ('owner', 'manager'));

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Clients: все авторизованные пользователи
CREATE POLICY "clients_all" ON clients FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Leads: все авторизованные
CREATE POLICY "leads_all" ON leads FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "lead_history_all" ON lead_history FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Tasks: все авторизованные
CREATE POLICY "tasks_all" ON tasks FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Expenses: все авторизованные (читают), создают все, удаляют только owner/manager
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "expenses_update_delete" ON expenses FOR DELETE
  USING (get_user_role() IN ('owner', 'manager'));

-- Daily reports: admin видит только свои, owner/manager видит все
CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT
  USING (
    admin_id = auth.uid() OR
    get_user_role() IN ('owner', 'manager')
  );

CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_update" ON daily_reports FOR UPDATE
  USING (
    admin_id = auth.uid() OR
    get_user_role() IN ('owner', 'manager')
  );

-- Salary: только owner и manager
CREATE POLICY "salary_owner_manager" ON salary_calc FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- Settings: только owner
CREATE POLICY "settings_owner" ON settings FOR ALL
  USING (get_user_role() = 'owner');

-- Справочники: все читают, owner редактирует
CREATE POLICY "expense_categories_select" ON expense_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "expense_categories_write" ON expense_categories FOR ALL
  USING (get_user_role() = 'owner');

CREATE POLICY "supply_items_select" ON supply_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "supply_items_write" ON supply_items FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

CREATE POLICY "procedure_cards_select" ON procedure_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "procedure_cards_write" ON procedure_cards FOR ALL
  USING (get_user_role() = 'owner');

CREATE POLICY "procedure_card_items_all" ON procedure_card_items FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "marketing_channels_select" ON marketing_channels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "marketing_channels_write" ON marketing_channels FOR ALL
  USING (get_user_role() = 'owner');

CREATE POLICY "accounts_all" ON accounts FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_select" ON staff FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_write" ON staff FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

CREATE POLICY "staff_schedules_all" ON staff_schedules FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "client_consents_all" ON client_consents FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cosmetics_sales_all" ON cosmetics_sales FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "inventory_all" ON inventory FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "marketing_expenses_all" ON marketing_expenses FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- ============================================================
-- ИНДЕКСЫ
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_dikidi_id ON clients(dikidi_id);
CREATE INDEX IF NOT EXISTS idx_clients_last_visit ON clients(last_visit);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_client ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_admin ON daily_reports(admin_id);
CREATE INDEX IF NOT EXISTS idx_salary_staff_period ON salary_calc(staff_id, period);
