// Vytvorí Shopify Draft Order s presnou cenou pre beachvlajku (namiesto vopred vytvorených
// cenových variant, ako pri tričkách — cena vlajky má príliš veľký rozptyl 45€-500€+ na to,
// aby stačilo pár cenových stupňov). Cena sa VŽDY prepočíta server-side z aktuálnych
// katalógových riadkov v DB — klientom poslaná cena sa nikdy nepoužije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Marzovy vzorec + cena z materialu je duplikat beachflag-price-preview/index.ts — pri zmene
// uprav aj tam (a src/printstudio/pricingEngine.js, printstudio-pro/src/pricingEngine.js).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; qtyAtFloor: number; }

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

interface VlajkaCenaVstup {
  nakladMaterial: number;
  dokoncenie: { cena: number } | null;
  stoziar: { cena: number } | null;
  doplnky: { cena: number; mnozstvo: number }[];
  expresne: boolean;
  pocetKs: number;
  nastavenia: { dph_percent: number; expresny_priplatok_percent: number };
  pricingConfig: PricingConfig;
}

function vypocitajCenuVlajky({ nakladMaterial, dokoncenie, stoziar, doplnky, expresne, pocetKs, nastavenia, pricingConfig }: VlajkaCenaVstup) {
  const ks = Math.max(1, Number(pocetKs) || 1);
  const cenaMaterialKus = priceAt(Number(nakladMaterial) || 0, ks, pricingConfig);
  const cenaDokoncenia = Number(dokoncenie?.cena) || 0;
  const cenaStoziara = Number(stoziar?.cena) || 0;
  const zaklad = cenaMaterialKus + cenaDokoncenia + cenaStoziara;

  const doplnkySpolu = (doplnky || []).reduce((sum, d) => sum + (Number(d.cena) || 0) * (Number(d.mnozstvo) || 0), 0);

  const subtotal = (zaklad + doplnkySpolu) * ks;

  const expresnyPercent = Number(nastavenia?.expresny_priplatok_percent) || 0;
  const expresnyPriplatok = expresne ? subtotal * (expresnyPercent / 100) : 0;

  const cenaBezDph = subtotal + expresnyPriplatok;

  const dphPercent = Number(nastavenia?.dph_percent) || 0;
  const dphSuma = cenaBezDph * (dphPercent / 100);

  const cenaSpolu = cenaBezDph + dphSuma;

  return { zaklad, doplnkySpolu, subtotal, expresnyPriplatok, cenaBezDph, dphSuma, cenaSpolu };
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Ak je material prepojeny na skutocny sklad (materials.id), naklad/m2 sa VZDY pocita naживo
// z aktualnej ceny za bezny meter + sirky rolky v Sklade — nie zo starej ulozenej snimky.
// Bez prepojenia (alebo ak sklad. polozka nema vyplnenu sirku) sa pouzije rucne zadany naklad_m2.
async function resolveNakladM2(supabase: ReturnType<typeof createClient>, material: { naklad_m2: number; sklad_material_id: string | null }) {
  if (!material.sklad_material_id) return Number(material.naklad_m2) || 0;
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) return Number(material.naklad_m2) || 0;
  return (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100);
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
      designId, tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod,
      doplnky = [], farbaHex, farbaPoznamka, textNaVlajke,
      expresne = false, pocetKs = 1, nahladUrl,
    } = body;

    if (!tvarKod || !velkostKod) throw new Error('Chýba tvar alebo veľkosť vlajky.');
    if (!materialKod) throw new Error('Chýba materiál.');

    const [{ data: tvar }, { data: velkost }, { data: material }, { data: dokoncenie }, { data: stoziar }, { data: doplnkyDb }, { data: nastavenia }, { data: cfg }] = await Promise.all([
      supabase.from('vlajka_tvary').select('*').eq('kod', tvarKod).maybeSingle(),
      supabase.from('vlajka_velkosti').select('*').eq('kod', velkostKod).maybeSingle(),
      supabase.from('vlajka_materialy').select('*').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      dokoncenieKod ? supabase.from('vlajka_dokoncenie').select('*').eq('kod', dokoncenieKod).maybeSingle() : Promise.resolve({ data: null }),
      stoziarKod ? supabase.from('vlajka_stoziare').select('*').eq('kod', stoziarKod).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('vlajka_doplnky').select('*'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (!tvar) throw new Error(`Tvar "${tvarKod}" sa v katalógu nenašiel.`);
    if (!velkost) throw new Error(`Veľkosť "${velkostKod}" sa v katalógu nenašla.`);
    if (!material) throw new Error(`Materiál "${materialKod}" sa v katalógu nenašiel.`);

    const { data: rozmer } = await supabase.from('vlajka_tvar_rozmery').select('spotreba_m2').eq('tvar_id', tvar.id).eq('velkost', velkostKod).maybeSingle();
    if (!rozmer || rozmer.spotreba_m2 == null) throw new Error(`Spotreba materiálu pre tvar "${tvarKod}" a veľkosť "${velkostKod}" nie je nastavená.`);

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    const doplnkyVypocet = (doplnky as { kod: string; mnozstvo: number }[]).map((d) => {
      const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
      return { cena: dbRow ? Number(dbRow.cena) : 0, mnozstvo: Number(d.mnozstvo) || 0, nazov: dbRow?.nazov || d.kod };
    });

    const nakladM2Material = await resolveNakladM2(supabase, material);
    const nakladMaterial = Number(rozmer.spotreba_m2) * nakladM2Material;

    const cena = vypocitajCenuVlajky({
      nakladMaterial, dokoncenie, stoziar,
      doplnky: doplnkyVypocet,
      pricingConfig,
      expresne: !!expresne,
      pocetKs: Number(pocetKs) || 1,
      nastavenia: nastavenia || { dph_percent: 23, expresny_priplatok_percent: 10 },
    });

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const nazovPolozky = `Beachvlajka — ${tvar.nazov} (${velkost.kod})`;
    const properties: Record<string, string> = {
      _beachflag_order: 'true',
      _design_id: designId || '',
      _tvar: tvar.nazov,
      _velkost: velkost.kod,
      _material: material.nazov,
      _opracovanie: dokoncenie?.nazov || '',
      _stoziar: stoziar?.nazov || '',
      _doplnky: doplnkyVypocet.map((d) => `${d.mnozstvo}× ${d.nazov}`).join(', '),
      _farba_hex: farbaHex || '',
      _farba_poznamka: farbaPoznamka || '',
      _text_na_vlajke: textNaVlajke || '',
      _expresne: expresne ? 'áno' : 'nie',
      _nahlad_url: nahladUrl || '',
    };

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky,
            price: (cena.cenaSpolu / Math.max(1, Number(pocetKs) || 1)).toFixed(2),
            quantity: Number(pocetKs) || 1,
            taxable: false, // cena už zahŕňa DPH (vypočítaná server-side) — Shopify ju druhýkrát nepripočíta
            requires_shipping: true,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Beachflag objednávka — dizajn ${designId || '—'}`,
        tags: 'beachflag',
        use_customer_default_address: true,
      },
    };

    const res = await fetch(`https://${domain}/admin/api/2025-01/draft_orders.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(draftPayload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify Admin API chyba ${res.status}: ${text}`);
    }
    const data = await res.json();
    const draftOrder = data?.draft_order;
    if (!draftOrder?.invoice_url) throw new Error('Shopify nevrátil odkaz na platbu draft objednávky.');

    return odpoved({ draftOrderId: draftOrder.id, checkoutUrl: draftOrder.invoice_url, cenaSpolu: cena.cenaSpolu });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
