// Príprava nahratého obrázka pre tlač (odstránenie pozadia / zvýšenie kvality) cez Nano Banana Pro.
// Rovnaká ochrana ako pri ai-generate-motif — plná kvalita len v súkromnom bucketi "ai-full",
// zákazník dostane len zmenšený náhľad z verejného "ai-previews".
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { volajGeminiObrazok } from '../_shared/gemini.ts';
import { vytvorNahladPng } from '../_shared/resize.ts';
import { RateLimitError, skontrolujARegistrujLimit, ziskajIp } from '../_shared/rateLimit.ts';

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
