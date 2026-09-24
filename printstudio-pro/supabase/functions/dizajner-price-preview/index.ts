// Zivy nahlad ceny potlace pre konfigurator "Dizajner" (vlastna potlac na tricka/textil) — bezi
// so servisnym klucom, aby klient (anon) nikdy nevidel surove vyrobne naklady (cena farby, cena
// prace, cena elektriny zariadeni...) priamo cez REST API (viacero z tychto tabuliek ma RLS
// "len authenticated", cize by ich anon aj tak neprecital) — vidi len hotovu cenu z tejto odpovede.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Vzorce (VC aj marzova krivka) su duplikat z src/printstudio/vyrobneNaklady.js + pricingEngine.js
// v hlavnej ERP appke — pri zmene vzorca uprav VSETKY miesta rovnako (viz komentar tam).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; qtyAtFloor: number; dphPercent: number; }

function baseMargin(cost: number, cfg: PricingConfig) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost: number, qty: number, cfg: PricingConfig) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.qtyAtFloor, 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost: number, qty: number, cfg: PricingConfig) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

// deno-lint-ignore no-explicit-any
type Riadok = Record<string, any>;

function elektrinaZariadeniaEurZaHod(costMetrics: Riadok[], zariadenieId: string | null | undefined) {
  if (!zariadenieId) return 0;
  const zariadenie = costMetrics.find((m) => m.id === zariadenieId);
  const cenaElektriny = costMetrics.find((m) => m.name === 'Cena elektriny');
  if (!zariadenie || !cenaElektriny) return 0;
  return (parseFloat(zariadenie.power_kw) || 0) * (parseFloat(cenaElektriny.value) || 0);
}

function vcSublimaciaGarment(textilSub: Riadok | null, sublimaciaGarment: Riadok | null, costMetrics: Riadok[], plochaCm2: number) {
  if (!textilSub || !sublimaciaGarment) return 0;
  const papierBm = plochaCm2 / 16000;
  const papierCena = papierBm * (parseFloat(textilSub.cena_papier_bm) || 0);
  const atramentMl = (plochaCm2 / 10000) * (parseFloat(textilSub.spotreba_atrament_ml_m2) || 0);
  const atramentCena = (atramentMl / 1000) * (parseFloat(textilSub.cena_atrament_l) || 0);
  const protekcnyPapierCena = parseFloat(sublimaciaGarment.naklady_ochranny_papier) || 0;
  const manipulacia = parseFloat(sublimaciaGarment.naklady_manipulacia) || 0;
  const casNazehlovaniaMin = parseFloat(sublimaciaGarment.cas_nazehlovania_min) || 0;
  const praca = (casNazehlovaniaMin / 60) * (parseFloat(textilSub.cena_prace_hod) || 0);
  const rychlostMHod = parseFloat(textilSub.rychlost_m_hod) || 0;
  const casTlaceSekund = rychlostMHod > 0 ? (papierBm / rychlostMHod) * 3600 : 0;
  const elektrinaTlaciarenCena = elektrinaZariadeniaEurZaHod(costMetrics, textilSub.tlaciaren_zariadenie_id) * (casTlaceSekund / 3600);
  const elektrinaLisCena = elektrinaZariadeniaEurZaHod(costMetrics, textilSub.lis_zariadenie_id) * (casNazehlovaniaMin / 60);
  const zaklad = papierCena + atramentCena + protekcnyPapierCena + manipulacia + praca + elektrinaTlaciarenCena + elektrinaLisCena;
  const koeficientPercent = parseFloat(sublimaciaGarment.koeficient_rizika_percent) || 0;
  return zaklad * (1 + koeficientPercent / 100);
}

const DTF_ROLL_WIDTH_CM = 56;
function vcDtfGarment(n: Riadok | null, costMetrics: Riadok[], plochaCm2: number) {
  if (!n) return 0;
  const plochaM2 = plochaCm2 / 10000;
  const filmM2 = (parseFloat(n.cena_folie_bm) || 0) / (DTF_ROLL_WIDTH_CM / 100);
  const material = plochaM2 * (
    filmM2 +
    (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
    (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
    (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0)
  );
  const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
  const dlzkaBmDtf = plochaCm2 / (DTF_ROLL_WIDTH_CM * 100);
  const tlaciarenEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.tlaciaren_zariadenie_id);
  const elektrinaTlaciaren = tlaciarenEurHod * (dlzkaBmDtf / Math.max(0.01, parseFloat(n.rychlost_tlace_m_hod) || 1));
  const tunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.fixacny_tunel_zariadenie_id);
  const elektrinaTunel = tunelEurHod * (dlzkaBmDtf / Math.max(0.01, parseFloat(n.rychlost_tunela_m_hod) || 1));
  const lisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, n.transferovy_lis_zariadenie_id);
  const elektrinaLis = lisEurHod * ((parseFloat(n.cas_nazehlovania_min) || 0) / 60);
  return material + (parseFloat(n.naklady_manipulacia) || 0) + praca + elektrinaTlaciaren + elektrinaTunel + elektrinaLis;
}

// Zakaznik v Dizajneri kresli motiv na volne velkej ploche (nie z preddefinovaneho formatu ako
// admin kalkulacky) — spotreba farby sa preto berie z NAJBLIZSIEHO definovaneho formatu, ktory
// jeho motiv este zmesti (zaokruhlenie NAHOR na najblizsi standardny format, presne ako pri
// realnej vyrobe — sito/naklad sa pripravuje na standardnu velkost, nie na presny cm2 motivu).
function najblizsiFormat(velkosti: Riadok[], plochaCm2: number): Riadok | null {
  if (!velkosti.length) return null;
  const zoradene = [...velkosti].sort((a, b) => (Number(a.sirka_cm) * Number(a.vyska_cm)) - (Number(b.sirka_cm) * Number(b.vyska_cm)));
  const vyhovujuci = zoradene.find((v) => Number(v.sirka_cm) * Number(v.vyska_cm) >= plochaCm2);
  return vyhovujuci || zoradene[zoradene.length - 1];
}

function vcSietotlacCelkom(
  sietotlac: Riadok | null, velkost: Riadok | null, jeTmavy: boolean, pocetFarieb: number, pocetKs: number, costMetrics: Riadok[],
) {
  if (!sietotlac) return 0;
  const n = Math.max(1, pocetFarieb || 1);
  const baseGramaz = velkost ? (parseFloat(jeTmavy ? velkost.spotreba_g_tmavy : velkost.spotreba_g_svetly) || 0) : 0;
  let farbySpolu = 0;
  for (let i = 1; i <= n; i++) {
    const gramazN = baseGramaz * Math.pow(0.8, i - 1);
    const farbaCena = ((parseFloat(sietotlac.cena_farba_kg) || 0) / 1000) * gramazN;
    // Sito je naklad NA CELU ZAKAZKU (pripravi sa raz) — rozpocitava sa na pocet kusov, aby
    // vacsia objednavka mala nizsiu cenu na kus (rovnaky princip ako v admin kalkulackach).
    const sitoCena = (parseFloat(sietotlac.naklad_sito_zakazka) || 0) / Math.max(1, pocetKs || 1);
    farbySpolu += farbaCena + sitoCena;
  }
  const cistenieNaKus = (parseFloat(sietotlac.naklad_cistenie_zakazka) || 0) / Math.max(1, pocetKs || 1);
  // Na tmavy textil sa tlaci svetlou/bielou farbou v 2 vrstvach (prekrytie) — tlac trva podstatne
  // dlhsie ako na svetly textil (cas_tlace_min_tmavy, ak vyplnene; inak spadne na svetly cas).
  const casTlaceSvetly = parseFloat(sietotlac.cas_tlace_min) || 0;
  const casTlaceTmavy = parseFloat(sietotlac.cas_tlace_min_tmavy) || 0;
  const casTlace = jeTmavy ? (casTlaceTmavy > 0 ? casTlaceTmavy : casTlaceSvetly) : casTlaceSvetly;
  const celkovyCasMin = casTlace + (parseFloat(sietotlac.cas_fixacie_min) || 0);
  const praca = (celkovyCasMin / 60) * (parseFloat(sietotlac.cena_prace_hod) || 0);
  const karuselEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.karusel_zariadenie_id);
  const tunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.fixacny_tunel_zariadenie_id);
  const elektrina = karuselEurHod * (casTlace / 60) + tunelEurHod * ((parseFloat(sietotlac.cas_fixacie_min) || 0) / 60);
  return farbySpolu + (parseFloat(sietotlac.naklady_manipulacia) || 0) + cistenieNaKus + praca + elektrina;
}

function vcRezanyTransfer(rezany: Riadok | null, folia: Riadok | null, costMetrics: Riadok[], plochaCm2: number) {
  const sirkaVyuz = parseFloat(rezany?.sirka_vyuzitelna_cm) || 49;
  const naklad_cm2 = folia ? (((parseFloat(folia.naklad_bm) || 0) / sirkaVyuz) / 100) : 0;
  const material = plochaCm2 * naklad_cm2;
  const pracaCm2 = ((parseFloat(rezany?.cas_rezania_min) || 0) + (parseFloat(rezany?.cas_vylupovania_min) || 0)) / 60 * (parseFloat(rezany?.cena_prace_hod) || 0) * plochaCm2;
  const pracaFlat = ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60) * (parseFloat(rezany?.cena_prace_hod) || 0);
  const ploterEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany?.ploter_zariadenie_id);
  const elektrinaPloterCm2 = ploterEurHod * ((parseFloat(rezany?.cas_rezania_min) || 0) / 60) * plochaCm2;
  const lisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany?.transferovy_lis_zariadenie_id);
  const elektrinaLisFlat = lisEurHod * ((parseFloat(rezany?.cas_nazehlovania_min) || 0) / 60);
  return material + (parseFloat(rezany?.naklady_manipulacia) || 0) + pracaFlat + pracaCm2 + elektrinaPloterCm2 + elektrinaLisFlat;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const {
      tech, plochaCm2, pocetFarieb = 1, jeTmavyTextil = false, foliaId = null, pocetKs = 1,
    } = body;

    if (!tech) throw new Error('Chýba technológia.');
    if (!plochaCm2 || plochaCm2 <= 0) throw new Error('Chýba plocha motívu.');
    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const plocha = Number(plochaCm2);
    const farby = Math.max(1, Math.round(Number(pocetFarieb)) || 1);

    const [{ data: cfg }, { data: costMetrics }] = await Promise.all([
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cost_metrics').select('id, name, value, power_kw'),
    ]);
    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000, dphPercent: 23 };
    const metriky = costMetrics || [];

    let vc = 0;
    let detaily: Record<string, unknown> = {};
    let minCena = 0;

    if (tech === 'sublimacia') {
      const [{ data: textilSub }, { data: sublimaciaGarment }, { data: techRiadok }] = await Promise.all([
        supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
        supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cennik_technologie').select('min_cena').eq('technologia', 'sublimacia').maybeSingle(),
      ]);
      vc = vcSublimaciaGarment(textilSub, sublimaciaGarment, metriky, plocha);
      minCena = Number(techRiadok?.min_cena) || 0;
    } else if (tech === 'dtf') {
      const [{ data: dtfNaklady }, { data: techRiadok }] = await Promise.all([
        supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cennik_technologie').select('min_cena').eq('technologia', 'dtf').maybeSingle(),
      ]);
      vc = vcDtfGarment(dtfNaklady, metriky, plocha);
      minCena = Number(techRiadok?.min_cena) || 0;
    } else if (tech === 'sietotlac') {
      const [{ data: sietotlac }, { data: velkosti }] = await Promise.all([
        supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cennik_sietotlac_velkosti').select('*'),
      ]);
      const format = najblizsiFormat(velkosti || [], plocha);
      vc = vcSietotlacCelkom(sietotlac, format, !!jeTmavyTextil, farby, ks, metriky);
      minCena = Number(sietotlac?.min_cena) || 0;
      detaily = { formatPouzity: format?.label || null };
    } else if (tech === 'rezany') {
      const [{ data: rezany }, { data: folie }] = await Promise.all([
        supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
        supabase.from('cennik_folie').select('*'),
      ]);
      const folia = (folie || []).find((f: Riadok) => f.id === foliaId) || (folie || [])[0] || null;
      vc = vcRezanyTransfer(rezany, folia, metriky, plocha) * farby;
      minCena = Number(rezany?.min_cena) || 0;
    } else {
      throw new Error(`Neznáma technológia: ${tech}`);
    }

    // "min. cena úkonu" (Potlače) je FLOOR na cenu, nie na VC — bez neho pri lacných materiáloch
    // (nízke VC) vracala maržová krivka len pár centov aj napriek vysokému percentu marže.
    const cenaPotlace = Math.max(priceAt(vc, ks, pricingConfig), minCena);
    const marzaPercent = vc > 0 ? Math.round(((cenaPotlace / vc) - 1) * 100) : 0;

    return odpoved({ cena: { cenaPotlace, vc: Math.round(vc * 1000) / 1000, marzaPercent, ...detaily } });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
