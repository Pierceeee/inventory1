-- AKM Phase 1 - departments and roles.
--
-- Role and department live on profiles and the API reads them on every
-- request, never from the token: Supabase lets users edit their own
-- user_metadata.

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
                constraint departments_name_length check (length(btrim(name)) between 1 and 100)
                constraint departments_name_trimmed check (name = btrim(name)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- "IT", "it" and " IT " are one department.
create unique index departments_name_key on public.departments (lower(btrim(name)));

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.departments enable row level security;

-- New accounts start as scanners with no department: they can sign in but
-- see nothing until an admin assigns them. Departments are never deleted
-- through the API (no DELETE route), so `on delete restrict` is belt and
-- braces rather than a constraint the app needs to work around.
alter table public.profiles
  add column role text not null default 'scanner'
    constraint profiles_role_check check (role in ('admin', 'head', 'scanner')),
  add column department_id uuid references public.departments (id) on delete restrict,
  -- Deactivation (Reconciliation R4): a disabled account can no longer sign in
  -- or make requests, but its history (who issued/scanned what) is untouched.
  add column disabled_at timestamptz;

create index profiles_department_idx on public.profiles (department_id);

-- Everyone who could sign in before this had full access. Keep it that way,
-- or current IT staff are locked out the moment this runs.
update public.profiles set role = 'admin';
