// AI Generátor motívov — text -> obrázok cez Nano Banana Pro (Gemini 3 Pro Image).
// Plná kvalita (4K) sa ukladá LEN do súkromného bucketu "ai-full" (nikdy sa neposiela
// do prehliadača). Zákazníkovi appka vráti len zmenšený náhľad z verejného bucketu "ai-previews".
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { volajGeminiObrazok } from '../_shared/gemini.ts';
import { vytvorNahladPng } from '../_shared/resize.ts';
import { RateLimitError, skontrolujARegistrujLimit, ziskajIp } from '../_shared/rateLimit.ts';

// Vracia sa vždy HTTP 200 (aj pri chybe, error je v tele) — supabase-js `functions.invoke()`
// pri ne-2xx odpovediach nespoľahlivo posiela telo do `data`, takto ho frontend vždy dostane.
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
    const { prompt, sessionId } = await req.json();
    if (!prompt || !prompt.trim()) throw new Error('Chýba popis motívu.');

    await skontrolujARegistrujLimit(supabase, { ip: ziskajIp(req), sessionId: sessionId || null, typ: 'generate' });

    const { base64, mimeType } = await volajGeminiObrazok({ prompt: prompt.trim(), imageSize: '4K' });
    const fullBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const id = crypto.randomUUID();
    const pripona = mimeType.includes('png') ? 'png' : 'jpg';
    const fullPath = `${id}.${pripona}`;

    const { error: fullErr } = await supabase.storage.from('ai-full').upload(fullPath, fullBytes, { contentType: mimeType });
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
