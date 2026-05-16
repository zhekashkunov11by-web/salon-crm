-- Расширяем таблицу tasks для AI-задач
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS assigned_role TEXT DEFAULT 'manager', -- owner / manager / admin
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',       -- high / medium / low
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_reason TEXT;                       -- почему AI поставил задачу

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_role ON tasks(assigned_role);
CREATE INDEX IF NOT EXISTS idx_tasks_ai ON tasks(is_ai_generated) WHERE is_ai_generated = TRUE;
