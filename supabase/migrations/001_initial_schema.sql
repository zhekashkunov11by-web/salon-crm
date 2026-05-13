-- ============================================================
-- Схема БД салона «Восторг» — v2
-- Соответствует database.types.ts и коду приложения
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0. СБРОС ВСЕГО СТАРОГО
-- ============================================================
DROP TABLE IF EXISTS salary_calc CASCADE;
DROP TABLE IF EXISTS dikidi_sync_log CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS client_consents CASCADE;
DROP TABLE IF EXISTS marketing_expenses CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS procedure_card_items CASCADE;
DROP TABLE IF EXISTS procedure_cards CASCADE;
DROP TABLE IF EXISTS supply_items CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS marketing_channels CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS staff_schedules CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS lead_history CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS lead_statuses CASCADE;
DROP TABLE IF EXISTS client_field_values CASCADE;
DROP TABLE IF EXISTS client_fields CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS cosmetics_sales CASCADE;
DROP TABLE IF EXISTS lead_field_values CASCADE;
DROP TABLE IF EXISTS lead_fields CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP SEQUENCE IF EXISTS client_seq CASCADE;

-- ============================================================
-- 1. РАСШИРЕНИЯ
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. ПРОФИЛИ
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'admin')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. КЛИЕНТЫ
-- ============================================================
CREATE SEQUENCE client_seq START 1;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE DEFAULT ('CL-' || LPAD(nextval('client_seq')::TEXT, 5, '0')),
  dikidi_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  birthday TEXT,
  source TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_visit_date DATE,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  visits_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. КАНАЛЫ ТРАФИКА
-- ============================================================
CREATE TABLE marketing_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
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
  ('Другое', 99);

-- ============================================================
-- 5. СТАТУСЫ ВОРОНКИ
-- ============================================================
CREATE TABLE lead_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INT DEFAULT 0,
  is_final BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO lead_statuses (name, color, sort_order, is_final, is_active) VALUES
  ('Новый',          '#10B981', 1, false, true),
  ('В обработке',    '#F59E0B', 2, false, true),
  ('Запись создана', '#3B82F6', 3, false, true),
  ('Оплачено',       '#8B5CF6', 4, false, true),
  ('Постоянный',     '#EC4899', 5, false, true),
  ('Отказ',          '#EF4444', 6, true,  true);

-- ============================================================
-- 6. СОТРУДНИКИ
-- ============================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manual', 'kim8', 'cosmetologist', 'admin')),
  rate_percent DECIMAL(5,2) NOT NULL DEFAULT 35,
  salary_base_per_shift DECIMAL(10,2),
  tax_rate DECIMAL(5,2) DEFAULT 13,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dikidi_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_worked BOOLEAN DEFAULT FALSE,
  plan_amount DECIMAL(10,2),
  fact_amount DECIMAL(10,2),
  bonus DECIMAL(10,2),
  UNIQUE(staff_id, date)
);

-- ============================================================
-- 7. ЗАЯВКИ (ВОРОНКА)
-- ============================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  status_id UUID NOT NULL REFERENCES lead_statuses(id),
  client_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  source TEXT,
  amount DECIMAL(12,2),
  notes TEXT,
  staff_id UUID REFERENCES staff(id),
  next_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  new_status_id UUID REFERENCES lead_statuses(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. ЗАДАЧИ-НАПОМИНАНИЯ
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. ВИЗИТЫ (из Dikidi)
-- ============================================================
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dikidi_id TEXT UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  staff_id UUID REFERENCES staff(id),
  visit_date DATE NOT NULL,
  service_name TEXT NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  prepaid DECIMAL(12,2) DEFAULT 0,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. УСЛУГИ
-- ============================================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('massage', 'cosmetology')),
  duration_min INT DEFAULT 60,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 11. РАСХОДНИКИ И ТЕХКАРТЫ
-- ============================================================
CREATE TABLE supply_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'шт',
  last_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE procedure_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id),
  name TEXT NOT NULL,
  duration_min INT DEFAULT 60,
  cost_calculated DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE procedure_card_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_card_id UUID NOT NULL REFERENCES procedure_cards(id) ON DELETE CASCADE,
  supply_item_id UUID NOT NULL REFERENCES supply_items(id),
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL
);

-- ============================================================
-- 12. КАТЕГОРИИ РАСХОДОВ
-- ============================================================
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cfs_section TEXT NOT NULL DEFAULT 'operating',
  pnl_section TEXT NOT NULL DEFAULT 'overhead',
  direction TEXT CHECK (direction IN ('massage', 'cosmetology')),
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO expense_categories (name, cfs_section, pnl_section, direction) VALUES
  ('Масло массажное',                     'operating', 'direct_costs', 'massage'),
  ('Масло антицеллюлитное',               'operating', 'direct_costs', 'massage'),
  ('Масло Kim8 (аппаратный)',             'operating', 'direct_costs', 'massage'),
  ('Шоколадная масса',                    'operating', 'direct_costs', 'massage'),
  ('Плёнка для обёртывания',              'operating', 'direct_costs', 'massage'),
  ('Простыни одноразовые',                'operating', 'direct_costs', 'massage'),
  ('Перчатки',                            'operating', 'direct_costs', 'massage'),
  ('Прочие расходники (массаж)',          'operating', 'direct_costs', 'massage'),
  ('Средства для очищения',               'operating', 'direct_costs', 'cosmetology'),
  ('Маски и сыворотки',                   'operating', 'direct_costs', 'cosmetology'),
  ('Расходники для аппаратных процедур',  'operating', 'direct_costs', 'cosmetology'),
  ('Одноразовые принадлежности косметолога','operating','direct_costs','cosmetology'),
  ('Косметика для продажи',               'operating', 'direct_costs', 'cosmetology'),
  ('Вода и угощения клиентам',            'operating', 'overhead',     NULL),
  ('Чистящие средства',                   'operating', 'overhead',     NULL),
  ('Бахилы и прочее хозяйство',          'operating', 'overhead',     NULL),
  ('Аренда помещения',                    'operating', 'overhead',     NULL),
  ('Коммунальные / Интернет',             'operating', 'overhead',     NULL),
  ('Уборка / клининг',                    'operating', 'overhead',     NULL),
  ('Ремонт и оборудование',               'investing', 'overhead',     NULL),
  ('Подписки и ПО',                       'operating', 'overhead',     NULL),
  ('Зарплата мастеров',                   'operating', 'payroll',      NULL),
  ('Зарплата косметологов',               'operating', 'payroll',      NULL),
  ('Зарплата администраторов',            'operating', 'payroll',      NULL),
  ('Прочий персонал',                     'operating', 'payroll',      NULL),
  ('Премии',                              'operating', 'payroll',      NULL),
  ('Instagram таргет',                    'operating', 'marketing',    NULL),
  ('ВКонтакте таргет',                    'operating', 'marketing',    NULL),
  ('Яндекс Директ',                       'operating', 'marketing',    NULL),
  ('Google Ads',                          'operating', 'marketing',    NULL),
  ('Создание контента / SMM',             'operating', 'marketing',    NULL),
  ('Прочая реклама',                      'operating', 'marketing',    NULL),
  ('УСН / патент / страховые взносы',     'operating', 'taxes',        NULL),
  ('Бухгалтерия / Банковские комиссии',   'operating', 'taxes',        NULL),
  ('Прочее',                              'operating', 'overhead',     NULL);

-- ============================================================
-- 13. СЧЕТА (КОШЕЛЬКИ)
-- ============================================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'card', 'bank')),
  balance DECIMAL(12,2) DEFAULT 0,
  sort_order INT DEFAULT 0
);

INSERT INTO accounts (name, type, sort_order) VALUES
  ('Наличные',       'cash', 1),
  ('Карта / Терминал','card', 2),
  ('Расчётный счёт', 'bank', 3);

-- ============================================================
-- 14. РАСХОДЫ
-- ============================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID NOT NULL REFERENCES expense_categories(id),
  supply_item_id UUID REFERENCES supply_items(id),
  description TEXT,
  quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  amount DECIMAL(12,2) NOT NULL,
  account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. МАРКЕТИНГОВЫЕ РАСХОДЫ
-- ============================================================
CREATE TABLE marketing_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. ЕЖЕДНЕВНЫЙ ОТЧЁТ
-- ============================================================
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  revenue_cash DECIMAL(12,2) DEFAULT 0,
  revenue_card DECIMAL(12,2) DEFAULT 0,
  revenue_online DECIMAL(12,2) DEFAULT 0,
  clients_count INT DEFAULT 0,
  new_clients_count INT DEFAULT 0,
  avg_check DECIMAL(10,2) DEFAULT 0,
  monthly_plan DECIMAL(12,2) DEFAULT 300000,
  expenses_cash DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  checklist JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. СОГЛАСИЯ КЛИЕНТОВ
-- ============================================================
CREATE TABLE client_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);

-- ============================================================
-- 18. НАСТРОЙКИ
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('monthly_plan',          '300000'),
  ('salon_name',            'Восторг'),
  ('timezone',              'Europe/Minsk'),
  ('dikidi_api_key',        ''),
  ('dikidi_company_id',     ''),
  ('telegram_bot_token',    ''),
  ('telegram_chat_id_all',  ''),
  ('telegram_chat_id_owners','');

-- ============================================================
-- 19. ЛОГ СИНХРОНИЗАЦИИ DIKIDI
-- ============================================================
CREATE TABLE dikidi_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  clients_synced INT DEFAULT 0,
  visits_synced INT DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  error_message TEXT
);

-- ============================================================
-- 20. РАСЧЁТ ЗАРПЛАТЫ
-- ============================================================
CREATE TABLE salary_calc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_salary DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, period_start, period_end)
);

-- ============================================================
-- 21. ТРИГГЕРЫ updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 22. RLS
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_statuses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_consents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dikidi_sync_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_calc      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
DROP POLICY IF EXISTS "profiles_select"      ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() IN ('owner', 'manager'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- clients
DROP POLICY IF EXISTS "clients_all" ON clients;
CREATE POLICY "clients_all" ON clients FOR ALL
  USING (auth.uid() IS NOT NULL);

-- lead_statuses
DROP POLICY IF EXISTS "lead_statuses_select" ON lead_statuses;
DROP POLICY IF EXISTS "lead_statuses_write"  ON lead_statuses;
CREATE POLICY "lead_statuses_select" ON lead_statuses FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "lead_statuses_write" ON lead_statuses FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- leads
DROP POLICY IF EXISTS "leads_all" ON leads;
CREATE POLICY "leads_all" ON leads FOR ALL
  USING (auth.uid() IS NOT NULL);

-- lead_history
DROP POLICY IF EXISTS "lead_history_all" ON lead_history;
CREATE POLICY "lead_history_all" ON lead_history FOR ALL
  USING (auth.uid() IS NOT NULL);

-- tasks
DROP POLICY IF EXISTS "tasks_all" ON tasks;
CREATE POLICY "tasks_all" ON tasks FOR ALL
  USING (auth.uid() IS NOT NULL);

-- staff
DROP POLICY IF EXISTS "staff_select" ON staff;
DROP POLICY IF EXISTS "staff_write"  ON staff;
CREATE POLICY "staff_select" ON staff FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "staff_write" ON staff FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- staff_schedules
DROP POLICY IF EXISTS "staff_schedules_all" ON staff_schedules;
CREATE POLICY "staff_schedules_all" ON staff_schedules FOR ALL
  USING (auth.uid() IS NOT NULL);

-- visits
DROP POLICY IF EXISTS "visits_all" ON visits;
CREATE POLICY "visits_all" ON visits FOR ALL
  USING (auth.uid() IS NOT NULL);

-- services
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_write"  ON services;
CREATE POLICY "services_select" ON services FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "services_write" ON services FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- supply_items
DROP POLICY IF EXISTS "supply_items_select" ON supply_items;
DROP POLICY IF EXISTS "supply_items_write"  ON supply_items;
CREATE POLICY "supply_items_select" ON supply_items FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "supply_items_write" ON supply_items FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- procedure_cards
DROP POLICY IF EXISTS "procedure_cards_select" ON procedure_cards;
DROP POLICY IF EXISTS "procedure_cards_write"  ON procedure_cards;
CREATE POLICY "procedure_cards_select" ON procedure_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "procedure_cards_write" ON procedure_cards FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- procedure_card_items
DROP POLICY IF EXISTS "procedure_card_items_all" ON procedure_card_items;
CREATE POLICY "procedure_card_items_all" ON procedure_card_items FOR ALL
  USING (auth.uid() IS NOT NULL);

-- expense_categories
DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_write"  ON expense_categories;
CREATE POLICY "expense_categories_select" ON expense_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "expense_categories_write" ON expense_categories FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- accounts
DROP POLICY IF EXISTS "accounts_all" ON accounts;
CREATE POLICY "accounts_all" ON accounts FOR ALL
  USING (auth.uid() IS NOT NULL);

-- expenses
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (get_user_role() IN ('owner', 'manager'));

-- marketing_channels
DROP POLICY IF EXISTS "marketing_channels_select" ON marketing_channels;
DROP POLICY IF EXISTS "marketing_channels_write"  ON marketing_channels;
CREATE POLICY "marketing_channels_select" ON marketing_channels FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "marketing_channels_write" ON marketing_channels FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- marketing_expenses
DROP POLICY IF EXISTS "marketing_expenses_all" ON marketing_expenses;
CREATE POLICY "marketing_expenses_all" ON marketing_expenses FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- daily_reports
DROP POLICY IF EXISTS "daily_reports_all" ON daily_reports;
CREATE POLICY "daily_reports_all" ON daily_reports FOR ALL
  USING (auth.uid() IS NOT NULL);

-- client_consents
DROP POLICY IF EXISTS "client_consents_all" ON client_consents;
CREATE POLICY "client_consents_all" ON client_consents FOR ALL
  USING (auth.uid() IS NOT NULL);

-- settings
DROP POLICY IF EXISTS "settings_select" ON settings;
DROP POLICY IF EXISTS "settings_write"  ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_write" ON settings FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- dikidi_sync_log
DROP POLICY IF EXISTS "dikidi_sync_log_all" ON dikidi_sync_log;
CREATE POLICY "dikidi_sync_log_all" ON dikidi_sync_log FOR ALL
  USING (auth.uid() IS NOT NULL);

-- salary_calc
DROP POLICY IF EXISTS "salary_calc_all" ON salary_calc;
CREATE POLICY "salary_calc_all" ON salary_calc FOR ALL
  USING (get_user_role() IN ('owner', 'manager'));

-- ============================================================
-- 23. ИНДЕКСЫ
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_phone       ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_dikidi_id   ON clients(dikidi_id);
CREATE INDEX IF NOT EXISTS idx_clients_last_visit  ON clients(last_visit_date);
CREATE INDEX IF NOT EXISTS idx_leads_status_id     ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_client        ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created       ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_done       ON tasks(is_done);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date  ON daily_reports(date);
CREATE INDEX IF NOT EXISTS idx_visits_client       ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_date         ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_salary_staff_period ON salary_calc(staff_id, period_start);
