-- Poradie farieb (pre drag-and-drop presuvanie kariet v admin karte Farby) — doteraz sa farby
-- radili len podla id (poradie vzniku), ziadny sposob si ich prerovnat rucne podla vlastnej logiky
-- (napr. zoskupenie podla farebnych odtienov). Zaciatocne poradie = id, aby sa poradie nezmenilo
-- oproti sucasnemu zobrazeniu, kym si to Martin prvy raz nepretriedi.
-- Spustit v Supabase SQL editore. Bezpecne spustit opakovane.

alter table farby add column if not exists poradie int;
update farby set poradie = id where poradie is null;
alter table farby alter column poradie set default 0;
alter table farby alter column poradie set not null;
