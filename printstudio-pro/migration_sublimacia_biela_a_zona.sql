-- ============================================================
-- DOPLNOK 1: sublimácia len na bielu farbu textilu
-- ============================================================
alter table farby add column if not exists je_biela boolean not null default false;

-- ============================================================
-- DOPLNOK 2: nová zóna potlače — štítok/golier (neck label)
-- ============================================================
alter table produkt_velkost_zony drop constraint if exists produkt_velkost_zony_zona_check;
alter table produkt_velkost_zony add constraint produkt_velkost_zony_zona_check
    check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav','stitok_golier'));

alter table objednavka_zony drop constraint if exists objednavka_zony_zona_check;
alter table objednavka_zony add constraint objednavka_zony_zona_check
    check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav','stitok_golier'));

alter table produkt_mockupy drop constraint if exists produkt_mockupy_zona_check;
alter table produkt_mockupy add constraint produkt_mockupy_zona_check
    check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav','stitok_golier'));
