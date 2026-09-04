-- Doplnenie kategorii do cennika pre generator cenovych ponuk (quote_price_list),
-- aby karta "Cenove ponuky" mala vopred pripravene sekcie pre vlajky, beachvlajky
-- a dotlace (transfer, sietotlac, vysivka) - polozky si vie Martin dalej upravit/domazat/pridat.
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table quote_price_list add column if not exists category text not null default 'Ostatné';

-- Ceny nizsie su orientacne (placeholder), Martin si ich vie upravit priamo v zalozke Cenník.
insert into quote_price_list (id, name, description, price, sort_order, category)
values
  ('qpl-vlajka-mini', 'Reklamná vlajka Mini (teardrop, cca 250 cm)', 'Vrátane potlače, kompletu so stožiarom a základňou', 89, 1, 'Vlajky'),
  ('qpl-vlajka-medium', 'Reklamná vlajka Medium (teardrop, cca 350 cm)', 'Vrátane potlače, kompletu so stožiarom a základňou', 109, 2, 'Vlajky'),
  ('qpl-vlajka-large', 'Reklamná vlajka Large (teardrop, cca 460 cm)', 'Vrátane potlače, kompletu so stožiarom a základňou', 139, 3, 'Vlajky'),
  ('qpl-vlajka-stoziar-krizova', 'Krížová základňa k vlajke', 'Doplnok - kovová krížová základňa', 19, 4, 'Vlajky'),
  ('qpl-vlajka-stoziar-vodna', 'Vodná/plniteľná základňa k vlajke', 'Doplnok - plastová základňa plnená vodou/pieskom', 25, 5, 'Vlajky'),
  ('qpl-vlajka-obal', 'Prepravný obal k vlajke', 'Doplnok - taška na prenos a skladovanie', 12, 6, 'Vlajky'),

  ('qpl-beachflag-mini', 'Beachvlajka Mini (cca 220 cm)', 'Vrátane potlače a kompletu so stožiarom', 79, 1, 'Beachvlajky'),
  ('qpl-beachflag-medium', 'Beachvlajka Medium (cca 300 cm)', 'Vrátane potlače a kompletu so stožiarom', 99, 2, 'Beachvlajky'),
  ('qpl-beachflag-large', 'Beachvlajka Large (cca 400 cm)', 'Vrátane potlače a kompletu so stožiarom', 129, 3, 'Beachvlajky'),
  ('qpl-beachflag-obojstranna', 'Príplatok - obojstranná potlač (presvit blocker)', 'Doplnok k beachvlajke', 25, 4, 'Beachvlajky'),

  ('qpl-transfer-maly-motiv', 'DTF/transfer potlač - malý motív (do A5)', 'Cena za 1 ks potlače na odev', 5, 1, 'Dotlač - Transfer'),
  ('qpl-transfer-stredny-motiv', 'DTF/transfer potlač - stredný motív (do A4)', 'Cena za 1 ks potlače na odev', 9, 2, 'Dotlač - Transfer'),
  ('qpl-transfer-velky-motiv', 'DTF/transfer potlač - veľký motív (do A3)', 'Cena za 1 ks potlače na odev', 15, 3, 'Dotlač - Transfer'),
  ('qpl-transfer-priprava-grafiky', 'Grafická príprava/separácia motívu pre transfer', 'Jednorazový poplatok za motív', 15, 4, 'Dotlač - Transfer'),

  ('qpl-sietotlac-1farba', 'Sieťotlač - 1 farba (základná sadzba/kus, od 1 motívu)', 'Cena za 1 ks pri jednofarebnej sieťotlači', 4, 1, 'Dotlač - Sieťotlač'),
  ('qpl-sietotlac-viacfarebna', 'Sieťotlač - viacfarebný motív (za farbu navyše/kus)', 'Príplatok za každú ďalšiu farbu', 1.5, 2, 'Dotlač - Sieťotlač'),
  ('qpl-sietotlac-sablona', 'Výroba sieťotlačovej šablóny (za farbu)', 'Jednorazový poplatok za prípravu šablóny', 20, 3, 'Dotlač - Sieťotlač'),

  ('qpl-vysivka-maly-motiv', 'Výšivka - malý motív (do 5x5 cm, do 5000 stehov)', 'Cena za 1 ks výšivky na odev', 6, 1, 'Dotlač - Výšivka'),
  ('qpl-vysivka-stredny-motiv', 'Výšivka - stredný motív (do 10x10 cm)', 'Cena za 1 ks výšivky na odev', 10, 2, 'Dotlač - Výšivka'),
  ('qpl-vysivka-velky-motiv', 'Výšivka - veľký motív (nad 10x10 cm / chrbát)', 'Cena za 1 ks výšivky na odev', 16, 3, 'Dotlač - Výšivka'),
  ('qpl-vysivka-digitalizacia', 'Digitalizácia (naprogramovanie) výšivkového motívu', 'Jednorazový poplatok za nový motív', 25, 4, 'Dotlač - Výšivka')
on conflict (id) do nothing;
