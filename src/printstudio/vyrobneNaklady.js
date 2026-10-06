// Zdielane vypocty vyrobnej ceny (VC) pre vsetky "Potlace" technologie — JEDINY zdroj pravdy,
// pouzivany aj z PotlaceTab.jsx (Kostra cien -> Potlace, zivy eshop konfigurator) aj z
// CenovePonukyTab.jsx (rucne cenove ponuky pre klientov). Predtym mala kazda z tychto dvoch
// appiek VLASTNU kopiu podobnych vzorcov (alebo ziadnu), co uz viackrat sposobilo nezhodu cien
// (napr. DTF folia, sietotlac marza) — tento modul to rieši raz a navzdy.
import { mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// Jeden spolocny fetch vsetkych Kostra cien tabuliek + pricing_config.
export async function nacitajKostru(supabase) {
  const [{ data: tSub }, { data: sGarment }, { data: dtfNak }, { data: sieto }, { data: sietoVel }, { data: rez }, { data: fol }, { data: vysNak }, { data: cfg }, { data: metriky }, { data: tech }, { data: laser }, { data: laserHrub }] = await Promise.all([
    supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
    supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
    supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
    supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_folie').select('*').order('id'),
    supabase.from('kostra_vysivka').select('*').eq('id', 1).maybeSingle(),
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cost_metrics').select('*'),
    supabase.from('cennik_technologie').select('*'),
    supabase.from('cennik_laser_rezanie').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_laser_hrubky').select('*').order('poradie'),
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
    costMetrics: metriky || [],
    laserRezanie: laser || null,
    laserHrubky: laserHrub || [],
    // Predajne "min. cena ukonu" sadzby (Potlace) — sublimacia/dtf su v cennik_technologie,
    // sietotlac/rezany maju vlastne min_cena polia priamo vo svojich tabulkach vyssie.
    minCenaSublimacia: (tech || []).find(t => t.technologia === 'sublimacia')?.min_cena ?? 0,
    minCenaDtf: (tech || []).find(t => t.technologia === 'dtf')?.min_cena ?? 0,
    minCenaVysivka: (tech || []).find(t => t.technologia === 'vysivka')?.min_cena ?? 0,
  };
}

// Minimalna cena ukonu (nastavena v Potlaciach) pre danu technologiu — pouzit vzdy AZ NA cenu
// vratenu z priceAt(), nie na VC. Bez tohto floor-u vychadzala cena pri lacnych materialoch
// (napr. sublimacia/DTF s nizkou spotrebou atramentu) niekedy absurdne nizko aj pri malom odbere,
// lebo marzova krivka pocita len percenta z VC a pri VC pod ~0.5€ ostava aj pri vysokom % v
// absolutnych eurach stale len pár centov.
export function minCenaPotlace(kostra, tech) {
  if (tech === 'sublimacia') return Number(kostra?.minCenaSublimacia) || 0;
  if (tech === 'dtf') return Number(kostra?.minCenaDtf) || 0;
  if (tech === 'vysivka') return Number(kostra?.minCenaVysivka) || 0;
  if (tech === 'sietotlac') return Number(kostra?.sietotlac?.min_cena) || 0;
  if (tech === 'rezany') return Number(kostra?.rezany?.min_cena) || 0;
  if (tech === 'laser') return Number(kostra?.laserRezanie?.min_cena) || 0;
  return 0;
}

// €/hod prevadzky konkretneho zariadenia z registra (Financie -> Rezia firiem), na zaklade jeho
// prikonu (kW) a aktualnej ceny elektriny (riadok "Cena elektriny" v cost_metrics). Ak zariadenie
// nie je priradene alebo cena elektriny nie je nastavena, vracia 0 (spatna kompatibilita). Berie
// priamo pole cost_metrics riadkov (nie cely "kostra" objekt), aby sa dal pouzit aj mimo Kostry cien
// (napr. v KostraCienTab.jsx pri prepocte VC metraze, kde sa nacitava vlastny zoznam zariadeni).
export function elektrinaZariadeniaEurZaHod(costMetricsRiadky, zariadenieId) {
  if (!zariadenieId) return 0;
  const metriky = costMetricsRiadky || [];
  const zariadenie = metriky.find(m => m.id === zariadenieId);
  const cenaElektriny = metriky.find(m => m.name === 'Cena elektriny');
  if (!zariadenie || !cenaElektriny) return 0;
  return (parseFloat(zariadenie.power_kw) || 0) * (parseFloat(cenaElektriny.value) || 0);
}

// Sublimacia — potlac na tricka. Papier sa reze z 160cm rolky podla plochy motivu. Deleguje na
// vcSublimaciaGarmentRozpis, aby "spolu" a rozpis nikdy nemohli vyjst rozdielne cisla.
export function vcSublimaciaGarment(kostra, plochaCm2) {
  return vcSublimaciaGarmentRozpis(kostra, plochaCm2)?.spolu ?? 0;
}

// Sublimacia — podrobny rozpis (papier/atrament/protekcny papier v €, spotreba v bm/ml, cas tlace
// v sekundach podla rychlosti valca, elektrina konkretnej tlaciarne a lisu ak su priradene v Kostre
// cien). POZOR na rozdiel oproti variantu Metraz: pri potlaci na tricka bezi tlaciaren (rovnaky
// stroj ako pri metrazi) POCAS tlace motivu na papier, ale namiesto valcoveho kalandra (ten bezi
// LEN pri metrazi — kontinualna rolka) sa jednotlive kusy nazehluju na samostatnom LISE — preto
// textilSub.lis_zariadenie_id (nie kalander_zariadenie_id), viazane na cas nazehlovania z
// cennik_sublimacia_naklady.
export function vcSublimaciaGarmentRozpis(kostra, plochaCm2) {
  const { textilSub, sublimaciaGarment } = kostra;
  if (!textilSub || !sublimaciaGarment) return null;
  const papierBm = plochaCm2 / 16000; // plocha (cm2) na 160cm sirokej rolke -> bezne metre
  const papierCena = papierBm * (parseFloat(textilSub.cena_papier_bm) || 0);
  const atramentMl = (plochaCm2 / 10000) * (parseFloat(textilSub.spotreba_atrament_ml_m2) || 0);
  const atramentCena = (atramentMl / 1000) * (parseFloat(textilSub.cena_atrament_l) || 0);
  const protekcnyPapierCena = parseFloat(sublimaciaGarment.naklady_ochranny_papier) || 0;
  const manipulacia = parseFloat(sublimaciaGarment.naklady_manipulacia) || 0;
  const casNazehlovaniaMin = parseFloat(sublimaciaGarment.cas_nazehlovania_min) || 0;
  const praca = (casNazehlovaniaMin / 60) * (parseFloat(textilSub.cena_prace_hod) || 0);
  const rychlostMHod = parseFloat(textilSub.rychlost_m_hod) || 0;
  const casTlaceSekund = rychlostMHod > 0 ? (papierBm / rychlostMHod) * 3600 : 0;
  const elektrinaTlaciarenCena = elektrinaZariadeniaEurZaHod(kostra.costMetrics, textilSub.tlaciaren_zariadenie_id) * (casTlaceSekund / 3600);
  const elektrinaLisCena = elektrinaZariadeniaEurZaHod(kostra.costMetrics, textilSub.lis_zariadenie_id) * (casNazehlovaniaMin / 60);
  const zaklad = papierCena + atramentCena + protekcnyPapierCena + manipulacia + praca + elektrinaTlaciarenCena + elektrinaLisCena;
  const koeficientPercent = parseFloat(sublimaciaGarment.koeficient_rizika_percent) || 0;
  const spolu = zaklad * (1 + koeficientPercent / 100);
  // TRANSFER = sublimacny papier + atrament + tlac (elektrina tlaciarne); NAZEHLENIE = ochranny papier + manipulacia + praca lisu + elektrina lisu.
  // Riziko (koeficient) sa rozdeli rovnako na obe casti.
  const rizikoK = 1 + koeficientPercent / 100;
  const transfer = (papierCena + atramentCena + elektrinaTlaciarenCena) * rizikoK;
  const nazehlenie = (protekcnyPapierCena + manipulacia + praca + elektrinaLisCena) * rizikoK;
  return { papierBm, papierCena, atramentMl, atramentCena, protekcnyPapierCena, manipulacia, casNazehlovaniaMin, praca, casTlaceSekund, elektrinaTlaciarenCena, elektrinaLisCena, koeficientPercent, transfer, nazehlenie, spolu };
}

// DTF — potlac textilu. Elektrina: TLACIAREN a FIXACNY TUNEL bezia obe proporcionalne k ploche
// (56cm siroky pas, rovnaky rolkovy princip ako pri sublimacii), kazda svojou vlastnou rychlostou.
// TRANSFEROVY LIS (nazehlenie na textil) bezi flat cas na kus (cas_nazehlovania_min).
const DTF_ROLL_WIDTH_CM = 56;
// Predvolený odpad na rolke (medzery medzi logami, okraje pásu) — Martinov príklad 30× 33×25cm = 5 bm / 2,8 m²
// vs 2,475 m² čistej plochy = 13 %. Nastavuje sa v Kostre cien -> DTF (dtf_naklady.odpad_percent).
export const DTF_ODPAD_PREDVOLENY_PERCENT = 13;

// DTF — potlac textilu rozdelena na DVE OSOBITNE casti (kazdu robi iny clovek, inak sa predava):
//  1) TRANSFER (samotna potlacena folia) — presne to iste ako metraz: folia + lepidlo + CMYK + biela + praca pri tlaci
//     + elektrina tlaciarne a fixacneho tunela, na plochu logo + odpad na rolke (jedno % pre vsetky velkosti).
//  2) NAZEHLENIE na textil — manipulacia + cas lisu (praca) + elektrina lisu.
export function vcDtfGarmentRozpis(kostra, plochaCm2) {
  const n = kostra.dtf;
  if (!n) return { transfer: 0, nazehlenie: 0, spolu: 0, odpadPercent: 0 };
  const sirkaM = DTF_ROLL_WIDTH_CM / 100;
  const filmM2 = (parseFloat(n.cena_folie_bm) || 0) / sirkaM; // €/bm -> €/m2 cez sirku pasu
  const materialM2 =
    filmM2 +
    (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
    (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
    (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0);
  const rychlostTlace = Math.max(0.01, parseFloat(n.rychlost_tlace_m_hod) || 1);
  const pracaTlaceM2 = (parseFloat(n.cena_prace_hod) || 0) / (rychlostTlace * sirkaM); // operator pri tlaci, rovnako ako v metrazi
  const dlzkaBmDtf = plochaCm2 / (DTF_ROLL_WIDTH_CM * 100); // plocha (cm2) na 56cm sirokom pase -> bezne metre
  const tlaciarenEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, n.tlaciaren_zariadenie_id);
  const tunelEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, n.fixacny_tunel_zariadenie_id);
  const elektrinaBm = tlaciarenEurHod / rychlostTlace + tunelEurHod / Math.max(0.01, parseFloat(n.rychlost_tunela_m_hod) || 1);
  const odpadPercent = n.odpad_percent == null || n.odpad_percent === '' ? DTF_ODPAD_PREDVOLENY_PERCENT : Math.max(0, parseFloat(n.odpad_percent) || 0);
  const transfer = dlzkaBmDtf * ((materialM2 + pracaTlaceM2) * sirkaM + elektrinaBm) * (1 + odpadPercent / 100);

  const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
  const lisEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, n.transferovy_lis_zariadenie_id);
  const elektrinaLis = lisEurHod * ((parseFloat(n.cas_nazehlovania_min) || 0) / 60);
  const nazehlenie = (parseFloat(n.naklady_manipulacia) || 0) + praca + elektrinaLis;
  return { transfer, nazehlenie, spolu: transfer + nazehlenie, odpadPercent };
}
export function vcDtfGarment(kostra, plochaCm2) {
  return vcDtfGarmentRozpis(kostra, plochaCm2).spolu;
}

// Vysivka — digitalizacia rozpocitana na pocet kusov + cena od vysivaca na plochu.
export function vcVysivka(kostra, plochaCm2, ks) {
  const n = kostra.vysivkaNaklady;
  if (!n) return 0;
  return (parseFloat(n.cena_digitalizacia) || 0) / Math.max(1, ks || 1) + (parseFloat(n.cena_vysivky_cm2) || 0) * plochaCm2;
}

// Sietotlac — naklad za 1 konkretnu farbu (n-tu v poradi): kazda dalsia farba = dalsie sito +
// farba so spotrebou klesajucou o 20% oproti predchadzajucej. Sito je naklad NA CELU ZAKAZKU
// (pripravi sa raz, nie na kazdy kus znova) — rozpocitava sa preto rovnomerne na pocetKs, aby
// vacsia objednavka mala nizsiu cenu na kus (bez tohto delenia by 1ks aj 500ks stali za sito
// rovnako, co bolo povodnou pricinou, preco sa cena sietotlace vobec neznizovala pri odbere).
// Spotreba farby pre VLASTNY rozmer motivu (nie jeden z pevnych formatov): spotreba je umerna ploche, preto sa vezme
// format s najblizsou plochou, z neho sa vyrata g/cm² a vynasobi plochou motivu (25x1 cm vyjde nizsie ako 50x50 cm).
export function gramazPreVlastnuPlochu(kostra, jeTmavy, plochaCm2) {
  const plocha = parseFloat(plochaCm2) || 0;
  const formaty = (kostra.sietotlacVelkosti || [])
    .map(v => ({ plocha: (parseFloat(v.sirka_cm) || 0) * (parseFloat(v.vyska_cm) || 0), g: parseFloat(jeTmavy ? v.spotreba_g_tmavy : v.spotreba_g_svetly) || 0 }))
    .filter(v => v.plocha > 0 && v.g > 0);
  if (plocha <= 0 || formaty.length === 0) return 0;
  const najblizsi = formaty.reduce((best, v) => (Math.abs(v.plocha - plocha) < Math.abs(best.plocha - plocha) ? v : best), formaty[0]);
  return (najblizsi.g / najblizsi.plocha) * plocha;
}
export function nakladFarbySietotlac(kostra, velkostId, jeTmavy, n, pocetKs, plochaVlastnaCm2) {
  const sietotlac = kostra.sietotlac;
  const velkost = (kostra.sietotlacVelkosti || []).find(v => v.id === velkostId);
  const baseGramaz = velkost ? (parseFloat(jeTmavy ? velkost.spotreba_g_tmavy : velkost.spotreba_g_svetly) || 0) : gramazPreVlastnuPlochu(kostra, jeTmavy, plochaVlastnaCm2);
  const gramazN = baseGramaz * Math.pow(0.8, n - 1);
  const farbaCena = ((parseFloat(sietotlac?.cena_farba_kg) || 0) / 1000) * gramazN;
  const sitoCena = (parseFloat(sietotlac?.naklad_sito_zakazka) || 0) / Math.max(1, pocetKs || 1);
  return { n, gramaz: gramazN, farbaCena, sitoCena, spolu: farbaCena + sitoCena };
}
// Rozpad nakladov po vsetkych farbach zakazky (na zobrazenie/kontrolu).
export function vcSietotlacRozpad(kostra, velkostId, jeTmavy, pocetFarieb, pocetKs, plochaVlastnaCm2) {
  const n = Math.max(1, pocetFarieb || 1);
  return Array.from({ length: n }, (_, i) => nakladFarbySietotlac(kostra, velkostId, jeTmavy, i + 1, pocetKs, plochaVlastnaCm2));
}
// Na tmavy textil sa tlaci svetlou/bielou farbou, ktora potrebuje 2 vrstvy (prekrytie), preto
// tlac na tmavy textil trva podstatne dlhsie ako na svetly (podla Martina cca 2x) — cas_tlace_min
// je preto teraz SVETLY textil (povodne jedine, flat pole), cas_tlace_min_tmavy je NOVE volitelne
// pole pre tmavy textil. Bez vyplnenia (0/prazdne) sa pouzije rovnaka hodnota ako pre svetly —
// spatne kompatibilne, kym ho Martin v Kostra cien nevyplni.
function casTlaceMinPre(sietotlac, jeTmavy) {
  const svetly = parseFloat(sietotlac?.cas_tlace_min) || 0;
  if (!jeTmavy) return svetly;
  const tmavy = parseFloat(sietotlac?.cas_tlace_min_tmavy) || 0;
  return tmavy > 0 ? tmavy : svetly;
}
// Elektrina karuselu (tlac cez sita) + fixacneho tunela (fixacia farby), oba flat cas na kus —
// sietotlac (na rozdiel od ostatnych technologii) nema ziadny casovy rozmer v povodnom vzorci,
// preto su cas_tlace_min/cas_fixacie_min NOVE polia (default 0 = spatna kompatibilita).
function elektrinaSietotlacFlat(kostra, jeTmavy) {
  const sietotlac = kostra.sietotlac;
  if (!sietotlac) return 0;
  const karuselEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, sietotlac.karusel_zariadenie_id);
  const tunelEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, sietotlac.fixacny_tunel_zariadenie_id);
  return karuselEurHod * (casTlaceMinPre(sietotlac, jeTmavy) / 60) + tunelEurHod * ((parseFloat(sietotlac.cas_fixacie_min) || 0) / 60);
}
// Praca operatora (obsluha karuselu + tunela), flat cas na kus — samostatne od elektriny strojov.
function pracaSietotlacFlat(kostra, jeTmavy) {
  const sietotlac = kostra.sietotlac;
  if (!sietotlac) return 0;
  const celkovyCasMin = casTlaceMinPre(sietotlac, jeTmavy) + (parseFloat(sietotlac.cas_fixacie_min) || 0);
  return (celkovyCasMin / 60) * (parseFloat(sietotlac.cena_prace_hod) || 0);
}
// Celkova VC za 1 KUS (vsetky farby + manipulacia + praca + elektrina strojov na kus) + cistenie
// zakazky rozpocitane na pocetKs (rovnaky dovod ako pri site vyssie — jednorazovy naklad na celu
// zakazku, nie na kazdy kus). pocetKs je VOLITELNY — bez neho (napr. stare volania) sa sito aj
// cistenie spravaju ako doteraz (delia sa 1-timi, teda naplno na kazdy kus).
export function vcSietotlacCelkom(kostra, velkostId, jeTmavy, pocetFarieb, pocetKs, plochaVlastnaCm2) {
  const sietotlac = kostra.sietotlac;
  const rozpad = vcSietotlacRozpad(kostra, velkostId, jeTmavy, pocetFarieb, pocetKs, plochaVlastnaCm2);
  const cistenieNaKus = (parseFloat(sietotlac?.naklad_cistenie_zakazka) || 0) / Math.max(1, pocetKs || 1);
  return rozpad.reduce((s, r) => s + r.spolu, 0) + (parseFloat(sietotlac?.naklady_manipulacia) || 0) + cistenieNaKus + pracaSietotlacFlat(kostra, jeTmavy) + elektrinaSietotlacFlat(kostra, jeTmavy);
}
// VC len za 1. farbu (zakladna predajna sadzba, bez dalsich farieb — tie sa predavaju cez priplatok).
export function vcSietotlacZaklad(kostra, velkostId, jeTmavy, pocetKs, plochaVlastnaCm2) {
  const sietotlac = kostra.sietotlac;
  const prva = nakladFarbySietotlac(kostra, velkostId, jeTmavy, 1, pocetKs, plochaVlastnaCm2);
  const cistenieNaKus = (parseFloat(sietotlac?.naklad_cistenie_zakazka) || 0) / Math.max(1, pocetKs || 1);
  return prva.spolu + (parseFloat(sietotlac?.naklady_manipulacia) || 0) + cistenieNaKus + pracaSietotlacFlat(kostra, jeTmavy) + elektrinaSietotlacFlat(kostra, jeTmavy);
}
export function plochaFormatuSietotlac(kostra, velkostId, plochaVlastnaCm2) {
  const velkost = (kostra.sietotlacVelkosti || []).find(v => v.id === velkostId);
  return velkost ? (parseFloat(velkost.sirka_cm) || 0) * (parseFloat(velkost.vyska_cm) || 0) : (parseFloat(plochaVlastnaCm2) || 0);
}

// Rezany transfer — naklad materialu je per-folia (€/bm prepocitane cez efektivnu sirku rolky),
// cas rezania/vylupovania zavisi od plochy motivu, nazehlovanie a manipulacia su fixne na kus.
// Elektrina: PLOTTER bezi pocas rezania (cas_rezania_min je uz min/cm², vylupovanie je rucna
// praca, nie strojovy cas), TRANSFEROVY LIS bezi pocas flat casu nazehlovania.
export function vcRezanyTransferRozpis(kostra, foliaId, plochaCm2) {
  const rezany = kostra.rezany;
  const folia = (kostra.folie || []).find(f => f.id === foliaId);
  const sirkaVyuz = parseFloat(rezany?.sirka_vyuzitelna_cm) || 49;
  const naklad_cm2 = folia ? (((parseFloat(folia.naklad_bm) || 0) / sirkaVyuz) / 100) : 0;
  const material = plochaCm2 * naklad_cm2;
  const pracaCm2 = ((parseFloat(rezany?.cas_rezania_min) || 0) + (parseFloat(rezany?.cas_vylupovania_min) || 0)) / 60 * (parseFloat(rezany?.cena_prace_hod) || 0) * plochaCm2;
  const pracaFlat = ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60) * (parseFloat(rezany?.cena_prace_hod) || 0);
  const ploterEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, rezany?.ploter_zariadenie_id);
  const elektrinaPloterCm2 = ploterEurHod * ((parseFloat(rezany?.cas_rezania_min) || 0) / 60) * plochaCm2;
  const lisEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, rezany?.transferovy_lis_zariadenie_id);
  const elektrinaLisFlat = lisEurHod * ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60);
  // TRANSFER = folia + rezanie + vylupovanie (+ plotter); NAZEHLENIE = manipulacia + cas lisu (+ elektrina lisu)
  const transfer = material + pracaCm2 + elektrinaPloterCm2;
  const nazehlenie = (parseFloat(rezany?.naklady_manipulacia) || 0) + pracaFlat + elektrinaLisFlat;
  return { transfer, nazehlenie, spolu: transfer + nazehlenie };
}
export function vcRezanyTransfer(kostra, foliaId, plochaCm2) {
  return vcRezanyTransferRozpis(kostra, foliaId, plochaCm2).spolu;
}

// Laserove rezanie vlastnych dielcov zo zakazkovej latky (nie potlac) — cas rezania zavisi od
// hrubky/typu latky (rozne materialy sa reznu roznou rychlostou), preto sa zadava per-hrubka,
// rovnaky princip ako Rezany transfer vyssie (cas v min/cm², nasobi sa celou plochou dielca).
export function vcLaserRezanie(kostra, hrubkaId, plochaCm2) {
  const laser = kostra.laserRezanie;
  const hrubka = (kostra.laserHrubky || []).find(h => h.id === hrubkaId);
  const casRezaniaMinCm2 = hrubka ? (parseFloat(hrubka.cas_rezania_min_cm2) || 0) : 0;
  const praca = casRezaniaMinCm2 / 60 * (parseFloat(laser?.cena_prace_hod) || 0) * plochaCm2;
  const laserEurHod = elektrinaZariadeniaEurZaHod(kostra.costMetrics, laser?.laser_zariadenie_id);
  const elektrina = laserEurHod * (casRezaniaMinCm2 / 60) * plochaCm2;
  return (parseFloat(laser?.naklady_manipulacia) || 0) + praca + elektrina;
}
