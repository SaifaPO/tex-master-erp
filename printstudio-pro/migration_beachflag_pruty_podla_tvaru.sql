-- ============================================================
-- Beachvlajky: ktore PRUTY (konstrukcie) sa ponukaju pri ktorom TVARE.
-- Tabulka vlajka_stoziare_tvary: ak prut NEMA ziadny riadok, ponuka sa pri vsetkych tvaroch.
-- Ak ma riadky, ponuka sa len pri vymenovanych tvaroch (nastavuje sa v ERP: Beachvlajky ->
-- Opracovanie, pruty... -> rozbal prut -> "Ponuka sa pri tvaroch").
-- Vychodzie nastavenie: "Square Hlinik" (kod square) a "PRO Square" (kod squarepro) len pre tvar Square.
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists vlajka_stoziare_tvary (
    stoziar_id bigint not null references vlajka_stoziare(id) on delete cascade,
    tvar_id bigint not null references vlajka_tvary(id) on delete cascade,
    primary key (stoziar_id, tvar_id)
);

alter table vlajka_stoziare_tvary enable row level security;
drop policy if exists "verejne citanie prutov podla tvaru" on vlajka_stoziare_tvary;
create policy "verejne citanie prutov podla tvaru" on vlajka_stoziare_tvary for select using (true);
drop policy if exists "admin plny pristup prutov podla tvaru" on vlajka_stoziare_tvary;
create policy "admin plny pristup prutov podla tvaru" on vlajka_stoziare_tvary for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
grant select on vlajka_stoziare_tvary to anon, authenticated;
grant insert, update, delete on vlajka_stoziare_tvary to authenticated;

insert into vlajka_stoziare_tvary (stoziar_id, tvar_id)
select s.id, t.id from vlajka_stoziare s, vlajka_tvary t
where s.kod in ('square', 'squarepro') and t.kod = 'square'
on conflict do nothing;
