// Edge Function: verify-station-pin
// Overi 4-miestny PIN zamestnanca na serveri (service_role), aby sa hash PIN-u nikdy
// neposielal klientovi (predtym appka porovnavala PIN oproti hashom VSETKYCH zamestnancov
// nacitanym do prehliadaca, co robilo 4-miestny PIN prakticky nechraneny).
//
// Volanie (bez prihlasenia, zo stanice): supabase.functions.invoke('verify-station-pin', { body: { pin: '1234' } })
//
// Nasadenie (Supabase Dashboard -> Edge Functions -> Create function "verify-station-pin", vloz tento kod,
// alebo cez CLI: supabase functions deploy verify-station-pin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FAILED_ATTEMPTS_PER_WINDOW = 20;
const WINDOW_MINUTES = 5;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { pin } = await req.json();
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return jsonResponse({ success: false, error: 'Neplatný formát PIN.' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Serverove obmedzenie poctu nesprávnych pokusov — chráni aj keby niekto obišiel UI a volal funkciu priamo.
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60000).toISOString();
    const { count: recentFailedCount } = await supabaseAdmin
      .from('pin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('success', false)
      .gte('created_at', windowStart);

    if ((recentFailedCount || 0) >= MAX_FAILED_ATTEMPTS_PER_WINDOW) {
      return jsonResponse({ success: false, error: 'Príliš veľa nesprávnych pokusov z tejto appky. Skús to o pár minút.' }, 429);
    }

    const pinHash = await sha256Hex(pin);

    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id, first_name, last_name, role, position, avatar')
      .eq('pin_hash', pinHash)
      .maybeSingle();

    await supabaseAdmin.from('pin_login_attempts').insert({ success: !!emp });

    if (!emp) {
      return jsonResponse({ success: false, error: 'Nesprávny PIN.' }, 200);
    }

    return jsonResponse({
      success: true,
      employee: {
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        role: emp.role,
        position: emp.position,
        avatar: emp.avatar,
      },
    }, 200);
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) }, 500);
  }
});
