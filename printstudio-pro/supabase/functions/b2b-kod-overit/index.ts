// Overenie B2B kodu: zakaznik zada kod v konfiguratore, funkcia (servisny kluc) zisti, ci je kod platny, a vrati
// vysku zlavy. Samotny zoznam kodov (tabulka b2b_kody) zakaznik nikdy nevidi. Samostatny subor — bez importov.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { kod } = await req.json();
    const k = String(kod || '').trim().toUpperCase();
    if (!k || k.length > 60) return odpoved({ platny: false });

    const { data } = await supabase.from('b2b_kody').select('zlava_percent, agentura').eq('kod', k).eq('aktivny', true).maybeSingle();
    if (!data) {
      // male spomalenie pri nespravnom kode — taznejsie hadanie kodov
      await new Promise((r) => setTimeout(r, 600));
      return odpoved({ platny: false });
    }
    return odpoved({ platny: true, zlavaPercent: Number(data.zlava_percent) || 0, agentura: data.agentura || '' });
  } catch (e) {
    return odpoved({ platny: false, error: e instanceof Error ? e.message : String(e) });
  }
});
