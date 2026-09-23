-- AKM Phases 2-3 - audit sessions and the items uploaded into them.
--
-- Named inventory_sessions so it never collides with sign-in "session" code;
-- the UI still says Sessions. Archiving is derived, not stored: a session
-- reads as archived 7 days after completion, so no cron job can silently
-- fail to run.

create table public.inventory_sessions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null
                    constraint inventory_sessions_name_length check (length(btrim(name)) between 1 and 200),
  department_id   uuid not null references public.departments (id) on delete restrict,
  status          text not null default 'active'
                    constraint inventory_sessions_status_check check (status in ('active', 'completed')),
  completed_at    timestamptz,
  completed_by    uuid references public.profiles (id),
  -- Spreadsheet headers in their original order: jsonb does not keep key
  -- order. Server-owned - a client only ever posts display_columns (which of
  -- these to show), never columns itself.
  columns         text[] not null default '{}'
                    constraint inventory_sessions_columns_limit check (cardinality(columns) <= 100),
  -- null = show every column, including ones a later import adds.
  display_columns text[]
                    constraint inventory_sessions_display_columns_known
                    check (display_columns is null or display_columns <@ columns),
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint inventory_sessions_completed_at_matches_status
    check ((status = 'completed') = (completed_at is not null)),
  constraint inventory_sessions_completed_by_matches_status
    check ((status = 'completed') = (completed_by is not null))
);

create index inventory_sessions_department_idx on public.inventory_sessions (department_id, created_at desc);
create index inventory_sessions_status_idx on public.inventory_sessions (status, completed_at);

create trigger inventory_sessions_set_updated_at
  before update on public.inventory_sessions
  for each row execute function public.set_updated_at();

alter table public.inventory_sessions enable row level security;

create table public.session_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.inventory_sessions (id) on delete cascade,
  -- Upload order, so tables, labels and exports follow the spreadsheet.
  seq         integer generated always as identity,
  item_code   text not null
                constraint session_items_code_trimmed
                check (item_code = btrim(item_code) and length(item_code) between 1 and 128),
  data        jsonb not null default '{}'
                constraint session_items_data_is_object check (jsonb_typeof(data) = 'object'),
  scanned_at  timestamptz,
  scanned_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint session_items_scan_is_complete check ((scanned_at is null) = (scanned_by is null))
);

-- Unique within a session only: the same sticker is audited again every
-- quarter. An expression index, not a table constraint, so it can be
-- addressed by name from isUniqueViolation(err, 'session_items_code_key').
create unique index session_items_code_key on public.session_items (session_id, lower(item_code));
create index session_items_session_scanned_idx on public.session_items (session_id, scanned_at);
create index session_items_session_seq_idx on public.session_items (session_id, seq);
create index session_items_scanned_by_idx on public.session_items (scanned_by) where scanned_by is not null;

create trigger session_items_set_updated_at
  before update on public.session_items
  for each row execute function public.set_updated_at();

alter table public.session_items enable row level security;

-- The one place the 7-day archive rule lives.
create function public.session_effective_status(status text, completed_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when status = 'active' then 'active'
    when completed_at <= now() - interval '7 days' then 'archived'
    else 'completed'
  end
$$;

-- A completed session is read-only (D4). FOR SHARE makes Mark Complete wait
-- for in-flight item writes, and them wait for it, so nothing lands after a
-- session closes. Deletes are not covered: cascades must still work. Always
-- checks the BASE TABLE status, never the summary view's derived
-- effective_status - a write must never sneak past the 7-day archive rule
-- just because a session has been completed for a while.
create function public.assert_session_active() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.inventory_sessions
   where id = new.session_id and status = 'active'
     for share;
  if not found then
    raise exception 'Session % is not active', new.session_id using errcode = '55000';
  end if;
  return new;
end
$$;

create trigger session_items_require_active_session
  before insert or update on public.session_items
  for each row execute function public.assert_session_active();

create view public.inventory_session_summary with (security_invoker = true) as
select
  s.id, s.name, s.department_id, s.status, s.completed_at, s.completed_by,
  s.columns, s.display_columns, s.created_by, s.created_at, s.updated_at,
  d.name       as department_name,
  cb.full_name as created_by_name,
  pb.full_name as completed_by_name,
  public.session_effective_status(s.status, s.completed_at) as effective_status,
  i.item_count,
  i.scanned_count
from public.inventory_sessions s
join public.departments d on d.id = s.department_id
left join public.profiles cb on cb.id = s.created_by
left join public.profiles pb on pb.id = s.completed_by
cross join lateral (
  select count(*)::int as item_count, count(si.scanned_at)::int as scanned_count
    from public.session_items si where si.session_id = s.id
) i;

create view public.session_item_details with (security_invoker = true) as
select
  it.id, it.session_id, it.seq, it.item_code, it.data, it.scanned_at, it.scanned_by,
  it.created_at, it.updated_at,
  s.name        as session_name,
  s.department_id,
  d.name        as department_name,
  s.created_at  as session_created_at,
  public.session_effective_status(s.status, s.completed_at) as session_effective_status,
  sb.full_name  as scanned_by_name
from public.session_items it
join public.inventory_sessions s on s.id = it.session_id
join public.departments d on d.id = s.department_id
left join public.profiles sb on sb.id = it.scanned_by;
