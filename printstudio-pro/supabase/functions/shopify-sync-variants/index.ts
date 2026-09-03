// Stiahne varianty JEDNÉHO Shopify produktu (podľa handle) cez Admin API — len na čítanie (read_products).
// Volá sa len keď admin klikne "Synchronizovať zo Shopify" pri konkrétnom, už predtým ručne
// vybranom produkte — appka nikdy sama nesťahuje celý katalóg.
import { corsHeaders } from '../_shared/cors.ts';

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { handle } = await req.json();
    if (!handle || !handle.trim()) throw new Error('Chýba Shopify handle produktu.');

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const res = await fetch(`https://${domain}/admin/api/2025-01/products.json?handle=${encodeURIComponent(handle.trim())}`, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify Admin API chyba ${res.status}: ${text}`);
    }
    const data = await res.json();
    const produkt = data?.products?.[0];
    if (!produkt) throw new Error(`Produkt s handle "${handle}" sa v Shopify nenašiel.`);

    return odpoved({
      options: (produkt.options || []).map((o: any) => ({ name: o.name, position: o.position })),
      variants: (produkt.variants || []).map((v: any) => ({
        id: v.id,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        price: v.price,
        title: v.title,
      })),
    });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
