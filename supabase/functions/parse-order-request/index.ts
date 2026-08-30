// Edge Function: parse-order-request
// Rozpozná zadanie zákazky z hlasu (prepísaný text z prehliadača), z prilepeného textu emailu, alebo
// z fotky/screenshotu objednávky — rovnaký vzor ako existujúca funkcia parse-delivery-note.
//
// Volanie: supabase.functions.invoke('parse-order-request', {
//   body: { text?: string, imageBase64?: string, mimeType?: string, knownProducts: [{id,name,customCode}], knownCustomers: string[] }
// })
//
// Vyzaduje ANTHROPIC_API_KEY v Supabase secrets (rovnaky ako pre parse-delivery-note/ocr-odometer).
// Nasadenie: Supabase Dashboard -> Edge Functions -> Create function "parse-order-request", vloz tento kod.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { text, imageBase64, mimeType, knownProducts, knownCustomers } = await req.json();
    if (!text && !imageBase64) return jsonResponse({ error: 'Chýba text alebo fotka.' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Chýba nastavený ANTHROPIC_API_KEY v Supabase secrets.' }, 500);

    const productList = (knownProducts || []).map((p: { id: string; name: string; customCode: string }) => `${p.id}: ${p.name} (${p.customCode})`).join('\n');
    const customerList = (knownCustomers || []).join(', ');

    const instructions = `Si asistent na spracovanie zadania zákazky pre textilnú výrobu (dresy, oblečenie na mieru).
Z nasledujúceho vstupu (hlasové zadanie prepísané na text, email od zákazníka, alebo fotka objednávky) vytiahni štruktúrované údaje.

Zoznam existujúcich produktov v katalógu (over sa proti nim, ak sa dá nájsť zhodu, uveď presné "id"; ak nenájdeš zhodu, nechaj productId prázdne a vyplň aspoň productNameGuess):
${productList || '(žiadne produkty v katalógu)'}

Zoznam existujúcich zákazníkov (ak meno sedí, použi presne rovnaký zápis):
${customerList || '(žiadni zákazníci)'}

Odpovedz IBA validným JSON objektom v tomto tvare, bez akéhokoľvek ďalšieho textu:
{
  "customerName": "meno zákazníka alebo prázdny reťazec ak nejasné",
  "deliveryDate": "YYYY-MM-DD alebo null ak nespomenuté",
  "notes": "všeobecná poznámka k zákazke alebo prázdny reťazec",
  "items": [
    { "productId": "id z katalógu alebo prázdny reťazec", "productNameGuess": "názov, ak si productId neistý", "qty": číslo, "gender": "men" alebo "women" alebo "children", "notes": "poznámka k položke alebo prázdny reťazec" }
  ]
}`;

    const content: unknown[] = [];
    if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } });
    content.push({ type: 'text', text: `${instructions}\n\nVstup na spracovanie:\n${text || '(pozri priloženú fotku)'}` });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse({ error: `AI požiadavka zlyhala: ${errText}` }, 502);
    }

    const data = await response.json();
    const rawText = (data?.content?.[0]?.text || '').trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return jsonResponse({ error: 'AI nevrátila rozpoznateľnú odpoveď. Skús to znova alebo zadaj zákazku ručne.' }, 200);

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return jsonResponse({ error: 'AI odpoveď sa nepodarilo spracovať. Skús to znova.' }, 200);
    }

    return jsonResponse({ success: true, ...parsed }, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
