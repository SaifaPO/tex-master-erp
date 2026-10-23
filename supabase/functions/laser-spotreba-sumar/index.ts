// Edge Function: laser-spotreba-sumar — denny e-mailovy suhrn spotreby metraze z laseru (data z tabulky laser_spotreba).
// Naplanovane cez pg_cron (kazdy vecer; funkcia sama skontroluje, ze je nastavena hodina podla slovenskeho casu a ze sa dnes este neposielalo).
//
// Volanie:  { cron: true }    -> volanie z pg_cron (posle len v nastavenej hodine, najviac raz za den, a len ak pribudli subory alebo agent mlci)
//           { dryRun: true }  -> nic neodosle, vrati predmet + text suhrnu (ERP "Nahlad suhrnu")
//           { }               -> odosle suhrn hned (ERP "Poslat suhrn teraz"); volitelne { datum: "YYYY-MM-DD" }
// Secrets: RESEND_API_KEY (odosielanie cez resend.com; odosielatel musi byt na overenej domene). SUPABASE_URL a SERVICE_ROLE su automaticky.
// Nasadenie: Supabase Dashboard -> Edge Functions -> "laser-spotreba-sumar", vloz tento kod (jeden samostatny subor). Verify JWT nechaj ZAPNUTE.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const baDatum = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(d); // YYYY-MM-DD
const baHodina = (d = new Date()) => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bratislava', hour: '2-digit', hour12: false }).format(d), 10);
const skDatum = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const m2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const html = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STAV_TEXT: Record<string, string> = { chyba_v_nazve: 'chyba v názve', nezmesti_sa: 'nezmestí sa na šírku', chyba_suboru: 'súbor sa nedal prečítať' };

const suborov = (n: number) => (n === 1 ? 'súbor' : n >= 2 && n <= 4 ? 'súbory' : 'súborov');
// Rola z JWT (Verify JWT uz overil podpis) — funkciu smie volat len cron (service_role) alebo prihlaseny pouzivatel ERP, nie verejny anon kluc.
const rolaJwt = (req: Request) => { try { const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''); return String(JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role || ''); } catch { return ''; } };

// deno-lint-ignore no-explicit-any
type R = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    if (!['service_role', 'authenticated'].includes(rolaJwt(req))) return json({ error: 'Nedostatočné oprávnenie (treba prihlásenie do ERP).' }, 403);
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: s } = await supabase.from('laser_spotreba_nastavenia').select('*').eq('id', 1).maybeSingle();
    if (!s) return json({ error: 'Chýbajú nastavenia (spusti migration_laser_spotreba.sql).' }, 500);

    const dnes = baDatum();
    const datum: string = /^\d{4}-\d{2}-\d{2}$/.test(String(body.datum || '')) ? String(body.datum) : dnes;
    const dryRun = !!body.dryRun;
    const cron = !!body.cron;

    if (cron) {
      if (!s.sumar_zapnuty) return json({ ok: true, skipped: 'Denný súhrn je vypnutý.' });
      if (baHodina() !== Number(s.cas_sumaru)) return json({ ok: true, skipped: 'Nie je nastavená hodina odoslania.' });
      if (s.posledny_sumar_datum === dnes) return json({ ok: true, skipped: 'Dnešný súhrn už bol odoslaný.' });
    }

    const mesiacOd = datum.slice(0, 8) + '01';
    const { data: riadkyMesiac } = await supabase.from('laser_spotreba').select('*').gte('datum', mesiacOd).lte('datum', datum).eq('ignorovat', false).order('zakazka');
    const mesiac: R[] = riadkyMesiac || [];
    const den = mesiac.filter((r) => r.datum === datum);
    const nas = s.nasobit_poctom !== false;
    const metre = (r: R) => ((Number(r.dlzka_cm) || 0) / 100) * (nas ? (Number(r.pocet_ks) || 1) : 1);
    const spolu = (rr: R[]) => rr.reduce((a, r) => a + metre(r), 0);

    const pingStaryH = s.posledny_ping ? (Date.now() - new Date(s.posledny_ping).getTime()) / 3600000 : null;
    const agentMlci = pingStaryH == null || pingStaryH > 24;
    const problemy = den.filter((r) => r.stav !== 'ok');

    if (cron && !den.length && !agentMlci) return json({ ok: true, skipped: 'Dnes nepribudli žiadne súbory.' });

    // zoskupenia
    const skup = (rr: R[], kluc: (r: R) => string) => {
      const mp = new Map<string, { m: number; n: number }>();
      for (const r of rr) { const k = kluc(r); const x = mp.get(k) || { m: 0, n: 0 }; x.m += metre(r); x.n += 1; mp.set(k, x); }
      return [...mp.entries()].sort((a, b) => b[1].m - a[1].m);
    };
    const mf = (r: R) => `${r.material || 'materiál ?'} — ${r.farba || 'farba ?'}`;
    const dnesMF = skup(den, mf);
    const mesiacMF = skup(mesiac, mf);
    const dnesZak = skup(den, (r) => `${r.zakazka || '?'} · ${r.zakaznik || 'zákazník ?'}`);

    const predmet = `Laser – spotreba metráže ${skDatum(datum)}: ${m2(spolu(den))} m (${den.length} ${suborov(den.length)})`;
    const rr: string[] = [];
    rr.push(`Spotreba metráže z laseru za ${skDatum(datum)}`);
    rr.push('');
    rr.push(`Spolu dnes: ${m2(spolu(den))} bežných metrov (${den.length} ${suborov(den.length)})`);
    rr.push(`Spolu od začiatku mesiaca: ${m2(spolu(mesiac))} bežných metrov (${mesiac.length} ${suborov(mesiac.length)})`);
    if (agentMlci) rr.push('', `⚠ Agent na PC pri laseri sa neozval ${pingStaryH == null ? 'ešte nikdy' : `už ${Math.round(pingStaryH)} hodín`} — údaje nemusia byť úplné (skontroluj, či PC beží a agent je spustený).`);
    rr.push('', 'DNES PODĽA MATERIÁLU A FARBY');
    if (!dnesMF.length) rr.push('  (nič)');
    for (const [k, v] of dnesMF) rr.push(`  ${k}: ${m2(v.m)} m (${v.n} súb.)`);
    rr.push('', 'DNES PODĽA ZÁKAZKY');
    if (!dnesZak.length) rr.push('  (nič)');
    for (const [k, v] of dnesZak) rr.push(`  ${k}: ${m2(v.m)} m`);
    rr.push('', 'DNES – SÚBORY');
    for (const r of den) rr.push(`  ${r.subor_nazov} → ${m2(metre(r))} m${nas && (Number(r.pocet_ks) || 1) > 1 ? ` (${m2(Number(r.dlzka_cm) / 100)} m × ${r.pocet_ks})` : ''}${r.stav !== 'ok' ? `  [${STAV_TEXT[r.stav] || r.stav}]` : ''}`);
    if (problemy.length) {
      rr.push('', `POZOR – na kontrolu: ${problemy.length} ${suborov(problemy.length)}:`);
      for (const r of problemy) rr.push(`  • ${r.subor_nazov}: ${STAV_TEXT[r.stav] || r.stav}${r.poznamka ? ` — ${r.poznamka}` : ''}`);
    }
    rr.push('', 'MESIAC DOTERAZ PODĽA MATERIÁLU A FARBY');
    for (const [k, v] of mesiacMF) rr.push(`  ${k}: ${m2(v.m)} m`);
    rr.push('', 'Detail a opravy názvov nájdeš v ERP: PrintStudio → Laser – spotreba metráže.');
    const text = rr.join('\n');

    const tab = (hlavicka: string[], riadky: string[][]) => `<table style="border-collapse:collapse;font-size:13px;margin:6px 0 14px"><tr>${hlavicka.map((h) => `<th style="text-align:left;padding:4px 10px;border-bottom:2px solid #ccc">${html(h)}</th>`).join('')}</tr>${riadky.map((r) => `<tr>${r.map((c, i) => `<td style="padding:4px 10px;border-bottom:1px solid #eee;${i > 0 && /m$/.test(c) ? 'text-align:right;white-space:nowrap' : ''}">${html(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    const htmlTelo = `<div style="font-family:Arial,sans-serif;color:#222;max-width:760px">
<h2 style="margin:0 0 6px">Laser – spotreba metráže ${skDatum(datum)}</h2>
<p style="font-size:15px;margin:4px 0"><b>Dnes: ${m2(spolu(den))} m</b> (${den.length} ${suborov(den.length)}) &nbsp;|&nbsp; Od začiatku mesiaca: <b>${m2(spolu(mesiac))} m</b></p>
${agentMlci ? `<p style="background:#fff3cd;padding:8px 10px;border-radius:6px">⚠ Agent na PC pri laseri sa neozval ${pingStaryH == null ? 'ešte nikdy' : `už ${Math.round(pingStaryH)} hodín`} — údaje nemusia byť úplné.</p>` : ''}
<h3 style="margin:14px 0 2px">Dnes podľa materiálu a farby</h3>${dnesMF.length ? tab(['Materiál — farba', 'Metre', 'Súborov'], dnesMF.map(([k, v]) => [k, `${m2(v.m)} m`, String(v.n)])) : '<p>(nič)</p>'}
<h3 style="margin:14px 0 2px">Dnes podľa zákazky</h3>${dnesZak.length ? tab(['Zákazka · zákazník', 'Metre'], dnesZak.map(([k, v]) => [k, `${m2(v.m)} m`])) : '<p>(nič)</p>'}
<h3 style="margin:14px 0 2px">Dnešné súbory</h3>${den.length ? tab(['Súbor', 'Metre', 'Stav'], den.map((r) => [r.subor_nazov, `${m2(metre(r))} m`, r.stav === 'ok' ? 'OK' : (STAV_TEXT[r.stav] || r.stav)])) : '<p>(nič)</p>'}
${problemy.length ? `<p style="background:#fde2e2;padding:8px 10px;border-radius:6px"><b>Vyžaduje kontrolu (${problemy.length}):</b><br>${problemy.map((r) => `• ${html(r.subor_nazov)} — ${html(STAV_TEXT[r.stav] || r.stav)}${r.poznamka ? ` (${html(r.poznamka)})` : ''}`).join('<br>')}</p>` : ''}
<h3 style="margin:14px 0 2px">Mesiac doteraz podľa materiálu a farby</h3>${tab(['Materiál — farba', 'Metre'], mesiacMF.map(([k, v]) => [k, `${m2(v.m)} m`]))}
<p style="color:#777;font-size:12px">Detail a opravy názvov: ERP → PrintStudio → Laser – spotreba metráže.</p></div>`;

    if (dryRun) return json({ ok: true, dryRun: true, predmet, text, riadkov: den.length, prijemcovia: s.prijemcovia });

    const prijemcovia: string[] = (s.prijemcovia || []).filter((x: string) => /@/.test(x));
    if (!prijemcovia.length) return json({ error: 'Nie sú zadané žiadne e-mailové adresy príjemcov.' }, 400);
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'Chýba secret RESEND_API_KEY — e-mail sa neodoslal.' }, 500);

    let meno = s.odosielatel_meno, email = s.odosielatel_email;
    if (!email) {
      const { data: u } = await supabase.from('upomienky_nastavenia').select('odosielatel_meno, odosielatel_email').eq('id', 1).maybeSingle();
      meno = meno || u?.odosielatel_meno; email = u?.odosielatel_email;
    }
    if (!email || /example\.sk$/i.test(email)) return json({ error: 'Nie je nastavený odosielateľ e-mailu (adresa na overenej Resend doméne).' }, 400);

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${meno || 'Laser'} <${email}>`, to: prijemcovia, subject: predmet, text, html: htmlTelo }),
    });
    if (!resp.ok) return json({ error: `Odoslanie zlyhalo: ${(await resp.text()).slice(0, 300)}` }, 502);
    if (datum === dnes) await supabase.from('laser_spotreba_nastavenia').update({ posledny_sumar_datum: dnes }).eq('id', 1);
    return json({ ok: true, odoslane: true, prijemcovia, predmet, riadkov: den.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
