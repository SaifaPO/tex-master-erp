-- ============================================================
-- DOPLNOK: rate-limit pre AI funkcie (ai-generate-motif, ai-prepare-image)
-- Zaznamenáva každé úspešné AI volanie, aby Edge Functions vedeli overiť denné limity
-- (na reláciu prehliadača, na IP adresu, aj celkový strop pre celý eshop).
-- Tabuľka nemá žiadne RLS policies — prístup len cez service role z Edge Functions,
-- nikdy priamo z prehliadača.
-- ============================================================

create table if not exists ai_pouzitie (
    id bigint generated always as identity primary key,
    ip_address text,
    session_id text,
    typ text not null check (typ in ('generate', 'prepare')),
    created_at timestamptz default now()
);

create index if not exists idx_ai_pouzitie_created on ai_pouzitie(created_at);
create index if not exists idx_ai_pouzitie_ip on ai_pouzitie(ip_address, created_at);
create index if not exists idx_ai_pouzitie_session on ai_pouzitie(session_id, created_at);

alter table ai_pouzitie enable row level security;
-- Žiadne create policy príkazy — RLS zapnuté bez policies = nikto cez anon/authenticated
-- kľúč sem nevidí ani nezapisuje. Edge Functions používajú service role, ktorý RLS obchádza.
