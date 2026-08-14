-- ============================================================
-- DOPLNOK: reálne fotky produktov + kalibrácia tlačovej zóny na fotke
-- Jedna fotka pre každú kombináciu produkt × farba × zóna (napr. Pánske tričko, Čierna, Predok).
-- Poloha/veľkosť tlačovej zóny sa ukladá v percentách rozmerov fotky, aby fungovala nezávisle
-- od toho, v akom rozlíšení sa fotka práve zobrazuje (admin editor aj konfigurátor).
-- ============================================================

create table if not exists produkt_mockupy (
    id bigint generated always as identity primary key,
    produkt_id bigint references produkty(id) on delete cascade,
    farba_id bigint references farby(id) on delete cascade,
    zona text not null check (zona in ('predok','chrbat','lavy_rukav','pravy_rukav')),
    foto_url text not null,
    zona_x_percent numeric(6,3) not null,
    zona_y_percent numeric(6,3) not null,
    zona_sirka_percent numeric(6,3) not null,
    zona_vyska_percent numeric(6,3) not null,
    created_at timestamptz default now(),
    unique (produkt_id, farba_id, zona)
);

alter table produkt_mockupy enable row level security;

create policy "verejne citanie mockupov" on produkt_mockupy for select using (true);
create policy "admin plny pristup mockupov" on produkt_mockupy for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- POZNÁMKA K STORAGE
-- Vytvor v Supabase Storage NOVÝ bucket "produkt-fotky" (VEREJNÝ — zákazník musí fotky vidieť
-- bez prihlásenia, rovnako ako pri buckete "grafiky"). Potom spusti tieto storage policies:
-- ============================================================

create policy "authenticated upload produkt fotky"
on storage.objects for insert
to authenticated
with check (bucket_id = 'produkt-fotky');

create policy "authenticated delete produkt fotky"
on storage.objects for delete
to authenticated
using (bucket_id = 'produkt-fotky');
