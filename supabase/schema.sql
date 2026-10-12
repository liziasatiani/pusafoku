alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

create table public.settings (
  id boolean primary key default true check (id),
  name text not null default 'LA',
  language text not null default 'en' check (language in ('en','ka')),
  city text not null default 'Tbilisi',
  latitude numeric(8,5) not null default 41.71510,
  longitude numeric(8,5) not null default 44.82710,
  time_zone text not null default 'Asia/Tbilisi',
  currency text not null default 'GEL' check (char_length(currency) = 3),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  source text not null default 'manual' check (char_length(source) <= 80),
  draft text not null default '' check (char_length(draft) <= 8000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index approvals_status_created_idx on public.approvals (status, created_at desc);

create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https://' and char_length(url) <= 500),
  label text not null default '' check (char_length(label) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.monitor_sites (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https://' and char_length(url) <= 500),
  label text not null default '' check (char_length(label) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.monitor_checks (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.monitor_sites(id) on delete cascade,
  ok boolean not null,
  status_code integer,
  ms integer check (ms >= 0),
  checked_at timestamptz not null default now()
);
create index monitor_checks_site_time_idx on public.monitor_checks (site_id, checked_at desc);

create table public.usage_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  model text not null,
  purpose text not null default 'command' check (char_length(purpose) <= 80),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(10,6) not null default 0 check (cost_usd >= 0)
);
create index usage_log_at_idx on public.usage_log (at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (char_length(action) <= 80),
  detail jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);

insert into public.settings (id) values (true);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  day date not null,
  start_time time,
  end_time time,
  repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly','yearly')),
  created_at timestamptz not null default now(),
  check (end_time is null or start_time is not null),
  check (end_time is null or end_time > start_time)
);
create index events_day_idx on public.events (day);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https://' and char_length(url) <= 1000),
  label text not null default '' check (char_length(label) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.approvals enable row level security;
alter table public.feeds enable row level security;
alter table public.monitor_sites enable row level security;
alter table public.monitor_checks enable row level security;
alter table public.usage_log enable row level security;
alter table public.audit_log enable row level security;
alter table public.events enable row level security;
alter table public.calendar_sources enable row level security;

alter table public.settings force row level security;
alter table public.tasks force row level security;
alter table public.notes force row level security;
alter table public.approvals force row level security;
alter table public.feeds force row level security;
alter table public.monitor_sites force row level security;
alter table public.monitor_checks force row level security;
alter table public.usage_log force row level security;
alter table public.audit_log force row level security;
alter table public.events force row level security;
alter table public.calendar_sources force row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
