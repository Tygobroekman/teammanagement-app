-- Schema voor de opstelling-app (fase 1, met ruimte voor fase 2).
-- Uitvoeren in de Supabase SQL Editor (of via de Supabase CLI).

-- Captains (whitelist) ---------------------------------------------------
create table public.captains (
  email      text primary key check (email = lower(email)),
  naam       text not null,
  created_at timestamptz not null default now()
);

-- Controleert of de ingelogde gebruiker op de whitelist staat.
-- Het e-mailadres in de JWT is geverifieerd via de code/magic link.
create or replace function public.is_captain()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.captains
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_captain() from public, anon;
grant execute on function public.is_captain() to authenticated;

-- Referentiedata: posities en formaties -----------------------------------
create table public.positions (
  code     text primary key,
  naam     text not null,
  volgorde int  not null
);

create table public.formations (
  code text primary key,
  naam text not null
);

-- x en y (0 tot 100) zijn de plek op het veld; y=0 is bovenin (doel tegenstander).
create table public.formation_slots (
  formation_code text not null references public.formations (code) on delete cascade,
  slot           smallint not null check (slot between 1 and 11),
  position_code  text not null references public.positions (code),
  x              smallint not null check (x between 0 and 100),
  y              smallint not null check (y between 0 and 100),
  primary key (formation_code, slot)
);

-- Seizoenen ----------------------------------------------------------------
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null unique,
  start_datum date,
  eind_datum  date,
  created_at  timestamptz not null default now()
);

-- Spelers ------------------------------------------------------------------
create table public.players (
  id              uuid primary key default gen_random_uuid(),
  naam            text not null,
  voorkeurspositie text references public.positions (code),
  voorkeursvoet   text not null default 'rechts' check (voorkeursvoet in ('links', 'rechts', 'beide')),
  notities        text,
  actief          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Posities die een speler kan spelen, met niveau 1 (zwak) tot 5 (sterk).
create table public.player_positions (
  player_id     uuid not null references public.players (id) on delete cascade,
  position_code text not null references public.positions (code),
  niveau        smallint not null check (niveau between 1 and 5),
  primary key (player_id, position_code)
);

-- Wedstrijden --------------------------------------------------------------
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id),
  aanvang          timestamptz not null,
  tegenstander     text not null,
  thuis_uit        text not null check (thuis_uit in ('thuis', 'uit')),
  doelpunten_voor  smallint check (doelpunten_voor >= 0),
  doelpunten_tegen smallint check (doelpunten_tegen >= 0),
  status           text not null default 'concept' check (status in ('concept', 'definitief')),
  formation_code   text not null default '4-3-3' references public.formations (code),
  duur_minuten     smallint not null default 90 check (duur_minuten > 0),
  created_at       timestamptz not null default now()
);
create index matches_season_idx on public.matches (season_id, aanvang);

-- Geen rij betekent: nog niet opgegeven.
create table public.attendance (
  match_id  uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id),
  status    text not null check (status in ('aanwezig', 'afwezig', 'geblesseerd')),
  primary key (match_id, player_id)
);

-- Basisopstelling bij de aftrap (minuut 0).
-- De unieke speler-regel wordt pas bij commit gecontroleerd, zodat spelers
-- in één keer van plek kunnen wisselen.
create table public.lineup_slots (
  match_id      uuid not null references public.matches (id) on delete cascade,
  slot          smallint not null check (slot between 1 and 11),
  player_id     uuid not null references public.players (id),
  position_code text not null references public.positions (code),
  primary key (match_id, slot),
  constraint lineup_slots_unique_player unique (match_id, player_id) deferrable initially deferred
);

-- Wissels. Vrije wissels: een speler mag terugkomen.
-- De speelminuten worden hieruit berekend, dus een fout corrigeren kan altijd.
create table public.substitutions (
  id            bigint generated always as identity primary key,
  match_id      uuid not null references public.matches (id) on delete cascade,
  minuut        smallint not null check (minuut >= 0),
  player_in     uuid not null references public.players (id),
  player_out    uuid not null references public.players (id),
  slot          smallint not null check (slot between 1 and 11),
  position_code text not null references public.positions (code),
  created_at    timestamptz not null default now(),
  check (player_in <> player_out)
);
create index substitutions_match_idx on public.substitutions (match_id, minuut);

-- Wijzigingslog ------------------------------------------------------------
create table public.audit_log (
  id        bigint generated always as identity primary key,
  tijdstip  timestamptz not null default now(),
  gebruiker text,
  tabel     text not null,
  actie     text not null,
  oud       jsonb,
  nieuw     jsonb
);
create index audit_log_tijdstip_idx on public.audit_log (tijdstip desc);

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (gebruiker, tabel, actie, oud, nieuw)
  values (
    auth.jwt() ->> 'email',
    tg_table_name,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger audit_seasons          after insert or update or delete on public.seasons          for each row execute function public.log_change();
create trigger audit_players          after insert or update or delete on public.players          for each row execute function public.log_change();
create trigger audit_player_positions after insert or update or delete on public.player_positions for each row execute function public.log_change();
create trigger audit_matches          after insert or update or delete on public.matches          for each row execute function public.log_change();
create trigger audit_attendance       after insert or update or delete on public.attendance       for each row execute function public.log_change();
create trigger audit_lineup_slots     after insert or update or delete on public.lineup_slots     for each row execute function public.log_change();
create trigger audit_substitutions    after insert or update or delete on public.substitutions    for each row execute function public.log_change();

-- Speelminuten en bankminuten per wedstrijd ----------------------------------
-- Elke speler "komt erin" (+) of "gaat eruit" (-). De basisspelers komen in op
-- minuut 0. Gespeeld = som van teken * (duur - minuut). Een speler die aan het
-- eind nog op het veld staat telt zo automatisch mee tot de eindtijd.
-- Bankminuten tellen alleen voor spelers die aanwezig zijn.
create view public.match_minutes with (security_invoker = true) as
with moments as (
  select match_id, player_id, 0::smallint as minuut, 1 as sign from public.lineup_slots
  union all
  select match_id, player_in,  minuut,  1 from public.substitutions
  union all
  select match_id, player_out, minuut, -1 from public.substitutions
),
played as (
  select mo.match_id, mo.player_id,
         sum(mo.sign * (m.duur_minuten - mo.minuut))::int as minuten_gespeeld
  from moments mo
  join public.matches m on m.id = mo.match_id
  group by mo.match_id, mo.player_id
),
participants as (
  select match_id, player_id from public.attendance where status = 'aanwezig'
  union
  select match_id, player_id from played
)
select pa.match_id,
       pa.player_id,
       m.duur_minuten,
       coalesce(p.minuten_gespeeld, 0)                  as minuten_gespeeld,
       m.duur_minuten - coalesce(p.minuten_gespeeld, 0) as minuten_bank
from participants pa
join public.matches m on m.id = pa.match_id
left join played p on p.match_id = pa.match_id and p.player_id = pa.player_id;

-- Seizoensoverzicht per speler (alleen definitieve wedstrijden) ---------------
create view public.season_overview with (security_invoker = true) as
select m.season_id,
       pl.id   as player_id,
       pl.naam,
       count(distinct m.id)                                        as wedstrijden,
       count(*) filter (where a.status = 'aanwezig')               as aanwezig,
       count(*) filter (where a.status = 'afwezig')                as afwezig,
       count(*) filter (where a.status = 'geblesseerd')            as geblesseerd,
       coalesce(sum(mm.minuten_gespeeld), 0)::int                  as minuten_gespeeld,
       coalesce(sum(mm.minuten_bank), 0)::int                      as minuten_bank
from public.matches m
cross join public.players pl
left join public.attendance a   on a.match_id = m.id and a.player_id = pl.id
left join public.match_minutes mm on mm.match_id = m.id and mm.player_id = pl.id
where m.status = 'definitief'
  and (pl.actief or a.player_id is not null)
group by m.season_id, pl.id, pl.naam;
