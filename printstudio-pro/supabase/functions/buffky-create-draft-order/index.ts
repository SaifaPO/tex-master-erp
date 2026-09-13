// Vytvorí Shopify Draft Order s presnou cenou pre Buffky. Rovnaky vzor ako
// celenky-create-draft-order/index.ts a ostatne create-draft-order funkcie v projekte.
// Cena sa VZDY prepocita server-side z aktualnych DB tabuliek — klientom poslana cena sa
// nikdy nepouzije priamo. Tlacovy subor (300 DPI, 50x50cm) uz nahral klient priamo do Storage
// pred zavolanim tejto funkcie — tu sa len referencuje cesta.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function ziskajAdminToken(domain: string, clientId: string, clientSecret: string) {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Nepodarilo sa získať Shopify token (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error('Shopify nevrátil access_token.');
  return data.access_token as string;
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
      typ = 'tubular_basic', materialKod = null,
      pocetKs, deliverySpeed = 'standard',
      suborNazov = null, suborCesta = null, dizajnJson = null,
    } = body;

    if (typ !== 'tubular_basic' && typ !== 'premium') throw new Error('Neplatný typ buffky.');
    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    if (!suborCesta) throw new Error('Chýba tlačový súbor buffky.');

    const [{ data: nak }, { data: cfg }, { data: nastavenia }] = await Promise.all([
      supabase.from('buffky_naklady_verejny').select('*').maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('buffky_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!nak) throw new Error('Výrobné náklady buffiek nie sú nastavené.');
    if (!nastavenia) throw new Error('Nastavenia buffiek sa nenašli.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    // Nikdy neveri klientom poslanej cene materialu — pri Premium sa nakladovy zaklad materialu
    // ZNOVA zisti zo servera (buffky_premium_materialy_verejny), materialKod len urcuje KTORY.
    let nakladKs = Number(nak.naklad_ks) || 0;
    let vybranyMaterialNazov: string | null = null;
    if (typ === 'premium') {
      if (!materialKod) throw new Error('Chýba zvolený materiál Premium buffky.');
      const { data: material } = await supabase.from('buffky_premium_materialy_verejny').select('kod, nazov, naklad_material_ks').eq('kod', materialKod).maybeSingle();
      if (!material) throw new Error('Zvolený materiál sa nenašiel alebo nie je aktívny.');
      nakladKs = Number(material.naklad_material_ks || 0) + Number(nak.naklad_potlac_ks || 0) + Number(nak.cena_sitia_bok_ks || 0);
      vybranyMaterialNazov = material.nazov;
    }
    const cenaKus = priceAt(nakladKs, ks, pricingConfig);
    const subtotal = Math.max(cenaKus * ks, Number(nastavenia.minimalna_cena_objednavky) || 0);
    const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia.priplatok_expres_percent) || 0) / 100) : 0;
    const shippingFee = Number(nastavenia.cena_doprava) || 0;
    const grandTotalBezDph = subtotal + expressFee + shippingFee;
    const dphPercent = Number(nastavenia.dph_percent) || 0;
    const dphSuma = grandTotalBezDph * (dphPercent / 100);
    const grandTotal = grandTotalBezDph + dphSuma;

    const objednavkaId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('buffky_objednavky').insert({
      id: objednavkaId,
      typ,
      material_kod: typ === 'premium' ? materialKod : null,
      pocet_ks: ks,
      cena_kus: Math.round(cenaKus * 100) / 100,
      cena_spolu: Math.round(grandTotal * 100) / 100,
      doprava_rychlost: deliverySpeed,
      dizajn_json: dizajnJson ? JSON.parse(dizajnJson) : null,
      subor_nazov: suborNazov,
      subor_cesta: suborCesta,
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    const typLabel = typ === 'premium' ? `Premium${vybranyMaterialNazov ? ' — ' + vybranyMaterialNazov : ''}` : 'Tubular Basic';
    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: `Buffka — ${typLabel} — vlastný dizajn (${ks} ks)`,
            price: grandTotal.toFixed(2),
            quantity: 1,
            taxable: false, // cena uz zahrna DPH (vypocitana server-side) — Shopify ju druhykrat neprirata
            requires_shipping: true,
            properties: [
              { name: '_objednavka_id', value: objednavkaId },
              { name: '_typ', value: typLabel },
              { name: '_pocet_ks', value: String(ks) },
              { name: '_subor', value: suborNazov || '' },
            ],
          },
        ],
        note: `Buffka objednávka ${objednavkaId}`,
        tags: 'buffky',
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
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ error: msg });
  }
});
