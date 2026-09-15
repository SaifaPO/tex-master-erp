// Zdielane vypocty vyrobnej ceny (VC) pre vsetky "Potlace" technologie — JEDINY zdroj pravdy,
// pouzivany aj z PotlaceTab.jsx (Kostra cien -> Potlace, zivy eshop konfigurator) aj z
// CenovePonukyTab.jsx (rucne cenove ponuky pre klientov). Predtym mala kazda z tychto dvoch
// appiek VLASTNU kopiu podobnych vzorcov (alebo ziadnu), co uz viackrat sposobilo nezhodu cien
// (napr. DTF folia, sietotlac marza) — tento modul to rieši raz a navzdy.
import { mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// Jeden spolocny fetch vsetkych Kostra cien tabuliek + pricing_config.
export async function nacitajKostru(supabase) {
  const [{ data: tSub }, { data: sGarment }, { data: dtfNak }, { data: sieto }, { data: sietoVel }, { data: rez }, { data: fol }, { data: vysNak }, { data: cfg }] = await Promise.all([
    supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
    supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
    supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
    supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_folie').select('*').order('id'),
    supabase.from('kostra_vysivka').select('*').eq('id', 1).maybeSingle(),
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
  ]);
  return {
    textilSub: tSub || null,
    sublimaciaGarment: sGarment || null,
    dtf: dtfNak || null,
    sietotlac: sieto || null,
    sietotlacVelkosti: sietoVel || [],
    rezany: rez || null,
    folie: fol || [],
    vysivkaNaklady: vysNak || null,
    pricingConfig: cfg ? mapConfigFromDb(cfg) : DEFAULT_PRICING_CONFIG,
  };
}

// Sublimacia — potlac na tricka. Papier sa reze z 160cm rolky podla plochy motivu.
export function vcSublimaciaGarment(kostra, plochaCm2) {
  const { textilSub, sublimaciaGarment } = kostra;
  if (!textilSub || !sublimaciaGarment) return 0;
  const cenaPapierCm2 = ((parseFloat(textilSub.cena_papier_bm) || 0) / 160) / 100;
  const cenaAtramentCm2 = (((parseFloat(textilSub.cena_atrament_l) || 0) / 1000) * (parseFloat(textilSub.spotreba_atrament_ml_m2) || 0)) / 10000;
  const praca = ((parseFloat(sublimaciaGarment.cas_nazehlovania_min) || 0) / 60) * (parseFloat(textilSub.cena_prace_hod) || 0);
  const zaklad = plochaCm2 * (cenaPapierCm2 + cenaAtramentCm2) + (parseFloat(sublimaciaGarment.naklady_manipulacia) || 0) + (parseFloat(sublimaciaGarment.naklady_ochranny_papier) || 0) + praca;
  return zaklad * (1 + (parseFloat(sublimaciaGarment.koeficient_rizika_percent) || 0) / 100);
}

// DTF — potlac textilu.
export function vcDtfGarment(kostra, plochaCm2) {
  const n = kostra.dtf;
  if (!n) return 0;
  const plochaM2 = plochaCm2 / 10000;
  const material = plochaM2 * (
    (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
    (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
    (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0)
  );
  const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
  return material + (parseFloat(n.naklady_manipulacia) || 0) + praca;
}

// Vysivka — digitalizacia rozpocitana na pocet kusov + cena od vysivaca na plochu.
export function vcVysivka(kostra, plochaCm2, ks) {
  const n = kostra.vysivkaNaklady;
  if (!n) return 0;
  return (parseFloat(n.cena_digitalizacia) || 0) / Math.max(1, ks || 1) + (parseFloat(n.cena_vysivky_cm2) || 0) * plochaCm2;
}

// Sietotlac — naklad za 1 konkretnu farbu (n-tu v poradi): kazda dalsia farba = dalsie sito +
// farba so spotrebou klesajucou o 20% oproti predchadzajucej.
export function nakladFarbySietotlac(kostra, velkostId, jeTmavy, n) {
  const sietotlac = kostra.sietotlac;
  const velkost = (kostra.sietotlacVelkosti || []).find(v => v.id === velkostId);
  const baseGramaz = velkost ? (parseFloat(jeTmavy ? velkost.spotreba_g_tmavy : velkost.spotreba_g_svetly) || 0) : 0;
  const gramazN = baseGramaz * Math.pow(0.8, n - 1);
  const farbaCena = ((parseFloat(sietotlac?.cena_farba_kg) || 0) / 1000) * gramazN;
  const sitoCena = parseFloat(sietotlac?.naklad_sito_zakazka) || 0;
  return { n, gramaz: gramazN, farbaCena, sitoCena, spolu: farbaCena + sitoCena };
}
// Rozpad nakladov po vsetkych farbach zakazky (na zobrazenie/kontrolu).
export function vcSietotlacRozpad(kostra, velkostId, jeTmavy, pocetFarieb) {
  const n = Math.max(1, pocetFarieb || 1);
  return Array.from({ length: n }, (_, i) => nakladFarbySietotlac(kostra, velkostId, jeTmavy, i + 1));
}
// Celkova VC za CELU zakazku (vsetky farby + manipulacia/cistenie raz).
export function vcSietotlacCelkom(kostra, velkostId, jeTmavy, pocetFarieb) {
  const sietotlac = kostra.sietotlac;
  const rozpad = vcSietotlacRozpad(kostra, velkostId, jeTmavy, pocetFarieb);
  return rozpad.reduce((s, r) => s + r.spolu, 0) + (parseFloat(sietotlac?.naklady_manipulacia) || 0) + (parseFloat(sietotlac?.naklad_cistenie_zakazka) || 0);
}
// VC len za 1. farbu (zakladna predajna sadzba, bez dalsich farieb — tie sa predavaju cez priplatok).
export function vcSietotlacZaklad(kostra, velkostId, jeTmavy) {
  const sietotlac = kostra.sietotlac;
  const prva = nakladFarbySietotlac(kostra, velkostId, jeTmavy, 1);
  return prva.spolu + (parseFloat(sietotlac?.naklady_manipulacia) || 0) + (parseFloat(sietotlac?.naklad_cistenie_zakazka) || 0);
}
export function plochaFormatuSietotlac(kostra, velkostId) {
  const velkost = (kostra.sietotlacVelkosti || []).find(v => v.id === velkostId);
  return velkost ? (parseFloat(velkost.sirka_cm) || 0) * (parseFloat(velkost.vyska_cm) || 0) : 0;
}

// Rezany transfer — naklad materialu je per-folia (€/bm prepocitane cez efektivnu sirku rolky),
// cas rezania/vylupovania zavisi od plochy motivu, nazehlovanie a manipulacia su fixne na kus.
export function vcRezanyTransfer(kostra, foliaId, plochaCm2) {
  const rezany = kostra.rezany;
  const folia = (kostra.folie || []).find(f => f.id === foliaId);
  const sirkaVyuz = parseFloat(rezany?.sirka_vyuzitelna_cm) || 49;
  const naklad_cm2 = folia ? (((parseFloat(folia.naklad_bm) || 0) / sirkaVyuz) / 100) : 0;
  const material = plochaCm2 * naklad_cm2;
  const pracaCm2 = ((parseFloat(rezany?.cas_rezania_min) || 0) + (parseFloat(rezany?.cas_vylupovania_min) || 0)) / 60 * (parseFloat(rezany?.cena_prace_hod) || 0) * plochaCm2;
  const pracaFlat = ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60) * (parseFloat(rezany?.cena_prace_hod) || 0);
  return material + (parseFloat(rezany?.naklady_manipulacia) || 0) + pracaFlat + pracaCm2;
}
