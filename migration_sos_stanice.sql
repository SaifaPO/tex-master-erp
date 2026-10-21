-- ============================================================
-- SOS tlačidlá na staniciach (šitie, kompletáž, balenie…): pracovník stlačí jedno tlačidlo (fyzické Wi-Fi tlačidlo pri stroji alebo veľké tlačidlo
-- v ERP) a v ERP vznikne žiadosť o pomoc pre grafika, ktorý zákazku robil (alebo pre supervízora, ak nie je známy). Používa existujúcu tabuľku help_requests.
-- Fyzické tlačidlo volá Edge Function sos-stanica (token tlačidla ho overuje). Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists sos_tlacidla (
    id uuid primary key default gen_random_uuid(),
    nazov text not null,                       -- napr. "Šitie – stôl 1"
    stanica text not null,                     -- grafik | strihanie | laser | sublimacia | transfer | sietotlac | sitie | balenie
    token text not null unique,                -- tajný kľúč tlačidla (vloží sa do tlačidla)
    aktivne boolean not null default true,
    posledne_stlacenie timestamptz,
    posledny_ping timestamptz,                 -- naposledy, keď sa tlačidlo ozvalo (kontrola, že žije)
    created_at timestamptz not null default now()
);
alter table sos_tlacidla enable row level security;
drop policy if exists "admin plny pristup sos tlacidla" on sos_tlacidla;
create policy "admin plny pristup sos tlacidla" on sos_tlacidla for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Žiadosti o pomoc: kto povedal „idem“, odkiaľ žiadosť prišla a čoho sa týka
alter table help_requests add column if not exists acked_at timestamptz;
alter table help_requests add column if not exists acked_by_name text;
alter table help_requests add column if not exists zdroj text;     -- tlacidlo | sos_ekran | rucne
alter table help_requests add column if not exists typ text;       -- pomoc | material | stroj | grafika
