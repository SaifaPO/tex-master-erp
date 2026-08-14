// Vypočíta cenu potlače pre danú technológiu — rovnaká logika, akú používa aj zákaznícky konfigurátor.
// cennik: { sublimacia:{cena_cm2,min_cena}, dtf:{cena_cm2,min_cena},
//           sietotlac:{cena_cm2,cena_cm2_tmavy,min_cena,priplatok_farba}, folie:[{id,nazov,cena_cm2}], rezanyMinCena }
export function vypocitajCenuPotlace(cennik, tech, plochaCm2, pocetFarieb, jeTmavyTextil, foliaId) {
  if (tech === 'sublimacia') {
    const c = cennik.sublimacia;
    return { cena: Math.max(plochaCm2 * c.cena_cm2, c.min_cena),
      vzorec: `max(${plochaCm2} cm² × ${c.cena_cm2} €, min. ${c.min_cena} €) — farby ani počet motívov cenu neovplyvňujú` };
  }
  if (tech === 'dtf') {
    const c = cennik.dtf;
    return { cena: Math.max(plochaCm2 * c.cena_cm2, c.min_cena),
      vzorec: `max(${plochaCm2} cm² × ${c.cena_cm2} €, min. ${c.min_cena} €) — rozhoduje len celková plocha` };
  }
  if (tech === 'sietotlac') {
    const c = cennik.sietotlac;
    const sadzba = jeTmavyTextil ? (c.cena_cm2_tmavy ?? c.cena_cm2) : c.cena_cm2;
    const zaklad = Math.max(plochaCm2 * sadzba, c.min_cena);
    const priplatok = Math.max(0, pocetFarieb - 1) * c.priplatok_farba;
    return { cena: zaklad + priplatok,
      vzorec: `max(${plochaCm2} cm² × ${sadzba} €${jeTmavyTextil ? ' (tmavý textil, 2 vrstvy)' : ' (svetlý textil)'}, min. ${c.min_cena} €) + ${Math.max(0, pocetFarieb - 1)} × ${c.priplatok_farba} € za ďalšie farby` };
  }
  if (tech === 'rezany') {
    const folia = (cennik.folie || []).find(f => f.id === foliaId) || (cennik.folie || [])[0];
    const sadzba = folia ? folia.cena_cm2 : 0;
    const cena = Math.max(plochaCm2 * sadzba * pocetFarieb, cennik.rezanyMinCena);
    return { cena, vzorec: `max(${plochaCm2} cm² × ${sadzba} €/cm² (${folia ? folia.nazov : '—'}) × ${pocetFarieb} farieb, min. ${cennik.rezanyMinCena} €)` };
  }
  return { cena: 0, vzorec: '' };
}
