-- Šiltovka v Potlači textilu (?typ=potlac): 4 pohľady (spredu, zľava, sprava, zozadu) + 4 miesta potlače.
-- Aditívne: nové stĺpce pre fotky bokov, nové umiestnenia (len pre šiltovku) a zapnutie produktu `siltovka`.
alter table public.potlac_produkty add column if not exists foto_lavy_url text;
alter table public.potlac_produkty add column if not exists foto_pravy_url text;

insert into public.sietotlac_umiestnenia (kod, nazov, popis, strana, max_sirka_cm, max_vyska_cm, vychodzia_sirka_cm, vychodzia_vyska_cm, aktivny, poradie) values
  ('siltovka_celo',       'Šiltovka — čelo',       'Logo alebo nápis na prednom paneli šiltovky', 'predok', 11, 6, 8, 4.5, true, 20),
  ('siltovka_bok_lavy',   'Šiltovka — ľavý bok',   'Malé logo alebo nápis na ľavom boku',          'lavy',   7, 5, 5, 3.5, true, 21),
  ('siltovka_bok_pravy',  'Šiltovka — pravý bok',  'Malé logo alebo nápis na pravom boku',         'pravy',  7, 5, 5, 3.5, true, 22),
  ('siltovka_zadok',      'Šiltovka — zadná časť', 'Nápis alebo logo vzadu nad pásikom',           'zadok',  8, 3, 6, 2.2, true, 23)
on conflict (kod) do nothing;

update public.potlac_produkty set
  nazov = 'Šiltovka',
  popis = '5-panelová šiltovka so zahnutým šiltom a nastaviteľným pásikom vzadu. FIKTÍVNA CENA — nahraď skutočnou.',
  foto_predok_url = '/produkty/siltovka-biela-predok.png',
  foto_zadok_url  = '/produkty/siltovka-biela-zadok.png',
  foto_lavy_url   = '/produkty/siltovka-biela-lavy.png',
  foto_pravy_url  = '/produkty/siltovka-biela-pravy.png',
  foto_sirka_cm   = 28,
  technologie     = array['dtf', 'rezany'],
  pozicie = jsonb_build_object(
    'siltovka_celo',      jsonb_build_object('predok', jsonb_build_object('x', 0.5009, 'y', 0.3744, 'rot', 0, 'kotva', 'stred')),
    'siltovka_bok_lavy',  jsonb_build_object('lavy',   jsonb_build_object('x', 0.6906, 'y', 0.5215, 'rot', 0, 'kotva', 'stred')),
    'siltovka_bok_pravy', jsonb_build_object('pravy',  jsonb_build_object('x', 0.3094, 'y', 0.5215, 'rot', 0, 'kotva', 'stred')),
    'siltovka_zadok',     jsonb_build_object('zadok',  jsonb_build_object('x', 0.4999, 'y', 0.4337, 'rot', 0, 'kotva', 'stred'))
  )
where kod = 'siltovka';
-- Zapnutie produktu (až po nasadení appky s fotkami): update public.potlac_produkty set aktivny = true where kod = 'siltovka';
