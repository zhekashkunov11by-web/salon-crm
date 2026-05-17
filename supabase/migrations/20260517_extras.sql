-- ============================================================
-- Дополнительные поля: амортизация расходов + заметки клиентов
-- Запустить в Supabase SQL Editor
-- ============================================================

-- Расходы: поля для амортизации в P&L
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS recognition_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recognition_start_date DATE;

COMMENT ON COLUMN expenses.recognition_months IS
  'На сколько месяцев размазывается расход в P&L. В ДДС — всегда полная сумма в дату оплаты.';
COMMENT ON COLUMN expenses.recognition_start_date IS
  'С какого месяца начинается признание в P&L (обычно = первое число месяца оплаты).';

-- Клиенты: заметки и Instagram
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;

COMMENT ON COLUMN clients.notes IS 'Заметки о клиенте (видны всем ролям)';
COMMENT ON COLUMN clients.instagram IS 'Ссылка или ник в Instagram (видна только администраторам)';
