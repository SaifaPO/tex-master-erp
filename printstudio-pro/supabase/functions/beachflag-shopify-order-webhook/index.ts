// Prijíma Shopify webhook "orders/create". Spracuje len objednávky, ktoré obsahujú položku
// vytvorenú cez beachflag-create-draft-order (rozpoznané podľa vlastnosti _beachflag_order),
// a vloží ich do vlajka_objednavky s pôvodným stavom "na_schvalenie" — žiadne automatické
// vytváranie výrobnej zákazky, to si ERP owner robí ručne po schválení.
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
    const beachflagItem = (order.line_items || []).find((li: any) =>
      najdiVlastnost(li.properties, '_beachflag_order') === 'true'
    );
    if (!beachflagItem) {
      // Bežná (nie-beachflag) objednávka — nič nerobíme, ale odpovieme 200, nech Shopify webhook nezopakuje.
      return odpoved(200, { ignored: true });
    }

    const props = beachflagItem.properties as { name: string; value: string }[];
    const doplnkyText = najdiVlastnost(props, '_doplnky');
    const doplnky = doplnkyText
      ? doplnkyText.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
          const m = s.match(/^(\d+)×\s*(.+)$/);
          return m ? { nazov: m[2], mnozstvo: parseInt(m[1]), kod: m[2], cena_ks: null } : { nazov: s, mnozstvo: 1, kod: s, cena_ks: null };
        })
      : [];

    const riadok = {
      shopify_order_id: String(order.id),
      shopify_order_number: order.name || null,
      design_id: najdiVlastnost(props, '_design_id') || null,
      tvar_kod: najdiVlastnost(props, '_tvar') || null,
      velkost_kod: najdiVlastnost(props, '_velkost') || null,
      dokoncenie_kod: najdiVlastnost(props, '_opracovanie') || null,
      stoziar_kod: najdiVlastnost(props, '_stoziar') || null,
      doplnky,
      farba_hex: najdiVlastnost(props, '_farba_hex') || null,
      farba_poznamka: najdiVlastnost(props, '_farba_poznamka') || null,
      text_na_vlajke: najdiVlastnost(props, '_text_na_vlajke') || null,
      ma_ai_pozadie: false,
      pocet_ks: beachflagItem.quantity || 1,
      expresne: najdiVlastnost(props, '_expresne') === 'áno',
      cena_kus: parseFloat(beachflagItem.price) || null,
      cena_spolu: (parseFloat(beachflagItem.price) || 0) * (beachflagItem.quantity || 1),
      status: 'na_schvalenie',
      nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
      zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
      zakaznik_email: order.email || null,
      raw_shopify_payload: order,
    };

    const { error } = await supabase.from('vlajka_objednavky').insert(riadok);
    if (error) throw error;

    return odpoved(200, { ok: true });
  } catch (e) {
    return odpoved(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
