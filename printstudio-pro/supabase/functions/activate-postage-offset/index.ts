// Jednorazovy admin skript: vytvori automaticku zlavu (Discount Function "postage-offset", trieda SHIPPING),
// ktora pri doprave odpocita postovne zahrnute v cene z appiek (atribut riadku "_postovne_eur"), aby zakaznik
// zo zahranicia neplatil postovne dvakrat (appka + Shopify sadzba podla krajiny). Idempotentne: ak uz zlava
// existuje, nic nevytvara. Volat rucne raz (curl) po nasadeni Shopify funkcie.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function graphql(domain: string, token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
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
    if (!token) throw new Error('Shopify nevrátil access_token.');

    const f = await graphql(domain, token, `{ shopifyFunctions(first: 50) { nodes { id title apiType } } }`);
    if (f.errors) return odpoved({ krok: 'shopifyFunctions', errors: f.errors, scope: tokData?.scope });
    const funkcia = (f.data?.shopifyFunctions?.nodes || []).find((x: { title: string }) => x.title === 'postage-offset');
    if (!funkcia) return odpoved({ krok: 'hladanie_funkcie', chyba: 'Funkcia postage-offset sa nenašla.', funkcie: f.data?.shopifyFunctions?.nodes, scope: tokData?.scope });

    const existujuce = await graphql(domain, token, `{ discountNodes(first: 50, query: "type:app") { nodes { id discount { __typename ... on DiscountAutomaticApp { title status appDiscountType { functionId } } } } } }`);
    const uz = (existujuce.data?.discountNodes?.nodes || []).find((n: { discount?: { appDiscountType?: { functionId?: string } } }) => n.discount?.appDiscountType?.functionId === funkcia.id);
    // { akcia: 'zmazat' } — zmaže automatickú zľavu (funkcia postage-offset sa v draft checkoute neuplatňuje, zľava je zbytočná)
    const vstup = await req.json().catch(() => ({}));
    if (vstup?.akcia === 'zmazat') {
      if (!uz) return odpoved({ krok: 'zmazat', vysledok: 'zľava neexistuje (už zmazaná)' });
      const d = await graphql(domain, token, `mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }`, { id: (uz as { id: string }).id });
      return odpoved({ krok: 'zmazat', vysledok: d });
    }
    if (uz) return odpoved({ krok: 'uz_existuje', zlava: uz, funkcia });

    const c = await graphql(domain, token, `
      mutation($d: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $d) {
          automaticAppDiscount { discountId title status }
          userErrors { field message }
        }
      }`, {
      d: {
        title: 'Poštovné zahrnuté v cene (odpočet pri zahraničí)',
        functionId: funkcia.id,
        startsAt: new Date().toISOString(),
        discountClasses: ['SHIPPING'],
        combinesWith: { orderDiscounts: true, productDiscounts: true, shippingDiscounts: false },
      },
    });
    return odpoved({ krok: 'vytvorenie', vysledok: c, funkcia, scope: tokData?.scope });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
