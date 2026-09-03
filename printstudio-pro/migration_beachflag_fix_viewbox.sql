-- ============================================================
-- OPRAVA: pôvodná migrácia omylom vložila rovnaký viewbox ('0 0 210 430')
-- pre všetky veľkosti každého tvaru. Tento skript opraví už vložené riadky
-- na správne hodnoty per tvar × veľkosť. Bezpečné spustiť viackrát.
-- ============================================================
update vlajka_tvar_rozmery r
set viewbox = v.viewbox
from vlajka_tvary t
join (values
    ('pierko','S','0 0 190 400'), ('pierko','M','0 0 200 420'), ('pierko','L','0 0 205 425'), ('pierko','XL','0 0 210 430'),
    ('kvapka','S','0 0 210 420'), ('kvapka','M','0 0 215 425'), ('kvapka','L','0 0 220 430'), ('kvapka','XL','0 0 225 432'),
    ('cepel','S','0 0 180 420'), ('cepel','M','0 0 190 425'), ('cepel','L','0 0 195 430'), ('cepel','XL','0 0 200 435'),
    ('kridlo','S','0 0 190 420'), ('kridlo','M','0 0 200 425'), ('kridlo','L','0 0 205 430'), ('kridlo','XL','0 0 210 435')
) as v(tvar_kod, velkost, viewbox) on v.tvar_kod = t.kod
where r.tvar_id = t.id and r.velkost = v.velkost;
