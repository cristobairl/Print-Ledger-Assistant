create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.filament_spools (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  material text not null,
  total_weight_grams numeric not null check (total_weight_grams > 0),
  remaining_weight_grams numeric not null check (remaining_weight_grams >= 0),
  reserved_weight_grams numeric not null default 0 check (reserved_weight_grams >= 0),
  active_printer_id uuid null references public.printers(id) on delete set null,
  color_name text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint filament_spools_remaining_lte_total
    check (remaining_weight_grams <= total_weight_grams)
);

create unique index if not exists filament_spools_one_active_per_printer
  on public.filament_spools(active_printer_id)
  where active_printer_id is not null;

drop trigger if exists filament_spools_set_updated_at on public.filament_spools;
create trigger filament_spools_set_updated_at
before update on public.filament_spools
for each row
execute function public.set_updated_at();

create table if not exists public.filament_events (
  id uuid primary key default gen_random_uuid(),
  spool_id uuid not null references public.filament_spools(id) on delete cascade,
  event_type text not null
    check (event_type in ('reserve', 'release', 'consume', 'adjust', 'assign', 'unassign')),
  grams numeric not null default 0 check (grams >= 0),
  printer_id uuid null references public.printers(id) on delete set null,
  job_id uuid null references public.jobs(id) on delete set null,
  student_id uuid null references public.students(id) on delete set null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists filament_events_spool_id_idx
  on public.filament_events(spool_id);

create index if not exists filament_events_printer_id_idx
  on public.filament_events(printer_id);

create index if not exists filament_events_job_id_idx
  on public.filament_events(job_id);

create index if not exists filament_events_created_at_idx
  on public.filament_events(created_at desc);
