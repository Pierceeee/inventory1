-- Device Handout Tracker - initial schema (spec §4).
--
-- The rules that must hold under concurrency live here, not in application
-- code: a device can have at most one open assignment, a return can never
-- precede its issue, and "issued" is derived from assignments, never stored.
--
-- No seed data. The register starts empty and fills from the app or /import.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- profiles - the IT staff who record handouts
-- ---------------------------------------------------------------------------
-- One row per Supabase Auth user (id = auth.users.id), upserted by the API
-- when someone signs in or records a handout. Kept in public rather than
-- joined to auth.users directly so history keeps a readable name, and so the
-- schema runs on any Postgres for tests.

create table public.profiles (
  id          uuid primary key,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------

create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (length(btrim(full_name)) > 0),
  email       text,
  department  text,
  status      text not null default 'active' check (status in ('active', 'resigned')),
  resigned_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint employees_resigned_at_matches_status
    check ((status = 'resigned') = (resigned_at is not null))
);

-- Case-insensitive: Maria@adspark.ph and maria@adspark.ph are one person.
create unique index employees_email_key on public.employees (lower(email)) where email is not null;
create index employees_status_idx on public.employees (status);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- devices - status is lifecycle only; "issued" is derived (see view below)
-- ---------------------------------------------------------------------------

create table public.devices (
  id            uuid primary key default gen_random_uuid(),
  asset_tag     text not null check (length(btrim(asset_tag)) > 0),
  type          text not null check (type in ('laptop', 'mobile')),
  brand         text,
  model         text,
  serial_number text,
  os            text check (os in ('macos', 'windows', 'ios', 'android')),
  status        text not null default 'available' check (status in ('available', 'repair', 'retired')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Case-insensitive: ASP-0042 and asp-0042 are the same sticker.
create unique index devices_asset_tag_key on public.devices (lower(asset_tag));
create unique index devices_serial_number_key on public.devices (lower(serial_number))
  where serial_number is not null;
create index devices_type_status_idx on public.devices (type, status);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- assignments - the handout log. One row per handout; history is permanent.
-- ---------------------------------------------------------------------------

create table public.assignments (
  id                   uuid primary key default gen_random_uuid(),
  device_id            uuid not null references public.devices (id) on delete restrict,
  employee_id          uuid not null references public.employees (id) on delete restrict,
  issued_at            timestamptz not null default now(),
  issued_by            uuid references public.profiles (id),
  returned_at          timestamptz,
  returned_by          uuid references public.profiles (id),
  return_reason        text check (return_reason in ('resignation', 'swap', 'repair', 'lost', 'other')),
  issued_condition     text not null default 'good' check (issued_condition in ('good', 'fair', 'damaged')),
  returned_condition   text check (returned_condition in ('good', 'fair', 'damaged')),
  issued_accessories   text[] not null default '{}',
  returned_accessories text[],
  notes                text,
  created_at           timestamptz not null default now(),

  constraint assignments_return_after_issue
    check (returned_at is null or returned_at >= issued_at),
  -- A return is recorded whole or not at all: the reason and the condition it
  -- came back in are the evidence an offboarding dispute turns on.
  constraint assignments_return_is_complete
    check ((returned_at is null) = (return_reason is null)
       and (returned_at is null) = (returned_condition is null))
);

-- The no-double-issue guarantee. The database physically refuses to hand the
-- same device to two people; a second concurrent issue fails with 23505.
create unique index one_open_assignment_per_device
  on public.assignments (device_id)
  where returned_at is null;

create index assignments_device_issued_idx on public.assignments (device_id, issued_at desc);
create index assignments_employee_issued_idx on public.assignments (employee_id, issued_at desc);
create index assignments_issued_idx on public.assignments (issued_at desc);

-- ---------------------------------------------------------------------------
-- Views. security_invoker so they never bypass row level security.
-- ---------------------------------------------------------------------------

create view public.device_current_holder with (security_invoker = true) as
select
  d.*,
  a.id                 as assignment_id,
  a.issued_at,
  a.issued_condition,
  a.issued_accessories,
  e.id                 as holder_id,
  e.full_name          as holder_name
from public.devices d
left join public.assignments a on a.device_id = d.id and a.returned_at is null
left join public.employees  e on e.id = a.employee_id;

-- Assignments denormalised with both names, so no list needs a client-side join.
create view public.assignment_details with (security_invoker = true) as
select
  a.*,
  d.asset_tag,
  d.model        as device_model,
  d.type         as device_type,
  e.full_name    as employee_name,
  ib.full_name   as issued_by_name,
  rb.full_name   as returned_by_name
from public.assignments a
join public.devices   d  on d.id = a.device_id
join public.employees e  on e.id = a.employee_id
left join public.profiles ib on ib.id = a.issued_by
left join public.profiles rb on rb.id = a.returned_by;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- The browser never talks to the database: every read and write goes through
-- the Express API, which connects as the table owner and so bypasses RLS.
-- Enabling RLS with no policies closes Supabase's auto-generated REST API to
-- the anon and authenticated roles, so the public anon key cannot read or
-- change the register.

alter table public.profiles    enable row level security;
alter table public.employees   enable row level security;
alter table public.devices     enable row level security;
alter table public.assignments enable row level security;
