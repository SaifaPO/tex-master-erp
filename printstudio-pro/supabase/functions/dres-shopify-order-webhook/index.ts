// Prijíma Shopify webhook "orders/create". Spracuje len objednávky, ktoré obsahujú položku
// vytvorenú cez dres-create-draft-order (rozpoznané podľa vlastnosti _dres_order), a vloží
// ich do dres_objednavky s pôvodným stavom "na_schvalenie" — žiadne automatické vytváranie
// výrobnej zákazky, to si ERP owner robí ručne po schválení.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function odpoved(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function overHmac(rawBody: string, hmacHeader: string | null, secret: string): Promise<boolean> {
  if (!hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  return computed === hmacHeader;
}

function najdiVlastnost(properties: { name: string; value: string }[] | undefined, nazov: string): string {
  return (properties || []).find((p) => p.name === nazov)?.value || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return odpoved(405, { error: 'Len POST.' });

  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
  if (!secret) return odpoved(500, { error: 'SHOPIFY_WEBHOOK_SECRET nie je nastavený v Supabase secrets.' });

  const rawBody = await req.text();
  const platny = await overHmac(rawBody, req.headers.get('X-Shopify-Hmac-Sha256'), secret);
  if (!platny) return odpoved(401, { error: 'Neplatný HMAC podpis.' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const order = JSON.parse(rawBody);
    const dresItem = (order.line_items || []).find((li: any) =>
      najdiVlastnost(li.properties, '_dres_order') === 'true'
    );
    if (!dresItem) {
      // Bežná (nie-dres) objednávka — nič nerobíme, ale odpovieme 200, nech Shopify webhook nezopakuje.
      return odpoved(200, { ignored: true });
    }

    const props = dresItem.properties as { name: string; value: string }[];
    let roster: unknown = [];
    try {
      roster = JSON.parse(najdiVlastnost(props, '_roster_json') || '[]');
    } catch {
      roster = [];
    }

    const produktIdRaw = najdiVlastnost(props, '_produkt_id');

    const riadok = {
      shopify_order_id: String(order.id),
      shopify_order_number: order.name || null,
      design_id: najdiVlastnost(props, '_design_id') || null,
      produkt_id: produktIdRaw ? Number(produktIdRaw) : null,
      produkt_nazov: dresItem.title || null,
      vzor_kod: najdiVlastnost(props, '_vzor') || null,
      farba_zakladna: najdiVlastnost(props, '_farba_zakladna') || null,
      farba_vzor: najdiVlastnost(props, '_farba_vzor') || null,
      farba_akcent: najdiVlastnost(props, '_farba_akcent') || null,
      farba_rukava: najdiVlastnost(props, '_farba_rukava') || null,
      farba_golier: najdiVlastnost(props, '_farba_golier') || null,
      golier_typ: najdiVlastnost(props, '_golier') || null,
      material_kod: null,
      material_nazov: najdiVlastnost(props, '_material') || null,
      tim_text: najdiVlastnost(props, '_tim_text') || null,
      font: najdiVlastnost(props, '_font') || null,
      roster,
      pocet_ks: dresItem.quantity || 1,
      cena_kus: parseFloat(dresItem.price) || null,
      cena_spolu: (parseFloat(dresItem.price) || 0) * (dresItem.quantity || 1),
      status: 'na_schvalenie',
      nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
      zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
      zakaznik_email: order.email || null,
      raw_shopify_payload: order,
    };

    const { error } = await supabase.from('dres_objednavky').insert(riadok);
    if (error) throw error;

    return odpoved(200, { ok: true });
  } catch (e) {
    return odpoved(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
