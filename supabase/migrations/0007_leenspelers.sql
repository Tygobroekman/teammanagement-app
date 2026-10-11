-- Leenspelers: spelers van andere teams die bij een wedstrijd meespelen.
-- Ze horen bij een wedstrijd, staan niet in de vaste spelerslijst en niet in het seizoensoverzicht.
alter table public.players add column leenspeler boolean not null default false;
alter table public.players add column leen_match_id uuid references public.matches (id) on delete cascade;
alter table public.players add constraint players_leen_check check (leenspeler = (leen_match_id is not null));

create or replace view public.season_overview with (security_invoker = true) as
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
  and not pl.leenspeler
  and (pl.actief or a.player_id is not null)
group by m.season_id, pl.id, pl.naam;
