// Jednorazovy admin skript: aktivuje Shopify Function "sk-postage-split" (Delivery customization) —
// pre objednavky z appiek ukaze slovenske postovne "Doprava SR (zakazka)", pre bezny e-shop "Standard" (0 EUR).
// Idempotentne. Volat rucne raz po nasadeni funkcie.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const odpoved = (body: Record<string, unknown>) => new Response(JSON.stringify(body, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function graphql(domain: string, token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
    method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('Chýbajú Shopify secrets.');
    const tokRes = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    if (!tokRes.ok) throw new Error(`Token (${tokRes.status}): ${await tokRes.text()}`);
    const tokData = await tokRes.json();
    const token = tokData?.access_token as string;
    const f = await graphql(domain, token, `{ shopifyFunctions(first: 50) { nodes { id title apiType } } }`);
    const funkcia = (f.data?.shopifyFunctions?.nodes || []).find((x: { title: string }) => x.title === 'sk-postage-split');
    if (!funkcia) return odpoved({ krok: 'hladanie_funkcie', chyba: 'Funkcia sk-postage-split sa nenašla.', funkcie: f.data?.shopifyFunctions?.nodes, scope: tokData?.scope });
    const ex = await graphql(domain, token, `{ deliveryCustomizations(first: 50) { nodes { id title enabled functionId } } }`);
    const uz = (ex.data?.deliveryCustomizations?.nodes || []).find((n: { functionId: string }) => n.functionId === funkcia.id);
    if (uz) return odpoved({ krok: 'uz_existuje', customization: uz });
    const c = await graphql(domain, token, `
      mutation($d: DeliveryCustomizationInput!) {
        deliveryCustomizationCreate(deliveryCustomization: $d) { deliveryCustomization { id title enabled functionId } userErrors { field message } }
      }`, { d: { functionId: funkcia.id, title: 'Slovenské poštovné: appky vs. e-shop', enabled: true } });
    return odpoved({ krok: 'vytvorenie', vysledok: c, scope: tokData?.scope });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
