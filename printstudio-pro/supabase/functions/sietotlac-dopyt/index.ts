// Edge Function: sietotlac-dopyt — verejná appka „Sieťotlač“ (?typ=sietotlac): kalkulačka, objednávka s platbou a dopyt.
//   { akcia: 'cennik' }                      -> nastavenia appky, efekty farieb a umiestnenia potlače (bez akýchkoľvek nákladov)
//   { preview: true, ...vyber }              -> cena (živý náhľad; rovnaká odpoveď ako ostatné appky pre cenaNahlad.jsx)
//   { ...vyber }                             -> uloží objednávku (sietotlac_objednavky), vytvorí Shopify draft order, vráti odkaz na platbu
//   { akcia: 'dopyt', vyber, kontakt }       -> uloží dopyt bez platby (sietotlac_dopyty) + e-maily
// Výber = textil, počet kusov a ZOZNAM POTLAČÍ na jednom kuse (každá má umiestnenie, rozmer, počet farieb, efekt a súbor s grafikou).
// Cena kusa = súčet cien potlačí. Cena každej potlače = výrobný náklad sieťotlače z Kostry cien (rovnaký vzorec ako dizajner-price-preview)
// cez maržový modul (Cenotvorba) + príplatok efektu; + príplatok polyester, B2B zľava, manipulácia, poštovné, DPH.
// Tabuľky s nákladmi nikdy neopustia server — klient vidí len hotovú cenu.
// Secrets pre platbu: SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.
//
// POZOR: súbor je zámerne SAMOSTATNÝ (žiadne importy z ../_shared/), vzorce sú duplikát z src/printstudio/vyrobneNaklady.js
// a pricingEngine.js — pri zmene vzorca uprav VŠETKY miesta rovnako (viď dizajner-price-preview).
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

// Spotreba farby sa berie z NAJBLIŽŠIEHO štandardného formátu, ktorý motív ešte zmestí (sito sa pripravuje na štandardnú veľkosť).
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

const HLADINY = [10, 25, 50, 100, 250, 500, 1000];
const MAX_TLACI = 6;

type Kontext = Awaited<ReturnType<typeof nacitajKontext>>;
async function nacitajKontext(supabase: ReturnType<typeof createClient>) {
  const [nast, efekty, umiestnenia, cfgR, metriky, sieto, velkosti] = await Promise.all([
    supabase.from('sietotlac_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('sietotlac_efekty').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('sietotlac_umiestnenia').select('*').eq('aktivny', true).not('kod', 'like', 'siltovka_%').not('kod', 'like', 'rukav_dlhy_%').order('poradie'), // miesta na šiltovke patria len do Potlače textilu
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cost_metrics').select('id, name, value, power_kw, amortizacia_hod'),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac_velkosti').select('*'),
  ]);
  if (nast.error || !nast.data) throw new Error('Appka Sieťotlač ešte nie je pripravená (chýba migrácia migration_sietotlac_appka.sql).');
  if (umiestnenia.error) throw new Error('Appka Sieťotlač ešte nemá umiestnenia (chýba migrácia migration_sietotlac_objednavky.sql).');
  const c = cfgR.data;
  const cfg: PricingConfig = c
    ? { coefA: num(c.coef_a), coefB: num(c.coef_b), marginFloor: num(c.margin_floor), coefP: num(c.coef_p), cielovaHodnotaZakazky: num(c.cielova_hodnota_zakazky, 25000), dphPercent: num(c.dph_percent, 23) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };
  return { nast: nast.data as Riadok, efekty: (efekty.data || []) as Riadok[], umiestnenia: (umiestnenia.data || []) as Riadok[], cfg, metriky: (metriky.data || []) as Riadok[], sieto: sieto.data as Riadok | null, velkosti: (velkosti.data || []) as Riadok[] };
}

type Tlac = { umiestnenie: string; sirkaCm: number; vyskaCm: number; farby: number; efekt: string; suborCesta: string | null; suborNazov: string | null };
type Vyber = { material: string; tmavy: boolean; dveVelkosti: boolean; pocetKs: number; tlace: Tlac[]; osobnyOdber: boolean; b2bKod: string };

function normalizuj(ctx: Kontext, b: Riadok, suborPovinny: boolean): Vyber {
  const { nast } = ctx;
  const tlaceVstup: Riadok[] = Array.isArray(b.tlace) ? b.tlace : [];
  if (tlaceVstup.length === 0) throw new Error('Pridajte aspoň jednu potlač.');
  if (tlaceVstup.length > MAX_TLACI) throw new Error(`Najviac ${MAX_TLACI} potlačí na jednom kuse.`);
  const pouzite = new Set<string>();
  const tlace: Tlac[] = tlaceVstup.map((t) => {
    const um = ctx.umiestnenia.find((u) => u.kod === t.umiestnenie);
    if (!um) throw new Error('Vyberte umiestnenie potlače.');
    if (pouzite.has(um.kod)) throw new Error(`Umiestnenie „${um.nazov}“ máte v objednávke dvakrát.`);
    pouzite.add(um.kod);
    const maxS = Math.min(num(um.max_sirka_cm, 43), num(nast.max_sirka_cm, 43)), maxV = Math.min(num(um.max_vyska_cm, 58), num(nast.max_vyska_cm, 58));
    const efekt = ctx.efekty.some((e) => e.kod === t.efekt) ? String(t.efekt) : (ctx.efekty[0]?.kod || 'klasicka');
    let suborCesta: string | null = null;
    if (t.suborCesta) {
      suborCesta = String(t.suborCesta);
      if (!suborCesta.startsWith('sietotlac/') || suborCesta.includes('..')) throw new Error('Neplatný nahraný súbor.');
    }
    if (suborPovinny && !suborCesta) throw new Error(`Nahrajte grafiku k potlači „${um.nazov}“.`);
    return {
      umiestnenie: um.kod, sirkaCm: Math.min(Math.max(num(t.sirkaCm, 10), 1), maxS), vyskaCm: Math.min(Math.max(num(t.vyskaCm, 10), 1), maxV),
      farby: Math.min(8, Math.max(1, Math.round(num(t.farby, 1)))), efekt, suborCesta, suborNazov: t.suborNazov ? String(t.suborNazov).slice(0, 200) : null,
    };
  });
  return {
    material: b.material === 'polyester' ? 'polyester' : 'bavlna', tmavy: !!b.tmavy, dveVelkosti: !!b.dveVelkosti,
    pocetKs: Math.round(num(b.pocetKs, num(nast.min_ks, 10))), tlace, osobnyOdber: !!b.osobnyOdber, b2bKod: String(b.b2bKod || '').trim().toUpperCase(),
  };
}

// Cena 1 potlače na 1 kuse pri danom počte kusov
function cenaTlace(ctx: Kontext, v: Vyber, t: Tlac, ks: number) {
  const format = najblizsiFormat(ctx.velkosti, t.sirkaCm * t.vyskaCm);
  // Dve veľkosti potlače = dve sady sít: náklad na sitá sa rozpočíta len na polovicu kusov (každá veľkosť má vlastné sitá).
  const ksNaSita = v.dveVelkosti ? Math.max(1, Math.ceil(ks / 2)) : ks;
  const vc = vcSietotlacCelkom(ctx.sieto, format, v.tmavy, t.farby, ksNaSita, ctx.metriky);
  const zaklad = Math.max(priceAt(vc, ks, ctx.cfg), num(ctx.sieto?.min_cena));
  const efekt = ctx.efekty.find((e) => e.kod === t.efekt);
  const priplEfekt = num(efekt?.priplatok_percent);
  const priplPoly = v.material === 'polyester' ? num(ctx.nast.polyester_priplatok_percent) : 0;
  return { cenaKs: r2(zaklad * (1 + priplEfekt / 100) * (1 + priplPoly / 100)), vc, priplEfekt, priplPoly };
}
const cenaKusaSpolu = (ctx: Kontext, v: Vyber, ks: number) => r2(v.tlace.reduce((s, t) => s + cenaTlace(ctx, v, t, ks).cenaKs, 0));

async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: string) {
  if (!kod) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', kod).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(num((data as Riadok | null)?.zlava_percent), 0), 90);
}

async function vyhodnot(supabase: ReturnType<typeof createClient>, ctx: Kontext, v: Vyber) {
  const minKs = Math.round(num(ctx.nast.min_ks, 10)), maxKs = Math.round(num(ctx.nast.max_ks, 5000));
  if (v.pocetKs < minKs) throw new Error(`Minimálny odber pre sieťotlač je ${minKs} ks (príprava sít).`);
  if (v.pocetKs > maxKs) throw new Error(`Pre objednávky nad ${maxKs} ks nám prosím napíšte.`);
  if (!ctx.sieto) throw new Error('Cenník sieťotlače nie je v ERP vyplnený.');
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
  const manipulacia = num(ctx.nast.manipulacny_poplatok_eur);
  const zdarma = num(ctx.nast.postovne_zdarma_od_eur) > 0 && (poZlave + manipulacia) >= num(ctx.nast.postovne_zdarma_od_eur);
  const postovne = v.osobnyOdber || zdarma ? 0 : num(ctx.nast.cena_doprava);
  const spoluBezDph = r2(poZlave + manipulacia + postovne);
  const dph = r2(spoluBezDph * ctx.cfg.dphPercent / 100);
  const spolu = r2(spoluBezDph + dph);
  const urovne = [...new Set([minKs, ...HLADINY.filter((h) => h > minKs && h <= maxKs)])].sort((a, b) => a - b)
    .map((k) => ({ ks: k, cenaKsBezDph: cenaKusaSpolu(ctx, v, k) }));
  return {
    interne: { naklad: r2(naklad), tlaceCeny, cenaKs },
    verejne: {
      pocetKs: ks, cenaKsBezDph: r2(logaSpolu / ks), logaSpoluBezDph: logaSpolu, zlavaB2bPercent: zlavaPercent, zlavaB2bEur: zlavaEur, manipulaciaBezDph: manipulacia,
      postovneBezDph: postovne, spoluBezDph, dphPercent: ctx.cfg.dphPercent, dph, spolu, ksSpolu: ks, doplatokMinimaBezDph: doplatokMinima,
      pocetSit: v.tlace.reduce((s, t) => s + t.farby, 0) * (v.dveVelkosti ? 2 : 1), urovne,
      tlace: tlaceCeny.map((x) => ({ umiestnenie: x.t.umiestnenie, nazov: ctx.umiestnenia.find((u) => u.kod === x.t.umiestnenie)?.nazov || x.t.umiestnenie, cenaKsBezDph: x.cenaKs, priplatokEfektPercent: x.priplEfekt })),
      priplatokPolyesterPercent: tlaceCeny[0]?.priplPoly || 0,
    } as Record<string, unknown>,
  };
}

async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
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

const eur = (x: number) => `${x.toFixed(2).replace('.', ',')} €`;
const popisTlace = (ctx: Kontext, t: Tlac) => `${ctx.umiestnenia.find((u) => u.kod === t.umiestnenie)?.nazov || t.umiestnenie}: ${t.sirkaCm} × ${t.vyskaCm} cm, ${t.farby} ${t.farby === 1 ? 'farba' : t.farby < 5 ? 'farby' : 'farieb'}, ${ctx.efekty.find((e) => e.kod === t.efekt)?.nazov || t.efekt}`;

function textRekapitulacie(ctx: Kontext, v: Vyber, r: Riadok, k: Riadok, cislo: string) {
  const L = [
    `Dopyt ${cislo} – sieťotlač PBT`,
    `Kontakt: ${k.meno || '–'}, ${k.telefon || '–'}, ${k.email}`,
    ...(r.zlavaB2bPercent > 0 ? [`B2B kód: ${v.b2bKod} (−${r.zlavaB2bPercent} %)`] : []),
    '',
    `Počet kusov: ${v.pocetKs}`,
    `Textil: ${v.material === 'polyester' ? 'polyester' : 'bavlna'}, ${v.tmavy ? 'tmavý' : 'svetlý'}`,
    `Potlače na jednom kuse (${v.tlace.length}):`,
    ...v.tlace.map((t) => `  • ${popisTlace(ctx, t)}`),
    v.dveVelkosti ? 'Dve veľkosti potlače (2 sady sít)' : 'Jedna veľkosť potlače',
    `Počet sít: ${r.pocetSit}`,
    `Orientačná cena: ${eur(r.cenaKsBezDph)}/ks bez DPH, spolu za potlač ${eur(r.logaSpoluBezDph)} bez DPH (s doručením a DPH ${eur(r.spolu)})`,
  ];
  if (k.poznamka) L.push('', `Poznámka / odkaz na grafiku: ${k.poznamka}`);
  return L.join('\n');
}

async function posliEmaily(supabase: ReturnType<typeof createClient>, nast: Riadok, k: Riadok, cislo: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { odoslany: false };
  const { data: o } = await supabase.from('upomienky_nastavenia').select('odosielatel_meno, odosielatel_email').eq('id', 1).maybeSingle();
  if (!o?.odosielatel_email || String(o.odosielatel_email).endsWith('@example.sk')) return { odoslany: false };
  const from = `${o.odosielatel_meno || 'PBT'} <${o.odosielatel_email}>`;
  const posli = (to: string, subject: string, body: string) => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text: body }) });
  let zakaznik = false;
  try {
    const r = await posli(k.email, `Dopyt ${cislo} – sieťotlač PBT: sme ho prijali`, `Dobrý deň,\n\ndakujeme za váš dopyt. Záväznú ponuku a vizualizáciu vám pošleme do 24 hodín.\n\n${text}\n\nPBT · pbtprint.sk`);
    zakaznik = r.ok;
  } catch { /* e-mail je len pohodlie */ }
  if (nast.email_notifikacie) { try { await posli(String(nast.email_notifikacie).trim(), `Nový dopyt ${cislo} – sieťotlač (${k.meno || k.email})`, text); } catch { /* ignorovať */ } }
  return { odoslany: zakaznik };
}

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
      const n = ctx.nast;
      return odpoved({
        ok: true,
        nastavenia: {
          aktivny: n.aktivny !== false, minKs: num(n.min_ks, 10), maxKs: num(n.max_ks, 5000), maxSirkaCm: num(n.max_sirka_cm, 43), maxVyskaCm: num(n.max_vyska_cm, 58),
          polyesterPriplatokPercent: num(n.polyester_priplatok_percent), infoText: n.info_text || '', dphPercent: ctx.cfg.dphPercent,
        },
        efekty: ctx.efekty.map((e) => ({ kod: e.kod, nazov: e.nazov, popis: e.popis || '', priplatokPercent: num(e.priplatok_percent) })),
        umiestnenia: ctx.umiestnenia.map((u) => ({ kod: u.kod, nazov: u.nazov, popis: u.popis || '', strana: u.strana, maxSirkaCm: Math.min(num(u.max_sirka_cm), num(n.max_sirka_cm, 43)), maxVyskaCm: Math.min(num(u.max_vyska_cm), num(n.max_vyska_cm, 58)), vychodziaSirkaCm: num(u.vychodzia_sirka_cm, 20), vychodziaVyskaCm: num(u.vychodzia_vyska_cm, 20) })),
      });
    }
    if (ctx.nast.aktivny === false) throw new Error('Kalkulačka sieťotlače je dočasne vypnutá.');

    if (akcia === 'cena') {
      const v = normalizuj(ctx, body, false);
      const r = await vyhodnot(supabase, ctx, v);
      return odpoved({ ok: true, ...r.verejne });
    }

    if (akcia === 'dopyt') {
      if (body.hp) return odpoved({ ok: true, cislo: 'SIT-0' }); // honeypot (bot)
      const k = body.kontakt || {};
      const email = String(k.email || '').trim(), meno = String(k.meno || '').trim().slice(0, 120);
      const telefon = String(k.telefon || '').trim().slice(0, 40), poznamka = String(k.poznamka || '').trim().slice(0, 2000);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Zadajte platný e-mail, na ktorý pošleme ponuku.');
      if (!meno) throw new Error('Doplňte meno alebo názov firmy.');
      if (!telefon) throw new Error('Doplňte telefónne číslo.');

      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'neznama';
      const ipHash = await sha256(ip + '|' + (Deno.env.get('SUPABASE_URL') || ''));
      const odHodiny = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count } = await supabase.from('sietotlac_dopyty').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', odHodiny);
      if ((count || 0) >= 6) throw new Error('Z tejto adresy prišlo príliš veľa dopytov. Skúste to prosím neskôr alebo nám napíšte e-mail.');

      const v = normalizuj(ctx, body.vyber || {}, false);
      const r = await vyhodnot(supabase, ctx, v);
      const cislo = await ziskajCislo(supabase, 'SIT');
      const kontakt = { meno, telefon, email, poznamka };
      const text = textRekapitulacie(ctx, v, r.verejne, kontakt, cislo);
      const { error: insErr } = await supabase.from('sietotlac_dopyty').insert({
        cislo, meno, email, telefon, poznamka, konfig: v, pocet_ks: v.pocetKs, cena_kus_bez_dph: r.verejne.cenaKsBezDph, cena_spolu_bez_dph: r.verejne.logaSpoluBezDph, ip_hash: ipHash,
        b2b_kod: (r.verejne.zlavaB2bPercent as number) > 0 ? v.b2bKod : null,
      });
      if (insErr) throw insErr;
      const mail = await posliEmaily(supabase, ctx.nast, kontakt, cislo, text);
      return odpoved({ ok: true, cislo, email: mail.odoslany });
    }

    if (akcia === 'objednat') {
      const v = normalizuj(ctx, body, true);
      const r = await vyhodnot(supabase, ctx, v);
      const c = r.verejne as Riadok;
      const cislo = await ziskajCislo(supabase, 'SIE');
      const objednavkaId = crypto.randomUUID();
      const odkazy: (string | null)[] = [];
      for (const t of v.tlace) odkazy.push(await podpisanyOdkaz(supabase, t.suborCesta));
      const polozky = v.tlace.map((t, i) => ({ ...t, nazov: ctx.umiestnenia.find((u) => u.kod === t.umiestnenie)?.nazov || t.umiestnenie, cenaKs: r.interne.tlaceCeny[i].cenaKs, suborUrl: odkazy[i] }));
      const { error: insErr } = await supabase.from('sietotlac_objednavky').insert({
        id: objednavkaId, cislo_objednavky: cislo, pocet_ks: v.pocetKs, material: v.material, tmavy: v.tmavy, dve_velkosti: v.dveVelkosti, polozky,
        cena_kus: c.cenaKsBezDph, cena_spolu: c.spolu, naklad_spolu: r.interne.naklad, b2b_kod: (c.zlavaB2bPercent as number) > 0 ? v.b2bKod : null, osobny_odber: v.osobnyOdber,
        subor_nazov: v.tlace[0].suborNazov, subor_cesta: v.tlace[0].suborCesta,
      });
      if (insErr) throw insErr;
      const nazvyUmiestneni = polozky.map((p) => p.nazov).join(', ');
      const checkoutUrl = await vytvorDraft([{
        title: `Sieťotlač — ${v.pocetKs}× ${v.material === 'polyester' ? 'polyester' : 'bavlna'}, ${v.tmavy ? 'tmavý' : 'svetlý'} textil (${nazvyUmiestneni})${v.osobnyOdber ? ' (osobný odber)' : ''}`,
        price: c.spolu as number, requiresShipping: !v.osobnyOdber,
        properties: [
          { name: '_cislo_objednavky', value: cislo }, { name: '_objednavka_id', value: objednavkaId }, { name: '_sietotlac', value: 'true' },
          { name: '_pocet_ks', value: String(v.pocetKs) }, { name: '_textil', value: `${v.material}, ${v.tmavy ? 'tmavý' : 'svetlý'}` }, { name: '_dve_velkosti', value: v.dveVelkosti ? 'áno' : 'nie' },
          ...polozky.flatMap((p, i) => [{ name: `_potlac_${i + 1}`, value: popisTlace(ctx, p) }, { name: `_subor_link_${i + 1}`, value: p.suborUrl || '' }]),
          { name: '_osobny_odber', value: v.osobnyOdber ? 'áno' : 'nie' }, { name: '_b2b_kod', value: (c.zlavaB2bPercent as number) > 0 ? v.b2bKod : '' },
        ],
      }], `${cislo} (sieťotlač, ${v.pocetKs} ks)\n${polozky.map((p, i) => `${i + 1}. ${popisTlace(ctx, p)}${p.suborUrl ? `\nSúbor: ${p.suborUrl}` : ''}`).join('\n')}`, 'sietotlac');
      return odpoved({ ok: true, checkoutUrl, cenaSpolu: c.spolu, objednavkaId, cisloObjednavky: cislo });
    }
    throw new Error('Neznáma akcia.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as Riadok).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
