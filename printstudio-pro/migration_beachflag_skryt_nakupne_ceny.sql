-- ============================================================
-- Beachvlajky: ceny opracovania, prutov, podstavcov a doplnkov su odteraz NAKUPNE ceny
-- (predajna cena sa dopocita na serveri z marze a poctu kusov). Verejnost (anon kluc)
-- preto nesmie citat stlpce s cenami — odober im ich, nazvy/popisy/fotky ostavaju.
-- SPUSTIT AZ PO nasadeni novej verzie appky (Vercel) a Edge Functions — inak by stara verzia
-- konfiguratora nenacitala katalog. Admin (prihlaseny) a Edge Functions (service role) to
-- nezmeni, ostavaju s plnym pristupom. Bezpecne spustit opakovane.
-- ============================================================

revoke select on vlajka_dokoncenie from anon;
grant select (id, kod, nazov, popis, obrazok_url, poradie, aktivny) on vlajka_dokoncenie to anon;

revoke select on vlajka_stoziare from anon;
grant select (id, kod, nazov, popis, obrazok_url, poradie, aktivny) on vlajka_stoziare to anon;

revoke select on vlajka_stoziare_ceny from anon;

revoke select on vlajka_doplnky from anon;
grant select (id, kod, nazov, popis, obrazok_url, max_mnozstvo, poradie, aktivny) on vlajka_doplnky to anon;

revoke select on vlajka_podstavce_ceny from anon;
grant select (id, podstavec_id, velkost, vhodny, poznamka) on vlajka_podstavce_ceny to anon;
