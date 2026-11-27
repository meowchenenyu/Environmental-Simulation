-- Initial cloud-save schema draft for the recommended Supabase backend.
-- Apply only after creating a Supabase project and reviewing the RLS policies.

create table public.islands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  cover_icon text not null default '🌴' check (char_length(cover_icon) <= 16),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  save_format_version smallint not null default 2 check (save_format_version > 0),
  save_data jsonb not null check (jsonb_typeof(save_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index islands_owner_created_idx on public.islands (owner_id, created_at desc);

alter table public.islands enable row level security;

-- Start private by default. Public reads are intentionally added only with the
-- public discovery and moderation work in stage 5.
revoke all on table public.islands from anon, authenticated;
grant select, insert, update, delete on table public.islands to authenticated;

create policy "Owners can read their islands"
  on public.islands for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their islands"
  on public.islands for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their islands"
  on public.islands for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their islands"
  on public.islands for delete to authenticated
  using ((select auth.uid()) = owner_id);
