-- Rezané fólie: 3 úrovne služby (1 = len rezaná fólia, 2 = + vylúpanie, 3 = full servis: vylúpané a nastrihané) a odstránenie interných názvov v zátvorkách.
-- Nastrihanie sa účtuje samostatne: náklad = bm × minút na 1 bm × sadzba strihača, + marža. Bezpečné spustiť opakovane.
alter table folie_nastavenia add column if not exists strihanie_hod numeric(10,2) not null default 7;              -- €/hod strihača
alter table folie_nastavenia add column if not exists strihanie_min_bm_maly numeric(8,2) not null default 10;     -- minút na 1 bm pri malých motívoch
alter table folie_nastavenia add column if not exists strihanie_min_bm_velky numeric(8,2) not null default 5;     -- minút na 1 bm pri veľkých motívoch
alter table folie_nastavenia add column if not exists strihanie_marza_percent numeric(6,1) not null default 100;  -- marža na náklad nastrihania (%)

alter table folie_druhy add column if not exists interny_nazov text;   -- pôvodný názov aj so značkou/typom fólie; zákazník ho nevidí
update folie_druhy set interny_nazov = coalesce(interny_nazov, nazov), nazov = trim(regexp_replace(nazov, '\s*\([^)]*\)', '', 'g')) where nazov like '%(%';

alter table folie_objednavky add column if not exists uroven text;     -- rez | vylupanie | plny
