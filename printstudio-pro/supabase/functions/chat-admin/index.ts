// Edge Function: chat-admin — odpoveď z ERP zákazníkovi (len prihlásený používateľ ERP). Uloží správu a ak zákazník práve nemá otvorené okno chatu,
// pošle mu odpoveď e-mailom (s odkazom, cez ktorý v chate pokračuje).
//   { akcia: 'odpoved', id, text, autor }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const odp = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const rolaJwt = (req: Request) => { try { const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); return String(JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || ''); } catch { return ''; } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!['service_role', 'authenticated'].includes(rolaJwt(req))) return odp({ ok: false, error: 'Treba prihlásenie do ERP.' }, 403);
    const b = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (b.akcia !== 'odpoved') return odp({ ok: false, error: 'Neznáma akcia.' }, 400);
    const text = String(b.text || '').trim().slice(0, 2000);
    if (!text) return odp({ ok: false, error: 'Napíšte správu.' });
    const { data: konv } = await sb.from('chat_konverzacie').select('*').eq('id', String(b.id || '')).maybeSingle();
    if (!konv) return odp({ ok: false, error: 'Konverzácia sa nenašla.' }, 404);
    const { data: sprava, error } = await sb.from('chat_spravy').insert({ konverzacia_id: konv.id, od: 'admin', text, autor: String(b.autor || 'PBT Print').slice(0, 60) }).select().single();
    if (error) throw error;
    await sb.from('chat_konverzacie').update({ posledna_sprava_at: new Date().toISOString(), neprecitane_admin: 0, stav: 'otvorena' }).eq('id', konv.id);

    // zákazník je "v chate", ak si správy načítal v posledných ~40 s; inak mu odpoveď pošleme aj e-mailom
    const aktivny = konv.zakaznik_aktivny_at && Date.now() - new Date(konv.zakaznik_aktivny_at).getTime() < 40_000;
    let email = 'nie';
    if (!aktivny) {
      const { data: n } = await sb.from('chat_nastavenia').select('*').eq('id', 1).maybeSingle();
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (n && n.email_zakaznikovi && apiKey && konv.email) {
        const odkaz = `${n.odkaz_appky}?chat=${konv.id}&t=${konv.token}`;
        const telo = `Dobrý deň${konv.meno ? ' ' + konv.meno : ''},\n\n${text}\n\n— ${n.odosielatel_meno}\n\nV rozhovore môžete pokračovať tu: ${odkaz}\n(alebo odpovedzte priamo na tento e-mail)`;
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `${n.odosielatel_meno} <${n.odosielatel_email}>`, to: [konv.email], subject: 'Odpoveď na vašu otázku — PBT Print', text: telo, reply_to: (n.prijemcovia || [])[0] || n.odosielatel_email }),
        });
        email = r.ok ? 'odoslany' : 'zlyhal';
      }
    }
    return odp({ ok: true, sprava, email });
  } catch (e) {
    return odp({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
