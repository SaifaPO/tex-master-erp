// Volanie Nano Banana Pro (Gemini 3 Pro Image) cez Gemini API.
// Over si presný názov modelu v aktuálnej Google dokumentácii (ai.google.dev) — v čase písania
// tohto kódu sa model volal "gemini-3-pro-image-preview", ale Google preview/GA názvy mení.
const GEMINI_MODEL = 'gemini-3-pro-image-preview';

export async function volajGeminiObrazok({
  prompt,
  vstupnyObrazokBase64,
  vstupnyMimeType,
  imageSize = '4K',
}: {
  prompt: string;
  vstupnyObrazokBase64?: string;
  vstupnyMimeType?: string;
  imageSize?: '1K' | '2K' | '4K';
}): Promise<{ base64: string; mimeType: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY nie je nastavený v Supabase secrets.');

  const parts: Record<string, unknown>[] = [];
  if (vstupnyObrazokBase64) {
    parts.push({ inlineData: { mimeType: vstupnyMimeType || 'image/png', data: vstupnyObrazokBase64 } });
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize } },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API chyba ${res.status}: ${text}`);
  }

  const data = await res.json();
  const imagePart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  if (!imagePart) throw new Error('Gemini nevrátil obrázok (možno zablokované bezpečnostným filtrom — skontroluj prompt).');

  return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || 'image/png' };
}
