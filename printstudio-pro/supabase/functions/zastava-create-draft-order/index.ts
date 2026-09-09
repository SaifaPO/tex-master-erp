// Vytvorí Shopify Draft Order s presnou cenou pre zástavu (rovnaký princíp ako
// beachflag-create-draft-order) — cena sa VŽDY prepočíta server-side z aktuálnych
// nákladov + marzoveho vzorca, klientom poslaná cena sa nikdy nepoužije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { vypocitajCenuZastavy, vypocitajHardwareRozmery } from '../_shared/zastavaCena.ts';

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

    const { tunelyBm, ockaPocet, karabinkyPocet, popruhBm } = vypocitajHardwareRozmery(Number(sirkaCm), Number(vyskaCm), tunely, ocka, karabinky, popruhy);

    const pricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    const cena = vypocitajCenuZastavy({
      sirkaCm: Number(sirkaCm), vyskaCm: Number(vyskaCm),
      materialNakladM2: Number(material.naklad_m2),
      vyhotovenie,
      tunelyBm, ockaPocet, karabinkyPocet, popruhBm,
      pocetKs: Number(pocetKs) || 1,
      expresne: !!expresne,
      naklady,
      pricingConfig,
    });

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
            price: cena.cenaKus.toFixed(2),
            quantity: Number(pocetKs) || 1,
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

    return odpoved({ draftOrderId: draftOrder.id, checkoutUrl: draftOrder.invoice_url, cenaSpolu: cena.cenaSpolu });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
