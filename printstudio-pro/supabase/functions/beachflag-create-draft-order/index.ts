// Vytvorí Shopify Draft Order s presnou cenou pre beachvlajku (namiesto vopred vytvorených
// cenových variant, ako pri tričkách — cena vlajky má príliš veľký rozptyl 45€-500€+ na to,
// aby stačilo pár cenových stupňov). Cena sa VŽDY prepočíta server-side z aktuálnych
// katalógových riadkov v DB — klientom poslaná cena sa nikdy nepoužije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// vypocitajCenuVlajky je duplikat z ../_shared/vlajkaCena.ts — pri zmene vzorca uprav oba subory
// (aj src/printstudio/vlajkaCenotvorba.js a printstudio-pro/src/beachflag/vlajkaCenotvorba.js).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VlajkaCenaVstup {
  velkost: { cena: number } | null;
  dokoncenie: { cena: number } | null;
  stoziar: { cena: number } | null;
  doplnky: { cena: number; mnozstvo: number }[];
  expresne: boolean;
  pocetKs: number;
  nastavenia: { dph_percent: number; expresny_priplatok_percent: number };
}

function vypocitajCenuVlajky({ velkost, dokoncenie, stoziar, doplnky, expresne, pocetKs, nastavenia }: VlajkaCenaVstup) {
  const cenaVelkosti = Number(velkost?.cena) || 0;
  const cenaDokoncenia = Number(dokoncenie?.cena) || 0;
  const cenaStoziara = Number(stoziar?.cena) || 0;
  const zaklad = cenaVelkosti + cenaDokoncenia + cenaStoziara;

  const doplnkySpolu = (doplnky || []).reduce((sum, d) => sum + (Number(d.cena) || 0) * (Number(d.mnozstvo) || 0), 0);

  const ks = Math.max(1, Number(pocetKs) || 1);
  const subtotal = (zaklad + doplnkySpolu) * ks;

  const expresnyPercent = Number(nastavenia?.expresny_priplatok_percent) || 0;
  const expresnyPriplatok = expresne ? subtotal * (expresnyPercent / 100) : 0;

  const cenaBezDph = subtotal + expresnyPriplatok;

  const dphPercent = Number(nastavenia?.dph_percent) || 0;
  const dphSuma = cenaBezDph * (dphPercent / 100);

  const cenaSpolu = cenaBezDph + dphSuma;

  return { zaklad, doplnkySpolu, subtotal, expresnyPriplatok, cenaBezDph, dphSuma, cenaSpolu };
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const {
      designId, tvarKod, velkostKod, dokoncenieKod, stoziarKod,
      doplnky = [], farbaHex, farbaPoznamka, textNaVlajke,
      expresne = false, pocetKs = 1, nahladUrl,
    } = body;

    if (!tvarKod || !velkostKod) throw new Error('Chýba tvar alebo veľkosť vlajky.');

    const [{ data: tvar }, { data: velkost }, { data: dokoncenie }, { data: stoziar }, { data: doplnkyDb }, { data: nastavenia }] = await Promise.all([
      supabase.from('vlajka_tvary').select('*').eq('kod', tvarKod).maybeSingle(),
      supabase.from('vlajka_velkosti').select('*').eq('kod', velkostKod).maybeSingle(),
      dokoncenieKod ? supabase.from('vlajka_dokoncenie').select('*').eq('kod', dokoncenieKod).maybeSingle() : Promise.resolve({ data: null }),
      stoziarKod ? supabase.from('vlajka_stoziare').select('*').eq('kod', stoziarKod).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('vlajka_doplnky').select('*'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (!tvar) throw new Error(`Tvar "${tvarKod}" sa v katalógu nenašiel.`);
    if (!velkost) throw new Error(`Veľkosť "${velkostKod}" sa v katalógu nenašla.`);

    const doplnkyVypocet = (doplnky as { kod: string; mnozstvo: number }[]).map((d) => {
      const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
      return { cena: dbRow ? Number(dbRow.cena) : 0, mnozstvo: Number(d.mnozstvo) || 0, nazov: dbRow?.nazov || d.kod };
    });

    const cena = vypocitajCenuVlajky({
      velkost, dokoncenie, stoziar,
      doplnky: doplnkyVypocet,
      expresne: !!expresne,
      pocetKs: Number(pocetKs) || 1,
      nastavenia: nastavenia || { dph_percent: 23, expresny_priplatok_percent: 10 },
    });

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const nazovPolozky = `Beachvlajka — ${tvar.nazov} (${velkost.kod})`;
    const properties: Record<string, string> = {
      _beachflag_order: 'true',
      _design_id: designId || '',
      _tvar: tvar.nazov,
      _velkost: velkost.kod,
      _opracovanie: dokoncenie?.nazov || '',
      _stoziar: stoziar?.nazov || '',
      _doplnky: doplnkyVypocet.map((d) => `${d.mnozstvo}× ${d.nazov}`).join(', '),
      _farba_hex: farbaHex || '',
      _farba_poznamka: farbaPoznamka || '',
      _text_na_vlajke: textNaVlajke || '',
      _expresne: expresne ? 'áno' : 'nie',
      _nahlad_url: nahladUrl || '',
    };

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky,
            price: (cena.cenaSpolu / Math.max(1, Number(pocetKs) || 1)).toFixed(2),
            quantity: Number(pocetKs) || 1,
            taxable: false, // cena už zahŕňa DPH (vypočítaná server-side) — Shopify ju druhýkrát nepripočíta
            requires_shipping: true,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Beachflag objednávka — dizajn ${designId || '—'}`,
        tags: 'beachflag',
        use_customer_default_address: true,
      },
    };

    const res = await fetch(`https://${domain}/admin/api/2025-01/draft_orders.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(draftPayload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify Admin API chyba ${res.status}: ${text}`);
    }
    const data = await res.json();
    const draftOrder = data?.draft_order;
    if (!draftOrder?.invoice_url) throw new Error('Shopify nevrátil odkaz na platbu draft objednávky.');

    return odpoved({ draftOrderId: draftOrder.id, checkoutUrl: draftOrder.invoice_url, cenaSpolu: cena.cenaSpolu });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
