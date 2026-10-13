// Edge Function: send-payment-reminders
// Raz denne (pg_cron) skontroluje vystavene faktury po splatnosti a zakaznikom posle e-mailom:
//   stupen 1 (po `dni_1` dnoch): priatelska pripomienka,  stupen 2 (`dni_2`): upomienka,  stupen 3 (`dni_3`): posledna vyzva.
// Kazdy stupen sa pre fakturu posiela najviac raz. Neposiela sa, ak: su upomienky vypnute, zakaznik nema e-mail, je vynaty
// (customers.nevysielat_upomienky), alebo v banke je neparovana prichadzajuca platba s rovnakym VS a sumou (pravdepodobne uz zaplatene).
//
// Volanie:  { dryRun: true }  -> nic neodosle, vrati zoznam, co by sa poslalo (aj s textom) — pouziva ERP "Skusobny beh".
//           {}                -> skutocne odosielanie (iba ak upomienky_nastavenia.zapnute = true).
// Secrets: RESEND_API_KEY (odosielanie cez resend.com; odosielatel musi byt na overenej domene). SUPABASE_URL a SERVICE_ROLE su automaticky.
// Nasadenie: Supabase Dashboard -> Edge Functions -> Create function "send-payment-reminders", vloz tento kod (jeden samostatny subor).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const skDatum = (s: string | null) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '—');
const dniMedzi = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000);
const slovoDni = (d: number) => (d === 1 ? 'deň' : d < 5 ? 'dni' : 'dní');

// deno-lint-ignore no-explicit-any
function zostavSpravu(inv: any, dni: number, stupen: number, firma: any, s: any) {
  const udaje = `Údaje na úhradu:\n• Suma: ${eur(inv.total)}\n• Variabilný symbol: ${inv.variable_symbol || inv.invoice_number}\n${firma?.iban ? `• IBAN: ${firma.iban}\n` : ''}`;
  const podpis = `\nS pozdravom\n${firma?.company_name || s.odosielatel_meno}`;
  const predmet = `${stupen === 3 ? 'Posledná výzva na úhradu' : stupen === 2 ? 'Upomienka' : 'Pripomienka'} – faktúra ${inv.invoice_number}`;
  let text: string;
  if (stupen === 1) {
    text = `Dobrý deň,\n\ndovoľujeme si Vás priateľsky upozorniť, že faktúra č. ${inv.invoice_number} zo dňa ${skDatum(inv.issue_date)} so splatnosťou ${skDatum(inv.due_date)} nám zatiaľ nebola uhradená (${dni} ${slovoDni(dni)} po splatnosti). Ak ste platbu už zadali, tento e-mail prosím ignorujte.\n\n${udaje}${podpis}`;
  } else if (stupen === 2) {
    text = `Dobrý deň,\n\nv našej evidencii vedieme neuhradenú faktúru č. ${inv.invoice_number} so splatnosťou ${skDatum(inv.due_date)}, ktorá je už ${dni} dní po splatnosti. Žiadame Vás o jej úhradu v čo najkratšom čase, najneskôr do 7 dní. Ak ste platbu už zadali, pošlite nám prosím potvrdenie.\n\n${udaje}${podpis}`;
  } else {
    let sankcie = '';
    if (s.uctovat_pokutu) {
      const pokuta = Math.round(inv.total * (Number(s.pokuta_percent_denne) / 100) * dni * 100) / 100;
      const pausal = Number(s.pausal_eur) || 0;
      sankcie = `\nPodľa našich všeobecných obchodných podmienok si uplatňujeme zmluvnú pokutu ${Number(s.pokuta_percent_denne)} % z dlžnej sumy za každý deň omeškania (k dnešnému dňu ${eur(pokuta)}) a paušálnu náhradu nákladov spojených s uplatnením pohľadávky ${eur(pausal)}. Sankcie vyúčtujeme osobitným dokladom.\n`;
    }
    text = `Dobrý deň,\n\nfaktúra č. ${inv.invoice_number} so splatnosťou ${skDatum(inv.due_date)} stále nie je uhradená (${dni} dní po splatnosti), napriek predchádzajúcim pripomienkam. Žiadame Vás o okamžitú úhradu najneskôr do 5 dní. V opačnom prípade budeme nútení riešiť pohľadávku ďalšími krokmi vrátane vymáhania.\n${sankcie}\n${udaje}${podpis}`;
  }
  return { predmet, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: nast } = await supabase.from('upomienky_nastavenia').select('*').eq('id', 1).maybeSingle();
    const s = nast || { zapnute: false, odosielatel_meno: 'Fakturácia', odosielatel_email: 'fakturacia@example.sk', dni_1: 3, dni_2: 14, dni_3: 30, uctovat_pokutu: false, pokuta_percent_denne: 0.05, pausal_eur: 40 };
    if (!dryRun && !s.zapnute) return json({ success: true, skipped: 'Automatické upomienky sú vypnuté.' });

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!dryRun && !apiKey) return json({ error: 'Chýba secret RESEND_API_KEY — e-maily sa neodoslali.' }, 500);

    const dnes = new Date().toISOString().slice(0, 10);
    const [invRes, custRes, logRes, bankRes, firmaRes] = await Promise.all([
      supabase.from('invoices').select('*').neq('status', 'paid').lt('due_date', dnes),
      supabase.from('customers').select('name,email,nevysielat_upomienky'),
      supabase.from('upomienky_log').select('invoice_id,stupen').eq('stav', 'odoslane'),
      supabase.from('bank_transactions').select('amount,variable_symbol').eq('matched', false).gt('amount', 0),
      supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (invRes.error) return json({ error: invRes.error.message }, 500);
    const zakaznici = new Map((custRes.data || []).map((c: { name: string; email: string; nevysielat_upomienky: boolean }) => [String(c.name || '').trim().toLowerCase(), c]));
    const odoslane = new Map<string, number>();
    (logRes.data || []).forEach((l: { invoice_id: string; stupen: number }) => odoslane.set(String(l.invoice_id), Math.max(odoslane.get(String(l.invoice_id)) || 0, l.stupen)));
    const neparovane = bankRes.data || [];

    const naOdoslanie: Record<string, unknown>[] = [];
    const preskocene: { faktura: string; dovod: string }[] = [];
    const chyby: { faktura: string; chyba: string }[] = [];

    for (const inv of invRes.data || []) {
      const dni = dniMedzi(inv.due_date, dnes);
      const stupen = dni >= s.dni_3 ? 3 : dni >= s.dni_2 ? 2 : dni >= s.dni_1 ? 1 : 0;
      if (stupen === 0) continue;
      if ((odoslane.get(String(inv.id)) || 0) >= stupen) continue; // tento stupen uz isiel
      const zakaznik = zakaznici.get(String(inv.customer_name || '').trim().toLowerCase());
      if (zakaznik?.nevysielat_upomienky) { preskocene.push({ faktura: inv.invoice_number, dovod: 'Zákazník je vyňatý z upomienok.' }); continue; }
      if (!zakaznik?.email) { preskocene.push({ faktura: inv.invoice_number, dovod: 'Zákazník nemá v evidencii e-mail.' }); continue; }
      const vs = String(inv.variable_symbol || inv.invoice_number || '').replace(/\D/g, '');
      const mozneZaplatene = neparovane.some((t: { amount: number; variable_symbol: string }) => vs && String(t.variable_symbol || '').replace(/\D/g, '') === vs && Math.abs(Number(t.amount) - Number(inv.total)) < 0.02);
      if (mozneZaplatene) { preskocene.push({ faktura: inv.invoice_number, dovod: 'V banke je nespárovaná platba s rovnakým VS a sumou — pravdepodobne už zaplatené.' }); continue; }

      const { predmet, text } = zostavSpravu(inv, dni, stupen, firmaRes.data, s);
      const polozka = { faktura: inv.invoice_number, invoice_id: inv.id, zakaznik: inv.customer_name, email: zakaznik.email, stupen, dni, predmet, text };

      if (dryRun) { naOdoslanie.push(polozka); continue; }

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${s.odosielatel_meno} <${s.odosielatel_email}>`, to: [zakaznik.email], ...(s.kopia_email ? { bcc: [s.kopia_email] } : {}), subject: predmet, text }),
      });
      if (resp.ok) {
        naOdoslanie.push(polozka);
        await supabase.from('upomienky_log').insert({ invoice_id: String(inv.id), invoice_number: inv.invoice_number, customer_name: inv.customer_name, prijemca: zakaznik.email, stupen, dni_po_splatnosti: dni, stav: 'odoslane' });
      } else {
        const err = await resp.text();
        chyby.push({ faktura: inv.invoice_number, chyba: err.slice(0, 300) });
        await supabase.from('upomienky_log').insert({ invoice_id: String(inv.id), invoice_number: inv.invoice_number, customer_name: inv.customer_name, prijemca: zakaznik.email, stupen, dni_po_splatnosti: dni, stav: 'chyba', chyba: err.slice(0, 500) });
      }
    }
    return json({ success: true, dryRun, odosielatel: `${s.odosielatel_meno} <${s.odosielatel_email}>`, naOdoslanie, preskocene, chyby });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
