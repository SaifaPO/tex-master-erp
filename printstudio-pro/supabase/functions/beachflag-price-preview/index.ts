// Zivy nahlad ceny pre konfigurator beachvlajok — bezi so servisnym klucom, aby klient (anon)
// nikdy nevidel surove vyrobne naklady (vlajka_materialy.naklad_m2) ani marzove koeficienty
// (pricing_config) priamo — vidi len hotovu cenu z tejto odpovede.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Marzovy vzorec je duplikat z ../_shared/zastavaCena.ts / src/printstudio/pricingEngine.js /
// printstudio-pro/src/pricingEngine.js / zastava-price-preview — pri zmene uprav VSETKY miesta.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Ak je material prepojeny na skutocny sklad (materials.id), naklad/m2 sa VZDY pocita naживo
// z aktualnej ceny za bezny meter + sirky rolky v Sklade — nie zo starej ulozenej snimky.
// Bez prepojenia (alebo ak sklad. polozka nema vyplnenu sirku) sa pouzije rucne zadany naklad_m2.
async function resolveNakladM2(supabase: ReturnType<typeof createClient>, material: { naklad_m2: number; sklad_material_id: string | null }) {
  if (!material.sklad_material_id) return Number(material.naklad_m2) || 0;
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) return Number(material.naklad_m2) || 0;
  return (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100);
}

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; qtyAtFloor: number; }

function baseMargin(cost: number, cfg: PricingConfig) {
  const c = Math.max(cost, 0.05);
  const m = cfg.coefA - cfg.coefB * Math.log(c);
  return Math.min(Math.max(m, cfg.marginFloor), 450);
}
function marginAt(cost: number, qty: number, cfg: PricingConfig) {
  const base = baseMargin(cost, cfg);
  const q = Math.max(qty, 1);
  const qm = Math.max(cfg.qtyAtFloor, 2);
  const t = Math.max(0, 1 - Math.log10(q) / Math.log10(qm));
  const decay = Math.pow(t, cfg.coefP);
  return cfg.marginFloor + (base - cfg.marginFloor) * decay;
}
function priceAt(cost: number, qty: number, cfg: PricingConfig) {
  return Math.round(cost * (1 + marginAt(cost, qty, cfg) / 100) * 100) / 100;
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
      tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod,
      doplnky = [], pocetKs = 1, expresne = false,
    } = body;

    if (!tvarKod || !velkostKod) throw new Error('Chýba tvar alebo veľkosť vlajky.');
    if (!materialKod) throw new Error('Chýba materiál.');

    const [{ data: tvar }, { data: material }, { data: dokoncenie }, { data: stoziar }, { data: doplnkyDb }, { data: nastavenia }, { data: cfg }] = await Promise.all([
      supabase.from('vlajka_tvary').select('id').eq('kod', tvarKod).maybeSingle(),
      supabase.from('vlajka_materialy').select('naklad_m2, sklad_material_id').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      dokoncenieKod ? supabase.from('vlajka_dokoncenie').select('cena').eq('kod', dokoncenieKod).maybeSingle() : Promise.resolve({ data: null }),
      stoziarKod ? supabase.from('vlajka_stoziare').select('cena').eq('kod', stoziarKod).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('vlajka_doplnky').select('*'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (!tvar) throw new Error(`Tvar "${tvarKod}" sa nenašiel.`);
    if (!material) throw new Error(`Materiál "${materialKod}" sa nenašiel.`);

    const { data: rozmer } = await supabase.from('vlajka_tvar_rozmery').select('spotreba_m2').eq('tvar_id', tvar.id).eq('velkost', velkostKod).maybeSingle();
    if (!rozmer || rozmer.spotreba_m2 == null) throw new Error(`Spotreba materiálu pre tvar "${tvarKod}" a veľkosť "${velkostKod}" nie je nastavená (admin: Vlajky → Tvary).`);

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    const doplnkyVypocet = (doplnky as { kod: string; mnozstvo: number }[]).map((d) => {
      const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
      return { cena: dbRow ? Number(dbRow.cena) : 0, mnozstvo: Number(d.mnozstvo) || 0 };
    });

    const nakladM2Material = await resolveNakladM2(supabase, material);
    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const nakladMaterial = Number(rozmer.spotreba_m2) * nakladM2Material;
    const cenaMaterialKus = priceAt(nakladMaterial, ks, pricingConfig);
    const marzaPercent = Math.round(marginAt(nakladMaterial, ks, pricingConfig));

    const cenaDokoncenia = Number(dokoncenie?.cena) || 0;
    const cenaStoziara = Number(stoziar?.cena) || 0;
    const zaklad = cenaMaterialKus + cenaDokoncenia + cenaStoziara;

    const doplnkySpolu = doplnkyVypocet.reduce((sum, d) => sum + d.cena * d.mnozstvo, 0);

    const subtotal = (zaklad + doplnkySpolu) * ks;

    const naklady = nastavenia || { dph_percent: 23, expresny_priplatok_percent: 10 };
    const expresnyPercent = Number(naklady.expresny_priplatok_percent) || 0;
    const expresnyPriplatok = expresne ? subtotal * (expresnyPercent / 100) : 0;

    const cenaBezDph = subtotal + expresnyPriplatok;
    const dphPercent = Number(naklady.dph_percent) || 0;
    const dphSuma = cenaBezDph * (dphPercent / 100);
    const cenaSpolu = cenaBezDph + dphSuma;

    return odpoved({
      cena: {
        zaklad: Math.round(zaklad * 100) / 100,
        doplnkySpolu: Math.round(doplnkySpolu * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        expresnyPriplatok: Math.round(expresnyPriplatok * 100) / 100,
        cenaBezDph: Math.round(cenaBezDph * 100) / 100,
        dphSuma: Math.round(dphSuma * 100) / 100,
        cenaSpolu: Math.round(cenaSpolu * 100) / 100,
        cenaMaterialKus,
        marzaPercent,
      },
    });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
