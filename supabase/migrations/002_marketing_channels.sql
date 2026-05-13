-- ============================================================
-- Миграция 002: Расширение маркетинговой аналитики
-- Добавляет клики/показы к расходам + таблицу API-ключей каналов
-- Выполнить в Supabase SQL Editor
-- ============================================================

-- 1. Добавляем метрики к marketing_expenses
ALTER TABLE marketing_expenses
  ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;

-- 2. Таблица для хранения API-ключей рекламных платформ
CREATE TABLE IF NOT EXISTS ad_channel_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL UNIQUE,   -- 'facebook', 'yandex_direct', 'vk', 'google', 'telegram'
  is_enabled BOOLEAN DEFAULT false,
  access_token TEXT,
  account_id TEXT,
  extra JSONB,                     -- дополнительные поля (client_id, login и т.д.)
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ad_channel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_channel_settings_all" ON ad_channel_settings;
CREATE POLICY "ad_channel_settings_all" ON ad_channel_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. Seed-данные: создаём записи для всех платформ
INSERT INTO ad_channel_settings (channel, is_enabled) VALUES
  ('facebook', false),
  ('instagram', false),
  ('yandex_direct', false),
  ('vk', false),
  ('google', false),
  ('telegram', false)
ON CONFLICT (channel) DO NOTHING;
