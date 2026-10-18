-- Buffky: cena sa berie CELA z vyrobnej ceny produktu v Katalogu produktov (cez blank v PrintStudio -> Produkty (Blanks)).
-- Vyrobna cena produktu v katalogu uz zahrna material, potlac aj sitie, preto sa zvlast uz nepripocitava sublimacna potlac
-- ani cena sitia bocneho svu (naklad_potlac_ks a cena_sitia_bok_ks su teraz 0). Ak Basic nema vybrany blank, pouzije sa zalozny
-- vypocet (rucna cena + potlac z Kostry cien), aby cena nikdy nebola 0. Premium: naklad = vyrobna cena blanku zvoleneho materialu.
-- Edge Function buffky-create-draft-order ani Buffky.jsx sa NEMENIA — oba citaju len tieto pohlady. Bezpecne spustit opakovane.

drop view if exists buffky_naklady_verejny;
create view buffky_naklady_verejny as
select
  round(coalesce(p.zakladna_cena, b.cena_buffka_ks + coalesce(t.naklad_bm, 0) / 5)::numeric, 2) as naklad_ks,
  0::numeric as naklad_potlac_ks,
  0::numeric as cena_sitia_bok_ks
from buffky_naklady b
left join produkty p on p.id = b.produkt_id
left join textil_naklady_verejny t on t.technologia = 'sublimacia'
where b.id = 1;
grant select on buffky_naklady_verejny to anon, authenticated;
