create extension if not exists pgcrypto;

do $$ begin create type public.tl_item_type as enum ('period', 'milestone', 'annotation'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tl_recurrence_type as enum ('period', 'milestone'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tl_recurrence_frequency as enum ('day', 'week', 'month'); exception when duplicate_object then null; end $$;

create table if not exists public.tl_timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  theme text not null default 'atelier',
  is_sandbox boolean not null default false,
  is_public boolean not null default false,
  public_token uuid not null default gen_random_uuid() unique,
  template_id uuid,
  template_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_sandbox and user_id is null) or (not is_sandbox and user_id is not null))
);

alter table public.tl_timelines alter column user_id drop not null;
alter table public.tl_timelines add column if not exists is_sandbox boolean not null default false;
alter table public.tl_timelines add column if not exists theme text not null default 'atelier';
alter table public.tl_timelines drop constraint if exists tl_timelines_sandbox_owner_check;
alter table public.tl_timelines add constraint tl_timelines_sandbox_owner_check check ((is_sandbox and user_id is null) or (not is_sandbox and user_id is not null));

create table if not exists public.tl_recurrences (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.tl_timelines(id) on delete cascade,
  type public.tl_recurrence_type not null,
  frequency public.tl_recurrence_frequency not null,
  interval integer not null default 0 check (interval >= 0),
  occurrences integer not null check (occurrences between 1 and 1000),
  start_date date not null,
  duration integer check (duration > 0),
  duration_unit public.tl_recurrence_frequency,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'milestone' and duration is null and duration_unit is null) or (type = 'period' and duration is not null and duration_unit is not null))
);

create table if not exists public.tl_items (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.tl_timelines(id) on delete cascade,
  type public.tl_item_type not null,
  label text not null check (char_length(label) between 1 and 500),
  description text not null default '' check (char_length(description) <= 5000),
  link_alias text not null default '' check (char_length(link_alias) <= 200),
  link_url text not null default '' check (char_length(link_url) <= 2000),
  start_date date not null,
  end_date date,
  color text not null check (color in ('blue', 'green', 'orange', 'red', 'violet', 'rose') or color ~ '^#[0-9A-Fa-f]{6}$'),
  render_mode text not null default 'bracket' check (render_mode in ('bracket', 'rectangle')),
  recurrence_id uuid references public.tl_recurrences(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'milestone' and end_date is null) or (type in ('period', 'annotation') and end_date is not null and end_date >= start_date))
);

alter table public.tl_items add column if not exists description text not null default '' check (char_length(description) <= 5000);
alter table public.tl_items add column if not exists link_alias text not null default '' check (char_length(link_alias) <= 200);
alter table public.tl_items add column if not exists link_url text not null default '' check (char_length(link_url) <= 2000);
alter table public.tl_items add column if not exists time text not null default '' check (time ~ '^$|^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.tl_items add column if not exists render_mode text not null default 'bracket' check (render_mode in ('bracket', 'rectangle'));

create index if not exists tl_timelines_user_id_idx on public.tl_timelines(user_id);
create table if not exists public.tl_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  iteration_duration_days integer not null check (iteration_duration_days > 0),
  number_of_iterations integer not null check (number_of_iterations between 1 and 1000),
  iteration_label text not null default 'Iteration',
  iteration_color text not null default 'blue',
  iteration_render_mode text not null default 'rectangle' check (iteration_render_mode in ('bracket', 'rectangle')),
  milestones jsonb not null default '[]'::jsonb,
  periods jsonb not null default '[]'::jsonb,
  is_sandbox boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_sandbox and user_id is null) or (not is_sandbox and user_id is not null))
);
alter table public.tl_templates alter column user_id drop not null;
alter table public.tl_templates add column if not exists periods jsonb not null default '[]'::jsonb;
create index if not exists tl_templates_user_id_idx on public.tl_templates(user_id);
alter table public.tl_timelines add column if not exists template_id uuid;
alter table public.tl_timelines add column if not exists template_start_date date;
do $$ begin alter table public.tl_timelines add constraint tl_timelines_template_fk foreign key (template_id) references public.tl_templates(id) on delete set null; exception when duplicate_object then null; end $$;
create table if not exists public.tl_raci_assignments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.tl_items(id) on delete cascade,
  role text not null check (role in ('responsible', 'accountable', 'consulted', 'informed')),
  person text not null check (char_length(person) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (item_id, role, person)
);

create index if not exists tl_items_timeline_date_idx on public.tl_items(timeline_id, start_date);
create index if not exists tl_recurrences_timeline_id_idx on public.tl_recurrences(timeline_id);
create index if not exists tl_raci_assignments_item_id_idx on public.tl_raci_assignments(item_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tl_timelines_updated_at on public.tl_timelines;
drop trigger if exists tl_items_updated_at on public.tl_items;
drop trigger if exists tl_recurrences_updated_at on public.tl_recurrences;
create trigger tl_timelines_updated_at before update on public.tl_timelines for each row execute function public.set_updated_at();
create trigger tl_items_updated_at before update on public.tl_items for each row execute function public.set_updated_at();
create trigger tl_recurrences_updated_at before update on public.tl_recurrences for each row execute function public.set_updated_at();
drop trigger if exists tl_templates_updated_at on public.tl_templates;
create trigger tl_templates_updated_at before update on public.tl_templates for each row execute function public.set_updated_at();

alter table public.tl_timelines enable row level security;
alter table public.tl_items enable row level security;
alter table public.tl_raci_assignments enable row level security;
alter table public.tl_recurrences enable row level security;
alter table public.tl_templates enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tl_timelines to anon, authenticated;
grant select, insert, update, delete on public.tl_items to anon, authenticated;
grant select, insert, update, delete on public.tl_raci_assignments to anon, authenticated;
grant select, insert, update, delete on public.tl_recurrences to anon, authenticated;
grant select, insert, update, delete on public.tl_templates to anon, authenticated;

drop policy if exists "Owners manage their timelines" on public.tl_timelines;
drop policy if exists "Sandbox timelines are shared" on public.tl_timelines;
drop policy if exists "Public timelines are readable" on public.tl_timelines;
drop policy if exists "Owners manage their timeline items" on public.tl_items;
drop policy if exists "Sandbox timeline items are shared" on public.tl_items;
drop policy if exists "Public timeline items are readable" on public.tl_items;
drop policy if exists "Owners manage their RACI assignments" on public.tl_raci_assignments;
drop policy if exists "Sandbox RACI assignments are shared" on public.tl_raci_assignments;
drop policy if exists "Public RACI assignments are readable" on public.tl_raci_assignments;
drop policy if exists "Owners manage their recurrences" on public.tl_recurrences;
drop policy if exists "Sandbox recurrences are shared" on public.tl_recurrences;
drop policy if exists "Public recurrences are readable" on public.tl_recurrences;
drop policy if exists "Owners manage their templates" on public.tl_templates;
drop policy if exists "Sandbox templates are shared" on public.tl_templates;

create policy "Owners manage their timelines" on public.tl_timelines for all using (not is_sandbox and user_id = auth.uid()) with check (not is_sandbox and user_id = auth.uid());
create policy "Sandbox timelines are shared" on public.tl_timelines for all using (is_sandbox) with check (is_sandbox and user_id is null);
create policy "Public timelines are readable" on public.tl_timelines for select using (is_public);
create policy "Owners manage their timeline items" on public.tl_items for all using (exists (select 1 from public.tl_timelines where id = timeline_id and not is_sandbox and user_id = auth.uid())) with check (exists (select 1 from public.tl_timelines where id = timeline_id and not is_sandbox and user_id = auth.uid()));
create policy "Sandbox timeline items are shared" on public.tl_items for all using (exists (select 1 from public.tl_timelines where id = timeline_id and is_sandbox)) with check (exists (select 1 from public.tl_timelines where id = timeline_id and is_sandbox));
create policy "Public timeline items are readable" on public.tl_items for select using (exists (select 1 from public.tl_timelines where id = timeline_id and is_public));
create policy "Owners manage their RACI assignments" on public.tl_raci_assignments for all using (exists (select 1 from public.tl_items join public.tl_timelines on tl_timelines.id = tl_items.timeline_id where tl_items.id = item_id and not tl_timelines.is_sandbox and tl_timelines.user_id = auth.uid())) with check (exists (select 1 from public.tl_items join public.tl_timelines on tl_timelines.id = tl_items.timeline_id where tl_items.id = item_id and not tl_timelines.is_sandbox and tl_timelines.user_id = auth.uid()));
create policy "Sandbox RACI assignments are shared" on public.tl_raci_assignments for all using (exists (select 1 from public.tl_items join public.tl_timelines on tl_timelines.id = tl_items.timeline_id where tl_items.id = item_id and tl_timelines.is_sandbox)) with check (exists (select 1 from public.tl_items join public.tl_timelines on tl_timelines.id = tl_items.timeline_id where tl_items.id = item_id and tl_timelines.is_sandbox));
create policy "Public RACI assignments are readable" on public.tl_raci_assignments for select using (exists (select 1 from public.tl_items join public.tl_timelines on tl_timelines.id = tl_items.timeline_id where tl_items.id = item_id and tl_timelines.is_public));
create policy "Owners manage their recurrences" on public.tl_recurrences for all using (exists (select 1 from public.tl_timelines where id = timeline_id and not is_sandbox and user_id = auth.uid())) with check (exists (select 1 from public.tl_timelines where id = timeline_id and not is_sandbox and user_id = auth.uid()));
create policy "Sandbox recurrences are shared" on public.tl_recurrences for all using (exists (select 1 from public.tl_timelines where id = timeline_id and is_sandbox)) with check (exists (select 1 from public.tl_timelines where id = timeline_id and is_sandbox));
create policy "Public recurrences are readable" on public.tl_recurrences for select using (exists (select 1 from public.tl_timelines where id = timeline_id and is_public));
create policy "Owners manage their templates" on public.tl_templates for all using (not is_sandbox and user_id = auth.uid()) with check (not is_sandbox and user_id = auth.uid());
create policy "Sandbox templates are shared" on public.tl_templates for all using (is_sandbox) with check (is_sandbox and user_id is null);
