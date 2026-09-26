-- Vlajky (Zastava) — napojenie nakladovych sadzieb na realne zdroje (namiesto len rucne
-- zadaneho cisla), s "refresh" tlacidlom na prepocitanie, presne ako uz funguje pri materialoch
-- (VlajkaMaterialyTab/ZastavaMaterialyTab). Samotne polia naklad_sitia_min/naklad_laser_m2/
-- naklad_ocko_ks/naklad_karabinka_ks/naklad_popruh_bm OSTAVAJU (Edge Function ich cita bezo
-- zmeny) — pridavaju sa len odkazy NA ZDROJ, z ktoreho sa da hodnota kedykolvek znovu natiahnut:
--   naklad_sitia_min  <- pricing_config.cena_minuty_sitia (Cenotvorba, jednotna sadzba sitia)
--   naklad_laser_m2   <- Kostra cien -> Laserove rezanie (VC pre zvolenu hrubku pri ploche 1m²)
--   naklad_ocko_ks / naklad_karabinka_ks / naklad_popruh_bm <- Sklad (materialy na ks/bm)
-- Tunel/rukav (naklad_tunel_bm) ostava len rucny — realny zdroj (cas sitia tunela) zatial nemame.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table zastava_nastavenia add column if not exists laser_hrubka_id bigint references cennik_laser_hrubky(id) on delete set null;
alter table zastava_nastavenia add column if not exists ocko_sklad_id text references materials(id) on delete set null;
alter table zastava_nastavenia add column if not exists karabinka_sklad_id text references materials(id) on delete set null;
alter table zastava_nastavenia add column if not exists popruh_sklad_id text references materials(id) on delete set null;
