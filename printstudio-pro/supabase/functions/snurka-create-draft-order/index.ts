// Edge Function: snurka-create-draft-order — objednávka šnúrok na krk (vlastný dizajn líce + rub).
//   { preview: true, ... } -> len vypočíta cenu (konfigurátor + ERP kalkulačka; admin dostane aj rozpis nákladov a maržu)
//   { ... }                -> uloží objednávku (snurka_objednavky), vytvorí Shopify draft order a vráti odkaz na platbu.
// Náklad 1 ks = model šnúrky (výrobná cena prepojeného produktu z Katalógu, inak ručný náklad z ERP).
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

// Predajná cena z celkového výrobného nákladu: marža podľa množstva, minimálna cena, B2B zľava, manipulácia, poštovné, DPH.
async function spoluCena(supabase: ReturnType<typeof createClient>, nast: any, cfg: PricingConfig, nakladSpolu: number, ks: number, osobnyOdber: boolean, b2bKod: unknown) {
  const nakladKs = nakladSpolu / ks;
  const cenaKs = priceAt(nakladKs, ks, cfg);
  const logaSpolu = Math.max(r2(cenaKs * ks), n(nast.minimalna_cena_eur));
  const zlavaPercent = await b2bZlava(supabase, b2bKod);
  const zlavaEur = r2(logaSpolu * zlavaPercent / 100);
  const poZlave = logaSpolu - zlavaEur;
  const manipulacia = n(nast.manipulacny_poplatok_eur);
  const zdarma = n(nast.postovne_zdarma_od_eur) > 0 && (poZlave + manipulacia) >= n(nast.postovne_zdarma_od_eur);
  const postovne = osobnyOdber || zdarma ? 0 : n(nast.cena_doprava);
  const spoluBezDph = poZlave + manipulacia + postovne;
  const dph = r2(spoluBezDph * cfg.dphPercent / 100);
  return {
    nakladKs, logaSpolu, poZlave, zlavaPercent, spolu: r2(spoluBezDph + dph),
    verejne: {
      cenaKsBezDph: logaSpolu / ks, logaSpoluBezDph: logaSpolu, zlavaB2bPercent: zlavaPercent, zlavaB2bEur: zlavaEur, manipulaciaBezDph: manipulacia,
      postovneBezDph: postovne, spoluBezDph: r2(spoluBezDph), dphPercent: cfg.dphPercent, dph, spolu: r2(spoluBezDph + dph),
    } as Record<string, unknown>,
  };
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

// Shopify draft order s presnou cenou (cena už zahŕňa DPH, preto taxable: false) -> odkaz na platbu
async function vytvorDraft(polozka: { title: string; price: number; requiresShipping: boolean; properties: { name: string; value: string }[] }, note: string, tags: string) {
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
      line_items: [{ title: polozka.title, price: polozka.price.toFixed(2), quantity: 1, taxable: false, requires_shipping: polozka.requiresShipping, properties: polozka.properties }],
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


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const { preview = false, osobnyOdber = false, b2bKod = null } = body;
    const ks = Math.max(1, Math.round(n(body.pocetKs, 1)));
    const [{ data: nast }, { data: model }, cfg] = await Promise.all([
      supabase.from('snurka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('snurka_modely').select('*').eq('kod', String(body.model || '')).maybeSingle(),
      nacitajCfg(supabase),
    ]);
    if (!nast) throw new Error('Nastavenia šnúrok nie sú k dispozícii (spusti migration_stolove_snurky_folie.sql).');
    if (nast.aktivny === false) throw new Error('Objednávanie šnúrok je dočasne vypnuté.');
    if (!model) throw new Error('Vyber typ šnúrky.');

    const [nModel] = await nakladPolozky(supabase, [model]);
    const c = await spoluCena(supabase, nast, cfg, nModel * ks, ks, !!osobnyOdber, b2bKod);
    const vysledok: Record<string, unknown> = { ok: true, ...c.verejne };
    if (await jeAdmin(supabase, req)) {
      vysledok.admin = { nakladSpolu: r2(nModel * ks), nakladKs: r2(nModel), margaEur: r2(c.logaSpolu - nModel * ks), margaPercent: nModel > 0 ? r2((c.logaSpolu / (nModel * ks) - 1) * 100) : 0, rozpis: { model: r2(nModel) } };
    }
    // Cenové úrovne podľa počtu kusov (tabuľka „Množstevné zľavy“ v konfigurátore) — cena za kus bez DPH a bez B2B zľavy
    if (body.urovne) {
      vysledok.urovne = await Promise.all([1, 5, 10, 25, 50, 100, 250, 500, 1000].map(async (l) => {
        const cc = await spoluCena(supabase, nast, cfg, nModel * l, l, true, null);
        return { ks: l, cenaKsBezDph: r2(cc.logaSpolu / l) };
      }));
    }
    if (preview) return odpoved(vysledok);

    const objednavkaId = crypto.randomUUID();
    const cislo = await ziskajCisloObjednavky(supabase, 'SNK');
    const url1 = await podpisanyOdkaz(supabase, body.suborCesta), url2 = await podpisanyOdkaz(supabase, body.suborCesta2);
    const { error: insErr } = await supabase.from('snurka_objednavky').insert({
      id: objednavkaId, cislo_objednavky: cislo, model: model.kod, pocet_ks: ks, cena_kus: r2(c.poZlave / ks), cena_spolu: c.spolu, naklad_spolu: r2(nModel * ks),
      dizajn_json: body.dizajnJson ?? null, subor_nazov: body.suborNazov ?? 'liec.png', subor_cesta: body.suborCesta ?? null, subor_url: url1,
      subor2_cesta: body.suborCesta2 ?? null, subor2_url: url2, osobny_odber: !!osobnyOdber,
    });
    if (insErr) throw insErr;
    const checkoutUrl = await vytvorDraft({
      title: `Šnúrka na krk — ${ks}× ${model.nazov}${osobnyOdber ? ' (osobný odber)' : ''}`,
      price: c.spolu, requiresShipping: !osobnyOdber,
      properties: [
        { name: '_cislo_objednavky', value: cislo }, { name: '_objednavka_id', value: objednavkaId }, { name: '_snurka', value: 'true' },
        { name: '_model', value: model.kod }, { name: '_casti_tlace_mm', value: model.casti_mm ? `${String(model.casti_mm).replace(/,/g, ' + ')} mm (vedľa seba, medzera 10 mm na strih)` : `${model.sirka_mm} mm` }, { name: '_pocet_ks', value: String(ks) }, { name: '_subor_liec', value: url1 || '' }, { name: '_subor_rub', value: url2 || '' },
        { name: '_osobny_odber', value: osobnyOdber ? 'áno' : 'nie' }, { name: '_b2b_kod', value: c.zlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '' },
      ],
    }, `${cislo} (šnúrky na krk)` + (url1 ? `\nLíce: ${url1}` : '') + (url2 ? `\nRub: ${url2}` : ''), 'snurky');
    return odpoved({ ok: true, checkoutUrl, cenaSpolu: c.spolu, objednavkaId, cisloObjednavky: cislo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
