-- DTF metraz — napojenie na jednotny marzovy modul (pricing_config), namiesto vlastnych
-- rucne nastavenych cenovych hladin (dtf_cenove_hladiny). Zakaznicky konfigurator (printstudio-pro)
-- potrebuje poznat vyrobnu cenu na bezny meter, ale dtf_naklady (surove vstupy — ceny materialu)
-- su zamerne interne/neverejne (aby zakaznik/konkurencia nevidel presne nakupne ceny). Preto sa
-- vytvara VIEW, ktory vracia LEN vypocitany naklad na 1 bm (jedno cislo), nie jednotlive zlozky.
-- Postgres view bezi s pravami vlastnika (nie query-ujuceho anon usera), takze obchadza RLS na
-- dtf_naklady — presne to tu chceme (odvodena hodnota verejna, surove naklady stale skryte).
-- Bezpecne spustit opakovane.

create or replace view dtf_naklady_verejny as
select
    (
        (n.cena_folie_bm / 0.56)
        + (n.cena_lepidlo_kg * n.spotreba_lepidlo_m2)
        + (n.cena_cmyk_kg * n.spotreba_cmyk_m2)
        + (n.cena_biela_kg * n.spotreba_biela_m2)
        + (n.cena_prace_hod / nullif(n.rychlost_tlace_m_hod * 0.56, 0))
    ) * 0.56 as naklad_bm
from dtf_naklady n
where n.id = 1;

grant select on dtf_naklady_verejny to anon, authenticated;

-- Povodna tabulka dtf_cenove_hladiny (rucne zadane cenove hladiny) ostava v DB nezmenena/nezmazana —
-- appka ju uz nepouziva (nahradena vypoctom cez pricing_config), ale data si mozes kedykolvek pozriet
-- alebo tabulku neskor zmazat, az si overis, ze nova cenotvorba funguje spravne.
