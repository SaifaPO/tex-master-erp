-- ============================================================
-- PODKLADY PRE MZDY — mesacne rucne udaje k zamestnancovi (odmena, zrazka, zaloha, poznamka).
-- Dochadzka sa cita z existujucej tabulky attendance_records; tu sa ukladaju len veci, ktore v dochadzke nie su.
-- Bezpecne spustit opakovane.
-- ============================================================

create table if not exists mzdy_podklady (
    id uuid primary key default gen_random_uuid(),
    mesiac text not null,                 -- 'YYYY-MM'
    employee_id text not null,            -- id zamestnanca (ako text, aby fungovalo pre uuid aj cislo)
    odmena numeric(10,2) not null default 0,
    zrazka numeric(10,2) not null default 0,
    zaloha numeric(10,2) not null default 0,
    poznamka text,
    updated_at timestamptz not null default now(),
    updated_by text,
    unique (mesiac, employee_id)
);

alter table mzdy_podklady enable row level security;
drop policy if exists "prihlaseni plny pristup mzdy_podklady" on mzdy_podklady;
create policy "prihlaseni plny pristup mzdy_podklady" on mzdy_podklady for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
