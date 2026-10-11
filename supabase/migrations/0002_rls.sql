-- Row Level Security: alleen captains op de whitelist hebben toegang.
-- Anonieme bezoekers krijgen niets. Niveaus en notities zijn dus alleen
-- zichtbaar voor captains.

revoke all on all tables in schema public from anon;

alter table public.captains         enable row level security;
alter table public.positions        enable row level security;
alter table public.formations       enable row level security;
alter table public.formation_slots  enable row level security;
alter table public.seasons          enable row level security;
alter table public.players          enable row level security;
alter table public.player_positions enable row level security;
alter table public.matches          enable row level security;
alter table public.attendance       enable row level security;
alter table public.lineup_slots     enable row level security;
alter table public.substitutions    enable row level security;
alter table public.audit_log        enable row level security;

-- Alleen lezen: de captains-lijst wordt via de SQL Editor beheerd, en het log
-- wordt alleen door triggers gevuld.
create policy captains_select  on public.captains  for select to authenticated using (public.is_captain());
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_captain());

-- Lezen en schrijven voor captains.
create policy captains_all on public.positions        for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.formations       for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.formation_slots  for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.seasons          for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.players          for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.player_positions for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.matches          for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.attendance       for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.lineup_slots     for all to authenticated using (public.is_captain()) with check (public.is_captain());
create policy captains_all on public.substitutions    for all to authenticated using (public.is_captain()) with check (public.is_captain());

-- Het log mag niet worden aangepast, ook niet door captains.
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.captains from authenticated;
