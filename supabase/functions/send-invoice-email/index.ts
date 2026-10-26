// Edge Function: send-invoice-email
// ERP tlacidlo "Poslat faktúru e-mailom": zákazníkovi odošle e-mail s PDF faktúrou v prílohe (cez resend.com).
// Vstup: { invoiceId, to, subject, text, filename, pdfBase64, jazyk, replyTo?, cc?, fromName? }
//   replyTo / cc  = e-mail predávajúceho (obchodníka): odpoveď zákazníka príde priamo jemu a dostane aj kópiu e-mailu
//   fromName      = meno predávajúceho, zobrazí sa ako "Meno Priezvisko | PBT" (odosielacia adresa ostáva centrálna, overená v Resende)
// Odosielateľ a skrytá kópia sa berú z tabuľky upomienky_nastavenia (rovnaké nastavenie ako pri upomienkach — ERP → Upomienky).
// Secrets: RESEND_API_KEY (odosielateľ musí byť na overenej doméne). SUPABASE_URL a SERVICE_ROLE sú automatické.
// Každé odoslanie sa zapíše do faktury_email_log (ak existuje; migration_faktury_email.sql).
// Nasadenie: Supabase Dashboard -> Edge Functions -> Create function "send-invoice-email", vlož tento kód (jeden samostatný súbor).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cistiMeno = (s: unknown) => String(s || '').replace(/[<>"@\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { invoiceId, to, subject, text, filename, pdfBase64, jazyk, replyTo, cc, fromName } = await req.json();
    if (!invoiceId || !to || !subject || !text || !pdfBase64) return json({ error: 'Chýba faktúra, príjemca, predmet, text alebo PDF.' }, 400);
    const prijemcovia = String(to).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    if (prijemcovia.length === 0 || prijemcovia.length > 3 || prijemcovia.some((x) => !EMAIL_RE.test(x))) return json({ error: 'E-mailová adresa príjemcu nie je platná.' }, 400);
    const kopie = String(cc || '').split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    if (kopie.length > 3 || kopie.some((x) => !EMAIL_RE.test(x))) return json({ error: 'E-mailová adresa kópie nie je platná.' }, 400);
    const odpovedat = String(replyTo || '').trim();
    if (odpovedat && !EMAIL_RE.test(odpovedat)) return json({ error: 'E-mailová adresa pre odpoveď nie je platná.' }, 400);
    if (String(pdfBase64).length > 8_000_000) return json({ error: 'PDF je príliš veľké.' }, 400);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'Chýba secret RESEND_API_KEY — e-mail sa neodoslal (nastav ho v Supabase → Edge Functions → Secrets).' }, 500);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: inv } = await supabase.from('invoices').select('id,invoice_number,customer_name').eq('id', invoiceId).maybeSingle();
    if (!inv) return json({ error: 'Faktúra sa nenašla.' }, 404);
    const { data: nast } = await supabase.from('upomienky_nastavenia').select('odosielatel_meno,odosielatel_email,kopia_email').eq('id', 1).maybeSingle();
    if (!nast || !nast.odosielatel_email || String(nast.odosielatel_email).endsWith('@example.sk')) return json({ error: 'Nie je nastavená skutočná adresa odosielateľa (ERP → Upomienky → Odosielateľ).' }, 400);
    const meno = cistiMeno(fromName);
    const odosielatel = `${meno ? `${meno} | ${nast.odosielatel_meno}` : nast.odosielatel_meno} <${nast.odosielatel_email}>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: odosielatel,
        to: prijemcovia,
        ...(kopie.length ? { cc: kopie } : {}),
        ...(odpovedat ? { reply_to: odpovedat } : {}),
        ...(nast.kopia_email ? { bcc: [nast.kopia_email] } : {}),
        subject,
        text,
        attachments: [{ filename: filename || `faktura-${inv.invoice_number}.pdf`, content: pdfBase64 }],
      }),
    });
    const ok = resp.ok;
    const err = ok ? null : (await resp.text()).slice(0, 500);
    await supabase.from('faktury_email_log').insert({
      invoice_id: String(inv.id), invoice_number: inv.invoice_number, customer_name: inv.customer_name,
      prijemca: [...prijemcovia, ...kopie.map((k) => `kópia: ${k}`)].join(', '), jazyk: jazyk === 'en' ? 'en' : 'sk', stav: ok ? 'odoslane' : 'chyba', chyba: err,
    });
    if (!ok) return json({ error: `Odoslanie zlyhalo: ${err}` }, 502);
    return json({ success: true, odosielatel, prijemca: prijemcovia, kopia: kopie });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
