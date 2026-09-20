-- Vlastné (nahrané) vzory pre 3D konfigurátor dresov — admin nahrá hotový dizajn ako 3
-- samostatné PNG vrstvy s priehľadnosťou (základ / vzor / akcent, každá voliteľná), zákazník
-- si ho vyberie v konfigurátore a naďalej mu fungujú farebné políčka (každá vrstva sa vyfarbí
-- zvolenou farbou z FarbyZonyTab, presne ako pri vstavaných vzoroch). Obrázky sa nahrávajú do
-- existujúceho Storage bucketu "grafiky" (rovnaký, aký už používa GrafikyTab.jsx) pod cestou
-- "dres-vzory/...". Bezpečné spustiť opakovane (idempotentné).

create table if not exists dres_vlastne_vzory (
    id bigint generated always as identity primary key,
    nazov text not null,
    zaklad_url text,
    vzor_url text,
    akcent_url text,
    aktivny boolean not null default true,
    created_at timestamptz default now()
);

alter table dres_vlastne_vzory enable row level security;

drop policy if exists "verejne citanie vlastnych vzorov dresu" on dres_vlastne_vzory;
create policy "verejne citanie vlastnych vzorov dresu" on dres_vlastne_vzory for select using (aktivny = true);

drop policy if exists "admin plny pristup vlastne vzory dresu" on dres_vlastne_vzory;
create policy "admin plny pristup vlastne vzory dresu" on dres_vlastne_vzory for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
