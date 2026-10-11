-- Langdurig geblesseerde spelers staan bij nieuwe wedstrijden standaard op geblesseerd.
alter table public.players add column langdurig_geblesseerd boolean not null default false;
