-- Referentiedata: posities en formaties. Uitbreiden kan later met extra inserts.

insert into public.positions (code, naam, volgorde) values
  ('GK',  'Keeper',                     1),
  ('RB',  'Rechtsback',                 2),
  ('CB',  'Centrale verdediger',        3),
  ('LB',  'Linksback',                  4),
  ('CDM', 'Verdedigende middenvelder',  5),
  ('CM',  'Centrale middenvelder',      6),
  ('CAM', 'Aanvallende middenvelder',   7),
  ('RM',  'Rechtermiddenvelder',        8),
  ('LM',  'Linkermiddenvelder',         9),
  ('RW',  'Rechtsbuiten',              10),
  ('LW',  'Linksbuiten',               11),
  ('ST',  'Spits',                     12);

insert into public.formations (code, naam) values
  ('4-3-3', '4-3-3'),
  ('4-4-2', '4-4-2'),
  ('3-5-2', '3-5-2');

insert into public.formation_slots (formation_code, slot, position_code, x, y) values
  ('4-3-3',  1, 'GK', 50, 92),
  ('4-3-3',  2, 'RB', 85, 72),
  ('4-3-3',  3, 'CB', 62, 76),
  ('4-3-3',  4, 'CB', 38, 76),
  ('4-3-3',  5, 'LB', 15, 72),
  ('4-3-3',  6, 'CM', 75, 52),
  ('4-3-3',  7, 'CM', 50, 56),
  ('4-3-3',  8, 'CM', 25, 52),
  ('4-3-3',  9, 'RW', 85, 24),
  ('4-3-3', 10, 'ST', 50, 18),
  ('4-3-3', 11, 'LW', 15, 24),

  ('4-4-2',  1, 'GK', 50, 92),
  ('4-4-2',  2, 'RB', 85, 72),
  ('4-4-2',  3, 'CB', 62, 76),
  ('4-4-2',  4, 'CB', 38, 76),
  ('4-4-2',  5, 'LB', 15, 72),
  ('4-4-2',  6, 'RM', 85, 48),
  ('4-4-2',  7, 'CM', 62, 54),
  ('4-4-2',  8, 'CM', 38, 54),
  ('4-4-2',  9, 'LM', 15, 48),
  ('4-4-2', 10, 'ST', 62, 20),
  ('4-4-2', 11, 'ST', 38, 20),

  ('3-5-2',  1, 'GK', 50, 92),
  ('3-5-2',  2, 'CB', 75, 76),
  ('3-5-2',  3, 'CB', 50, 78),
  ('3-5-2',  4, 'CB', 25, 76),
  ('3-5-2',  5, 'RM', 90, 50),
  ('3-5-2',  6, 'CM', 68, 54),
  ('3-5-2',  7, 'CM', 50, 58),
  ('3-5-2',  8, 'CM', 32, 54),
  ('3-5-2',  9, 'LM', 10, 50),
  ('3-5-2', 10, 'ST', 62, 20),
  ('3-5-2', 11, 'ST', 38, 20);
