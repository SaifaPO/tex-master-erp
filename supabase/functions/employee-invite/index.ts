// Edge Function: employee-invite
// Pozvánka zamestnanca cez odkaz (https://tex-master-erp.vercel.app/?pozvanka=TOKEN).
//   { akcia: 'over',   token }                -> overí platnosť odkazu, vráti meno zamestnanca
//   { akcia: 'prijmi', token, email, heslo }  -> vytvorí prihlasovací účet (Supabase Auth, bez potvrdzovacieho e-mailu),
//                                                prepojí ho s profilom, uloží e-mail do profilu a zruší odkaz (platí len raz)
// Token vytvára Master v ERP (Zamestnanci & Práva); v databáze je len jeho SHA-256 hash (employees.signup_token) + platnosť.
// Token má 24 znakov (~120 bitov), takže sa nedá uhádnuť; pri nesprávnom tokene sa odpoveď o chvíľu oneskorí.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const odpoved = (body: unknown) => new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const zly = async () => { await new Promise((r) => setTimeout(r, 700)); return odpoved({ ok: false, error: 'Odkaz je neplatný alebo už nie je aktívny. Požiadaj o nový odkaz.' }); };
    if (token.length < 20 || token.length > 64) return await zly();

    const { data: emp } = await admin
      .from('employees')
      .select('id, first_name, last_name, email, auth_user_id, signup_token_expires')
      .eq('signup_token', await sha256(token))
      .maybeSingle();
    if (!emp || emp.auth_user_id) return await zly();
    if (emp.signup_token_expires && new Date(emp.signup_token_expires) < new Date()) return await zly();

    if (body.akcia === 'over') {
      return odpoved({ ok: true, meno: emp.first_name, email: emp.email || '' });
    }

    if (body.akcia === 'prijmi') {
      const email = String(body.email || '').trim().toLowerCase();
      const heslo = String(body.heslo || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return odpoved({ ok: false, error: 'Zadaj platný e-mail.' });
      if (heslo.length < 8) return odpoved({ ok: false, error: 'Heslo musí mať aspoň 8 znakov.' });

      const { data: obsadeny } = await admin.from('employees').select('id').ilike('email', email).neq('id', emp.id).limit(1);
      if (obsadeny && obsadeny.length) return odpoved({ ok: false, error: 'Tento e-mail už používa iný profil. Zadaj svoj vlastný e-mail.' });

      const { data: vytvoreny, error: chyba } = await admin.auth.admin.createUser({ email, password: heslo, email_confirm: true });
      if (chyba || !vytvoreny?.user) {
        const msg = String(chyba?.message || '');
        if (/already|registered|exists/i.test(msg)) return odpoved({ ok: false, error: 'Pre tento e-mail už existuje účet. Použi iný e-mail alebo sa obráť na Mastra.' });
        return odpoved({ ok: false, error: msg || 'Účet sa nepodarilo vytvoriť.' });
      }

      const { error: upd } = await admin
        .from('employees')
        .update({ email, auth_user_id: vytvoreny.user.id, signup_token: null, signup_token_expires: null })
        .eq('id', emp.id);
      if (upd) {
        await admin.auth.admin.deleteUser(vytvoreny.user.id);
        return odpoved({ ok: false, error: 'Prepojenie účtu zlyhalo: ' + upd.message });
      }
      return odpoved({ ok: true });
    }

    return odpoved({ ok: false, error: 'Neznáma akcia.' });
  } catch (e) {
    return odpoved({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});
