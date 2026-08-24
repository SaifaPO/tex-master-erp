// Edge Function: employee-pin
// Nastavi/zmeni PIN zamestnanca na serveri (service_role) namiesto klienta — potrebne, lebo
// kontrola "tento PIN uz niekto pouziva" si predtym vyzadovala mat v prehliadaci hashe PINov
// VSETKYCH zamestnancov. Volajuci musi byt prihlaseny cez Supabase Auth a mat opravnenie
// manage_profiles (rovnake pravidlo ako v appke, cita sa z acl_settings — defaultne len master).
//
// Volanie (z appky, prihlaseny pouzivatel s pravom manage_profiles):
//   supabase.functions.invoke('employee-pin', { body: { employeeId: 'emp-123', pin: '1234' } })
//
// Nasadenie (Supabase Dashboard -> Edge Functions -> Create function "employee-pin", vloz tento kod,
// alebo cez CLI: supabase functions deploy employee-pin)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return jsonResponse({ error: 'Chýba prihlásenie.' }, 401);

    // Klient s právami volajúceho (na overenie, kto vlastne volá).
    const supabaseAsCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAsCaller.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: 'Neplatné prihlásenie.' }, 401);

    // Klient so service_role (obchádza RLS) — na overenie role volajúceho a na samotný zápis PIN-u.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerEmp, error: callerErr } = await supabaseAdmin
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (callerErr || !callerEmp) return jsonResponse({ error: 'Nemáte oprávnenie meniť PIN.' }, 403);

    // Rovnaké pravidlo ako v appke (hasPermission('manage_profiles')) — defaultne len master,
    // ale dá sa nakonfigurovať aj pre supervisor cez Zamestnanci & Práva -> acl_settings.
    const { data: aclRow } = await supabaseAdmin.from('acl_settings').select('rules').eq('id', 1).maybeSingle();
    const manageProfilesRule = aclRow?.rules?.manage_profiles ?? { master: true, supervisor: false, sales: false, employee: false };
    if (!manageProfilesRule[callerEmp.role]) {
      return jsonResponse({ error: 'Nemáte oprávnenie meniť PIN.' }, 403);
    }

    const { employeeId, pin } = await req.json();
    if (!employeeId || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return jsonResponse({ error: 'PIN musí mať presne 4 číslice.' }, 400);
    }

    const pinHash = await sha256Hex(pin);

    const { data: existing } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('pin_hash', pinHash)
      .neq('id', employeeId)
      .maybeSingle();

    if (existing) return jsonResponse({ error: 'Tento PIN už používa iný zamestnanec. Zvoľte iný.' }, 409);

    const { error: updateErr } = await supabaseAdmin
      .from('employees')
      .update({ pin_hash: pinHash })
      .eq('id', employeeId);

    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
