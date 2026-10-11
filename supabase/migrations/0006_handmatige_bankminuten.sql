-- Voor oude wedstrijden zonder opstelling en wissels: bankminuten rechtstreeks opslaan.
-- Is dit veld gevuld, dan gaat het voor op de berekening uit opstelling en wissels.
alter table public.attendance add column if not exists minuten_bank smallint check (minuten_bank >= 0);

create or replace view public.match_minutes with (security_invoker = true) as
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
       (case when a.minuten_bank is not null then m.duur_minuten - a.minuten_bank
             else coalesce(p.minuten_gespeeld, 0) end)::int as minuten_gespeeld,
       (case when a.minuten_bank is not null then a.minuten_bank
             else m.duur_minuten - coalesce(p.minuten_gespeeld, 0) end)::int as minuten_bank
from participants pa
join public.matches m on m.id = pa.match_id
left join played p on p.match_id = pa.match_id and p.player_id = pa.player_id
left join public.attendance a on a.match_id = pa.match_id and a.player_id = pa.player_id;
