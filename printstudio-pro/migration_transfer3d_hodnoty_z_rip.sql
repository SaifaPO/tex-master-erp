-- ============================================================
-- 3D transfery: reálne hodnoty z RIP štatistiky (stredná úroveň 3D, 8 prechodov, job 266,7 × 248,58 mm = 0,0663 m²).
-- Zmerané: CMYK+G 0,438 ml, biela 1,130 ml, lak (V+V1) 0,793 ml → na 1 m²: CMYK 6,6 / biela 17,0 / lak 12,0 ml.
-- Čas tlače pre stredný job odhadnutý na 30 min (≈ 450 min/m²). Nízka a vysoká úroveň sú ODHAD (pomerom) — upraviť podľa merania v RIP.
-- Predpoklad: meranie je pri laku „na plno". Bezpečné spustiť opakovane; hodnoty sa dajú kedykoľvek prepísať v ERP (PrintStudio → 3D transfery).
-- ============================================================
update transfer3d_nastavenia set pokrytie_percent = 100 where id = 1;
update transfer3d_urovne set spotreba_cmyk_ml_m2 = 6.6, spotreba_biela_ml_m2 = 8.5,  spotreba_lak_ml_m2 = 6,  cas_tlace_min_m2 = 250 where kod = 'low';
update transfer3d_urovne set spotreba_cmyk_ml_m2 = 6.6, spotreba_biela_ml_m2 = 17,   spotreba_lak_ml_m2 = 12, cas_tlace_min_m2 = 450 where kod = 'medium';
update transfer3d_urovne set spotreba_cmyk_ml_m2 = 6.6, spotreba_biela_ml_m2 = 28,   spotreba_lak_ml_m2 = 20, cas_tlace_min_m2 = 750 where kod = 'high';
update transfer3d_laky set cas_nasobok = 0.85 where kod = 'none';
update transfer3d_laky set cas_nasobok = 0.95 where kod = 'partial';
update transfer3d_laky set cas_nasobok = 1.00 where kod = 'full';
