-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- TODOS: single-day items with time
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text,
  due_date date not null,
  due_time time,
  priority smallint not null default 0 check (priority between 0 and 5),
  done boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DEADLINES: ranged items (start ~ end)
create table if not exists deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  priority smallint not null default 0 check (priority between 0 and 5),
  done boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Migration for existing tables:
alter table deadlines add column if not exists start_time time;
alter table deadlines add column if not exists end_time time;

-- GOALS + SUBGOALS
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text,
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists subgoals (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Telegram bot session state (for multi-step flows)
create table if not exists tg_sessions (
  chat_id bigint primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security but allow all (we gate by service_role in API)
alter table todos enable row level security;
alter table deadlines enable row level security;
alter table goals enable row level security;
alter table subgoals enable row level security;
alter table tg_sessions enable row level security;

-- Public read/write policies (single-user app; access is controlled by API layer)
create policy "anon_all_todos" on todos for all using (true) with check (true);
create policy "anon_all_deadlines" on deadlines for all using (true) with check (true);
create policy "anon_all_goals" on goals for all using (true) with check (true);
create policy "anon_all_subgoals" on subgoals for all using (true) with check (true);

-- Indexes
create index if not exists idx_todos_due on todos(due_date);
create index if not exists idx_deadlines_range on deadlines(start_date, end_date);
create index if not exists idx_subgoals_goal on subgoals(goal_id);

-- Expenses & settings
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  spent_at date not null default current_date,
  place text not null,
  memo text,
  amount integer not null,
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;
create policy "anon_all_expenses" on expenses for all using (true) with check (true);
create index if not exists idx_expenses_spent_at on expenses(spent_at);

create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  earned_at date not null default current_date,
  source text not null,
  memo text,
  amount integer not null,
  created_at timestamptz not null default now()
);
alter table incomes enable row level security;
create policy "anon_all_incomes" on incomes for all using (true) with check (true);
create index if not exists idx_incomes_earned_at on incomes(earned_at);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table settings enable row level security;
create policy "anon_all_settings" on settings for all using (true) with check (true);
insert into settings(key, value) values ('starting_balance', '503339') on conflict (key) do nothing;
