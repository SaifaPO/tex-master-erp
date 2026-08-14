-- ============================================================
-- DOPLNOK: viacero podporovaných technológií potlače na produkt
-- Pôvodná migrácia počítala s JEDNOU technológiou na produkt (stĺpec produkty.technologia).
-- Tento stĺpec necháme (nesie "predvolenú" technológiu, DB constraint ju vyžaduje),
-- ale pridávame tabuľku, ktorá umožní produktu podporovať viacero technológií naraz —
-- zákazník si v konfigurátore vyberie, ktorú z nich chce použiť.
-- ============================================================

create table if not exists produkt_technologie (
    produkt_id bigint references produkty(id) on delete cascade,
    technologia text not null check (technologia in ('sublimacia','dtf','sietotlac','rezany')),
    primary key (produkt_id, technologia)
);

alter table produkt_technologie enable row level security;

create policy "verejne citanie produkt_technologie" on produkt_technologie for select using (true);
create policy "admin plny pristup produkt_technologie" on produkt_technologie for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Migrácia existujúcich produktov: doplň im ich doterajšiu (jedinú) technológiu do novej tabuľky,
-- aby žiadny existujúci produkt neostal bez podporovanej technológie.
insert into produkt_technologie (produkt_id, technologia)
select id, technologia from produkty
on conflict do nothing;
