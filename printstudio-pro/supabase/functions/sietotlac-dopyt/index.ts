// Edge Function: sietotlac-dopyt — verejná appka „Sieťotlač“ (?typ=sietotlac): kalkulačka + dopyt (bez platby).
//   { akcia: 'cennik' }                 -> nastavenia appky + efekty farieb (bez akýchkoľvek nákladov)
//   { akcia: 'cena', ...vyber }         -> cena za kus a spolu (+ množstevná tabuľka)
//   { akcia: 'dopyt', ...vyber, kontakt } -> uloží dopyt (sietotlac_dopyty), pošle e-mail zákazníkovi a obchodníkovi
// Cena = výrobný náklad sieťotlače z Kostry cien (rovnaký vzorec ako dizajner-price-preview) cez maržový modul (Cenotvorba),
// + príplatok za efekt farby a polyester (nastavuje sa v ERP: Aplikácie → Sieťotlač).
// Tabuľky s nákladmi nikdy neopustia server — klient vidí len hotovú cenu.
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

async function nacitajKontext(supabase: ReturnType<typeof createClient>) {
  const [nast, efekty, cfgR, metriky, sieto, velkosti] = await Promise.all([
    supabase.from('sietotlac_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('sietotlac_efekty').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cost_metrics').select('id, name, value, power_kw, amortizacia_hod'),
    supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
    supabase.from('cennik_sietotlac_velkosti').select('*'),
  ]);
  if (nast.error || !nast.data) throw new Error('Appka Sieťotlač ešte nie je pripravená (chýba migrácia migration_sietotlac_appka.sql).');
  const c = cfgR.data;
  const cfg: PricingConfig = c
    ? { coefA: num(c.coef_a), coefB: num(c.coef_b), marginFloor: num(c.margin_floor), coefP: num(c.coef_p), cielovaHodnotaZakazky: num(c.cielova_hodnota_zakazky, 25000), dphPercent: num(c.dph_percent, 23) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };
  return { nast: nast.data as Riadok, efekty: (efekty.data || []) as Riadok[], cfg, metriky: (metriky.data || []) as Riadok[], sieto: sieto.data as Riadok | null, velkosti: (velkosti.data || []) as Riadok[] };
}

type Vyber = { material: string; tmavy: boolean; dveVelkosti: boolean; sirkaCm: number; vyskaCm: number; farby: number; efekt: string; pocetKs: number };

function normalizuj(ctx: Awaited<ReturnType<typeof nacitajKontext>>, b: Riadok): Vyber {
  const { nast } = ctx;
  const maxS = num(nast.max_sirka_cm, 43), maxV = num(nast.max_vyska_cm, 58);
  const sirkaCm = Math.min(Math.max(num(b.sirkaCm, 20), 1), maxS);
  const vyskaCm = Math.min(Math.max(num(b.vyskaCm, 20), 1), maxV);
  const ks = Math.round(num(b.pocetKs, num(nast.min_ks, 10)));
  const efekt = ctx.efekty.some((e) => e.kod === b.efekt) ? String(b.efekt) : (ctx.efekty[0]?.kod || 'klasicka');
  return {
    material: b.material === 'polyester' ? 'polyester' : 'bavlna',
    tmavy: !!b.tmavy, dveVelkosti: !!b.dveVelkosti, sirkaCm, vyskaCm,
    farby: Math.min(8, Math.max(1, Math.round(num(b.farby, 1)))), efekt, pocetKs: ks,
  };
}

function cenaPre(ctx: Awaited<ReturnType<typeof nacitajKontext>>, v: Vyber, ks: number) {
  const plocha = v.sirkaCm * v.vyskaCm;
  const format = najblizsiFormat(ctx.velkosti, plocha);
  // Dve veľkosti potlače = dve sady sít: náklad na sitá sa rozpočíta len na polovicu kusov (každá veľkosť má vlastné sitá).
  const ksNaSita = v.dveVelkosti ? Math.max(1, Math.ceil(ks / 2)) : ks;
  const vc = vcSietotlacCelkom(ctx.sieto, format, v.tmavy, v.farby, ksNaSita, ctx.metriky);
  const minCena = num(ctx.sieto?.min_cena);
  const zaklad = Math.max(priceAt(vc, ks, ctx.cfg), minCena);
  const efekt = ctx.efekty.find((e) => e.kod === v.efekt);
  const priplEfekt = num(efekt?.priplatok_percent);
  const priplPoly = v.material === 'polyester' ? num(ctx.nast.polyester_priplatok_percent) : 0;
  const cenaKs = r2(zaklad * (1 + priplEfekt / 100) * (1 + priplPoly / 100));
  return { cenaKs, priplEfekt, priplPoly, formatPouzity: format?.label || null };
}

function vyhodnot(ctx: Awaited<ReturnType<typeof nacitajKontext>>, v: Vyber) {
  const minKs = Math.round(num(ctx.nast.min_ks, 10)), maxKs = Math.round(num(ctx.nast.max_ks, 5000));
  if (v.pocetKs < minKs) throw new Error(`Minimálny odber pre sieťotlač je ${minKs} ks (príprava sít).`);
  if (v.pocetKs > maxKs) throw new Error(`Pre objednávky nad ${maxKs} ks nám prosím napíšte.`);
  if (!ctx.sieto) throw new Error('Cenník sieťotlače nie je v ERP vyplnený.');
  const c = cenaPre(ctx, v, v.pocetKs);
  const spolu = r2(c.cenaKs * v.pocetKs);
  const dph = ctx.cfg.dphPercent;
  const urovne = [...new Set([minKs, ...HLADINY.filter((h) => h > minKs && h <= maxKs)])].sort((a, b) => a - b)
    .map((ks) => ({ ks, cenaKsBezDph: cenaPre(ctx, v, ks).cenaKs }));
  return {
    pocetKs: v.pocetKs, cenaKsBezDph: c.cenaKs, spoluBezDph: spolu, dphPercent: dph, dph: r2(spolu * dph / 100), spoluSDph: r2(spolu * (1 + dph / 100)),
    pocetSit: v.farby * (v.dveVelkosti ? 2 : 1), priplatokEfektPercent: c.priplEfekt, priplatokPolyesterPercent: c.priplPoly, formatPouzity: c.formatPouzity, urovne,
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

const eur = (x: number) => `${x.toFixed(2).replace('.', ',')} €`;
function textRekapitulacie(ctx: Awaited<ReturnType<typeof nacitajKontext>>, v: Vyber, r: ReturnType<typeof vyhodnot>, k: Riadok, cislo: string) {
  const efekt = ctx.efekty.find((e) => e.kod === v.efekt);
  const L = [
    `Dopyt ${cislo} – sieťotlač PBT`,
    `Kontakt: ${k.meno || '–'}, ${k.telefon || '–'}, ${k.email}`,
    '',
    `Počet kusov: ${v.pocetKs}`,
    `Textil: ${v.material === 'polyester' ? 'polyester' : 'bavlna'}, ${v.tmavy ? 'tmavý' : 'svetlý'}`,
    `Motív: ${v.sirkaCm} × ${v.vyskaCm} cm, ${v.farby} ${v.farby === 1 ? 'farba' : v.farby < 5 ? 'farby' : 'farieb'}, ${v.dveVelkosti ? 'dve veľkosti potlače (2 sady sít)' : 'jedna veľkosť potlače'}`,
    `Efekt: ${efekt?.nazov || v.efekt}`,
    `Počet sít: ${r.pocetSit}`,
    `Orientačná cena: ${eur(r.cenaKsBezDph)}/ks bez DPH, spolu ${eur(r.spoluBezDph)} bez DPH (s DPH ${eur(r.spoluSDph)})`,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const ctx = await nacitajKontext(supabase);
    const akcia = body.akcia || 'cennik';

    if (akcia === 'cennik') {
      const n = ctx.nast;
      return odpoved({
        ok: true,
        nastavenia: {
          aktivny: n.aktivny !== false, minKs: num(n.min_ks, 10), maxKs: num(n.max_ks, 5000), maxSirkaCm: num(n.max_sirka_cm, 43), maxVyskaCm: num(n.max_vyska_cm, 58),
          polyesterPriplatokPercent: num(n.polyester_priplatok_percent), infoText: n.info_text || '', dphPercent: ctx.cfg.dphPercent,
        },
        efekty: ctx.efekty.map((e) => ({ kod: e.kod, nazov: e.nazov, popis: e.popis || '', priplatokPercent: num(e.priplatok_percent) })),
      });
    }
    if (ctx.nast.aktivny === false) throw new Error('Kalkulačka sieťotlače je dočasne vypnutá.');

    if (akcia === 'cena') {
      const v = normalizuj(ctx, body);
      return odpoved({ ok: true, cena: vyhodnot(ctx, v) });
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

      const v = normalizuj(ctx, body.vyber || {});
      const r = vyhodnot(ctx, v);
      const cislo = await ziskajCislo(supabase, 'SIT');
      const kontakt = { meno, telefon, email, poznamka };
      const text = textRekapitulacie(ctx, v, r, kontakt, cislo);
      const { error: insErr } = await supabase.from('sietotlac_dopyty').insert({
        cislo, meno, email, telefon, poznamka, konfig: v, pocet_ks: v.pocetKs, cena_kus_bez_dph: r.cenaKsBezDph, cena_spolu_bez_dph: r.spoluBezDph, ip_hash: ipHash,
      });
      if (insErr) throw insErr;
      const mail = await posliEmaily(supabase, ctx.nast, kontakt, cislo, text);
      return odpoved({ ok: true, cislo, email: mail.odoslany });
    }
    throw new Error('Neznáma akcia.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as Riadok).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
