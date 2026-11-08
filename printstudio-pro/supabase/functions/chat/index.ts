// Edge Function: chat — živý chat zákazníka z verejných appiek (okno "Opýtať sa") s ERP. Zákazník nemá prístup do DB, všetko ide cez túto funkciu
// (service role) a je viazané na tajný token konverzácie.
//   { akcia: 'stav' }                                   -> { online }  (je niekto z ERP práve online?)
//   { akcia: 'start', meno, email, telefon, text, aplikacia, url, jazyk, hp } -> vytvorí konverzáciu + 1. správu, vráti { id, token }
//   { akcia: 'posli', id, token, text }                 -> pridá správu zákazníka
//   { akcia: 'nacitaj', id, token, po }                 -> správy (id > po), { online, stav }
// Upozornenia pre ERP: zvonček (erp_notifikacie) vždy; e-mail (Resend) len keď nie je nikto online (najviac raz za 10 min na konverzáciu).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const odp = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type R = Record<string, any>;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MAX_TEXT = 2000;

async function jeOnline(sb: ReturnType<typeof createClient>) {
  const od = new Date(Date.now() - 150_000).toISOString();
  const { count } = await sb.from('chat_admin_online').select('user_id', { count: 'exact', head: true }).gte('last_seen', od);
  return (count ?? 0) > 0;
}

async function upozorni(sb: ReturnType<typeof createClient>, konv: R, text: string, online: boolean, nova: boolean) {
  const kto = konv.meno || konv.email;
  try {
    await sb.from('erp_notifikacie').insert({ typ: 'chat', zdroj: 'chat', titulok: `💬 ${nova ? 'Nový chat' : 'Chat'} — ${kto}`, text: text.slice(0, 160), odkaz: { tab: 'chat', id: konv.id } });
  } catch { /* zvonček je bonus */ }
  if (online) return;
  const { data: n } = await sb.from('chat_nastavenia').select('*').eq('id', 1).maybeSingle();
  if (!n || !n.email_pri_offline) return;
  const posledny = konv.posledny_email_adminovi ? new Date(konv.posledny_email_adminovi).getTime() : 0;
  if (Date.now() - posledny < 10 * 60_000) return;
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const komu = (n.prijemcovia || []).filter((x: string) => /@/.test(x));
  if (!apiKey || !komu.length) return;
  const predmet = `Chat: ${nova ? 'nový zákazník' : 'nová správa'} — ${kto}`;
  const telo = `${kto} (${konv.email}${konv.telefon ? ', ' + konv.telefon : ''}) napísal z appky „${konv.aplikacia || '—'}“:\n\n${text}\n\nOdpísať môžeš v ERP → karta „Zákaznícky chat“:\n${n.odkaz_erp}\n(zákazník uvidí odpoveď v okne chatu a ak ho zavrie, dostane ju e-mailom)`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${n.odosielatel_meno} <${n.odosielatel_email}>`, to: komu, subject: predmet, text: telo, reply_to: konv.email }),
    });
    if (r.ok) await sb.from('chat_konverzacie').update({ posledny_email_adminovi: new Date().toISOString() }).eq('id', konv.id);
  } catch { /* e-mail je záloha */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const akcia = String(b.akcia || '');

    if (akcia === 'stav') return odp({ ok: true, online: await jeOnline(sb) });

    if (akcia === 'start') {
      if (b.hp) return odp({ ok: true, id: crypto.randomUUID(), token: crypto.randomUUID() }); // honeypot — bot dostane falošný úspech
      const email = String(b.email || '').trim().slice(0, 160), meno = String(b.meno || '').trim().slice(0, 80), text = String(b.text || '').trim().slice(0, MAX_TEXT);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return odp({ ok: false, error: 'Zadajte platný e-mail.' });
      if (!text) return odp({ ok: false, error: 'Napíšte správu.' });
      const odDna = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await sb.from('chat_konverzacie').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', odDna);
      if ((count ?? 0) >= 6) return odp({ ok: false, error: 'Dnes ste už poslali veľa otázok — napíšte nám prosím e-mailom.' });
      const { data: konv, error } = await sb.from('chat_konverzacie').insert({
        meno, email, telefon: String(b.telefon || '').trim().slice(0, 40) || null, aplikacia: String(b.aplikacia || '').slice(0, 80) || null,
        url: String(b.url || '').slice(0, 300) || null, jazyk: String(b.jazyk || '').slice(0, 5) || null, neprecitane_admin: 1, zakaznik_aktivny_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      await sb.from('chat_spravy').insert({ konverzacia_id: konv.id, od: 'zakaznik', text, autor: meno || email });
      await upozorni(sb, konv, text, await jeOnline(sb), true);
      return odp({ ok: true, id: konv.id, token: konv.token, online: await jeOnline(sb) });
    }

    // ostatné akcie vyžadujú id + token
    const id = String(b.id || ''), token = String(b.token || '');
    const { data: konv } = await sb.from('chat_konverzacie').select('*').eq('id', id).eq('token', token).maybeSingle();
    if (!konv) return odp({ ok: false, error: 'Konverzácia sa nenašla.', neplatna: true }, 404);

    if (akcia === 'posli') {
      const text = String(b.text || '').trim().slice(0, MAX_TEXT);
      if (!text) return odp({ ok: false, error: 'Napíšte správu.' });
      const od5 = new Date(Date.now() - 5 * 60_000).toISOString();
      const { count } = await sb.from('chat_spravy').select('id', { count: 'exact', head: true }).eq('konverzacia_id', id).eq('od', 'zakaznik').gte('created_at', od5);
      if ((count ?? 0) >= 15) return odp({ ok: false, error: 'Príliš veľa správ naraz — chvíľu počkajte.' });
      const { data: sprava, error } = await sb.from('chat_spravy').insert({ konverzacia_id: id, od: 'zakaznik', text, autor: konv.meno || konv.email }).select().single();
      if (error) throw error;
      await sb.from('chat_konverzacie').update({ posledna_sprava_at: new Date().toISOString(), neprecitane_admin: (konv.neprecitane_admin || 0) + 1, stav: 'otvorena', zakaznik_aktivny_at: new Date().toISOString() }).eq('id', id);
      const online = await jeOnline(sb);
      await upozorni(sb, konv, text, online, false);
      return odp({ ok: true, sprava: { id: sprava.id, od: 'zakaznik', text, created_at: sprava.created_at }, online });
    }

    if (akcia === 'nacitaj') {
      const po = Math.max(0, Number(b.po) || 0);
      const { data: spravy } = await sb.from('chat_spravy').select('id, od, text, autor, created_at').eq('konverzacia_id', id).gt('id', po).order('id', { ascending: true }).limit(200);
      await sb.from('chat_konverzacie').update({ zakaznik_aktivny_at: new Date().toISOString() }).eq('id', id);
      if ((spravy || []).some((s: R) => s.od === 'admin')) await sb.from('chat_spravy').update({ precitane_zakaznikom: true }).eq('konverzacia_id', id).eq('od', 'admin').eq('precitane_zakaznikom', false);
      return odp({ ok: true, spravy: spravy || [], online: await jeOnline(sb), stav: konv.stav });
    }
    return odp({ ok: false, error: 'Neznáma akcia.' }, 400);
  } catch (e) {
    return odp({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
