// Vytvorí Shopify Draft Order s presnou cenou pre DTF metráž (namiesto triku s velkym poctom
// kusov jednotkovej ceny cez /cart/add.js — Shopify bezny plan nedovoli nastavit vlastnu cenu
// riadku kosika). Rovnaky vzor ako beachflag-create-draft-order/index.ts. Cena sa VZDY prepocita
// server-side z aktualnych DB tabuliek — klientom poslana cena sa nikdy nepouzije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Marzovy vzorec je duplikat z src/printstudio/pricingEngine.js — pri zmene uprav aj tam.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLL_WIDTH_CM = 56;
const MARGIN_CM = 0.5;

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

// Rovnaky vzorec ako vypocitajRozlozenie v DtfMetraz.jsx — kolko bm rolky treba na dany
// pocet kusov pri danom rozmere (skladanie do riadkov na 56cm sirku).
function vypocitajRozlozenie(widthCm: number, heightCm: number, qty: number) {
  const effectiveWidth = Math.min(widthCm, ROLL_WIDTH_CM);
  const itemsPerRow = Math.max(1, Math.floor((ROLL_WIDTH_CM + MARGIN_CM) / (effectiveWidth + MARGIN_CM)));
  const totalRows = Math.ceil(qty / itemsPerRow);
  const rowHeightCm = heightCm + MARGIN_CM;
  const totalHeightCm = totalRows * rowHeightCm;
  return Math.max(0.1, totalHeightCm / 100);
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      mode, widthCm, heightCm, qty, directLengthBm,
      deliverySpeed = 'standard', harmonogram = '',
      suborNazov = null, suborCesta = null,
    } = body;

    if (mode !== 'auto' && mode !== 'subor') throw new Error('Neplatný režim objednávky.');

    const [{ data: nak }, { data: cfg }, { data: nastavenia }] = await Promise.all([
      supabase.from('dtf_naklady_verejny').select('naklad_bm').maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!nak) throw new Error('Výrobné náklady DTF metráže nie sú nastavené.');
    if (!nastavenia) throw new Error('Nastavenia DTF metráže sa nenašli.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    let totalLengthBm: number;
    if (mode === 'auto') {
      const w = Number(widthCm) || 0, h = Number(heightCm) || 0, q = Math.max(1, Math.round(Number(qty)) || 1);
      if (w <= 0 || h <= 0) throw new Error('Neplatný rozmer loga.');
      totalLengthBm = vypocitajRozlozenie(w, h, q);
    } else {
      totalLengthBm = Math.max(0.01, Number(directLengthBm) || 0.01);
    }
    const totalM2 = totalLengthBm * (ROLL_WIDTH_CM / 100);

    const nakladBm = Number(nak.naklad_bm) || 0;
    const baseRate = priceAt(nakladBm, totalLengthBm, pricingConfig);
    const subtotal = Math.max(totalLengthBm * baseRate, Number(nastavenia.minimalna_cena_objednavky) || 0);
    const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia.priplatok_expres_percent) || 0) / 100) : 0;
    const shippingFee = Number(nastavenia.cena_doprava) || 0;
    const grandTotalBezDph = subtotal + expressFee + shippingFee;
    const dphPercent = Number(nastavenia.dph_percent) || 0;
    const dphSuma = grandTotalBezDph * (dphPercent / 100);
    const grandTotal = grandTotalBezDph + dphSuma;

    const objednavkaId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('dtf_objednavky').insert({
      id: objednavkaId,
      rezim: mode,
      sirka_cm: mode === 'auto' ? Number(widthCm) : null,
      vyska_cm: mode === 'auto' ? Number(heightCm) : null,
      pocet_ks: mode === 'auto' ? Math.max(1, Math.round(Number(qty)) || 1) : null,
      dlzka_bm: Math.round(totalLengthBm * 100) / 100,
      plocha_m2: Math.round(totalM2 * 100) / 100,
      cena_hladina: `${baseRate.toFixed(2)} €/bm`,
      cena_spolu: Math.round(grandTotal * 100) / 100,
      doprava_rychlost: deliverySpeed,
      harmonogram: harmonogram || null,
      subor_nazov: suborNazov,
      subor_cesta: suborCesta,
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const nazovPolozky = mode === 'auto'
      ? `DTF transfer — metráž ${totalLengthBm.toFixed(2)}bm (${qty}× ${widthCm}×${heightCm}cm)`
      : `DTF transfer — hotová rolka ${totalLengthBm.toFixed(2)}bm`;

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky,
            price: grandTotal.toFixed(2),
            quantity: 1,
            taxable: false, // cena uz zahrna DPH (vypocitana server-side) — Shopify ju druhykrat neprirata
            requires_shipping: true,
            properties: [
              { name: '_objednavka_id', value: objednavkaId },
              { name: '_dlzka_bm', value: totalLengthBm.toFixed(2) },
              { name: '_harmonogram', value: harmonogram || '' },
              { name: '_subor', value: suborNazov || '' },
            ],
          },
        ],
        note: `DTF metráž objednávka ${objednavkaId}`,
        tags: 'dtf-metraz',
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

    return odpoved({ checkoutUrl: draftOrder.invoice_url, cenaSpolu: grandTotal, objednavkaId });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
