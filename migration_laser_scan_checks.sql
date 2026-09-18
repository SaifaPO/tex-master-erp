-- ============================================================
-- MIGRÁCIA: Automatická fotokontrola z kamery pri laseri
-- Kamera pri laseri (samostatný Python skript v priečinku laser-qr-watcher/,
-- bežiaci na počítači, ktorý ovláda laser) rozpozná QR kód položky
-- (rovnaký kód, aký sa tlačí na sprievodnom liste — pozri QRCodeSVG
-- s "?scan=" v App.jsx), počká kým sa látka zastaví, urobí niekoľko
-- fotiek a uloží ich sem — aby si ich grafik/majster mohol pozrieť
-- a odklikať ako skontrolované, bez toho, aby čokoľvek musel fotiť ručne.
-- Spustiť v Supabase SQL editore. Bezpečné spustiť opakovane.
-- ============================================================

create table if not exists laser_scan_checks (
    id uuid primary key default gen_random_uuid(),
    item_id text not null,
    photos jsonb not null default '[]'::jsonb,
    captured_at timestamptz not null default now(),
    status text not null default 'pending',
    reviewed_by text,
    reviewed_at timestamptz,
    notes text
);
create index if not exists laser_scan_checks_item_id_idx on laser_scan_checks (item_id);
create index if not exists laser_scan_checks_status_idx on laser_scan_checks (status);

alter table laser_scan_checks enable row level security;

-- ERP appka (prihlásení zamestnanci) potrebuje vedieť záznamy čítať a označiť ako skontrolované.
-- Skript pri laseri pristupuje cez service_role kľúč, ktorý RLS obchádza, takže preň netreba policy.
drop policy if exists "authenticated_all_laser_scan_checks" on laser_scan_checks;
create policy "authenticated_all_laser_scan_checks" on laser_scan_checks
    for all to authenticated using (true) with check (true);
