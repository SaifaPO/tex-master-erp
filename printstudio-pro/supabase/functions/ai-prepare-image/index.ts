// Príprava nahratého obrázka pre tlač (odstránenie pozadia / zvýšenie kvality) cez Nano Banana Pro.
// Rovnaká ochrana ako pri ai-generate-motif — plná kvalita len v súkromnom bucketi "ai-full",
// zákazník dostane len zmenšený náhľad z verejného "ai-previews".
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// Subor je zamerne SAMOSTATNY (ziadne lokalne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Pomocne funkcie su duplikat z ../_shared/{cors,gemini,resize,rateLimit}.ts — rovnaky
// duplikat je aj v ai-generate-motif/index.ts, pri zmene uprav oba subory.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-3-pro-image-preview';

async function volajGeminiObrazok({
  prompt, vstupnyObrazokBase64, vstupnyMimeType, imageSize = '4K',
}: {
  prompt: string; vstupnyObrazokBase64?: string; vstupnyMimeType?: string; imageSize?: '1K' | '2K' | '4K';
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

async function vytvorNahladPng(bytes: Uint8Array, maxSirkaPx = 800): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  if (img.width > maxSirkaPx) img.resize(maxSirkaPx, Image.RESIZE_AUTO);
  return await img.encode();
}

class RateLimitError extends Error {}

function ziskajIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

const MAX_PER_SESSION_PER_DAY = parseInt(Deno.env.get('AI_MAX_PER_SESSION_PER_DAY') || '8');
const MAX_PER_IP_PER_DAY = parseInt(Deno.env.get('AI_MAX_PER_IP_PER_DAY') || '15');
const MAX_GLOBAL_PER_DAY = parseInt(Deno.env.get('AI_MAX_GLOBAL_PER_DAY') || '300');

async function skontrolujARegistrujLimit(
  supabase: any,
  { ip, sessionId, typ }: { ip: string; sessionId: string | null; typ: 'generate' | 'prepare' },
) {
  const od = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: globalCount }, { count: ipCount }, sessionRes] = await Promise.all([
    supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).gte('created_at', od),
    supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).eq('ip_address', ip).gte('created_at', od),
    sessionId
      ? supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).gte('created_at', od)
      : Promise.resolve({ count: 0 }),
  ]);

  if ((globalCount || 0) >= MAX_GLOBAL_PER_DAY) {
    throw new RateLimitError('Dnešný limit AI generovania pre celý eshop je vyčerpaný. Skús to prosím zajtra.');
  }
  if ((ipCount || 0) >= MAX_PER_IP_PER_DAY) {
    throw new RateLimitError('Dosiahol si dnešný limit AI generovania z tejto siete. Skús to prosím zajtra.');
  }
  if ((sessionRes.count || 0) >= MAX_PER_SESSION_PER_DAY) {
    throw new RateLimitError('Dosiahol si dnešný limit AI generovania pre túto reláciu. Skús to prosím zajtra.');
  }

  await supabase.from('ai_pouzitie').insert({ ip_address: ip, session_id: sessionId, typ });
}

const PROMPT =
  'Remove the background completely so it becomes transparent. Keep the main subject exactly as it is — ' +
  'do not change its shape, colors or content. Sharpen and upscale the subject to high print-quality detail. ' +
  'Do not add any new elements, text or watermarks.';

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
    const { imageBase64, mimeType, sessionId } = await req.json();
    if (!imageBase64) throw new Error('Chýba obrázok na spracovanie.');

    await skontrolujARegistrujLimit(supabase, { ip: ziskajIp(req), sessionId: sessionId || null, typ: 'prepare' });

    const { base64, mimeType: vystupnyMimeType } = await volajGeminiObrazok({
      prompt: PROMPT,
      vstupnyObrazokBase64: imageBase64,
      vstupnyMimeType: mimeType || 'image/png',
      imageSize: '4K',
    });
    const fullBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const id = crypto.randomUUID();
    const pripona = vystupnyMimeType.includes('png') ? 'png' : 'jpg';
    const fullPath = `${id}.${pripona}`;

    const { error: fullErr } = await supabase.storage.from('ai-full').upload(fullPath, fullBytes, { contentType: vystupnyMimeType });
    if (fullErr) throw new Error('Uloženie plnej kvality zlyhalo: ' + fullErr.message);

    const previewBytes = await vytvorNahladPng(fullBytes, 800);
    const previewPath = `${id}.png`;
    const { error: prevErr } = await supabase.storage.from('ai-previews').upload(previewPath, previewBytes, { contentType: 'image/png' });
    if (prevErr) throw new Error('Uloženie náhľadu zlyhalo: ' + prevErr.message);

    const { data: pub } = supabase.storage.from('ai-previews').getPublicUrl(previewPath);

    return odpoved({ previewUrl: pub.publicUrl, fullResId: id });
  } catch (e) {
    if (e instanceof RateLimitError) return odpoved({ error: e.message, rateLimited: true });
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
