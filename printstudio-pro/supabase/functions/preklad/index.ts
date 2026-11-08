// Preklad rozhrania verejných appiek (SK -> EN / DE). Prehliadač pošle slovenské texty, ktoré ešte nemá preložené; funkcia ich vyhľadá v tabuľke `preklady`
// (cache + ručne opravené preklady) a chýbajúce preloží cez Claude (Gemini, záloha Claude — kľúče v Supabase secrets) a uloží. Bez nákladov na opakované návštevy.
// Ochrana: max. počet nových prekladov za 24 h, max. dĺžka textu a počet textov v jednej požiadavke.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const odpoved = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MODELY = ['claude-haiku-4-5-20251001'];
const LIMIT_NOVYCH_ZA_DEN = 20000;
const MAX_TEXTOV = 60;
const MAX_DLZKA = 600;
const DAVKA = 25;
const JAZYKY: Record<string, string> = { en: 'English', de: 'German (Germany; formal address with "Sie")' };

const SYSTEM = `You translate the user interface of a Slovak print-on-demand studio (PBT print: custom printing on textiles, jerseys, flags, lanyards, headbands and similar products) from Slovak (sometimes Czech) into the requested language.
INPUT: a JSON array of UI strings. OUTPUT: ONLY a JSON array of strings, same length and same order, nothing else (no markdown, no comments).
Rules:
- Keep placeholders such as {0}, {1}, {2} exactly as they are (they stand for numbers).
- Keep numbers, units (cm, mm, m, g, kg, %, €), symbols, emojis, product codes, brand names (PBT, DTF, Shopify, B&C, Pantone, QR) and colour names that are already English unchanged.
- Keep leading/trailing punctuation and capitalisation style; text is short UI wording (buttons, labels, hints, error messages, product descriptions). Be concise and natural, not literal.
- "ks" (pieces) -> "pcs" in English, "Stk." in German. "bez DPH" -> "excl. VAT" / "zzgl. MwSt."; "s DPH" -> "incl. VAT" / "inkl. MwSt."; "Cena" -> Price / Preis.
- Glossary: sieťotlač = screen printing / Siebdruck; DTF transfer = DTF transfer / DTF-Transfer; rezaný transfer, rezané fólie = cut vinyl transfer, heat-transfer vinyl / Flexfolie-Transfer, Schneidefolie; sublimácia = sublimation / Sublimationsdruck; plážová vlajka (beachflag) = beach flag / Beachflag; stolová vlajka = table flag / Tischfahne; zástava = flag / Fahne; šnúrka na krk = lanyard / Schlüsselband; čelenka = headband / Stirnband; buff / šatka = tube scarf (Buff) / Multifunktionstuch (Buff); dres = jersey / Trikot; potlač = print / Druck; náhľad = preview / Vorschau; vlastný motív = own design / eigenes Motiv; odberateľ / B2B kód = business customer / B2B-Code; spadávka = bleed / Beschnitt; líce/rub = front/back side; tričko = T-shirt; mikina = sweatshirt/hoodie; šiltovka = cap / Schirmmütze; objednávka = order / Bestellung; dopyt = enquiry / Anfrage; zálohová faktúra = proforma invoice.
- Do not translate or alter text that is already in the target language or is a name; return it unchanged.`;

const chyby: string[] = [];
const GEMINI_MODELY = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// vráti surový text odpovede modelu (JSON pole) alebo null
async function volajModel(jazyk: string, texty: string[]): Promise<string | null> {
  const system = `${SYSTEM}
Target language: ${JAZYKY[jazyk]}.`;
  const gemini = Deno.env.get('GEMINI_API_KEY');
  if (gemini) {
    for (const model of GEMINI_MODELY) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(texty) }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
        });
        if (!res.ok) { chyby.push(`gemini ${model} ${res.status} ${(await res.text()).slice(0, 120)}`); continue; }
        const data = await res.json();
        const t = (data.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
        if (t) return t;
      } catch (e) { chyby.push(`gemini ${model} ${String((e as Error).message || e)}`); }
    }
  }
  const claude = Deno.env.get('ANTHROPIC_API_KEY');
  if (claude) {
    for (const model of MODELY) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': claude, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: JSON.stringify(texty) }] }),
        });
        if (!res.ok) { chyby.push(`claude ${res.status} ${(await res.text()).slice(0, 120)}`); continue; }
        const data = await res.json();
        const t = (data.content || []).map((c: { text?: string }) => c.text || '').join('');
        if (t) return t;
      } catch (e) { chyby.push(`claude ${String((e as Error).message || e)}`); }
    }
  }
  return null;
}

async function preloz(jazyk: string, texty: string[]): Promise<string[] | null> {
  const text = await volajModel(jazyk, texty);
  if (text) {
    const i = text.indexOf('['), j = text.lastIndexOf(']');
    try {
      const pole = i >= 0 && j > i ? JSON.parse(text.slice(i, j + 1)) : null;
      if (Array.isArray(pole) && pole.length === texty.length && pole.every((x) => typeof x === 'string')) return pole as string[];
    } catch { /* neplatný JSON */ }
  }
  // nesedí počet / chyba -> pri väčšej dávke skúsime po polovici
  if (texty.length > 1) {
    const pol = Math.ceil(texty.length / 2);
    const a = await preloz(jazyk, texty.slice(0, pol)), b = await preloz(jazyk, texty.slice(pol));
    if (a && b) return [...a, ...b];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    chyby.length = 0;
    const telo = await req.json().catch(() => ({}));
    const jazyk = String(telo.lang || '');
    if (!JAZYKY[jazyk]) return odpoved({ ok: false, error: 'Nepodporovaný jazyk.' }, 400);
    if (telo.akcia === 'export') { // všetky preklady jazyka (na zabalenie do appky)
      const sbe = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const vsetko: Record<string, string> = {};
      for (let od = 0; ; od += 1000) {
        const { data } = await sbe.from('preklady').select('zdroj, preklad').eq('lang', jazyk).order('zdroj').range(od, od + 999);
        (data || []).forEach((r: { zdroj: string; preklad: string }) => { vsetko[r.zdroj] = r.preklad; });
        if (!data || data.length < 1000) break;
      }
      return odpoved({ ok: true, preklady: vsetko });
    }
    const vstup: string[] = Array.isArray(telo.texts) ? telo.texts.filter((t: unknown) => typeof t === 'string' && t.trim() && t.length <= MAX_DLZKA && /\p{L}/u.test(t)).slice(0, MAX_TEXTOV) : [];
    const texty = [...new Set(vstup)];
    if (!texty.length) return odpoved({ ok: true, preklady: {} });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const preklady: Record<string, string> = {};
    const { data: existujuce } = await sb.from('preklady').select('zdroj, preklad').eq('lang', jazyk).in('zdroj', texty);
    for (const r of existujuce || []) preklady[r.zdroj] = r.preklad;
    const chybajuce = texty.filter((t) => !(t in preklady));

    if (chybajuce.length) {
      const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY');
      const odDna = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await sb.from('preklady').select('zdroj', { count: 'exact', head: true }).gte('vytvorene', odDna);
      if (!apiKey) chyby.push('chýba GEMINI_API_KEY aj ANTHROPIC_API_KEY');
      if (apiKey && (count ?? 0) + chybajuce.length <= LIMIT_NOVYCH_ZA_DEN) {
        const davky: string[][] = [];
        for (let i = 0; i < chybajuce.length; i += DAVKA) davky.push(chybajuce.slice(i, i + DAVKA));
        const vysledky = await Promise.all(davky.map((d) => preloz(jazyk, d)));
        const riadky: { lang: string; zdroj: string; preklad: string }[] = [];
        vysledky.forEach((v, k) => { if (!v) return; davky[k].forEach((z, i) => { const p = v[i].trim() ? v[i] : z; preklady[z] = p; riadky.push({ lang: jazyk, zdroj: z, preklad: p }); }); });
        if (riadky.length) await sb.from('preklady').upsert(riadky, { onConflict: 'lang,zdroj', ignoreDuplicates: true });
      }
    }
    return odpoved({ ok: true, preklady, ...(chyby.length ? { diag: chyby.slice(0, 3) } : {}) });
  } catch (e) {
    return odpoved({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
