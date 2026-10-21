// @ts-nocheck
// Edge Function: ponuka-dresy — verejná ponuka dresov pre kluby, školy a agentúry.
//   { akcia: 'cennik' }  -> verejný cenník (ceny s DPH za kus, zľavy, termíny, rozmerová tabuľka). Predajné ceny sa počítajú z výrobných cien
//                           (produkt z Katalógu alebo ručný náklad) cez maržový modul + DPH, alebo sú ručne prepísané v ERP. Náklady a marže sa NEposielajú.
//   { akcia: 'dopyt', vyber, supiska, kontakt, b2bKod } -> cena sa PREPOČÍTA na serveri (klientom poslaná cena sa ignoruje), dopyt sa uloží
//                           do ponuka_dopyty a odošle sa potvrdzujúci e-mail zákazníkovi + upozornenie firme (ak je nastavený Resend a odosielateľ).
//   { akcia: 'b2b', kod } -> overenie B2B kódu (tabuľka b2b_kody, rovnaké kódy ako v ostatných konfigurátoroch).
// Súbor je SAMOSTATNÝ (žiadne importy z ../_shared/). Výpočet ceny je kópia z printstudio-pro/src/ponuka/ponukaCalc.js — pri zmene pregeneruj.
// Secrets: RESEND_API_KEY (voliteľné — e-maily); odosielateľ sa berie z tabuľky upomienky_nastavenia (ERP → Upomienky).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const odpoved = (body) => new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r2 = (x) => Math.round(x * 100) / 100;
const eur = (v) => `${r2(v).toFixed(2).replace('.', ',')} €`;

// Maržový vzorec je duplikát z src/printstudio/pricingEngine.js
function baseMargin(cost, cfg) { const c = Math.max(cost, 0.05); const m = cfg.coefA - cfg.coefB * Math.log(c); return Math.min(Math.max(m, cfg.marginFloor), 450); }
function marginAt(cost, qty, cfg) {
  const base = baseMargin(cost, cfg); const q = Math.max(qty, 1);
  const qm = Math.max(cfg.cielovaHodnotaZakazky / Math.max(cost, 0.05), 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  return cfg.marginFloor + (base - cfg.marginFloor) * Math.pow(t, cfg.coefP);
}
const priceAt = (cost, qty, cfg) => Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;

// ---- výpočet ceny (kópia z ponukaCalc.js) ----
// Výpočet ceny ponuky dresov — JEDNA logika pre klienta (okamžitá odozva) aj server (Edge Function ponuka-dresy ju má vloženú ako kópiu,
// súbor supabase/functions/ponuka-dresy/index.ts sa generuje zo scratch šablóny — pri zmene tohto súboru ho treba pregenerovať).
// cfg = verejný cenník z funkcie (ceny s DPH za kus), S = výber zákazníka, roster = súpiska [{m, c, s, g}].
//
// SKLAD:  jednotka = sklad[šport][položka]; dres += dotlač(meno/číslo/logo) + aplikácie; trenírky += číslo na trenírky; brankári sa nerozlišujú.
// CELOPOTLAČ: základ = ceny[šport][položka][úroveň] (hokejové štulpne: verzia); dres hráč = základ + rukáv* + strih + golier + (meno&číslo) + aplikácie;
//             dres brankár = základ + strih + golier + (meno&číslo) + aplikácie + brankársky strih + (futbal ? dlhý rukáv : rukáv*) + (futbal && lakte);
//             trenírky brankár += boky (futbal). *príplatok za rukáv len ak šport ponúka viac ako 1 rukáv.
// Zľavy: množstevná zo hrubej ceny, B2B z (hrubá − množstevná), termín z (hrubá − množstevná − B2B); celková zľava je zastropená (cfg.maxZlavaPercent).

const POLOZKY = { dres: 'Dres', trenirky: 'Trenírky', stulpne: 'Štulpne' };
const STULP_HOKEJ = ['Simple', 'Pletené', 'Profesionálne'];
const VELKOSTI = ['128', '134', '140', '146', '152', '158', '164', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const maSklad = (cfg, sport) => !!(cfg.stock?.[sport] && Object.keys(cfg.stock[sport]).length);
const dostupnePolozky = (cfg, S) => Object.keys(((S.mode === 'stock' ? cfg.stock : cfg.items) || {})[S.sport] || {});
const brankariZapnuty = (cfg, S) => S.mode === 'custom' && !!cfg.sporty?.[S.sport] && cfg.sporty[S.sport].brankari !== 'none';

// Opraví výber tak, aby bol platný pre šport a režim (rovnako ako pri prekreslení v prototype)
function normalizujVyber(cfg, S) {
  const sp = cfg.sporty?.[S.sport];
  if (!sp) return S;
  if (S.mode === 'stock' && !maSklad(cfg, S.sport)) S.mode = 'custom';
  if (!sp.rukavy.includes(S.sleeve)) S.sleeve = sp.rukavy.includes('kratky') ? 'kratky' : sp.rukavy[0];
  if (!sp.goliere.includes(S.collar)) S.collar = sp.goliere[0];
  const av = dostupnePolozky(cfg, S);
  S.comps = S.comps || {};
  Object.keys(S.comps).forEach((k) => { if (!av.includes(k)) S.comps[k] = false; });
  if (!Object.keys(S.comps).some((k) => S.comps[k]) && av.length) S.comps[av[0]] = true;
  return S;
}

function spocitaj(cfg, S, roster = []) {
  const sp = cfg.sporty[S.sport];
  const stock = S.mode === 'stock';
  const chosen = dostupnePolozky(cfg, S).filter((k) => S.comps?.[k]);
  const appsSum = Object.keys(cfg.apps || {}).filter((k) => S.apps?.[k]).reduce((a, k) => a + num(cfg.apps[k]), 0);
  const gkOn = brankariZapnuty(cfg, S);
  let players, gk;
  if (S.pmode === 'roster') { players = roster.length; gk = gkOn ? roster.filter((r) => r.g).length : 0; }
  else { players = Math.max(0, Math.floor(num(S.players))); gk = gkOn ? Math.min(Math.max(0, Math.floor(num(S.gk))), players) : 0; }
  const field = players - gk;
  const unit = {}, unitGk = {};
  chosen.forEach((k) => {
    let p;
    if (stock) {
      p = num(cfg.stock[S.sport][k]);
      if (k === 'dres') p += ['meno', 'cislo', 'logo'].reduce((a, x) => a + (S.prints?.[x] ? num(cfg.dotlac[x]) : 0), 0) + appsSum;
      if (k === 'trenirky' && S.prints?.cisloTren) p += num(cfg.dotlac.cisloTren);
      unit[k] = unitGk[k] = p;
      return;
    }
    const arr = cfg.items[S.sport][k];
    p = k === 'stulpne' && S.sport === 'hokej' ? num(arr[S.stulpVer]) : num(arr[S.tier]);
    let g = p;
    if (k === 'dres') {
      const slv = sp.rukavy.length > 1 ? num(cfg.sleeve[S.sleeve]) : 0;
      const add = num(cfg.fit[S.fit]) + num(cfg.collar[S.collar]) + (S.nn ? num(cfg.nameNum) : 0) + appsSum;
      p += slv + add;
      g += add + num(cfg.gk.cut) + (sp.brankari === 'futbal' ? num(cfg.sleeve.dlhy) : slv) + (sp.brankari === 'futbal' && S.gkElbow ? num(cfg.gk.lakte) : 0);
    }
    if (k === 'trenirky' && sp.brankari === 'futbal' && S.gkHip) g += num(cfg.gk.boky);
    unit[k] = p; unitGk[k] = g;
  });
  const pcs = players * chosen.length;
  const gross = chosen.reduce((a, k) => a + unit[k] * field + unitGk[k] * gk, 0);
  const volume = [...(cfg.volume || [])].sort((a, b) => a[0] - b[0]).map(([min, p]) => ({ min: num(min), p: num(p) }));
  if (!volume.length || volume[0].min > 1) volume.unshift({ min: 1, p: 0 });
  const vt = [...volume].reverse().find((t) => pcs >= t.min) || volume[0];
  const vol = gross * vt.p / 100;
  const b2bP = S.b2b ? num(S.b2b.p) : 0;
  const b2bAmt = (gross - vol) * b2bP / 100;
  const dp = num(cfg.delivery[S.del]);
  const delAmt = (gross - vol - b2bAmt) * dp / 100;
  let total = gross - vol - b2bAmt + delAmt;
  // strop celkovej zľavy
  let capped = false;
  const cap = num(cfg.maxZlavaPercent);
  if (cap > 0 && gross > 0 && (gross - total) / gross * 100 > cap) { total = gross * (1 - cap / 100); capped = true; }
  const vat = 1 + num(cfg.vat) / 100;
  const show = (v) => (S.b2b ? v / vat : v); // B2B vidí ceny bez DPH
  return { sp, stock, players, gk, chosen, pcs, gross, vt, volume, vol, b2bAmt, b2bP, delAmt, total, capped, vat, show, unit, unitGk, gkOn, appsSum };
}

// Normalizácia veľkostí z Excelu (XXL → 2XL, XXXL → 3XL)
function normVelkost(v) {
  const x = String(v || '').trim().toUpperCase().replace('XXXL', '3XL').replace('XXL', '2XL');
  return VELKOSTI.includes(x) ? x : 'M';
}

// Import riadkov súpisky (Excel/CSV/vložený text): hlavička sa rozpozná podľa názvov stĺpcov (meno, číslo, veľkosť, brankár)
function importujRiadky(rows) {
  rows = rows.filter((r) => r && r.some((c) => String(c).trim() !== ''));
  if (!rows.length) return [];
  let iM = 0, iC = 1, iS = 2, iG = -1;
  const h = rows[0].map((c) => String(c).toLowerCase());
  if (h.some((c) => /meno|name|priezv|číslo|cislo|veľk|velk|size|brank/.test(c))) {
    h.forEach((c, i) => {
      if (/meno|name|priezv/.test(c)) iM = i; else if (/čís|cis|num|#/.test(c)) iC = i; else if (/veľk|velk|size/.test(c)) iS = i; else if (/brank|gk|post/.test(c)) iG = i;
    });
    rows = rows.slice(1);
  }
  return rows.map((r) => ({
    m: String(r[iM] ?? '').trim(), c: String(r[iC] ?? '').trim(), s: normVelkost(r[iS]),
    g: iG >= 0 && /^(a|áno|ano|x|1|b|brankár|brankar|gk|yes)$/i.test(String(r[iG]).trim()),
  }));
}


async function nacitajPricingCfg(supabase) {
  const { data: cfg } = await supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle();
  return cfg
    ? { coefA: n(cfg.coef_a), coefB: n(cfg.coef_b), marginFloor: n(cfg.margin_floor), coefP: n(cfg.coef_p), cielovaHodnotaZakazky: n(cfg.cielova_hodnota_zakazky, 25000) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000 };
}

// Verejný cenník v tvare, ktorý používa konfigurátor (ceny s DPH za kus)
async function zostavCennik(supabase) {
  const [nastR, sportyR, polozkyR, priplR, zlavyR, terminyR, velkR, pcfg] = await Promise.all([
    supabase.from('ponuka_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('ponuka_sporty').select('*').eq('aktivny', true).order('poradie'),
    supabase.from('ponuka_polozky').select('*'),
    supabase.from('ponuka_priplatky').select('*'),
    supabase.from('ponuka_zlavy_mnozstvo').select('*').order('min_ks'),
    supabase.from('ponuka_terminy').select('*').order('poradie'),
    supabase.from('ponuka_velkosti').select('*').order('poradie'),
    nacitajPricingCfg(supabase),
  ]);
  const nast = nastR.data;
  if (!nast) throw new Error('Ponuka dresov nie je pripravená (spusti migration_ponuka_dresy.sql).');
  const vat = n(nast.dph_percent, 23);
  const polozky = polozkyR.data || [], pripl = priplR.data || [];
  const ids = [...new Set([...polozky, ...pripl].map((x) => x.produkt_id).filter((x) => x != null))];
  const nakladProduktu = new Map();
  if (ids.length) {
    const { data } = await supabase.from('produkty').select('id, zakladna_cena').in('id', ids);
    (data || []).forEach((p) => nakladProduktu.set(Number(p.id), n(p.zakladna_cena)));
  }
  const cena = (r) => {
    if (r.predajna_s_dph != null) return n(r.predajna_s_dph);
    const naklad = r.produkt_id != null && nakladProduktu.has(Number(r.produkt_id)) ? nakladProduktu.get(Number(r.produkt_id)) : n(r.naklad_eur);
    return naklad > 0 ? r2(priceAt(naklad, 1, pcfg) * (1 + vat / 100)) : null;
  };
  const cfg = { aktivny: nast.aktivny !== false, sporty: {}, poradie: [], items: {}, stock: {}, dotlac: {}, nameNum: 0, fit: {}, sleeve: {}, collar: {}, apps: {}, gk: {}, volume: [], delivery: {}, terminy: {}, vat, maxZlavaPercent: n(nast.max_zlava_percent, 40), sizeChart: {}, updated: String(nast.updated_at || '').slice(0, 10) };
  for (const s of sportyR.data || []) {
    const items = {}, stock = {};
    for (const pol of ['dres', 'trenirky', 'stulpne']) {
      const arr = [0, 1, 2].map((u) => { const r = polozky.find((x) => x.sport_kod === s.kod && x.polozka === pol && x.rezim === 'custom' && x.uroven === u); return r ? cena(r) : null; });
      if (arr.some((v) => v != null)) { let last = arr.find((v) => v != null); items[pol] = arr.map((v) => { if (v != null) last = v; return v ?? last; }); }
      const sr = polozky.find((x) => x.sport_kod === s.kod && x.polozka === pol && x.rezim === 'stock' && x.uroven === 0);
      const sc = sr ? cena(sr) : null; if (sc != null) stock[pol] = sc;
    }
    if (!Object.keys(items).length && !Object.keys(stock).length) continue;
    cfg.items[s.kod] = items; if (Object.keys(stock).length) cfg.stock[s.kod] = stock;
    cfg.sporty[s.kod] = { n: s.nazov, rukavy: s.rukavy, goliere: s.goliere, brankari: s.brankari, skladPoznamka: s.sklad_poznamka || '' };
    cfg.poradie.push(s.kod);
  }
  for (const p of pripl) {
    const v = cena(p) ?? 0;
    if (p.kod === 'nameNum') cfg.nameNum = v;
    else { const [g, k] = String(p.kod).split('.'); if (cfg[g] && k) cfg[g][k] = v; }
  }
  cfg.volume = (zlavyR.data || []).map((x) => [n(x.min_ks), n(x.zlava_percent)]);
  for (const t of terminyR.data || []) { cfg.delivery[t.kod] = n(t.uprava_percent); cfg.terminy[t.kod] = { n: t.nazov, custom: t.text_custom, sklad: t.text_sklad }; }
  for (const v of velkR.data || []) cfg.sizeChart[v.velkost] = [n(v.hrudnik_klasik), n(v.hrudnik_slim), n(v.hrudnik_obtiahnuty), n(v.dlzka)];
  return { cfg, nast };
}

async function overB2b(supabase, kod) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k || k.length > 60) return null;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent, agentura').eq('kod', k).eq('aktivny', true).maybeSingle();
  if (!data) { await new Promise((r) => setTimeout(r, 600)); return null; }
  return { kod: k, p: n(data.zlava_percent), n: data.agentura || '' };
}

async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function ziskajCislo(supabase, prefix) {
  const year = new Date().getFullYear(); const sy = String(year).slice(-2);
  const { data: c } = await supabase.from('print_objednavky_pocitadla').select('next_number').eq('prefix', prefix).eq('year', year).maybeSingle();
  const next = c?.next_number || 1;
  await supabase.from('print_objednavky_pocitadla').upsert({ prefix, year, next_number: next + 1 }, { onConflict: 'prefix,year' });
  return `${prefix}-${sy}${String(next).padStart(4, '0')}`;
}

const NAZVY = { slow: 'Bez zhonu', std: 'Štandard', exp: 'Expres' };
function textRekapitulacie(cfg, S, r, kontakt, roster, cislo) {
  const sp = r.sp; const L = [];
  L.push(`Dopyt ${cislo} – dresy PBT`, `Klub / škola / firma: ${kontakt.klub || '–'}`, `Kontakt: ${kontakt.kto || '–'}${kontakt.telefon ? ', ' + kontakt.telefon : ''}${kontakt.email ? ', ' + kontakt.email : ''}`);
  if (S.b2b) L.push(`B2B kód: ${S.b2b.kod} (${S.b2b.n}, −${S.b2b.p} %)`);
  L.push('', `Šport: ${sp.n}`, `Typ výroby: ${r.stock ? 'Zo skladu + dotlač' : 'Zákazková celopotlač'}`);
  L.push('Položky: ' + r.chosen.map((k) => POLOZKY[k] + ` ${eur(r.show(r.unit[k]))}/ks`).join(', '));
  L.push(`Hráčov: ${r.players}${r.gk ? ` (z toho brankárov ${r.gk})` : ''}, kusov spolu: ${r.pcs}`);
  L.push(`Termín: ${cfg.terminy[S.del]?.n || S.del} (${cfg.terminy[S.del]?.[r.stock ? 'sklad' : 'custom'] || ''})`);
  L.push(`Cena bez zliav: ${eur(r.show(r.gross))}`, `Množstevná zľava ${r.vt.p} %: −${eur(r.show(r.vol))}`);
  if (S.b2b) L.push(`B2B zľava ${S.b2b.p} %: −${eur(r.show(r.b2bAmt))}`);
  L.push(S.b2b ? `Orientačne spolu bez DPH: ${eur(r.show(r.total))} (s DPH ${eur(r.total)})` : `Orientačne spolu s DPH: ${eur(r.total)}`);
  if (roster.length) { L.push('', 'SÚPISKA'); roster.forEach((x, i) => L.push(`${i + 1}. ${x.m || '–'}  #${x.c || '–'}  ${x.s}${x.g ? '  BRANKÁR' : ''}`)); }
  if (kontakt.poznamka) L.push('', `Poznámka: ${kontakt.poznamka}`);
  return L.join('\n');
}

async function posliEmaily(supabase, nast, kontakt, cislo, text) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { odoslany: false, dovod: 'bez RESEND_API_KEY' };
  const { data: o } = await supabase.from('upomienky_nastavenia').select('odosielatel_meno, odosielatel_email').eq('id', 1).maybeSingle();
  if (!o?.odosielatel_email || String(o.odosielatel_email).endsWith('@example.sk')) return { odoslany: false, dovod: 'odosielateľ nie je nastavený' };
  const from = `${o.odosielatel_meno || 'PBT'} <${o.odosielatel_email}>`;
  const posli = (to, subject, body) => fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, text: body }) });
  let zakaznik = false;
  try {
    const r = await posli(kontakt.email, `Dopyt ${cislo} – dresy PBT: sme ho prijali`, `Dobrý deň,\n\ndakujeme za váš dopyt. Presnú ponuku vám pošleme do 1 pracovného dňa.\n\n${text}\n\nPBT · pbtprint.sk`);
    zakaznik = r.ok;
  } catch { /* e-mail je len pohodlie */ }
  if (nast.email_notifikacie) { try { await posli(String(nast.email_notifikacie).trim(), `Nový dopyt ${cislo} – dresy (${kontakt.klub || 'bez názvu'})`, text); } catch { /* ignorovať */ } }
  return { odoslany: zakaznik };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    if (body.akcia === 'b2b') {
      const b = await overB2b(supabase, body.kod);
      return odpoved(b ? { ok: true, platny: true, zlavaPercent: b.p, agentura: b.n } : { ok: true, platny: false });
    }
    const { cfg, nast } = await zostavCennik(supabase);
    if (body.akcia === 'cennik' || !body.akcia) return odpoved({ ok: true, cennik: cfg });
    if (cfg.aktivny === false) throw new Error('Ponuka dresov je dočasne vypnutá.');

    if (body.akcia === 'dopyt') {
      if (body.hp) return odpoved({ ok: true, cislo: 'DOP-0' }); // honeypot (bot)
      const k = body.kontakt || {};
      const email = String(k.email || '').trim(), kto = String(k.kto || '').trim().slice(0, 120), klub = String(k.klub || '').trim().slice(0, 120);
      const telefon = String(k.telefon || '').trim().slice(0, 40), poznamka = String(k.poznamka || '').trim().slice(0, 2000);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Zadajte platný e-mail, na ktorý pošleme ponuku.');
      if (!klub && !kto) throw new Error('Doplňte klub / školu / firmu alebo meno kontaktnej osoby.');

      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'neznama';
      const ipHash = await sha256(ip + '|' + (Deno.env.get('SUPABASE_URL') || ''));
      const odHodiny = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count } = await supabase.from('ponuka_dopyty').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', odHodiny);
      if ((count || 0) >= 6) throw new Error('Z tejto adresy prišlo príliš veľa dopytov. Skúste to prosím neskôr alebo nám napíšte e-mail.');

      const S = normalizujVyber(cfg, JSON.parse(JSON.stringify(body.vyber || {})));
      if (!cfg.sporty[S.sport]) throw new Error('Neplatný šport.');
      if (!cfg.terminy[S.del]) S.del = 'std';
      S.tier = Math.min(2, Math.max(0, Math.floor(n(S.tier)))); S.stulpVer = Math.min(2, Math.max(0, Math.floor(n(S.stulpVer))));
      const b2b = body.b2bKod ? await overB2b(supabase, body.b2bKod) : null;
      S.b2b = b2b ? { p: b2b.p, n: b2b.n, kod: b2b.kod } : null;
      const roster = (Array.isArray(body.supiska) ? body.supiska : []).slice(0, 400).map((x) => ({ m: String(x.m || '').slice(0, 60), c: String(x.c || '').slice(0, 10), s: normVelkost(x.s), g: !!x.g }));
      if (S.pmode === 'roster' && !roster.length) S.pmode = 'count';
      S.players = Math.min(2000, Math.max(0, Math.floor(n(S.players))));
      const r = spocitaj(cfg, S, roster);
      if (!r.chosen.length) throw new Error('Vyberte aspoň jednu položku.');
      if (r.players < 1) throw new Error('Zadajte počet hráčov.');

      const cislo = await ziskajCislo(supabase, 'DOP');
      const text = textRekapitulacie(cfg, S, r, { klub, kto, telefon, email, poznamka }, S.pmode === 'roster' ? roster : [], cislo);
      const { error: insErr } = await supabase.from('ponuka_dopyty').insert({
        cislo, klub, kontakt: kto, email, telefon, poznamka, sport: S.sport, rezim: S.mode, hracov: r.players, brankarov: r.gk, kusov: r.pcs,
        konfig: S, supiska: S.pmode === 'roster' ? roster : null, cena_bez_zliav_s_dph: r2(r.gross), cena_spolu_s_dph: r2(r.total), cena_spolu_bez_dph: r2(r.total / r.vat),
        b2b_kod: b2b?.kod || null, agentura: b2b?.n || null, zlava_b2b_percent: b2b?.p ?? null, ip_hash: ipHash,
      });
      if (insErr) throw insErr;
      const mail = await posliEmaily(supabase, nast, { klub, kto, telefon, email, poznamka }, cislo, text);
      return odpoved({ ok: true, cislo, celkomSDph: r2(r.total), celkomBezDph: r2(r.total / r.vat), email: mail.odoslany });
    }
    throw new Error('Neznáma akcia.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String(e.message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
