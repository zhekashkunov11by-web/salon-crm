-- Inbox: conversations and messages tables for amoCRM integration
-- Each conversation = one dialogue from Instagram/VK/Telegram/WhatsApp/Facebook

create table if not exists inbox_conversations (
  id            uuid primary key default gen_random_uuid(),
  channel       text not null,                  -- 'instagram' | 'vk' | 'telegram' | 'whatsapp' | 'facebook'
  external_id   text not null,                  -- chat_id from amoCRM
  amocrm_chat_id text,                          -- amoCRM internal chat id for sending
  contact_name  text,
  contact_phone text,
  contact_id    uuid references clients(id),    -- linked to client if matched
  assigned_to   uuid references staff(id),      -- assigned staff member
  status        text not null default 'open',   -- 'open' | 'closed'
  unread_count  int not null default 0,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  unique(channel, external_id)
);

create table if not exists inbox_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references inbox_conversations(id) on delete cascade,
  direction       text not null,                -- 'in' | 'out'
  text            text not null default '',
  external_id     text,                         -- amoCRM message id (for dedup)
  sent_via_amocrm boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_inbox_conversations_status on inbox_conversations(status);
create index if not exists idx_inbox_conversations_last_msg on inbox_conversations(last_message_at desc);
create index if not exists idx_inbox_messages_conv on inbox_messages(conversation_id, created_at);

-- RLS
alter table inbox_conversations enable row level security;
alter table inbox_messages enable row level security;

-- Allow all authenticated users to read/write (managers and owners)
create policy "inbox_conversations_auth" on inbox_conversations
  for all using (auth.uid() is not null);

create policy "inbox_messages_auth" on inbox_messages
  for all using (auth.uid() is not null);

-- Function to increment unread_count
create or replace function inbox_increment_unread(p_conversation_id uuid)
returns void language sql as $$
  update inbox_conversations
  set unread_count = unread_count + 1
  where id = p_conversation_id;
$$;

-- Function to mark conversation as read (reset unread)
create or replace function inbox_mark_read(p_conversation_id uuid)
returns void language sql as $$
  update inbox_conversations
  set unread_count = 0
  where id = p_conversation_id;
$$;
