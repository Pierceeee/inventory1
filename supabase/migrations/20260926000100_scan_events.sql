-- AKM Phase 4 - the scan log. Append-only: it feeds "10 most recent scans"
-- and survives Clear Items and item deletion - item_id only points at a live
-- row while one exists (A6); item_code is the durable record of what was
-- scanned, kept even once the row it pointed at is gone.

create table public.scan_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.inventory_sessions (id) on delete cascade,
  item_id     uuid references public.session_items (id) on delete set null,
  item_code   text not null
                constraint scan_events_code_length check (length(item_code) between 1 and 128),
  outcome     text not null
                constraint scan_events_outcome_check
                check (outcome in ('scanned', 'duplicate', 'not_found', 'undone', 'cleared', 'deleted')),
  -- Profiles are never deleted by the app (A6): NO ACTION, not SET NULL - a
  -- scan's actor must stay attributable even if that account later leaves.
  actor       uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- listRecentScans orders by (created_at desc, id desc) - the tiebreaker is
-- part of the index too, or a Clear (thousands of rows sharing one now())
-- degrades to a sort instead of an index-ordered scan.
create index scan_events_session_created_idx on public.scan_events (session_id, created_at desc, id desc);
create index scan_events_actor_idx on public.scan_events (actor);
-- Partial: most scan_events rows never lose their item (only Clear Items and
-- a future item delete null this out). Without it, ON DELETE SET NULL does a
-- sequential scan of the whole table for every item deleted - measured 23x
-- slower on a 12k-row history when clearing 4k items, while holding the
-- session's row lock the whole time.
create index scan_events_item_idx on public.scan_events (item_id) where item_id is not null;

alter table public.scan_events enable row level security;

-- Nothing is logged against a closed session, not even a "not found" - reuses
-- the same trigger function session_items already installs.
create trigger scan_events_require_active_session
  before insert on public.scan_events
  for each row execute function public.assert_session_active();

-- Append-only, with one deliberate exception: `item_id ... on delete set
-- null` fires as an ordinary UPDATE under the hood when the item it points
-- at is deleted (Clear Items, or a future item delete in G4), and that
-- UPDATE must be allowed to go through, or the delete itself fails. Anything
-- else - editing the outcome, code, actor or session after the fact - stays
-- refused.
create function public.refuse_scan_event_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_id is null and old.item_id is not null
     and new.id is not distinct from old.id
     and new.session_id is not distinct from old.session_id
     and new.item_code is not distinct from old.item_code
     and new.outcome is not distinct from old.outcome
     and new.actor is not distinct from old.actor
     and new.created_at is not distinct from old.created_at
  then
    return new;
  end if;
  raise exception 'scan_events is append-only';
end
$$;

create trigger scan_events_append_only
  before update on public.scan_events
  for each row execute function public.refuse_scan_event_update();
