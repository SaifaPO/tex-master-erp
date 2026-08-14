// Cena potlače — rovnaká logika ako v Master Admin karte "Cenník potlače" (src/printstudio/cenotvorba.js v tex-master-erp).
// cennik: { sublimacia:{cena_cm2,min_cena}, dtf:{cena_cm2,min_cena},
//           sietotlac:{cena_cm2,cena_cm2_tmavy,min_cena,priplatok_farba}, folie:[{id,nazov,cena_cm2}], rezanyMinCena }
export function vypocitajCenuPotlace(cennik, tech, plochaCm2, pocetFarieb, jeTmavyTextil, foliaId) {
  if (!cennik || plochaCm2 <= 0) return 0;
  if (tech === 'sublimacia') return Math.max(plochaCm2 * cennik.sublimacia.cena_cm2, cennik.sublimacia.min_cena);
  if (tech === 'dtf') return Math.max(plochaCm2 * cennik.dtf.cena_cm2, cennik.dtf.min_cena);
  if (tech === 'sietotlac') {
    const sadzba = jeTmavyTextil ? (cennik.sietotlac.cena_cm2_tmavy ?? cennik.sietotlac.cena_cm2) : cennik.sietotlac.cena_cm2;
    const zaklad = Math.max(plochaCm2 * sadzba, cennik.sietotlac.min_cena);
    return zaklad + Math.max(0, pocetFarieb - 1) * cennik.sietotlac.priplatok_farba;
  }
  if (tech === 'rezany') {
    const folia = (cennik.folie || []).find(f => f.id === foliaId) || (cennik.folie || [])[0];
    const sadzba = folia ? folia.cena_cm2 : 0;
    return Math.max(plochaCm2 * sadzba * pocetFarieb, cennik.rezanyMinCena);
  }
  return 0;
}

export async function nacitajCennik(supabase) {
  const [{ data: tech }, { data: sieto }, { data: fol }, { data: rez }] = await Promise.all([
    supabase.from('cennik_technologie').select('*'),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_folie').select('*').order('id'),
    supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
  ]);
  const subRow = (tech || []).find(t => t.technologia === 'sublimacia') || { cena_cm2: 0, min_cena: 0 };
  const dtfRow = (tech || []).find(t => t.technologia === 'dtf') || { cena_cm2: 0, min_cena: 0 };
  return {
    sublimacia: { cena_cm2: subRow.cena_cm2, min_cena: subRow.min_cena },
    dtf: { cena_cm2: dtfRow.cena_cm2, min_cena: dtfRow.min_cena },
    sietotlac: sieto ? { cena_cm2: sieto.cena_cm2, cena_cm2_tmavy: sieto.cena_cm2_tmavy, min_cena: sieto.min_cena, priplatok_farba: sieto.priplatok_farba } : { cena_cm2: 0, cena_cm2_tmavy: 0, min_cena: 0, priplatok_farba: 0 },
    folie: fol || [],
    rezanyMinCena: rez ? rez.min_cena : 0,
  };
}
