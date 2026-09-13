// Jednorazovy admin skript: aktivuje Shopify Function "hide-cod-custom-orders" (Payment
// customization) na obchode. Toto sa nesprava ako bezny endpoint pre appku — Martin ho zavola
// rucne raz (napr. cez curl alebo prehliadac), aby sa dobierka skryla pre custom objednavky
// (DTF/textilna metraz, beachvlajky, zastavy, 3D dresy). Po uspesnej aktivacii uz netreba tento
// subor volat znova.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

async function graphql(domain: string, token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shopify GraphQL HTTP chyba ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    // Krok 1: najdi ID nasej nasadenej funkcie cez shopifyFunctions
    const funkcieRes = await graphql(domain, token, `
      query {
        shopifyFunctions(first: 25) {
          nodes { id title apiType app { title } }
        }
      }
    `);
    if (funkcieRes.errors) return odpoved({ krok: 'shopifyFunctions', errors: funkcieRes.errors });

    const funkcie = funkcieRes.data?.shopifyFunctions?.nodes || [];
    const nasaFunkcia = funkcie.find((f: any) => f.title === 'hide-cod-custom-orders');
    if (!nasaFunkcia) {
      return odpoved({
        krok: 'shopifyFunctions',
        chyba: 'Funkcia "hide-cod-custom-orders" sa medzi nasadenymi funkciami nenasla.',
        najdene_funkcie: funkcie,
      });
    }

    // Krok 2: over, ci uz nie je aktivovana (paymentCustomizations)
    const existujuceRes = await graphql(domain, token, `
      query {
        paymentCustomizations(first: 25) {
          nodes { id title enabled functionId }
        }
      }
    `);
    const existujuce = existujuceRes.data?.paymentCustomizations?.nodes || [];
    const uzExistuje = existujuce.find((c: any) => c.functionId === nasaFunkcia.id);
    if (uzExistuje) {
      return odpoved({ krok: 'uz_aktivovane', existujuca_customization: uzExistuje, funkcia: nasaFunkcia });
    }

    // Krok 3: vytvor payment customization pre najdenu funkciu
    const createRes = await graphql(domain, token, `
      mutation paymentCustomizationCreate($paymentCustomization: PaymentCustomizationInput!) {
        paymentCustomizationCreate(paymentCustomization: $paymentCustomization) {
          paymentCustomization { id title enabled functionId }
          userErrors { field message }
        }
      }
    `, {
      paymentCustomization: {
        functionId: nasaFunkcia.id,
        title: 'Skryť dobierku pre vlastné (custom) objednávky',
        enabled: true,
      },
    });

    if (createRes.errors) return odpoved({ krok: 'paymentCustomizationCreate', errors: createRes.errors, funkcia: nasaFunkcia });

    const vysledok = createRes.data?.paymentCustomizationCreate;
    if (vysledok?.userErrors?.length) return odpoved({ krok: 'paymentCustomizationCreate', userErrors: vysledok.userErrors, funkcia: nasaFunkcia });

    return odpoved({ krok: 'hotovo', vytvorena_customization: vysledok?.paymentCustomization });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
