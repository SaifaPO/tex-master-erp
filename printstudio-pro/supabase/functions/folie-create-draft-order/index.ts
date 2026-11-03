// Edge Function: folie-create-draft-order — objednávka rezaných fólií (vektorový súbor, rezanie na plotri). Tri úrovne služby (parameter uroven):
//   'rez' = len rezaná fólia (vylúpanie si robí zákazník), 'vylupanie' = + vylúpame, 'plny' = full servis: vylúpané a nastrihané (jednotlivé motívy).
//   { preview: true, ... } -> len vypočíta cenu + rozloženie na rolke (konfigurátor + ERP kalkulačka; admin dostane aj rozpis nákladov a maržu)
//   { ... }                -> uloží objednávku (folie_objednavky), vytvorí Shopify draft order a vráti odkaz na platbu.
// Náklad = materiál (bm × cena fólie × odpad) + rezanie (stroj + práca) + vylúpanie (min/ks × sadzba) + príprava, × koeficient rizika.
// Nastrihanie (úroveň 'plny') je samostatný príplatok: bm × minút na 1 bm × sadzba strihača × (1 + marža).
// Secrets: SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ---- Spoločná časť (rovnaká vo všetkých funkciách "*-create-draft-order" tejto sady; súbor je samostatný, žiadne importy z ../_shared/) ----
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; cielovaHodnotaZakazky: number; dphPercent: number; }
// Maržový vzorec je duplikát z src/printstudio/pricingEngine.js — pri zmene uprav aj tam.
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

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r2 = (x: number) => Math.round(x * 100) / 100;

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function nacitajCfg(supabase: ReturnType<typeof createClient>): Promise<PricingConfig> {
  const { data: cfg } = await supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle();
  return cfg
    ? { coefA: n(cfg.coef_a), coefB: n(cfg.coef_b), marginFloor: n(cfg.margin_floor), coefP: n(cfg.coef_p), cielovaHodnotaZakazky: n(cfg.cielova_hodnota_zakazky, 25000), dphPercent: n(cfg.dph_percent, 23) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };
}

async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(n((data as any)?.zlava_percent), 0), 90);
}

// Predajná cena objednávky s jedným alebo VIACERÝMI motívmi (košík motívov — jedno poštovné, jedna manipulácia):
// množstevná hladina sa počíta z CELKOVÉHO počtu kusov všetkých motívov, minimálna cena platí raz na celú objednávku
// (doplatok sa rozpočíta medzi motívy), B2B zľava, manipulácia, poštovné a DPH sa počítajú z celku.
// Klient cenu len zobrazuje z odpovede servera (cenaNahlad.jsx) — cenu vždy prepočíta server.
type VstupCena = { nakladSpolu: number; ks: number; pridavokEur?: number };
async function spoluCenaViac(supabase: ReturnType<typeof createClient>, nast: any, cfg: PricingConfig, polozky: VstupCena[], osobnyOdber: boolean, b2bKod: unknown) {
  const ksSpolu = polozky.reduce((s, p) => s + p.ks, 0);
  const riadky = polozky.map((p) => {
    const nakladKs = p.nakladSpolu / p.ks;
    const cenaKs = priceAt(nakladKs, ksSpolu, cfg);
    return { ks: p.ks, nakladKs, cenaKs, loga: r2(cenaKs * p.ks), pridavok: p.pridavokEur || 0 };
  });
  const logaBezMinima = riadky.reduce((s, r) => s + r.loga, 0);
  const doplatokMinima = Math.max(0, n(nast.minimalna_cena_eur) - logaBezMinima);
  const pridavokSpolu = riadky.reduce((s, r) => s + r.pridavok, 0);
  const logaSpolu = logaBezMinima + doplatokMinima + pridavokSpolu;
  const zlavaPercent = await b2bZlava(supabase, b2bKod);
  const zlavaEur = r2(logaSpolu * zlavaPercent / 100);
  const poZlave = logaSpolu - zlavaEur;
  const manipulacia = n(nast.manipulacny_poplatok_eur);
  const zdarma = n(nast.postovne_zdarma_od_eur) > 0 && (poZlave + manipulacia) >= n(nast.postovne_zdarma_od_eur);
  const postovne = osobnyOdber || zdarma ? 0 : n(nast.cena_doprava);
  const spoluBezDph = poZlave + manipulacia + postovne;
  const dph = r2(spoluBezDph * cfg.dphPercent / 100);
  return {
    nakladKs: riadky[0].nakladKs, ksSpolu, riadky, doplatokMinima, logaBezMinima, logaSpolu, poZlave, zlavaPercent, manipulacia, postovne, spolu: r2(spoluBezDph + dph),
    verejne: {
      cenaKsBezDph: logaSpolu / ksSpolu, logaSpoluBezDph: logaSpolu, nastrihanieBezDph: pridavokSpolu, zlavaB2bPercent: zlavaPercent, zlavaB2bEur: zlavaEur, manipulaciaBezDph: manipulacia,
      postovneBezDph: postovne, spoluBezDph: r2(spoluBezDph), dphPercent: cfg.dphPercent, dph, spolu: r2(spoluBezDph + dph),
      ksSpolu, doplatokMinimaBezDph: r2(doplatokMinima),
      polozky: riadky.map((r) => ({ ks: r.ks, cenaKsBezDph: (r.loga + r.pridavok) / r.ks, logaSpoluBezDph: r.loga + r.pridavok })),
    } as Record<string, unknown>,
  };
}
// Jedna položka = pôvodný výpočet (používajú ho aj cenové úrovne)
async function spoluCena(supabase: ReturnType<typeof createClient>, nast: any, cfg: PricingConfig, nakladSpolu: number, ks: number, osobnyOdber: boolean, b2bKod: unknown, pridavokEur = 0) {
  return spoluCenaViac(supabase, nast, cfg, [{ nakladSpolu, ks, pridavokEur }], osobnyOdber, b2bKod);
}

// Rozpis finálnej ceny (s DPH) do položiek Shopify draftu v centoch, aby súčet presne sedel: každý motív má svoj podiel z tovaru
// (po B2B zľave, vrátane doplatku do minima), manipulácia + poštovné idú pri viacerých motívoch ako samostatná položka.
function rozpisCenty(c: any, cfg: PricingConfig, pocet: number) {
  const dphK = 1 + cfg.dphPercent / 100;
  const zK = c.logaSpolu > 0 ? c.poZlave / c.logaSpolu : 1;
  const logaBez = c.logaBezMinima;
  const podiely = c.riadky.map((r: any) => (r.loga + r.pridavok + (logaBez > 0 ? c.doplatokMinima * r.loga / logaBez : 0)) * zK);
  const celkomCents = Math.round(c.spolu * 100);
  const extraCents = pocet > 1 ? Math.round((c.manipulacia + c.postovne) * dphK * 100) : 0;
  const itemCents: number[] = podiely.map((p: number) => Math.round(p * dphK * 100));
  itemCents[itemCents.length - 1] += celkomCents - extraCents - itemCents.reduce((s, x) => s + x, 0);
  return { itemCents, extraCents, celkomCents, dphK };
}

// Podrobný rozpis nákladov a marže vidí len prihlásený admin (ERP), nie zákazník
async function jeAdmin(supabase: ReturnType<typeof createClient>, req: Request) {
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return false;
    const { data: u } = await supabase.auth.getUser(jwt);
    return !!u?.user;
  } catch { return false; }
}

async function ziskajCisloObjednavky(supabase: ReturnType<typeof createClient>, prefix: string) {
  const year = new Date().getFullYear();
  const shortYear = String(year).slice(-2);
  const { data: counter } = await supabase.from('print_objednavky_pocitadla').select('next_number').eq('prefix', prefix).eq('year', year).maybeSingle();
  const nextNum = (counter as { next_number: number } | null)?.next_number || 1;
  await supabase.from('print_objednavky_pocitadla').upsert({ prefix, year, next_number: nextNum + 1 }, { onConflict: 'prefix,year' });
  return `${prefix}-${shortYear}${String(nextNum).padStart(4, '0')}`;
}

async function podpisanyOdkaz(supabase: ReturnType<typeof createClient>, cesta: unknown): Promise<string | null> {
  if (!cesta) return null;
  const { data } = await supabase.storage.from('print-designs').createSignedUrl(String(cesta), 60 * 60 * 24 * 365);
  return data?.signedUrl || null;
}

// Shopify draft order s presnou cenou (cena už zahŕňa DPH, preto taxable: false) -> odkaz na platbu. Jedna alebo viac položiek (motívy + prípadne spoločné poštovné).
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

// Náklad položky: ak je prepojená na produkt z Katalógu, berie sa jeho výrobná cena; inak ručne zadaný náklad.
async function nakladPolozky(supabase: ReturnType<typeof createClient>, riadky: any[]) {
  const ids = [...new Set(riadky.map((x) => x?.produkt_id).filter((x) => x != null))];
  const mapa = new Map<number, number>();
  if (ids.length) {
    const { data } = await supabase.from('produkty').select('id, zakladna_cena').in('id', ids);
    (data || []).forEach((p: any) => mapa.set(Number(p.id), n(p.zakladna_cena)));
  }
  return riadky.map((x) => (x?.produkt_id != null && mapa.has(Number(x.produkt_id)) ? mapa.get(Number(x.produkt_id))! : n(x?.naklad_eur)));
}


// Rozloženie motívov na rolke (orientácia normálna alebo otočená o 90°, vyberie sa kratšia dĺžka) — rovnaká logika ako v prototype/konfigurátore.
function rozlozenie(w: number, h: number, ks: number, pracSirka: number, medzera: number) {
  const skus = (sirka: number, vyska: number) => {
    if (sirka > pracSirka) return null;
    const cols = Math.max(1, Math.floor(pracSirka / (sirka + medzera)));
    const rows = Math.ceil(ks / cols);
    return { cols, rows, dlzkaMm: rows * (vyska + medzera), itemW: sirka, itemH: vyska };
  };
  const a = skus(w, h), b = skus(h, w);
  if (!a && !b) return null;
  if (a && (!b || a.dlzkaMm <= b.dlzkaMm)) return { ...a, otoceny: false };
  return { ...b!, otoceny: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const { preview = false, osobnyOdber = false, b2bKod = null } = body;
    // Viac motívov v jednej objednávke: body.polozky = [{ druh, farba, sirkaMm, vyskaMm, pocetKs, uroven, suborNazov, suborCesta }]; inak sa berie jeden motív z koreňa
    const vstupne: any[] = Array.isArray(body.polozky) && body.polozky.length > 0 ? body.polozky : [body];
    if (vstupne.length > 20) throw new Error('Najviac 20 motívov v jednej objednávke.');
    const [{ data: nast }, cfg] = await Promise.all([
      supabase.from('folie_nastavenia').select('*').eq('id', 1).maybeSingle(),
      nacitajCfg(supabase),
    ]);
    if (!nast) throw new Error('Nastavenia rezaných fólií nie sú k dispozícii (spusti migration_stolove_snurky_folie.sql).');
    if (nast.aktivny === false) throw new Error('Objednávanie rezaných fólií je dočasne vypnuté.');
    const odpadK = 1 + n(nast.odpad_percent) / 100;

    // Výrobný náklad jedného motívu (samostatné rozloženie na rolke, rovnako ako doteraz)
    const spocitajMotiv = async (v: any) => {
      // úroveň služby: rez = len rezanie, vylupanie = + vylúpanie, plny = + vylúpanie a nastrihanie (staršie volania posielajú len separacia true/false)
      const separacia = v.separacia ?? true;
      const urovenVstup = v.uroven ?? null;
      const uroven: 'rez' | 'vylupanie' | 'plny' = urovenVstup === 'rez' || urovenVstup === 'vylupanie' || urovenVstup === 'plny' ? urovenVstup : (separacia ? 'vylupanie' : 'rez');
      const vylupanie = uroven !== 'rez';
      const nastrihane = uroven === 'plny';
      const w = n(v.sirkaMm), h = n(v.vyskaMm), ks = Math.max(1, Math.round(n(v.pocetKs, 1)));
      const [{ data: druh }, { data: farba }] = await Promise.all([
        supabase.from('folie_druhy').select('*').eq('kod', String(v.druh || '')).maybeSingle(),
        supabase.from('folie_farby').select('*').eq('kod', String(v.farba || '')).maybeSingle(),
      ]);
      if (!druh) throw new Error('Vyber druh fólie.');
      if (!farba || farba.druh_kod !== druh.kod) throw new Error('Vyber farbu fólie.');
      const minRozmer = n(nast.min_rozmer_mm, 10);
      if (w < minRozmer || h < minRozmer) throw new Error(`Minimálny rozmer grafiky je ${minRozmer} mm.`);
      const roz = rozlozenie(w, h, ks, n(nast.pracovna_sirka_mm, 490), n(nast.medzera_mm, 5));
      if (!roz) throw new Error(`Grafika sa nezmestí na rolku — jeden z rozmerov musí byť najviac ${n(nast.pracovna_sirka_mm, 490)} mm.`);
      if (roz.dlzkaMm > n(nast.max_dlzka_mm, 10000)) throw new Error('Objednávka je príliš dlhá na jednu rolku — rozdeľ ju na viac objednávok.');

      const dlzkaBm = Math.max(0.1, (roz.dlzkaMm + n(nast.medzera_mm, 5)) / 1000);
      const material = dlzkaBm * n(druh.cena_bm) * odpadK;
      const rezMin = dlzkaBm * n(nast.rez_min_bm);
      const strojRez = (rezMin / 60) * n(nast.stroj_rezanie_hod);
      const velky = Math.max(w, h) > n(nast.hranica_velky_mm, 100);
      const weedMin = vylupanie ? ks * (velky ? n(nast.weeding_min_velky) : n(nast.weeding_min_maly)) : 0;
      const pracaMin = n(nast.priprava_min) + rezMin + weedMin;
      const praca = (pracaMin / 60) * n(nast.praca_hod);
      const zaklad = material + strojRez + praca;
      const nakladSpolu = zaklad * (1 + n(nast.riziko_percent) / 100);
      // Nastrihanie: minút na 1 bm podľa veľkosti motívov × sadzba strihača, plus marža (nastaviteľné v ERP)
      const strihMin = nastrihane ? dlzkaBm * (velky ? n(nast.strihanie_min_bm_velky, 5) : n(nast.strihanie_min_bm_maly, 10)) : 0;
      const nakladStrihanie = (strihMin / 60) * n(nast.strihanie_hod, 7);
      const nastrihanieEur = r2(nakladStrihanie * (1 + n(nast.strihanie_marza_percent, 100) / 100));
      return { v, w, h, ks, druh, farba, uroven, vylupanie, nastrihane, velky, roz, dlzkaBm, material, strojRez, praca, zaklad, nakladSpolu, pracaMin, rezMin, weedMin, strihMin, nakladStrihanie, nastrihanieEur };
    };
    const polozky = [];
    for (const v of vstupne) polozky.push(await spocitajMotiv(v));
    const viac = polozky.length > 1;
    const c = await spoluCenaViac(supabase, nast, cfg, polozky.map((p) => ({ nakladSpolu: p.nakladSpolu, ks: p.ks, pridavokEur: p.nastrihanieEur })), !!osobnyOdber, b2bKod);
    const p0 = polozky[0];
    const vysledok: Record<string, unknown> = { ok: true, ...c.verejne, uroven: p0.uroven, dlzkaBm: r2(polozky.reduce((s, p) => s + p.dlzkaBm, 0)), cols: p0.roz.cols, rows: p0.roz.rows, otoceny: p0.roz.otoceny };
    if (await jeAdmin(supabase, req)) {
      const nakladCelkom = polozky.reduce((s, p) => s + p.nakladSpolu, 0);
      vysledok.admin = { nakladSpolu: r2(nakladCelkom), nakladKs: r2(nakladCelkom / c.ksSpolu), margaEur: r2(c.logaSpolu - nakladCelkom), margaPercent: nakladCelkom > 0 ? r2((c.logaSpolu / nakladCelkom - 1) * 100) : 0,
        rozpis: { material: r2(p0.material), strojRezanie: r2(p0.strojRez), praca: r2(p0.praca), riziko: r2(p0.nakladSpolu - p0.zaklad), nastrihanie: r2(p0.nakladStrihanie) },
        spotreba: { dlzkaBm: r2(p0.dlzkaBm), rezMin: r2(p0.rezMin), separaciaMin: r2(p0.weedMin), pracaMin: r2(p0.pracaMin), nastrihanieMin: r2(p0.strihMin) },
        nastrihanieCena: p0.nastrihanieEur };
    }
    // Cenové úrovne podľa počtu kusov (tabuľka „Množstevné zľavy“) — rovnaký výpočet nákladov pre iný počet kusov, bez B2B zľavy (podľa prvého motívu)
    if (body.urovne) {
      const { w, h, druh, vylupanie, nastrihane, velky } = p0;
      const urovneKs: { ks: number; cenaKsBezDph: number }[] = [];
      for (const l of [1, 5, 10, 25, 50, 100, 200, 500]) {
        const rz = rozlozenie(w, h, l, n(nast.pracovna_sirka_mm, 490), n(nast.medzera_mm, 5));
        if (!rz || rz.dlzkaMm > n(nast.max_dlzka_mm, 10000)) continue;
        const dl = Math.max(0.1, (rz.dlzkaMm + n(nast.medzera_mm, 5)) / 1000);
        const rm = dl * n(nast.rez_min_bm);
        const wm = vylupanie ? l * (velky ? n(nast.weeding_min_velky) : n(nast.weeding_min_maly)) : 0;
        const pm = n(nast.priprava_min) + rm + wm;
        const nk = (dl * n(druh.cena_bm) * odpadK + (rm / 60) * n(nast.stroj_rezanie_hod) + (pm / 60) * n(nast.praca_hod)) * (1 + n(nast.riziko_percent) / 100);
        const sm = nastrihane ? dl * (velky ? n(nast.strihanie_min_bm_velky, 5) : n(nast.strihanie_min_bm_maly, 10)) : 0;
        const ns = r2((sm / 60) * n(nast.strihanie_hod, 7) * (1 + n(nast.strihanie_marza_percent, 100) / 100));
        const cc = await spoluCena(supabase, nast, cfg, nk, l, true, null, ns);
        urovneKs.push({ ks: l, cenaKsBezDph: r2(cc.logaSpolu / l) });
      }
      vysledok.urovne = urovneKs;
    }
    if (preview) return odpoved(vysledok);

    const { itemCents, extraCents, dphK } = rozpisCenty(c, cfg, polozky.length);
    const skupinaId = crypto.randomUUID();
    const riadkyDraft: DraftPolozka[] = [];
    const poznamky: string[] = [];
    let prveId = '', prveCislo = '';
    for (let i = 0; i < polozky.length; i++) {
      const p = polozky[i];
      const { v, w, h, ks, druh, farba, uroven, vylupanie, dlzkaBm, nakladSpolu } = p;
      const objednavkaId = crypto.randomUUID();
      const cislo = await ziskajCisloObjednavky(supabase, 'FOL');
      if (i === 0) { prveId = objednavkaId; prveCislo = cislo; }
      const suborUrl = await podpisanyOdkaz(supabase, v.suborCesta);
      const { error: insErr } = await supabase.from('folie_objednavky').insert({
        id: objednavkaId, cislo_objednavky: cislo, druh: druh.kod, farba: farba.kod, sirka_mm: w, vyska_mm: h, pocet_ks: ks, separacia: vylupanie, uroven, dlzka_bm: r2(dlzkaBm),
        cena_kus: viac ? r2(itemCents[i] / 100 / dphK / ks) : r2(c.poZlave / ks), cena_spolu: viac ? itemCents[i] / 100 : c.spolu, naklad_spolu: r2(nakladSpolu), subor_nazov: v.suborNazov ?? null, subor_cesta: v.suborCesta ?? null, subor_url: suborUrl, osobny_odber: !!osobnyOdber,
        ...(viac ? { skupina_id: skupinaId, poradie: i + 1 } : {}),
      });
      if (insErr) throw insErr;
      riadkyDraft.push({
        title: `Rezaná fólia — ${ks}× ${w}×${h} mm (${druh.nazov}, ${farba.nazov})${uroven === 'plny' ? ' + vylúpanie a nastrihanie' : vylupanie ? ' + vylúpanie' : ''}${viac ? ` — motív ${i + 1}/${polozky.length}` : ''}${osobnyOdber ? ' (osobný odber)' : ''}`,
        price: itemCents[i] / 100, requiresShipping: !osobnyOdber,
        properties: [
          { name: '_cislo_objednavky', value: cislo }, { name: '_objednavka_id', value: objednavkaId }, { name: '_folie', value: 'true' },
          { name: '_druh', value: druh.nazov }, { name: '_farba', value: farba.nazov }, { name: '_rozmer_mm', value: `${w}x${h}` }, { name: '_pocet_ks', value: String(ks) },
          { name: '_dlzka_bm', value: dlzkaBm.toFixed(2) }, { name: '_separacia', value: vylupanie ? 'áno' : 'nie' }, { name: '_uroven_sluzby', value: uroven === 'plny' ? 'Full servis (vylúpané a nastrihané)' : uroven === 'vylupanie' ? 'Rezané + vylúpané' : 'Len rezaná fólia' }, { name: '_subor', value: v.suborNazov || '' }, { name: '_subor_link', value: suborUrl || '' },
          { name: '_osobny_odber', value: osobnyOdber ? 'áno' : 'nie' }, { name: '_b2b_kod', value: c.zlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '' },
          ...(viac ? [{ name: '_motiv', value: `${i + 1}/${polozky.length}` }, { name: '_skupina_id', value: skupinaId }] : []),
        ],
      });
      poznamky.push(`${cislo} (rezané fólie${viac ? `, motív ${i + 1}/${polozky.length}` : ''})` + (suborUrl ? `\nSúbor na rezanie: ${suborUrl}` : ''));
    }
    if (viac && extraCents > 0) riadkyDraft.push({ title: 'Manipulácia a poštovné (spoločné pre všetky motívy)', price: extraCents / 100, requiresShipping: false });
    const checkoutUrl = await vytvorDraft(riadkyDraft, poznamky.join('\n\n'), 'rezane-folie');
    return odpoved({ ok: true, checkoutUrl, cenaSpolu: c.spolu, objednavkaId: prveId, cisloObjednavky: prveCislo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
