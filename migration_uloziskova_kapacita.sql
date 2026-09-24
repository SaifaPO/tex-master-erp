-- Prehľad úložiska (databáza + storage buckety) pre admin kartu "Úložisko".
-- pg_database_size() vyžaduje priamy SQL prístup, ktorý klient (supabase-js) nemá — táto funkcia
-- ho sprístupní cez bezpečné RPC volanie (len číslo v bajtoch, žiadny prístup k dátam samotným).
-- Bezpečné spustiť opakovane.

create or replace function get_database_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Len pre prihlásených (admin appka) — anonymný/verejný prístup nepotrebný.
revoke all on function get_database_size() from public;
grant execute on function get_database_size() to authenticated;
