// Edge Function: ocr-odometer
// Precita stav kilometrov z fotky tachometra pomocou Claude vision API (rovnaky vzor ako uz existujuca
// funkcia parse-delivery-note pre naskladnenie z fotky dodacieho listu).
//
// Volanie (z appky, prihlaseny pouzivatel):
//   supabase.functions.invoke('ocr-odometer', { body: { imageBase64, mimeType } })
//
// Vyzaduje secret ANTHROPIC_API_KEY nastaveny v Supabase Edge Functions (Project Settings -> Edge Functions,
// alebo cez CLI: supabase secrets set ANTHROPIC_API_KEY=...). Ak uz funkcia parse-delivery-note funguje,
// tento kluc uz pravdepodobne existuje a da sa znovu pouzit.
//
// Nasadenie: Supabase Dashboard -> Edge Functions -> Create function "ocr-odometer", vloz tento kod.

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
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return jsonResponse({ error: 'Chýba fotka.' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Chýba nastavený ANTHROPIC_API_KEY v Supabase secrets.' }, 500);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Na tejto fotke je tachometer/palubná doska auta. Prečítaj aktuálny stav najazdených kilometrov (celkový počet km, nie dennú trasu). Odpovedz IBA čistým číslom bez medzier, bodiek, jednotiek a bez akéhokoľvek ďalšieho textu. Ak číslo vôbec nevieš rozoznať, odpovedz presne slovom NECITATELNE.' },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse({ error: `AI požiadavka zlyhala: ${errText}` }, 502);
    }

    const data = await response.json();
    const rawText = (data?.content?.[0]?.text || '').trim();
    const digitsOnly = rawText.replace(/[^0-9]/g, '');

    if (rawText.toUpperCase().includes('NECITATELNE') || !digitsOnly) {
      return jsonResponse({ success: false, error: 'AI nevedela z fotky prečítať číslo. Skús jasnejšiu fotku alebo zadaj km ručne.' }, 200);
    }

    return jsonResponse({ success: true, km: parseInt(digitsOnly, 10) }, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
