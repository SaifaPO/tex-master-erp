// Vytvorí Shopify Draft Order s presnou cenou pre zástavu (rovnaký princíp ako
// beachflag-create-draft-order) — cena sa VŽDY prepočíta server-side z aktuálnych
// nákladov + marzoveho vzorca, klientom poslaná cena sa nikdy nepoužije priamo.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Cenovy vzorec je duplikat z ../_shared/zastavaCena.ts (rovnaky ako zastava-price-preview,
// src/printstudio/pricingEngine.js a printstudio-pro/src/pricingEngine.js) — pri zmene vzorca
// uprav VSETKY styri miesta rovnako.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

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

function vypocitajHardwareRozmery(
  sirkaCm: number, vyskaCm: number,
  tunely: { side: string }[], ocka: { side: string; count: number }[],
  karabinky: { side: string; count: number }[], popruhy: Record<string, boolean>,
) {
  const tunelyBm = (tunely || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  const ockaPocet = (ocka || []).reduce((s, g) => s + (g.side === 'all' ? g.count * 4 : g.side === 'corners' ? 4 : g.count), 0);
  const karabinkyPocet = (karabinky || []).reduce((s, c) => s + (c.side === 'all' ? c.count * 4 : c.count), 0);
  let popruhBm = 0;
  if (popruhy?.left) popruhBm += vyskaCm / 100;
  if (popruhy?.right) popruhBm += vyskaCm / 100;
  if (popruhy?.top) popruhBm += sirkaCm / 100;
  if (popruhy?.bottom) popruhBm += sirkaCm / 100;
  return { tunelyBm, ockaPocet, karabinkyPocet, popruhBm };
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
      designId, materialKod, sirkaCm, vyskaCm, vyhotovenie,
      tunely = [], ocka = [], karabinky = [], popruhy = {},
      statnaVlajka, farbaHex, farbaPoznamka, textNaVlajke,
      expresne = false, pocetKs = 1, nahladUrl,
    } = body;

    if (!materialKod || !sirkaCm || !vyskaCm) throw new Error('Chýba materiál alebo rozmery vlajky.');
    if (vyhotovenie !== 'obsite' && vyhotovenie !== 'laser') throw new Error('Neplatné vyhotovenie okrajov.');

    const [{ data: material }, { data: naklady }, { data: cfg }] = await Promise.all([
      supabase.from('zastava_materialy').select('*').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      supabase.from('zastava_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!material) throw new Error(`Materiál "${materialKod}" sa nenašiel.`);
    if (!naklady) throw new Error('Nákladové sadzby (zastava_nastavenia) nie sú nastavené.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    const { tunelyBm, ockaPocet, karabinkyPocet, popruhBm } = vypocitajHardwareRozmery(Number(sirkaCm), Number(vyskaCm), tunely, ocka, karabinky, popruhy);

    const m2 = (Number(sirkaCm) * Number(vyskaCm)) / 10000;
    const nakladMaterial = m2 * Number(material.naklad_m2);
    const nakladVyhotovenie = vyhotovenie === 'laser'
      ? m2 * Number(naklady.naklad_laser_m2)
      : m2 * Number(naklady.min_sitia_na_m2) * Number(naklady.naklad_sitia_min);
    const nakladHardware =
      tunelyBm * Number(naklady.naklad_tunel_bm) +
      ockaPocet * Number(naklady.naklad_ocko_ks) +
      karabinkyPocet * Number(naklady.naklad_karabinka_ks) +
      popruhBm * Number(naklady.naklad_popruh_bm);
    const nakladKus = nakladMaterial + nakladVyhotovenie + nakladHardware;

    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const cenaKus = priceAt(nakladKus, ks, pricingConfig);

    const subtotal = cenaKus * ks;
    const expresnyPriplatok = expresne ? subtotal * (Number(naklady.expresny_priplatok_percent) / 100) : 0;
    const cenaBezDph = subtotal + expresnyPriplatok;
    const dphSuma = cenaBezDph * (Number(naklady.dph_percent) / 100);
    const cenaSpolu = Math.round((cenaBezDph + dphSuma) * 100) / 100;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const nazovPolozky = `Zástava — ${material.nazov} (${sirkaCm}×${vyskaCm} cm)`;
    const properties: Record<string, string> = {
      _zastava_order: 'true',
      _design_id: designId || '',
      _material: material.nazov,
      _rozmery: `${sirkaCm} x ${vyskaCm} cm`,
      _vyhotovenie: vyhotovenie === 'obsite' ? 'Obšité dookola' : 'Orezané laserom',
      _tunely: JSON.stringify(tunely),
      _ocka: JSON.stringify(ocka),
      _karabinky: JSON.stringify(karabinky),
      _popruhy: JSON.stringify(popruhy),
      _statna_vlajka: statnaVlajka || '',
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
            price: cenaKus.toFixed(2),
            quantity: ks,
            taxable: false, // cena uz zahrna DPH (vypocitana server-side)
            requires_shipping: true,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Zástava objednávka — dizajn ${designId || '—'}`,
        tags: 'zastava',
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

    return odpoved({ draftOrderId: draftOrder.id, checkoutUrl: draftOrder.invoice_url, cenaSpolu });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
