// Zivy nahlad ceny pre konfigurator zastav — bezi so servisnym klucom, aby klient (anon)
// nikdy nevidel surove vyrobne naklady (zastava_materialy.naklad_m2, zastava_nastavenia)
// ani marzove koeficienty (pricing_config) priamo — vidi len hotovu cenu z tejto odpovede.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Cenovy vzorec je duplikat z ../_shared/zastavaCena.ts (rovnaky ako src/printstudio/pricingEngine.js
// a printstudio-pro/src/pricingEngine.js) — pri zmene vzorca uprav VSETKY styri miesta rovnako.
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
async function resolveNakladM2(supabase: ReturnType<typeof createClient>, material: { naklad_m2: number; sklad_material_id: string | null; naklad_m2_rucne?: number | null }) {
  // Rucne zadana cena €/m2 (ERP: Materialy -> "rucne") ma prednost pred cenou zo skladu.
  if (Number(material.naklad_m2_rucne) > 0) return Number(material.naklad_m2_rucne);
  if (!material.sklad_material_id) return Number(material.naklad_m2) || 0;
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) return Number(material.naklad_m2) || 0;
  return (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100);
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

// B2B zlava (reklamne agentury): kod sa overuje na serveri v tabulke b2b_kody (servisny kluc). Neplatny / vypnuty kod = 0 %.
async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(Number(data?.zlava_percent) || 0, 0), 90);
}

function vypocitajHardwareRozmery(
  sirkaCm: number, vyskaCm: number,
  tunely: { side: string }[], ocka: { side: string; count: number }[],
  karabinky: { side: string; count: number }[], popruhy: Record<string, boolean>,
  strapce: { side: string }[],
) {
  const tunelyBm = (tunely || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  const ockaPocet = (ocka || []).reduce((s, g) => s + (g.side === 'all' ? g.count * 4 : g.side === 'corners' ? 4 : g.count), 0);
  const karabinkyPocet = (karabinky || []).reduce((s, c) => s + (c.side === 'all' ? c.count * 4 : c.count), 0);
  let popruhBm = 0;
  if (popruhy?.left) popruhBm += vyskaCm / 100;
  if (popruhy?.right) popruhBm += vyskaCm / 100;
  if (popruhy?.top) popruhBm += sirkaCm / 100;
  if (popruhy?.bottom) popruhBm += sirkaCm / 100;
  const strapceBm = (strapce || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  return { tunelyBm, ockaPocet, karabinkyPocet, popruhBm, strapceBm };
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
      materialKod, sirkaCm, vyskaCm, vyhotovenie,
      tunely = [], ocka = [], karabinky = [], popruhy = {}, strapce = [],
      pocetKs = 1, expresne = false, osobnyOdber = false, b2bKod = null,
    } = body;

    if (!materialKod) throw new Error('Chýba materiál.');
    if (!sirkaCm || !vyskaCm) throw new Error('Chýbajú rozmery vlajky.');
    if (vyhotovenie !== 'obsite' && vyhotovenie !== 'laser') throw new Error('Neplatné vyhotovenie okrajov.');

    const [{ data: material }, { data: naklady }, { data: cfg }] = await Promise.all([
      supabase.from('zastava_materialy').select('naklad_m2, sklad_material_id, naklad_m2_rucne').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      supabase.from('zastava_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (!material) throw new Error(`Materiál "${materialKod}" sa nenašiel.`);
    if (!naklady) throw new Error('Nákladové sadzby (zastava_nastavenia) nie sú nastavené.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const nakladM2Material = await resolveNakladM2(supabase, material);

    const { tunelyBm, ockaPocet, karabinkyPocet, popruhBm, strapceBm } = vypocitajHardwareRozmery(Number(sirkaCm), Number(vyskaCm), tunely, ocka, karabinky, popruhy, strapce);

    const m2 = (Number(sirkaCm) * Number(vyskaCm)) / 10000;
    const nakladMaterial = m2 * nakladM2Material;
    const nakladVyhotovenie = vyhotovenie === 'laser'
      ? m2 * Number(naklady.naklad_laser_m2)
      : m2 * Number(naklady.min_sitia_na_m2) * Number(naklady.naklad_sitia_min);
    const nakladHardware =
      tunelyBm * Number(naklady.naklad_tunel_bm) +
      ockaPocet * Number(naklady.naklad_ocko_ks) +
      karabinkyPocet * Number(naklady.naklad_karabinka_ks) +
      popruhBm * Number(naklady.naklad_popruh_bm) +
      strapceBm * (Number(naklady.naklad_strapce_bm) || 0);
    const nakladKus = nakladMaterial + nakladVyhotovenie + nakladHardware;

    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const cenaKus = priceAt(nakladKus, ks, pricingConfig);
    const marzaPercent = Math.round(marginAt(nakladKus, ks, pricingConfig));

    const subtotal = cenaKus * ks;
    // B2B zlava sa odpocita z ceny tovaru (pred expresom, dopravou a DPH)
    const b2bZlavaPercent = await b2bZlava(supabase, b2bKod);
    const b2bZlavaEur = Math.round(subtotal * b2bZlavaPercent) / 100;
    const subtotalPoZlave = subtotal - b2bZlavaEur;
    const expresnyPriplatok = expresne ? subtotalPoZlave * (Number(naklady.expresny_priplatok_percent) / 100) : 0;
    const doprava = osobnyOdber ? 0 : (Number(naklady.cena_doprava) || 0);
    const cenaBezDph = subtotalPoZlave + expresnyPriplatok + doprava;
    const dphSuma = cenaBezDph * (Number(pricingConfig.dphPercent) / 100);
    const cenaSpolu = cenaBezDph + dphSuma;

    return odpoved({
      cena: {
        m2: Math.round(m2 * 100) / 100,
        cenaKus,
        marzaPercent,
        subtotal: Math.round(subtotal * 100) / 100,
        b2bZlavaPercent,
        b2bZlavaEur: Math.round(b2bZlavaEur * 100) / 100,
        expresnyPriplatok: Math.round(expresnyPriplatok * 100) / 100,
        expresnyPercent: Number(naklady.expresny_priplatok_percent),
        doprava: Math.round(doprava * 100) / 100,
        cenaBezDph: Math.round(cenaBezDph * 100) / 100,
        dphSuma: Math.round(dphSuma * 100) / 100,
        cenaSpolu: Math.round(cenaSpolu * 100) / 100,
      },
    });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
