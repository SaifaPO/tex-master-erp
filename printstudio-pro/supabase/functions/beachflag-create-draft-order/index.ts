// Vytvorí Shopify Draft Order s presnou cenou pre beachvlajku (namiesto vopred vytvorených
// cenových variant, ako pri tričkách — cena vlajky má príliš veľký rozptyl 45€-500€+ na to,
// aby stačilo pár cenových stupňov). Cena sa VŽDY prepočíta server-side z aktuálnych
// katalógových riadkov v DB — klientom poslaná cena sa nikdy nepoužije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
//
// Naklad vlajky = latka + sublimacna potlac + sitie (rovnaky vzorec ako beachflag-price-preview —
// predtym pocitalo LEN latku, cena bola drasticky podhodnotena, napr. XL vyslo len 17 EUR).
// Marzovy vzorec + cena z materialu je duplikat beachflag-price-preview/index.ts — pri zmene
// uprav aj tam (a src/printstudio/pricingEngine.js, printstudio-pro/src/pricingEngine.js).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// B2B zlava (reklamne agentury): kod sa overuje na serveri v tabulke b2b_kody (servisny kluc). Neplatny / vypnuty kod = 0 %.
async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(Number(data?.zlava_percent) || 0, 0), 90);
}

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; cielovaHodnotaZakazky: number; dphPercent: number; }

function baseMargin(cost: number, cfg: PricingConfig) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost: number, qty: number, cfg: PricingConfig) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.cielovaHodnotaZakazky / Math.max(cost, 0.05), 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost: number, qty: number, cfg: PricingConfig) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
}

interface VlajkaCenaVstup {
  nakladMaterial: number;
  dokoncenie: { cena: number } | null;
  stoziare: { cena: number; mnozstvo: number }[]; // kazdy prut ma vlastny pocet kusov
  podstavce: { cena: number; mnozstvo: number }[]; // kazdy podstavec ma vlastny pocet kusov
  doplnky: { cena: number; mnozstvo: number }[];
  expresne: boolean;
  pocetKs: number;
  osobnyOdber: boolean;
  nastavenia: { expresny_priplatok_percent: number; cena_doprava?: number; postovne_zdarma_od_eur?: number };
  pricingConfig: PricingConfig;
  zlavaPercent?: number; // B2B zlava v % z ceny tovaru
}

function vypocitajCenuVlajky({ nakladMaterial, dokoncenie, stoziare, podstavce, doplnky, expresne, pocetKs, osobnyOdber, nastavenia, pricingConfig, zlavaPercent = 0 }: VlajkaCenaVstup) {
  const ks = Math.max(1, Number(pocetKs) || 1);
  const cenaMaterialKus = priceAt(Number(nakladMaterial) || 0, ks, pricingConfig);
  // Opracovanie, prut, podstavec aj doplnky su v DB NAKUPNE ceny — predajna sa dopocita rovnakym
  // marzovym vzorcom ako material (rovnako ako v beachflag-price-preview).
  // Vlajky: ks x (material + opracovanie). Prúty, podstavce a prislusenstvo maju kazdy VLASTNY pocet kusov
  // (marza sa pocita z poctu kusov danej polozky) — rovnaky vypocet ako v beachflag-price-preview.
  const cenaDokoncenia = priceAt(Number(dokoncenie?.cena) || 0, ks, pricingConfig);
  const zaklad = cenaMaterialKus + cenaDokoncenia;
  const sumaPolozky = (pole: { cena: number; mnozstvo: number }[]) => (pole || []).reduce((sum, d) => {
    const m = Math.round(Number(d.mnozstvo) || 0);
    return m > 0 ? sum + priceAt(Number(d.cena) || 0, m, pricingConfig) * m : sum;
  }, 0);
  const doplnkySpolu = sumaPolozky(doplnky);

  const subtotalPredZlavou = zaklad * ks + sumaPolozky(stoziare) + sumaPolozky(podstavce) + doplnkySpolu;
  const b2bZlavaEur = Math.round(subtotalPredZlavou * (Number(zlavaPercent) || 0)) / 100;
  const subtotal = subtotalPredZlavou - b2bZlavaEur;

  const expresnyPercent = Number(nastavenia?.expresny_priplatok_percent) || 0;
  const expresnyPriplatok = expresne ? subtotal * (expresnyPercent / 100) : 0;

  const dphPercent = Number(pricingConfig.dphPercent) || 0;
  // Postovne zdarma od urcitej sumy objednavky (s DPH, bez dopravy) — predvolene 150 EUR (rovnako ako v beachflag-price-preview).
  const postovneZdarmaOd = Number(nastavenia?.postovne_zdarma_od_eur ?? 150) || 0;
  const tovarSDph = (subtotal + expresnyPriplatok) * (1 + dphPercent / 100);
  const doprava = osobnyOdber || (postovneZdarmaOd > 0 && tovarSDph >= postovneZdarmaOd) ? 0 : (Number(nastavenia?.cena_doprava) || 0);

  const cenaBezDph = subtotal + expresnyPriplatok + doprava;
  const dphSuma = cenaBezDph * (dphPercent / 100);

  const cenaSpolu = cenaBezDph + dphSuma;

  return { zaklad, doplnkySpolu, subtotal, expresnyPriplatok, doprava, cenaBezDph, dphSuma, cenaSpolu };
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Ak je material prepojeny na skutocny sklad (materials.id), naklad/m2 sa VZDY pocita naживo
// z aktualnej ceny za bezny meter + sirky rolky v Sklade — nie zo starej ulozenej snimky.
// Bez prepojenia (alebo ak sklad. polozka nema vyplnenu sirku) sa pouzije rucne zadany naklad_m2.
async function resolveNakladM2(supabase: ReturnType<typeof createClient>, material: { naklad_m2: number; sklad_material_id: string | null; naklad_m2_rucne?: number | null }) {
  // Rucne zadana cena €/m2 (ERP: Materialy -> "rucne") ma prednost pred cenou zo skladu.
  if (Number(material.naklad_m2_rucne) > 0) return Number(material.naklad_m2_rucne);
  if (!material.sklad_material_id) return Number(material.naklad_m2) || 0;
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) return Number(material.naklad_m2) || 0;
  return (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100);
}

// Nominalna sirka, na ktorej je kalibrovany textil_naklady_verejny.naklad_bm pre sublimaciu
// (rovnaka konvencia ako printstudio-pro/src/TextilMetraz.jsx ROLL_WIDTH_CM) — prevod EUR/bm na EUR/m2.
const SUBLIMACIA_ROLL_WIDTH_CM = 160;
async function resolveNakladSublimacieM2(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('textil_naklady_verejny').select('naklad_bm').eq('technologia', 'sublimacia').maybeSingle();
  return (Number(data?.naklad_bm) || 0) / (SUBLIMACIA_ROLL_WIDTH_CM / 100);
}

// Cena stoziara sa lisi podla velkosti vlajky (vacsia vlajka = dlhsi/pevnejsi stoziar) —
// vlajka_stoziare.cena (flat) je uz nepouzivane, nahradza ho vlajka_stoziare_ceny per velkost.
async function resolveStoziarCena(supabase: ReturnType<typeof createClient>, stoziarKod: string | null, velkostKod: string) {
  if (!stoziarKod) return 0;
  const { data: st } = await supabase.from('vlajka_stoziare').select('id').eq('kod', stoziarKod).maybeSingle();
  if (!st) return 0;
  const { data: cenaRow } = await supabase.from('vlajka_stoziare_ceny').select('cena').eq('stoziar_id', st.id).eq('velkost', velkostKod).maybeSingle();
  return Number(cenaRow?.cena) || 0;
}

// Podstavec je volitelny, samostatna tabulka (nazov pre zaznam objednavky sa cita zvlast nizsie).
async function resolvePodstavecCena(supabase: ReturnType<typeof createClient>, podstavecKod: string | null, velkostKod: string) {
  if (!podstavecKod) return 0;
  const { data: p } = await supabase.from('vlajka_podstavce').select('id').eq('kod', podstavecKod).maybeSingle();
  if (!p) return 0;
  const { data: cenaRow } = await supabase.from('vlajka_podstavce_ceny').select('cena').eq('podstavec_id', p.id).eq('velkost', velkostKod).maybeSingle();
  return Number(cenaRow?.cena) || 0;
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
      designId, tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod,
      doplnky = [], farbaHex, farbaPoznamka, textNaVlajke,
      expresne = false, pocetKs = 1, osobnyOdber = false, nahladUrl,
      stoziare = null, podstavce = null, b2bKod = null, // volitelne: [{ kod, mnozstvo }] — pocet kusov kazdeho pruta/podstavca zvlast
    } = body;

    if (!tvarKod || !velkostKod) throw new Error('Chýba tvar alebo veľkosť vlajky.');
    if (!materialKod) throw new Error('Chýba materiál.');

    const [{ data: tvar }, { data: velkost }, { data: material }, { data: dokoncenie }, { data: stoziar }, cenaStoziara, { data: podstavec }, cenaPodstavca, { data: doplnkyDb }, { data: nastavenia }, { data: cfg }, nakladM2Sublimacia] = await Promise.all([
      supabase.from('vlajka_tvary').select('*').eq('kod', tvarKod).maybeSingle(),
      supabase.from('vlajka_velkosti').select('*').eq('kod', velkostKod).maybeSingle(),
      supabase.from('vlajka_materialy').select('*').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      dokoncenieKod ? supabase.from('vlajka_dokoncenie').select('*').eq('kod', dokoncenieKod).maybeSingle() : Promise.resolve({ data: null }),
      stoziarKod ? supabase.from('vlajka_stoziare').select('*').eq('kod', stoziarKod).maybeSingle() : Promise.resolve({ data: null }),
      resolveStoziarCena(supabase, stoziarKod, velkostKod),
      podstavecKod ? supabase.from('vlajka_podstavce').select('*').eq('kod', podstavecKod).maybeSingle() : Promise.resolve({ data: null }),
      resolvePodstavecCena(supabase, podstavecKod, velkostKod),
      supabase.from('vlajka_doplnky').select('*'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      resolveNakladSublimacieM2(supabase),
    ]);

    if (!tvar) throw new Error(`Tvar "${tvarKod}" sa v katalógu nenašiel.`);
    if (!velkost) throw new Error(`Veľkosť "${velkostKod}" sa v katalógu nenašla.`);
    if (!material) throw new Error(`Materiál "${materialKod}" sa v katalógu nenašiel.`);

    const { data: rozmer } = await supabase.from('vlajka_tvar_rozmery').select('spotreba_m2').eq('tvar_id', tvar.id).eq('velkost', velkostKod).maybeSingle();
    if (!rozmer || rozmer.spotreba_m2 == null) throw new Error(`Spotreba materiálu pre tvar "${tvarKod}" a veľkosť "${velkostKod}" nie je nastavená.`);

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const doplnkyVypocet = (doplnky as { kod: string; mnozstvo: number }[]).map((d) => {
      const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
      return { cena: dbRow ? Number(dbRow.cena) : 0, mnozstvo: Number(d.mnozstvo) || 0, nazov: dbRow?.nazov || d.kod };
    });

    const ksVlajok = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const zoznamPolozok = (pole: unknown, kodFallback: string | null) => (Array.isArray(pole)
      ? (pole as { kod: string; mnozstvo: number }[]).filter((x) => x?.kod && Number(x.mnozstvo) > 0).map((x) => ({ kod: String(x.kod), mnozstvo: Math.round(Number(x.mnozstvo)) }))
      : (kodFallback ? [{ kod: kodFallback, mnozstvo: ksVlajok }] : []));
    const stoziarePolozky: { cena: number; mnozstvo: number; nazov: string }[] = [];
    for (const p of zoznamPolozok(stoziare, stoziarKod)) {
      const { data: st } = await supabase.from('vlajka_stoziare').select('nazov').eq('kod', p.kod).maybeSingle();
      stoziarePolozky.push({ cena: p.kod === stoziarKod ? cenaStoziara : await resolveStoziarCena(supabase, p.kod, velkostKod), mnozstvo: p.mnozstvo, nazov: st?.nazov || p.kod });
    }
    const podstavcePolozky: { cena: number; mnozstvo: number; nazov: string }[] = [];
    for (const p of zoznamPolozok(podstavce, podstavecKod)) {
      const { data: pd } = await supabase.from('vlajka_podstavce').select('nazov').eq('kod', p.kod).maybeSingle();
      podstavcePolozky.push({ cena: p.kod === podstavecKod ? cenaPodstavca : await resolvePodstavecCena(supabase, p.kod, velkostKod), mnozstvo: p.mnozstvo, nazov: pd?.nazov || p.kod });
    }

    const nakladM2Latka = await resolveNakladM2(supabase, material);
    const minutySitia = Number(velkost.minuty_sitia) || 0;
    const cenaMinutySitia = Number(cfg?.cena_minuty_sitia) || 0;
    const nakladSitia = minutySitia * cenaMinutySitia;
    const nakladMaterial = Number(rozmer.spotreba_m2) * (nakladM2Latka + nakladM2Sublimacia) + nakladSitia;

    const b2bZlavaPercent = await b2bZlava(supabase, b2bKod);
    const cena = vypocitajCenuVlajky({
      zlavaPercent: b2bZlavaPercent,
      nakladMaterial, dokoncenie,
      stoziare: stoziarePolozky,
      podstavce: podstavcePolozky,
      doplnky: doplnkyVypocet,
      pricingConfig,
      expresne: !!expresne,
      pocetKs: Number(pocetKs) || 1,
      osobnyOdber: !!osobnyOdber,
      nastavenia: nastavenia || { expresny_priplatok_percent: 10 },
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
      _material: material.nazov,
      _opracovanie: dokoncenie?.nazov || '',
      _pocet_vlajok: String(ksVlajok),
      _b2b_kod: b2bZlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '',
      _b2b_zlava_percent: b2bZlavaPercent > 0 ? String(b2bZlavaPercent) : '',
      _stoziar: stoziarePolozky.map((p) => `${p.mnozstvo}× ${p.nazov}`).join(', ') || (stoziar?.nazov || ''),
      _podstavec: podstavcePolozky.map((p) => `${p.mnozstvo}× ${p.nazov}`).join(', ') || (podstavec?.nazov || ''),
      _doplnky: doplnkyVypocet.map((d) => `${d.mnozstvo}× ${d.nazov}`).join(', '),
      _farba_hex: farbaHex || '',
      _farba_poznamka: farbaPoznamka || '',
      _text_na_vlajke: textNaVlajke || '',
      _expresne: expresne ? 'áno' : 'nie',
      _doprava: cena.doprava.toFixed(2),
      _osobny_odber: osobnyOdber ? 'áno' : 'nie',
      _nahlad_url: nahladUrl || '',
    };

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky + (osobnyOdber ? ' (osobný odber)' : ''),
            price: (cena.cenaSpolu / Math.max(1, Number(pocetKs) || 1)).toFixed(2),
            quantity: Number(pocetKs) || 1,
            taxable: false, // cena už zahŕňa DPH aj dopravu (vypočítaná server-side) — Shopify ju druhýkrát nepripočíta
            requires_shipping: !osobnyOdber,
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
