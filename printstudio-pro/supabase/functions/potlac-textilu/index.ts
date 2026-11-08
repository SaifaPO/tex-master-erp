// Edge Function: potlac-textilu — verejná appka „Potlač textilu“ (?typ=potlac): produkt (tričko, mikina…) → farba → technológia (DTF / rezaný transfer /
// sieťotlač) → viac potlačí s umiestnením → cena → platba cez Shopify. Textil môže dodať zákazník, alebo ho objednať od nás.
//   { akcia: 'cennik' }                 -> nastavenia, produkty (fotky, farby, veľkosti, pozície potlače), umiestnenia, efekty sieťotlače (bez nákladov)
//   { preview: true, ...vyber }         -> cena (živý náhľad; rovnaká odpoveď ako ostatné appky pre cenaNahlad.jsx)
//   { ...vyber }                        -> uloží objednávku (potlac_objednavky), vytvorí Shopify draft order, vráti odkaz na platbu
// Cena potlače = výrobný náklad danej technológie z Kostry cien (rovnaké vzorce ako dizajner-price-preview a sietotlac-dopyt) cez maržový modul
// + príplatky (efekt, polyester), B2B zľava, manipulácia, poštovné, DPH. Cena textilu = predajná cena z karty produktu (ERP). Náklady nikdy neopustia server.
// Secrets pre platbu: SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.
//
// POZOR: súbor je zámerne SAMOSTATNÝ (žiadne importy z ../_shared/), vzorce sú duplikát z src/printstudio/vyrobneNaklady.js
// a pricingEngine.js — pri zmene vzorca uprav VŠETKY miesta rovnako (viď dizajner-price-preview, sietotlac-dopyt).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; cielovaHodnotaZakazky: number; dphPercent: number; }
function baseMargin(cost: number, cfg: PricingConfig) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost: number, qty: number, cfg: PricingConfig) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.cielovaHodnotaZakazky / Math.max(cost, 0.05), 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost: number, qty: number, cfg: PricingConfig) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

// deno-lint-ignore no-explicit-any
type Riadok = Record<string, any>;
const num = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r2 = (x: number) => Math.round(x * 100) / 100;

function elektrinaZariadeniaEurZaHod(costMetrics: Riadok[], zariadenieId: string | null | undefined) {
  if (!zariadenieId) return 0;
  const zariadenie = costMetrics.find((m) => m.id === zariadenieId);
  const cenaElektriny = costMetrics.find((m) => m.name === 'Cena elektriny');
  if (!zariadenie || !cenaElektriny) return 0;
  return (parseFloat(zariadenie.power_kw) || 0) * (parseFloat(cenaElektriny.value) || 0) + (parseFloat(zariadenie.amortizacia_hod) || 0);
}

// --- Sieťotlač (kópia zo sietotlac-dopyt) ---
function najblizsiFormat(velkosti: Riadok[], plochaCm2: number): Riadok | null {
  if (!velkosti.length) return null;
  const zoradene = [...velkosti].sort((a, b) => (Number(a.sirka_cm) * Number(a.vyska_cm)) - (Number(b.sirka_cm) * Number(b.vyska_cm)));
  return zoradene.find((v) => Number(v.sirka_cm) * Number(v.vyska_cm) >= plochaCm2) || zoradene[zoradene.length - 1];
}
function vcSietotlacCelkom(sietotlac: Riadok | null, velkost: Riadok | null, jeTmavy: boolean, pocetFarieb: number, pocetKsNaSita: number, costMetrics: Riadok[]) {
  if (!sietotlac) return 0;
  const n = Math.max(1, pocetFarieb || 1);
  const baseGramaz = velkost ? (parseFloat(jeTmavy ? velkost.spotreba_g_tmavy : velkost.spotreba_g_svetly) || 0) : 0;
  let farbySpolu = 0;
  for (let i = 1; i <= n; i++) {
    const gramazN = baseGramaz * Math.pow(0.8, i - 1);
    const farbaCena = ((parseFloat(sietotlac.cena_farba_kg) || 0) / 1000) * gramazN;
    const sitoCena = (parseFloat(sietotlac.naklad_sito_zakazka) || 0) / Math.max(1, pocetKsNaSita || 1);
    farbySpolu += farbaCena + sitoCena;
  }
  const cistenieNaKus = (parseFloat(sietotlac.naklad_cistenie_zakazka) || 0) / Math.max(1, pocetKsNaSita || 1);
  const casTlaceSvetly = parseFloat(sietotlac.cas_tlace_min) || 0;
  const casTlaceTmavy = parseFloat(sietotlac.cas_tlace_min_tmavy) || 0;
  const casTlace = jeTmavy ? (casTlaceTmavy > 0 ? casTlaceTmavy : casTlaceSvetly) : casTlaceSvetly;
  const podielFixacie = sietotlac.fixacia_praca_percent == null || sietotlac.fixacia_praca_percent === '' ? 1 : Math.min(100, Math.max(0, parseFloat(sietotlac.fixacia_praca_percent) || 0)) / 100;
  const celkovyCasMin = casTlace + (parseFloat(sietotlac.cas_fixacie_min) || 0) * podielFixacie;
  const praca = (celkovyCasMin / 60) * (parseFloat(sietotlac.cena_prace_hod) || 0);
  const karuselEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.karusel_zariadenie_id);
  const tunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.fixacny_tunel_zariadenie_id);
  const elektrina = karuselEurHod * (casTlace / 60) + tunelEurHod * ((parseFloat(sietotlac.cas_fixacie_min) || 0) / 60);
  return farbySpolu + (parseFloat(sietotlac.naklady_manipulacia) || 0) + cistenieNaKus + praca + elektrina;
}

// --- DTF a rezaný transfer (kópia z dizajner-price-preview) ---
const DTF_ROLL_WIDTH_CM = 56;
function vcDtfGarment(n: Riadok | null, costMetrics: Riadok[], plochaCm2: number) {
  if (!n) return 0;
  const sirkaM = DTF_ROLL_WIDTH_CM / 100;
  const filmM2 = (parseFloat(n.cena_folie_bm) || 0) / sirkaM;
  const materialM2 =
    filmM2 +
    (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
    (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
    (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0);
  const rychlostTlace = Math.max(0.01, parseFloat(n.rychlost_tlace_m_hod) || 1);
  const pracaTlaceM2 = (parseFloat(n.cena_prace_hod) || 0) / (rychlostTlace * sirkaM);
  const dlzkaBmDtf = plochaCm2 / (DTF_ROLL_WIDTH_CM * 100);
  const tlaciarenEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.tlaciaren_zariadenie_id);
  const tunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.fixacny_tunel_zariadenie_id);
  const elektrinaBm = tlaciarenEurHod / rychlostTlace + tunelEurHod / Math.max(0.01, parseFloat(n.rychlost_tunela_m_hod) || 1);
  const odpadPercent = n.odpad_percent == null || n.odpad_percent === '' ? 13 : Math.max(0, parseFloat(n.odpad_percent) || 0);
  const transfer = dlzkaBmDtf * ((materialM2 + pracaTlaceM2) * sirkaM + elektrinaBm) * (1 + odpadPercent / 100);
  const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
  const lisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.transferovy_lis_zariadenie_id);
  const elektrinaLis = lisEurHod * ((parseFloat(n.cas_nazehlovania_min) || 0) / 60);
  return transfer + (parseFloat(n.naklady_manipulacia) || 0) + praca + elektrinaLis;
}
function vcRezanyTransfer(rezany: Riadok | null, folia: Riadok | null, costMetrics: Riadok[], plochaCm2: number, pocetFarieb = 1) {
  // Viac farieb: odpad fólie +15 % a čas +0,3 min za každú ďalšiu farbu (Kostra cien), nažehlenie za každú vrstvu zvlášť.
  const nFarieb = Math.max(1, Math.round(pocetFarieb || 1)), dalsie = nFarieb - 1;
  const cislo = (v: unknown, def: number) => (v == null || v === '' ? def : (parseFloat(String(v)) || 0));
  const odpadFarba = cislo(rezany?.priplatok_odpad_farba_percent, 15) / 100, casNavyse = cislo(rezany?.cas_navyse_farba_min, 0.3);
  const sirkaVyuz = parseFloat(rezany?.sirka_vyuzitelna_cm) || 49;
  const naklad_cm2 = folia ? (((parseFloat(folia.naklad_bm) || 0) / sirkaVyuz) / 100) : 0;
  const material = plochaCm2 * naklad_cm2 * (1 + odpadFarba * dalsie);
  const pracaCm2 = ((parseFloat(rezany?.cas_rezania_min) || 0) + (parseFloat(rezany?.cas_vylupovania_min) || 0)) / 60 * (parseFloat(rezany?.cena_prace_hod) || 0) * plochaCm2;
  const pracaNavyse = (casNavyse * dalsie / 60) * (parseFloat(rezany?.cena_prace_hod) || 0);
  const pracaFlat = ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60) * (parseFloat(rezany?.cena_prace_hod) || 0);
  const ploterEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany?.ploter_zariadenie_id);
  const elektrinaPloterCm2 = ploterEurHod * ((parseFloat(rezany?.cas_rezania_min) || 0) / 60) * plochaCm2;
  const lisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany?.transferovy_lis_zariadenie_id);
  const elektrinaLisFlat = lisEurHod * ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60);
  return material + pracaCm2 + elektrinaPloterCm2 + pracaNavyse + ((parseFloat(rezany?.naklady_manipulacia) || 0) + pracaFlat + elektrinaLisFlat) * nFarieb;
}

const TECHNOLOGIE: Record<string, string> = { dtf: 'DTF transfer', rezany: 'Rezaný transfer', sietotlac: 'Sieťotlač' };
const HLADINY = [5, 10, 25, 50, 100, 250, 500, 1000];
const MAX_TLACI = 6;

type Kontext = Awaited<ReturnType<typeof nacitajKontext>>;
async function nacitajKontext(supabase: ReturnType<typeof createClient>) {
  const [nast, produkty, sNast, efekty, umiestnenia, cfgR, metriky, sieto, sVelkosti, dtf, rezany, folie, tech] = await Promise.all([
    supabase.from('potlac_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('potlac_produkty').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('sietotlac_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('sietotlac_efekty').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('sietotlac_umiestnenia').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cost_metrics').select('id, name, value, power_kw, amortizacia_hod'),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac_velkosti').select('*'),
    supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_folie').select('*'),
    supabase.from('cennik_technologie').select('technologia, min_cena'),
  ]);
  if (nast.error || !nast.data) throw new Error('Appka Potlač textilu ešte nie je pripravená (chýba migrácia migration_potlac_textilu.sql).');
  if (produkty.error) throw produkty.error;
  const c = cfgR.data;
  const cfg: PricingConfig = c
    ? { coefA: num(c.coef_a), coefB: num(c.coef_b), marginFloor: num(c.margin_floor), coefP: num(c.coef_p), cielovaHodnotaZakazky: num(c.cielova_hodnota_zakazky, 25000), dphPercent: num(c.dph_percent, 23) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };
  const minCeny: Record<string, number> = {};
  for (const t of (tech.data || []) as Riadok[]) minCeny[t.technologia] = num(t.min_cena);
  return {
    nast: nast.data as Riadok, produkty: (produkty.data || []) as Riadok[], sNast: (sNast.data || {}) as Riadok, efekty: (efekty.data || []) as Riadok[],
    umiestnenia: (umiestnenia.data || []) as Riadok[], cfg, metriky: (metriky.data || []) as Riadok[], sieto: sieto.data as Riadok | null,
    sVelkosti: (sVelkosti.data || []) as Riadok[], dtf: dtf.data as Riadok | null, rezany: rezany.data as Riadok | null, folie: (folie.data || []) as Riadok[], minCeny,
  };
}

type Tlac = { umiestnenie: string; sirkaCm: number; vyskaCm: number; farby: number; efekt: string; suborCesta: string | null; suborNazov: string | null };
type Vyber = {
  produkt: Riadok; vlastnyTextil: boolean; farbaNazov: string; farbaHex: string; tmavy: boolean; material: string; technologia: string;
  velkosti: Record<string, number>; pocetKs: number; tlace: Tlac[]; osobnyOdber: boolean; b2bKod: string;
};

// tmavý textil podľa relatívnej svetlosti farby (ovplyvňuje spotrebu farby a čas pri sieťotlači)
function jeTmavaFarba(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.5;
}

function normalizuj(ctx: Kontext, b: Riadok, suborPovinny: boolean): Vyber {
  const produkt = ctx.produkty.find((p) => p.id === b.produktId);
  if (!produkt) throw new Error('Vyberte produkt.');
  const technologia = String(b.technologia || '');
  if (!TECHNOLOGIE[technologia] || !(produkt.technologie || []).includes(technologia)) throw new Error('Táto technológia nie je pre vybraný produkt dostupná.');
  const vlastnyTextil = !!b.vlastnyTextil;
  const farby: Riadok[] = Array.isArray(produkt.farby) ? produkt.farby : [];
  const farba = farby.find((f) => f.hex === b.farbaHex) || farby[0] || { nazov: '', hex: '#ffffff' };

  let velkosti: Record<string, number> = {};
  let pocetKs: number;
  if (!vlastnyTextil) {
    const vstup = (b.velkosti && typeof b.velkosti === 'object') ? b.velkosti as Record<string, unknown> : {};
    for (const v of (produkt.velkosti || []) as string[]) {
      const q = Math.max(0, Math.round(num(vstup[v], 0)));
      if (q > 0) velkosti[v] = q;
    }
    pocetKs = Object.values(velkosti).reduce((s, q) => s + q, 0);
    if (pocetKs < 1) throw new Error('Zadajte počet kusov aspoň v jednej veľkosti.');
  } else {
    pocetKs = Math.round(num(b.pocetKs, 1));
  }

  const tlaceVstup: Riadok[] = Array.isArray(b.tlace) ? b.tlace : [];
  if (tlaceVstup.length === 0) throw new Error('Pridajte aspoň jednu potlač.');
  if (tlaceVstup.length > MAX_TLACI) throw new Error(`Najviac ${MAX_TLACI} potlačí na jednom kuse.`);
  const pozicie = (produkt.pozicie || {}) as Riadok;
  const pouzite = new Set<string>();
  const tlace: Tlac[] = tlaceVstup.map((t) => {
    const um = ctx.umiestnenia.find((u) => u.kod === t.umiestnenie);
    if (!um || !pozicie[um.kod]) throw new Error('Vyberte umiestnenie potlače.');
    if (pouzite.has(um.kod)) throw new Error(`Umiestnenie „${um.nazov}“ máte v objednávke dvakrát.`);
    pouzite.add(um.kod);
    const maxS = num(um.max_sirka_cm, 43), maxV = num(um.max_vyska_cm, 58);
    const efekt = technologia === 'sietotlac' && ctx.efekty.some((e) => e.kod === t.efekt) ? String(t.efekt) : (technologia === 'sietotlac' ? (ctx.efekty[0]?.kod || 'klasicka') : '');
    let suborCesta: string | null = null;
    if (t.suborCesta) {
      suborCesta = String(t.suborCesta);
      if (!suborCesta.startsWith('potlac/') || suborCesta.includes('..')) throw new Error('Neplatný nahraný súbor.');
    }
    if (suborPovinny && !suborCesta) throw new Error(`Pridajte grafiku k potlači „${um.nazov}“ (nahrajte súbor alebo si ju navrhnite).`);
    return {
      umiestnenie: um.kod, sirkaCm: Math.min(Math.max(num(t.sirkaCm, 10), 1), maxS), vyskaCm: Math.min(Math.max(num(t.vyskaCm, 10), 1), maxV),
      farby: Math.min(8, Math.max(1, Math.round(num(t.farby, 1)))), efekt, suborCesta, suborNazov: t.suborNazov ? String(t.suborNazov).slice(0, 200) : null,
    };
  });
  return {
    produkt, vlastnyTextil, farbaNazov: String(farba.nazov || ''), farbaHex: String(farba.hex || '#ffffff'), tmavy: jeTmavaFarba(String(farba.hex || '')),
    material: vlastnyTextil ? (b.material === 'polyester' ? 'polyester' : 'bavlna') : String(produkt.material || 'bavlna'),
    technologia, velkosti, pocetKs, tlace, osobnyOdber: !!b.osobnyOdber, b2bKod: String(b.b2bKod || '').trim().toUpperCase(),
  };
}

function minKsTechnologie(ctx: Kontext, technologia: string) { return technologia === 'sietotlac' ? Math.round(num(ctx.sNast.min_ks, 10)) : 1; }

// Cena 1 potlače na 1 kuse pri danom počte kusov
function cenaTlace(ctx: Kontext, v: Vyber, t: Tlac, ks: number) {
  const plocha = t.sirkaCm * t.vyskaCm;
  let vc = 0, zaklad = 0, priplEfekt = 0, priplPoly = 0;
  if (v.technologia === 'sietotlac') {
    vc = vcSietotlacCelkom(ctx.sieto, najblizsiFormat(ctx.sVelkosti, plocha), v.tmavy, t.farby, ks, ctx.metriky);
    zaklad = Math.max(priceAt(vc, ks, ctx.cfg), num(ctx.sieto?.min_cena));
    priplEfekt = num(ctx.efekty.find((e) => e.kod === t.efekt)?.priplatok_percent);
    priplPoly = v.material === 'polyester' ? num(ctx.sNast.polyester_priplatok_percent) : 0;
  } else if (v.technologia === 'dtf') {
    vc = vcDtfGarment(ctx.dtf, ctx.metriky, plocha);
    zaklad = Math.max(priceAt(vc, ks, ctx.cfg), num(ctx.minCeny.dtf));
  } else {
    vc = vcRezanyTransfer(ctx.rezany, ctx.folie[0] || null, ctx.metriky, plocha, t.farby);
    zaklad = Math.max(priceAt(vc, ks, ctx.cfg), num(ctx.rezany?.min_cena));
  }
  return { cenaKs: r2(zaklad * (1 + priplEfekt / 100) * (1 + priplPoly / 100)), vc, priplEfekt, priplPoly };
}
const cenaKusaSpolu = (ctx: Kontext, v: Vyber, ks: number) => r2(v.tlace.reduce((s, t) => s + cenaTlace(ctx, v, t, ks).cenaKs, 0));

async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: string) {
  if (!kod) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', kod).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(num((data as Riadok | null)?.zlava_percent), 0), 90);
}

async function vyhodnot(supabase: ReturnType<typeof createClient>, ctx: Kontext, v: Vyber) {
  const minKs = minKsTechnologie(ctx, v.technologia), maxKs = Math.round(num(ctx.nast.max_ks, 5000));
  if (v.pocetKs < minKs) throw new Error(`Minimálny odber pre ${TECHNOLOGIE[v.technologia].toLowerCase()} je ${minKs} ks.`);
  if (v.pocetKs > maxKs) throw new Error(`Pre objednávky nad ${maxKs} ks nám prosím napíšte.`);
  if (v.technologia === 'sietotlac' && !ctx.sieto) throw new Error('Cenník sieťotlače nie je v ERP vyplnený.');
  if (v.technologia === 'dtf' && !ctx.dtf) throw new Error('Cenník DTF nie je v ERP vyplnený.');
  if (v.technologia === 'rezany' && !ctx.rezany) throw new Error('Cenník rezaného transferu nie je v ERP vyplnený.');
  const ks = v.pocetKs;
  const tlaceCeny = v.tlace.map((t) => ({ t, ...cenaTlace(ctx, v, t, ks) }));
  const cenaKs = r2(tlaceCeny.reduce((s, x) => s + x.cenaKs, 0));
  const naklad = tlaceCeny.reduce((s, x) => s + x.vc, 0) * ks;
  const loga = r2(cenaKs * ks);
  const doplatokMinima = Math.max(0, r2(num(ctx.nast.minimalna_cena_eur) - loga));
  const logaSpolu = r2(loga + doplatokMinima);
  const zlavaPercent = await b2bZlava(supabase, v.b2bKod);
  const zlavaEur = r2(logaSpolu * zlavaPercent / 100);
  const poZlave = r2(logaSpolu - zlavaEur);
  const cenaTextilKs = v.vlastnyTextil ? 0 : num(v.produkt.cena_textilu_eur);
  const textilSpolu = r2(cenaTextilKs * ks);
  const manipulacia = num(ctx.nast.manipulacny_poplatok_eur);
  const zdarma = num(ctx.nast.postovne_zdarma_od_eur) > 0 && (poZlave + textilSpolu + manipulacia) >= num(ctx.nast.postovne_zdarma_od_eur);
  const postovne = v.osobnyOdber || zdarma ? 0 : num(ctx.nast.cena_doprava);
  const spoluBezDph = r2(poZlave + textilSpolu + manipulacia + postovne);
  const dph = r2(spoluBezDph * ctx.cfg.dphPercent / 100);
  const spolu = r2(spoluBezDph + dph);
  const urovne = [...new Set([minKs, ...HLADINY.filter((h) => h > minKs && h <= maxKs)])].sort((a, b) => a - b)
    .map((k) => ({ ks: k, cenaKsBezDph: cenaKusaSpolu(ctx, v, k) }));
  return {
    interne: { naklad: r2(naklad), tlaceCeny, cenaKs, textilSpolu },
    verejne: {
      pocetKs: ks, cenaKsBezDph: r2(logaSpolu / ks), logaSpoluBezDph: logaSpolu, zlavaB2bPercent: zlavaPercent, zlavaB2bEur: zlavaEur, manipulaciaBezDph: manipulacia,
      postovneBezDph: postovne, spoluBezDph, dphPercent: ctx.cfg.dphPercent, dph, spolu, ksSpolu: ks, doplatokMinimaBezDph: doplatokMinima,
      textilKsBezDph: cenaTextilKs, textilSpoluBezDph: textilSpolu, urovne, minKs,
      tlace: tlaceCeny.map((x) => ({ umiestnenie: x.t.umiestnenie, nazov: ctx.umiestnenia.find((u) => u.kod === x.t.umiestnenie)?.nazov || x.t.umiestnenie, cenaKsBezDph: x.cenaKs, priplatokEfektPercent: x.priplEfekt })),
      priplatokPolyesterPercent: tlaceCeny[0]?.priplPoly || 0,
    } as Record<string, unknown>,
  };
}

async function ziskajCislo(supabase: ReturnType<typeof createClient>, prefix: string) {
  const year = new Date().getFullYear(); const sy = String(year).slice(-2);
  const { data: c } = await supabase.from('print_objednavky_pocitadla').select('next_number').eq('prefix', prefix).eq('year', year).maybeSingle();
  const next = c?.next_number || 1;
  await supabase.from('print_objednavky_pocitadla').upsert({ prefix, year, next_number: next + 1 }, { onConflict: 'prefix,year' });
  return `${prefix}-${sy}${String(next).padStart(4, '0')}`;
}
async function podpisanyOdkaz(supabase: ReturnType<typeof createClient>, cesta: string | null): Promise<string | null> {
  if (!cesta) return null;
  const { data } = await supabase.storage.from('print-designs').createSignedUrl(cesta, 60 * 60 * 24 * 365);
  return data?.signedUrl || null;
}

const popisTlace = (ctx: Kontext, v: Vyber, t: Tlac) => {
  const nazov = ctx.umiestnenia.find((u) => u.kod === t.umiestnenie)?.nazov || t.umiestnenie;
  const farby = v.technologia === 'dtf' ? '' : `, ${t.farby} ${t.farby === 1 ? 'farba' : t.farby < 5 ? 'farby' : 'farieb'}`;
  const efekt = v.technologia === 'sietotlac' ? `, ${ctx.efekty.find((e) => e.kod === t.efekt)?.nazov || t.efekt}` : '';
  return `${nazov}: ${t.sirkaCm} × ${t.vyskaCm} cm${farby}${efekt}`;
};
const popisTextilu = (v: Vyber) => v.vlastnyTextil
  ? `vlastný textil (${v.material === 'polyester' ? 'polyester' : 'bavlna'}, ${v.farbaNazov || (v.tmavy ? 'tmavý' : 'svetlý')})`
  : `${v.produkt.nazov}, ${v.farbaNazov}, veľkosti: ${Object.entries(v.velkosti).map(([k, q]) => `${k}×${q}`).join(', ')}`;

// Shopify draft order s presnou cenou (cena už zahŕňa DPH, preto taxable: false) -> odkaz na platbu.
type DraftPolozka = { title: string; price: number; requiresShipping: boolean; properties?: { name: string; value: string }[] };
async function vytvorDraft(polozky: DraftPolozka[], note: string, tags: string) {
  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
  const tokRes = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!tokRes.ok) throw new Error(`Nepodarilo sa získať Shopify token (${tokRes.status}): ${await tokRes.text()}`);
  const token = (await tokRes.json())?.access_token as string;
  if (!token) throw new Error('Shopify nevrátil access_token.');
  const res = await fetch(`https://${domain}/admin/api/2025-01/draft_orders.json`, {
    method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_order: {
      line_items: polozky.map((p) => ({ title: p.title, price: p.price.toFixed(2), quantity: 1, taxable: false, requires_shipping: p.requiresShipping, ...(p.properties ? { properties: p.properties } : {}) })),
      note, tags, use_customer_default_address: true,
    } }),
  });
  if (!res.ok) throw new Error(`Shopify Admin API chyba ${res.status}: ${await res.text()}`);
  const url = (await res.json())?.draft_order?.invoice_url;
  if (!url) throw new Error('Shopify nevrátil odkaz na platbu draft objednávky.');
  return url as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const ctx = await nacitajKontext(supabase);
    const akcia = body.akcia || (body.preview ? 'cena' : 'objednat');

    if (akcia === 'cennik') {
      const n = ctx.nast, s = ctx.sNast;
      return odpoved({
        ok: true,
        nastavenia: {
          aktivny: n.aktivny !== false, maxKs: num(n.max_ks, 5000), infoText: n.info_text || '', dphPercent: ctx.cfg.dphPercent,
          minKs: { dtf: 1, rezany: 1, sietotlac: Math.round(num(s.min_ks, 10)) }, polyesterPriplatokPercent: num(s.polyester_priplatok_percent),
        },
        produkty: ctx.produkty.filter((p) => p.foto_predok_url).map((p) => ({
          id: p.id, kod: p.kod, nazov: p.nazov, kategoria: p.kategoria, popis: p.popis || '', material: p.material, cenaTextiluBezDph: num(p.cena_textilu_eur),
          velkosti: p.velkosti || [], farby: p.farby || [], technologie: p.technologie || [], fotoPredok: p.foto_predok_url, fotoZadok: p.foto_zadok_url || null,
          fotoSirkaCm: num(p.foto_sirka_cm, 100), pozicie: p.pozicie || {},
        })),
        efekty: ctx.efekty.map((e) => ({ kod: e.kod, nazov: e.nazov, popis: e.popis || '', priplatokPercent: num(e.priplatok_percent) })),
        umiestnenia: ctx.umiestnenia.map((u) => ({ kod: u.kod, nazov: u.nazov, popis: u.popis || '', strana: u.strana, maxSirkaCm: num(u.max_sirka_cm), maxVyskaCm: num(u.max_vyska_cm), vychodziaSirkaCm: num(u.vychodzia_sirka_cm, 20), vychodziaVyskaCm: num(u.vychodzia_vyska_cm, 20) })),
      });
    }
    if (ctx.nast.aktivny === false) throw new Error('Appka je dočasne vypnutá.');

    if (akcia === 'cena') {
      const v = normalizuj(ctx, body, false);
      const r = await vyhodnot(supabase, ctx, v);
      return odpoved({ ok: true, ...r.verejne });
    }

    if (akcia === 'objednat') {
      const v = normalizuj(ctx, body, true);
      const r = await vyhodnot(supabase, ctx, v);
      const c = r.verejne as Riadok;
      const cislo = await ziskajCislo(supabase, 'POT');
      const objednavkaId = crypto.randomUUID();
      const odkazy: (string | null)[] = [];
      for (const t of v.tlace) odkazy.push(await podpisanyOdkaz(supabase, t.suborCesta));
      const polozky = v.tlace.map((t, i) => ({ ...t, nazov: ctx.umiestnenia.find((u) => u.kod === t.umiestnenie)?.nazov || t.umiestnenie, cenaKs: r.interne.tlaceCeny[i].cenaKs, suborUrl: odkazy[i] }));
      const { error: insErr } = await supabase.from('potlac_objednavky').insert({
        id: objednavkaId, cislo_objednavky: cislo, produkt_id: v.produkt.id, produkt_nazov: v.produkt.nazov, vlastny_textil: v.vlastnyTextil, farba_nazov: v.farbaNazov, farba_hex: v.farbaHex,
        technologia: v.technologia, velkosti: v.vlastnyTextil ? null : v.velkosti, pocet_ks: v.pocetKs, polozky,
        cena_kus: c.cenaKsBezDph, cena_spolu: c.spolu, naklad_spolu: r.interne.naklad, b2b_kod: (c.zlavaB2bPercent as number) > 0 ? v.b2bKod : null, osobny_odber: v.osobnyOdber,
        subor_nazov: v.tlace[0].suborNazov, subor_cesta: v.tlace[0].suborCesta,
      });
      if (insErr) throw insErr;
      const nazvyUmiestneni = polozky.map((p) => p.nazov).join(', ');
      const checkoutUrl = await vytvorDraft([{
        title: `${TECHNOLOGIE[v.technologia]} — ${v.pocetKs}× ${v.vlastnyTextil ? 'vlastný textil' : v.produkt.nazov} (${nazvyUmiestneni})${v.osobnyOdber ? ' (osobný odber)' : ''}`,
        price: c.spolu as number, requiresShipping: !v.osobnyOdber,
        properties: [
          { name: '_cislo_objednavky', value: cislo }, { name: '_objednavka_id', value: objednavkaId }, { name: '_potlac', value: 'true' },
          { name: '_technologia', value: v.technologia }, { name: '_pocet_ks', value: String(v.pocetKs) }, { name: '_textil', value: popisTextilu(v) },
          ...polozky.flatMap((p, i) => [{ name: `_potlac_${i + 1}`, value: popisTlace(ctx, v, p) }, { name: `_subor_link_${i + 1}`, value: p.suborUrl || '' }]),
          { name: '_osobny_odber', value: v.osobnyOdber ? 'áno' : 'nie' }, { name: '_b2b_kod', value: (c.zlavaB2bPercent as number) > 0 ? v.b2bKod : '' },
        ],
      }], `${cislo} (${TECHNOLOGIE[v.technologia]}, ${v.pocetKs} ks)\nTextil: ${popisTextilu(v)}\n${polozky.map((p, i) => `${i + 1}. ${popisTlace(ctx, v, p)}${p.suborUrl ? `\nSúbor: ${p.suborUrl}` : ''}`).join('\n')}`, 'potlac-textilu');
      return odpoved({ ok: true, checkoutUrl, cenaSpolu: c.spolu, objednavkaId, cisloObjednavky: cislo });
    }
    throw new Error('Neznáma akcia.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as Riadok).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
