-- ============================================================
-- Управленческий учёт зарплаты (конверт + условные периоды)
-- Запустить в Supabase SQL Editor
-- ============================================================

-- Добавляем поля к таблице сотрудников
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS service_rates JSONB,
  ADD COLUMN IF NOT EXISTS return_rate_threshold INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS salary_envelope DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_envelope_type TEXT DEFAULT 'per_month'
    CHECK (salary_envelope_type IN ('per_month', 'per_shift')),
  ADD COLUMN IF NOT EXISTS salary_conditions JSONB;

-- Комментарии для понимания структуры
COMMENT ON COLUMN staff.salary_envelope IS
  'Неофициальная надбавка (конверт). Видна только владельцу.';
COMMENT ON COLUMN staff.salary_envelope_type IS
  'per_month = фиксированно в месяц, per_shift = за каждую смену';
COMMENT ON COLUMN staff.salary_conditions IS
  'JSON: условные периоды зарплаты. Структура:
  {
    "periods": [
      {
        "label": "1-й месяц",
        "rate_percent": 30,
        "subscription_rate": 5,
        "months": 1,
        "condition_type": "none",
        "condition_threshold": 20,
        "fallback_rate": 30
      },
      {
        "label": "С 2-го месяца",
        "rate_percent": 35,
        "subscription_rate": 5,
        "months": null,
        "condition_type": "return_rate_above",
        "condition_threshold": 20,
        "fallback_rate": 30
      }
    ],
    "active_period": 0,
    "period_started": "2026-05-01"
  }';

-- Политики безопасности: salary_envelope и salary_conditions видны только владельцу
-- (Реализовано через проверку роли на фронтенде — RLS не меняем для простоты)
