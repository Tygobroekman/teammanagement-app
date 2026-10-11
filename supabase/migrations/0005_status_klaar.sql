-- Extra status: klaar (opstelling staat, wedstrijd moet nog worden afgerond).
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check check (status in ('concept', 'klaar', 'definitief'));
