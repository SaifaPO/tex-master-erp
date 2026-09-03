// Vytvorí Shopify Draft Order pre 3D dres s presnou server-side prepočítanou cenou.
// Jeden line item pre celú tímovú súpisku (množstvo = počet hráčov, cena = jednotková
// cena po množstevnej zľave) — celá súpiska (meno/číslo/veľkosť na hráča) sa posiela
// v jednej _roster_json property, spolu so zdieľanými vlastnosťami dizajnu.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { vypocitajCenuDresu } from '../_shared/dresCena.ts';

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
      designId, produktId, vzorKod, farby = {}, golierTyp, materialKod, font, timText,
      roster = [], nahladUrl,
    } = body;

    if (!produktId) throw new Error('Chýba produktId.');
    if (!Array.isArray(roster) || roster.length === 0) throw new Error('Súpiska hráčov je prázdna.');

    const [{ data: produkt }, { data: material }, { data: zlavy }] = await Promise.all([
      supabase.from('produkty').select('*').eq('id', produktId).maybeSingle(),
      materialKod
        ? supabase.from('produkt_dres_materialy').select('*').eq('produkt_id', produktId).eq('kod', materialKod).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('dres_mnozstevne_zlavy').select('*'),
    ]);

    if (!produkt) throw new Error(`Produkt ${produktId} sa v katalógu nenašiel.`);

    const cena = vypocitajCenuDresu({
      zakladnaCena: produkt.zakladna_cena,
      priplatokMaterial: material?.priplatok_eur || 0,
      pocetHracov: roster.length,
      zlavy: zlavy || [],
    });

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const rosterText = roster.map((h: { meno: string; cislo: string; velkost: string }) => `${h.cislo} ${h.meno} (${h.velkost})`).join(', ');
    const nazovPolozky = `Dres 3D — ${produkt.nazov}`;
    const properties: Record<string, string> = {
      _dres_order: 'true',
      _design_id: designId || '',
      _produkt_id: String(produktId),
      _vzor: vzorKod || '',
      _golier: golierTyp || '',
      _material: material?.nazov || '',
      _font: font || '',
      _tim_text: timText || '',
      _farba_zakladna: farby.zakladna || '',
      _farba_vzor: farby.vzor || '',
      _farba_akcent: farby.akcent || '',
      _farba_rukava: farby.rukava || '',
      _farba_golier: farby.golier || '',
      _roster: rosterText,
      _roster_json: JSON.stringify(roster),
      _nahlad_url: nahladUrl || '',
    };

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky,
            price: cena.jednotkovaCena.toFixed(2),
            quantity: roster.length,
            taxable: false, // cena už zahŕňa DPH (produkty.zakladna_cena) — Shopify ju druhýkrát nepripočíta
            requires_shipping: true,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Dres 3D objednávka — dizajn ${designId || '—'} (${roster.length} ks)`,
        tags: 'dres3d',
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
