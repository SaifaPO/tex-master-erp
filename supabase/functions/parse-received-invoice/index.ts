// Edge Function: parse-received-invoice
// Precita PRIJATU fakturu (PDF alebo fotka) od dodavatela pomocou Claude a vrati strukturovane udaje:
// dodavatel, IČO/DIČ/IČ DPH, cislo faktury, VS, IBAN, datumy, zaklad/DPH/suma (aj po sadzbach), navrh kategorie, rezim DPH
// a upozornenia (napr. zahranicna faktura, dobropis, neciteľne udaje).
//
// Volanie (z appky, prihlaseny pouzivatel):
//   supabase.functions.invoke('parse-received-invoice', { body: { storagePath, mimeType } })
// kde storagePath je cesta suboru v SUKROMNOM bucket-e "prijate-faktury" (subor sa nahra z appky pred volanim).
//
// Vyzaduje secret ANTHROPIC_API_KEY (rovnaky ako pri ocr-odometer / parse-order-request). SUPABASE_URL a
// SUPABASE_SERVICE_ROLE_KEY su v Edge Functions k dispozicii automaticky.
//
// AI iba NAVRHUJE udaje — nic sa nezauctuje ani neodosiela; majitel kazdu fakturu pred schvalenim skontroluje v ERP.
// Nasadenie: Supabase Dashboard -> Edge Functions -> Create function "parse-received-invoice", vloz tento kod (je to jeden samostatny subor).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-sonnet-5-5';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const KATEGORIE = [
  'Materiál (látky, fólie, papier, atrament)', 'Tovar na predaj', 'Energie', 'Nájom', 'Služby (externé)', 'Doprava a kuriér',
  'Marketing a reklama', 'Softvér a IT', 'Telekomunikácie', 'Kancelária a drobný materiál', 'Údržba a opravy', 'Poistenie',
  'Pohonné hmoty a vozidlá', 'Leasing a splátky', 'Účtovné a právne služby', 'Dlhodobý majetok (stroj, zariadenie)', 'Ostatné',
];

const PROMPT = `Si pomocník účtovníčky na Slovensku. Prečítaj priložený doklad (prijatú faktúru od dodávateľa) a vráť IBA čistý JSON (bez textu okolo a bez markdown), presne v tomto tvare:
{
  "dodavatel_nazov": string|null, "dodavatel_ico": string|null (iba číslice), "dodavatel_dic": string|null, "dodavatel_ic_dph": string|null, "dodavatel_krajina": string|null (ISO kód, napr. "SK","CZ","FI","DE"),
  "druh": "faktura"|"dobropis"|"zalohova"|"ina",
  "cislo_faktury": string|null, "variabilny_symbol": string|null (iba číslice), "iban": string|null (bez medzier),
  "datum_vystavenia": "YYYY-MM-DD"|null, "datum_dodania": "YYYY-MM-DD"|null, "datum_splatnosti": "YYYY-MM-DD"|null,
  "mena": string (napr. "EUR"),
  "zaklad_dane": number|null, "dph_suma": number|null, "suma_celkom": number|null (na úhradu; pri dobropise záporná),
  "dph_sadzby": [ { "sadzba": number, "zaklad": number, "dph": number } ],
  "rezim_dph": "standard"|"prenos_danovej_povinnosti"|"oslobodene"|"mimo_sk_bez_dph"|"nejasne",
  "navrh_kategorie": jedna z: ${JSON.stringify(KATEGORIE)},
  "popis": string (stručne, max 120 znakov: čo sa nakupuje),
  "odberatel_nazov": string|null, "odberatel_ico": string|null,
  "istota": number (0 až 1: ako si si istý správnosťou súm a čísla faktúry),
  "upozornenia": [ string ]
}
Pravidlá: sumy sú čísla s bodkou ako desatinným oddeľovačom (nie text). Ak údaj na doklade nie je, daj null. Dátumy prepíš do tvaru YYYY-MM-DD. Nevymýšľaj hodnoty, ktoré na doklade nie sú. Do "upozornenia" napíš všetko, čo by mala skontrolovať účtovníčka: zahraničný dodávateľ, faktúra bez DPH, preklad DPH na odberateľa, dobropis, nečitateľné údaje, rozpor medzi súčtami, odberateľ nie je PBT PRINT / ATAK, faktúra za dlhodobý majetok. Ak ide o doklad, ktorý nie je faktúra (napr. bloček, výzva), nastav druh "ina" a vysvetli v upozorneniach.`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function vytiahniJson(text: string): Record<string, unknown> {
  const cisty = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const zaciatok = cisty.indexOf('{');
  const koniec = cisty.lastIndexOf('}');
  if (zaciatok < 0 || koniec < 0) throw new Error('AI nevrátila platný JSON.');
  return JSON.parse(cisty.slice(zaciatok, koniec + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { storagePath, mimeType } = await req.json();
    if (!storagePath) return jsonResponse({ error: 'Chýba cesta k súboru (storagePath).' }, 400);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Chýba nastavený ANTHROPIC_API_KEY v Supabase secrets.' }, 500);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: blob, error: dlErr } = await supabase.storage.from('prijate-faktury').download(storagePath);
    if (dlErr || !blob) return jsonResponse({ error: `Súbor sa nepodarilo načítať: ${dlErr?.message || 'neznáma chyba'}` }, 404);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) return jsonResponse({ error: 'Súbor je väčší ako 20 MB.' }, 413);
    const typ = String(mimeType || blob.type || '').toLowerCase();
    const jePdf = typ.includes('pdf') || storagePath.toLowerCase().endsWith('.pdf');
    const obsah = jePdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytesToBase64(bytes) } }
      : { type: 'image', source: { type: 'base64', media_type: typ.startsWith('image/') ? typ : 'image/jpeg', data: bytesToBase64(bytes) } };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: [obsah, { type: 'text', text: PROMPT }] }],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse({ error: `AI požiadavka zlyhala: ${errText}` }, 502);
    }
    const data = await response.json();
    const text = (data?.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n');
    const udaje = vytiahniJson(text);
    return jsonResponse({ success: true, udaje, kategorie: KATEGORIE });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
