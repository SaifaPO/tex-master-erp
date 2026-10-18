// Edge Function: transfer3d-create-draft-order — objednávka 3D transferov.
//   { preview: true, ... }  -> len vypočíta cenu (bez zápisu do DB a bez Shopify). Používa ho konfigurátor na živý náhľad ceny
//                              aj ERP (Kalkulačka v karte 3D transfery; prihlásený admin dostane aj podrobný rozpis nákladov).
//   { ... }                 -> uloží objednávku (transfer3d_objednavky), vytvorí Shopify draft order a vráti odkaz na platbu.
// Cena sa VŽDY počíta na serveri z hodnôt v tabuľkách transfer3d_* (výrobné hodnoty nastavuje admin v ERP). Klientom poslaná cena sa ignoruje.
//
// Súbor je zámerne SAMOSTATNÝ (žiadne importy z ../_shared/) — Supabase Dashboard (ručné vlepenie kódu) nevie zbaliť viacsúborové funkcie.
// Maržový vzorec je duplikát z src/printstudio/pricingEngine.js — pri zmene uprav aj tam.
// Secrets: SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET (rovnaké ako pri ostatných konfigurátoroch).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const n = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const r2 = (x: number) => Math.round(x * 100) / 100;

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Rozloženie motívov na fóliu: šírka fólie mínus okraje, motívy v riadkoch; vyskúša aj otočenie o 90° a vyberie kratšiu dĺžku.
function jednaOrientacia(w: number, h: number, ks: number, pouzitelnaSirka: number, medzera: number) {
  if (w > pouzitelnaSirka) return null;
  const naRiadok = Math.max(1, Math.floor((pouzitelnaSirka + medzera) / (w + medzera)));
  const riadkov = Math.ceil(ks / naRiadok);
  const dlzkaCm = riadkov * (h + medzera);
  return { naRiadok, riadkov, dlzkaBm: Math.max(0.1, dlzkaCm / 100) };
}
function rozlozenie(w: number, h: number, ks: number, pouzitelnaSirka: number, medzera: number) {
  const a = jednaOrientacia(w, h, ks, pouzitelnaSirka, medzera);
  const b = jednaOrientacia(h, w, ks, pouzitelnaSirka, medzera);
  if (!a && !b) return null;
  if (a && (!b || a.dlzkaBm <= b.dlzkaBm)) return { ...a, otoceny: false };
  return { ...b!, otoceny: true };
}

// €/hod zariadenia z Réžie firiem (cost_metrics): príkon (kW) × cena elektriny + amortizácia (€/hod)
function zariadenieHod(metriky: any[], id: string | null) {
  if (!id) return null;
  const z = metriky.find((m) => m.id === id);
  const el = metriky.find((m) => m.name === 'Cena elektriny');
  if (!z) return null;
  return n(z.power_kw) * n(el?.value) + n(z.amortizacia_hod);
}

function vypocitaj(nast: any, uroven: any, lak: any, metriky: any[], w: number, h: number, ks: number) {
  const folieSirka = n(nast.sirka_folie_cm, 30);
  const okraj = n(nast.okraj_cm, 1);
  const medzera = n(nast.medzera_cm, 0.5);
  const roz = rozlozenie(w, h, ks, folieSirka - 2 * okraj, medzera);
  if (!roz) throw new Error(`Motív sa nezmestí na fóliu (použiteľná šírka ${(folieSirka - 2 * okraj).toFixed(1)} cm).`);
  const folieM2 = roz.dlzkaBm * (folieSirka / 100);
  const potlacM2 = ks * (w * h / 10000) * (n(nast.pokrytie_percent, 70) / 100);

  const cmykMl = potlacM2 * n(uroven.spotreba_cmyk_ml_m2);
  const bielaMl = potlacM2 * n(uroven.spotreba_biela_ml_m2);
  const lakMl = potlacM2 * n(uroven.spotreba_lak_ml_m2) * (n(lak.pokrytie_percent) / 100);

  const odpadK = 1 + n(nast.odpad_percent) / 100;
  const folieEur = roz.dlzkaBm * n(nast.cena_folie_bm) * odpadK;
  const cmykEur = (cmykMl / 1000) * n(nast.cena_cmyk_l) * odpadK;
  const bielaEur = (bielaMl / 1000) * n(nast.cena_biela_l) * odpadK;
  const lakEur = (lakMl / 1000) * n(nast.cena_lak_l) * odpadK;

  const tlacMin = folieM2 * n(uroven.cas_tlace_min_m2) * n(lak.cas_nasobok, 1);
  const rezMin = ks * n(nast.rezanie_min_ks) + folieM2 * n(nast.rezanie_min_m2);
  const tlacHod = zariadenieHod(metriky, nast.tlaciaren_zariadenie_id) ?? n(nast.stroj_tlac_hod);
  const rezHod = zariadenieHod(metriky, nast.rezanie_zariadenie_id) ?? n(nast.stroj_rezanie_hod);
  const strojTlacEur = (tlacMin / 60) * tlacHod;
  const strojRezEur = (rezMin / 60) * rezHod;

  const pracaMin = n(nast.praca_min_objednavka) + ks * n(nast.praca_min_ks) + rezMin + tlacMin * (n(nast.obsluha_tlace_percent) / 100);
  const pracaEur = (pracaMin / 60) * n(nast.praca_hod);

  const zaklad = folieEur + cmykEur + bielaEur + lakEur + strojTlacEur + strojRezEur + pracaEur;
  const nakladSpolu = zaklad * (1 + n(nast.riziko_percent) / 100);
  return {
    roz, folieM2, potlacM2, cmykMl, bielaMl, lakMl, tlacMin, rezMin, pracaMin,
    rozpis: { folieEur, cmykEur, bielaEur, lakEur, strojTlacEur, strojRezEur, pracaEur, rizikoEur: nakladSpolu - zaklad },
    nakladSpolu,
  };
}

async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(n((data as any)?.zlava_percent), 0), 90);
}

async function ziskajCisloObjednavky(supabase: ReturnType<typeof createClient>, prefix: string) {
  const year = new Date().getFullYear();
  const shortYear = String(year).slice(-2);
  const { data: counter } = await supabase.from('print_objednavky_pocitadla').select('next_number').eq('prefix', prefix).eq('year', year).maybeSingle();
  const nextNum = (counter as { next_number: number } | null)?.next_number || 1;
  await supabase.from('print_objednavky_pocitadla').upsert({ prefix, year, next_number: nextNum + 1 }, { onConflict: 'prefix,year' });
  return `${prefix}-${shortYear}${String(nextNum).padStart(4, '0')}`;
}

async function ziskajAdminToken(domain: string, clientId: string, clientSecret: string) {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Nepodarilo sa získať Shopify token (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error('Shopify nevrátil access_token.');
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const { preview = false, uroven: urovenKod, lak: lakKod, osobnyOdber = false, b2bKod = null, suborNazov = null, suborCesta = null } = body;
    const w = n(body.sirkaCm), h = n(body.vyskaCm), ks = Math.max(1, Math.round(n(body.pocetKs, 1)));

    const [{ data: nast }, { data: ur }, { data: lk }, { data: cfg }, { data: metriky }] = await Promise.all([
      supabase.from('transfer3d_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('transfer3d_urovne').select('*').eq('kod', String(urovenKod || '')).maybeSingle(),
      supabase.from('transfer3d_laky').select('*').eq('kod', String(lakKod || '')).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cost_metrics').select('*'),
    ]);
    if (!nast) throw new Error('Výrobné hodnoty 3D transferov nie sú nastavené (spusti migration_transfer3d.sql).');
    if (nast.aktivny === false) throw new Error('Objednávanie 3D transferov je dočasne vypnuté.');
    if (!ur) throw new Error('Vyber úroveň 3D efektu.');
    if (!lk) throw new Error('Vyber variant laku.');
    if (w <= 0 || h <= 0) throw new Error('Rozmery musia byť väčšie ako 0.');
    if (w > n(nast.max_sirka_cm, 28) || h > n(nast.max_vyska_cm, 38)) throw new Error(`Maximálny rozmer motívu je ${n(nast.max_sirka_cm, 28)} × ${n(nast.max_vyska_cm, 38)} cm.`);

    const pricingConfig: PricingConfig = cfg
      ? { coefA: n(cfg.coef_a), coefB: n(cfg.coef_b), marginFloor: n(cfg.margin_floor), coefP: n(cfg.coef_p), cielovaHodnotaZakazky: n(cfg.cielova_hodnota_zakazky, 25000), dphPercent: n(cfg.dph_percent, 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const v = vypocitaj(nast, ur, lk, metriky || [], w, h, ks);
    const nakladKs = v.nakladSpolu / ks;
    const cenaKs = priceAt(nakladKs, ks, pricingConfig);
    const logaSpolu = Math.max(r2(cenaKs * ks), n(nast.minimalna_cena_eur));
    const zlavaPercent = await b2bZlava(supabase, b2bKod);
    const zlavaEur = r2(logaSpolu * zlavaPercent / 100);
    const logaPoZlave = logaSpolu - zlavaEur;
    const manipulacia = n(nast.manipulacny_poplatok_eur);
    const postovneZdarma = n(nast.postovne_zdarma_od_eur) > 0 && (logaPoZlave + manipulacia) >= n(nast.postovne_zdarma_od_eur);
    const postovne = osobnyOdber || postovneZdarma ? 0 : n(nast.cena_doprava);
    const spoluBezDph = logaPoZlave + manipulacia + postovne;
    const dphPercent = pricingConfig.dphPercent;
    const dph = r2(spoluBezDph * dphPercent / 100);
    const spolu = r2(spoluBezDph + dph);

    const vysledok: Record<string, unknown> = {
      cenaKsBezDph: logaSpolu / ks, logaSpoluBezDph: logaSpolu, zlavaB2bPercent: zlavaPercent, zlavaB2bEur: zlavaEur,
      manipulaciaBezDph: manipulacia, postovneBezDph: postovne, spoluBezDph: r2(spoluBezDph), dphPercent, dph, spolu,
      dlzkaBm: r2(v.roz.dlzkaBm), naRiadok: v.roz.naRiadok, riadkov: v.roz.riadkov, otoceny: v.roz.otoceny,
    };

    // Podrobný rozpis nákladov a marže vidí len prihlásený admin (ERP), nie zákazník
    let jeAdmin = false;
    try {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (jwt) { const { data: u } = await supabase.auth.getUser(jwt); jeAdmin = !!u?.user; }
    } catch { /* anonymný zákazník */ }
    if (jeAdmin) {
      vysledok.admin = {
        nakladSpolu: r2(v.nakladSpolu), nakladKs: r2(nakladKs), margaEur: r2(logaSpolu - v.nakladSpolu),
        margaPercent: v.nakladSpolu > 0 ? r2((logaSpolu / v.nakladSpolu - 1) * 100) : 0,
        rozpis: Object.fromEntries(Object.entries(v.rozpis).map(([k, x]) => [k, r2(x as number)])),
        spotreba: { cmykMl: r2(v.cmykMl), bielaMl: r2(v.bielaMl), lakMl: r2(v.lakMl), folieM2: r2(v.folieM2), potlacM2: Math.round(v.potlacM2 * 10000) / 10000, tlacMin: r2(v.tlacMin), rezMin: r2(v.rezMin), pracaMin: r2(v.pracaMin) },
      };
    }
    if (preview) return odpoved({ ok: true, ...vysledok });

    // ---- skutočná objednávka ----
    const objednavkaId = crypto.randomUUID();
    const cisloObjednavky = await ziskajCisloObjednavky(supabase, 'T3D');
    let suborUrl: string | null = null;
    if (suborCesta) {
      const { data: signed } = await supabase.storage.from('print-designs').createSignedUrl(String(suborCesta), 60 * 60 * 24 * 365);
      suborUrl = signed?.signedUrl || null;
    }
    const { error: insertErr } = await supabase.from('transfer3d_objednavky').insert({
      id: objednavkaId, cislo_objednavky: cisloObjednavky, sirka_cm: w, vyska_cm: h, pocet_ks: ks, uroven: ur.kod, lak: lk.kod,
      dlzka_bm: r2(v.roz.dlzkaBm), cena_kus: r2(logaPoZlave / ks), cena_spolu: spolu, naklad_spolu: r2(v.nakladSpolu),
      subor_nazov: suborNazov, subor_cesta: suborCesta, subor_url: suborUrl, osobny_odber: !!osobnyOdber,
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    const nazovPolozky = `3D transfer — ${ks}× ${w}×${h} cm (${ur.nazov}, ${lk.nazov})${osobnyOdber ? ' (osobný odber)' : ''}`;
    const draftPayload = {
      draft_order: {
        line_items: [{
          title: nazovPolozky,
          price: spolu.toFixed(2),
          quantity: 1,
          taxable: false, // cena už zahŕňa DPH (vypočítaná na serveri)
          requires_shipping: !osobnyOdber,
          properties: [
            { name: '_cislo_objednavky', value: cisloObjednavky },
            { name: '_objednavka_id', value: objednavkaId },
            { name: '_rozmer_cm', value: `${w}x${h}` },
            { name: '_pocet_ks', value: String(ks) },
            { name: '_uroven', value: ur.nazov },
            { name: '_lak', value: lk.nazov },
            { name: '_subor', value: suborNazov || '' },
            { name: '_subor_link', value: suborUrl || '' },
            { name: '_osobny_odber', value: osobnyOdber ? 'áno' : 'nie' },
            { name: '_b2b_kod', value: zlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '' },
          ],
        }],
        note: `${cisloObjednavky} (3D transfery)` + (suborUrl ? `\nSúbor na tlač: ${suborUrl}` : ''),
        tags: 'transfer3d',
        use_customer_default_address: true,
      },
    };
    const res = await fetch(`https://${domain}/admin/api/2025-01/draft_orders.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(draftPayload),
    });
    if (!res.ok) throw new Error(`Shopify Admin API chyba ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!data?.draft_order?.invoice_url) throw new Error('Shopify nevrátil odkaz na platbu draft objednávky.');
    return odpoved({ ok: true, checkoutUrl: data.draft_order.invoice_url, cenaSpolu: spolu, objednavkaId, cisloObjednavky });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ ok: false, error: msg });
  }
});
