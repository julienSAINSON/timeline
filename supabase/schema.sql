create extension if not exists pgcrypto;

create type public.timeline_item_type as enum ('period', 'milestone', 'annotation');
create type public.recurrence_type as enum ('period', 'milestone');
create type public.recurrence_frequency as enum ('day', 'week', 'month');

create table public.tl_timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  is_public boolean not null default false,
  public_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tl_recurrences (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.tl_timelines(id) on delete cascade,
  type public.recurrence_type not null,
  frequency public.recurrence_frequency not null,
  interval integer not null default 0 check (interval >= 0),
  occurrences integer not null check (occurrences between 1 and 1000),
  start_date date not null,
  duration integer check (duration > 0),
  duration_unit public.recurrence_frequency,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'milestone' and duration is null and duration_unit is null) or (type = 'period' and duration is not null and duration_unit is not null))
);

create table public.tl_timeline_items (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.tl_timelines(id) on delete cascade,
  type public.timeline_item_type not null,
  label text not null check (char_length(label) between 1 and 500),
  description text not null default '' check (char_length(description) <= 5000),
  start_date date not null,
  end_date date,
  color text not null check (color in ('blue', 'green', 'orange', 'red', 'violet', 'rose') or color ~ '^#[0-9A-Fa-f]{6}$'),
  render_mode text not null default 'bracket' check (render_mode in ('bracket', 'rectangle')),
  raci jsonb not null default '{}'::jsonb check (jsonb_typeof(raci) = 'object'),
  recurrence_id uuid references public.tl_recurrences(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'milestone' and end_date is null) or (type in ('period', 'annotation') and end_date is not null and end_date >= start_date))
);

create index tl_timelines_user_id_idx on public.tl_timelines(user_id);
create index tl_timeline_items_timeline_date_idx on public.tl_timeline_items(timeline_id, start_date);
create index tl_recurrences_timeline_id_idx on public.tl_recurrences(timeline_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tl_timelines_updated_at before update on public.tl_timelines for each row execute function public.set_updated_at();
create trigger tl_timeline_items_updated_at before update on public.tl_timeline_items for each row execute function public.set_updated_at();
create trigger tl_recurrences_updated_at before update on public.tl_recurrences for each row execute function public.set_updated_at();

alter table public.tl_timelines enable row level security;
alter table public.tl_timeline_items enable row level security;
alter table public.tl_recurrences enable row level security;

create policy "Owners manage their timelines" on public.tl_timelines for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Public timelines are readable" on public.tl_timelines for select using (is_public = true);
create policy "Owners manage their timeline items" on public.tl_timeline_items for all using (exists (select 1 from public.tl_timelines where id = timeline_id and user_id = auth.uid())) with check (exists (select 1 from public.tl_timelines where id = timeline_id and user_id = auth.uid()));
create policy "Public timeline items are readable" on public.tl_timeline_items for select using (exists (select 1 from public.tl_timelines where id = timeline_id and is_public = true));
create policy "Owners manage their recurrences" on public.tl_recurrences for all using (exists (select 1 from public.tl_timelines where id = timeline_id and user_id = auth.uid())) with check (exists (select 1 from public.tl_timelines where id = timeline_id and user_id = auth.uid()));
create policy "Public recurrences are readable" on public.tl_recurrences for select using (exists (select 1 from public.tl_timelines where id = timeline_id and is_public = true));