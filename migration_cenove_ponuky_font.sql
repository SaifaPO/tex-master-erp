-- Cenove ponuky: vyber pisma pre nazov firmy v hlavicke ponuky (napr. Bebas Neue).
-- Bezpecne spustit opakovane (idempotentne), nic nemaze existujuce data.

alter table quote_companies add column if not exists heading_font text not null default 'default';
