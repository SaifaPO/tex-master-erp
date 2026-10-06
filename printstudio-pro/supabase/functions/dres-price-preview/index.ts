// Zivy nahlad ceny 3D dresu — bezi so servisnym klucom, aby klient (anon) nikdy nevidel
// nakupne ceny (produkt_dres_naklady, produkt_dres_material_naklady) ani marzove koeficienty.
// Ak je pre produkt zadana nakupna cena dresu, predajna cena = marzovy vzorec (marza klesa
// s poctom kusov v tímovej suspiske) + DPH; inak (stary rezim) plati povodna pevna cena
// produkty.zakladna_cena + priplatok materialu a tabulka mnozstevnych zliav.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/). Vzorec je duplikat z
// dres-create-draft-order/index.ts — pri zmene uprav OBA subory rovnako.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

interface DresZlava { min_pocet: number; zlava_percent: number; }
function najdiZlavuPreMnozstvo(zlavy: DresZlava[], pocet: number): number {
  const vyhovujuce = (zlavy || []).filter((z) => pocet >= Number(z.min_pocet)).sort((a, b) => Number(b.min_pocet) - Number(a.min_pocet));
  return vyhovujuce.length ? Number(vyhovujuce[0].zlava_percent) : 0;
}

// B2B zlava (reklamne agentury): kod sa overuje na serveri v tabulke b2b_kody (servisny kluc). Neplatny / vypnuty kod = 0 %.
async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(Number(data?.zlava_percent) || 0, 0), 90);
}

// Trenírky (set s dresom): predajna cena z nakupnej ceny trenirok (produkt_dres_naklady.trenirky_naklad_ks) cez rovnaky
// marzovy vzorec ako dres — marza podla poctu trenirok v zostave. Cena je s DPH, B2B zlava sa uplatni rovnako ako pri dresoch.
async function cenaTrenirok(supabase: ReturnType<typeof createClient>, produktId: unknown, pocet: number, pricingConfig: PricingConfig, b2bP: number) {
  if (!(pocet > 0)) return null;
  const { data } = await supabase.from('produkt_dres_naklady').select('trenirky_naklad_ks').eq('produkt_id', produktId).maybeSingle();
  const naklad = Number(data?.trenirky_naklad_ks) || 0;
  if (naklad <= 0) throw new Error('Cena trenírok nie je nastavená (ERP → Výroba dresov → Nastavenia → Trenírky).');
  const dphK = 1 + (Number(pricingConfig.dphPercent) || 0) / 100;
  const jednotkova = Math.round(priceAt(naklad, pocet, pricingConfig) * dphK * (1 - Math.min(Math.max(b2bP, 0), 90) / 100) * 100) / 100;
  return { pocet, jednotkovaCena: jednotkova, spolu: Math.round(jednotkova * pocet * 100) / 100 };
}

function vypocitajCenuDresu(p: {
  zakladnaCena: number; priplatokMaterial: number; pocetHracov: number; zlavy: DresZlava[]; doprava: number;
  nakladKs: number; nakladMaterial: number; pricingConfig: PricingConfig; b2bZlavaPercent?: number;
}) {
  const pocet = Math.max(1, Number(p.pocetHracov) || 1);
  const dopravaNum = Number(p.doprava) || 0;
  const b2bP = Math.min(Math.max(Number(p.b2bZlavaPercent) || 0, 0), 90);
  // B2B zlava sa odpocita z jednotkovej ceny (s DPH), doprava ostava
  const sB2b = (jc: number) => Math.round(jc * (1 - b2bP / 100) * 100) / 100;
  if (p.nakladKs > 0) {
    const cost = p.nakladKs + (p.nakladMaterial || 0);
    const dphK = 1 + (Number(p.pricingConfig.dphPercent) || 0) / 100;
    const jednotkovaCenaPredZlavou = Math.round(priceAt(cost, 1, p.pricingConfig) * dphK * 100) / 100;
    const jednotkovaCena = Math.round(priceAt(cost, pocet, p.pricingConfig) * dphK * 100) / 100;
    const zlavaPercent = jednotkovaCenaPredZlavou > 0 ? Math.max(0, Math.round((1 - jednotkovaCena / jednotkovaCenaPredZlavou) * 100)) : 0;
    const jc = sB2b(jednotkovaCena);
    return { jednotkovaCenaPredZlavou, zlavaPercent, jednotkovaCena: jc, b2bZlavaPercent: b2bP, pocet, doprava: dopravaNum, cenaSpolu: jc * pocet + dopravaNum };
  }
  const jednotkovaCenaPredZlavou = (Number(p.zakladnaCena) || 0) + (Number(p.priplatokMaterial) || 0);
  const zlavaPercent = najdiZlavuPreMnozstvo(p.zlavy, pocet);
  const jc = sB2b(jednotkovaCenaPredZlavou * (1 - zlavaPercent / 100));
  return { jednotkovaCenaPredZlavou, zlavaPercent, jednotkovaCena: jc, b2bZlavaPercent: b2bP, pocet, doprava: dopravaNum, cenaSpolu: jc * pocet + dopravaNum };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { produktId, materialKod = null, pocetHracov = 1, pocetTrenirok = 0, osobnyOdber = false, b2bKod = null } = await req.json();
    if (!produktId) throw new Error('Chýba produktId.');

    const [{ data: produkt }, { data: material }, { data: zlavy }, { data: nastavenia }, { data: naklad }, { data: cfg }] = await Promise.all([
      supabase.from('produkty').select('zakladna_cena').eq('id', produktId).maybeSingle(),
      materialKod
        ? supabase.from('produkt_dres_materialy').select('id, priplatok_eur').eq('produkt_id', produktId).eq('kod', materialKod).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('dres_mnozstevne_zlavy').select('*'),
      supabase.from('dres_nastavenia').select('cena_doprava').eq('id', 1).maybeSingle(),
      supabase.from('produkt_dres_naklady').select('naklad_ks').eq('produkt_id', produktId).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!produkt) throw new Error(`Produkt ${produktId} sa nenašiel.`);

    let nakladMaterial = 0;
    if (material?.id) {
      const { data: nm } = await supabase.from('produkt_dres_material_naklady').select('naklad_eur').eq('material_id', material.id).maybeSingle();
      nakladMaterial = Number(nm?.naklad_eur) || 0;
    }

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const cena = vypocitajCenuDresu({
      zakladnaCena: produkt.zakladna_cena,
      priplatokMaterial: material?.priplatok_eur || 0,
      pocetHracov: Number(pocetHracov),
      zlavy: zlavy || [],
      doprava: osobnyOdber ? 0 : (Number(nastavenia?.cena_doprava) || 0),
      nakladKs: Number(naklad?.naklad_ks) || 0,
      nakladMaterial,
      pricingConfig,
      b2bZlavaPercent: await b2bZlava(supabase, b2bKod),
    });
    // Dresy (pocetHracov = pocet dresov, moze byt 0 ak sa objednavaju len trenirky) + volitelne trenirky.
    const dresov = Math.max(0, Math.round(Number(pocetHracov) || 0));
    const trenirky = await cenaTrenirok(supabase, produktId, Math.max(0, Math.round(Number(pocetTrenirok) || 0)), pricingConfig, cena.b2bZlavaPercent || 0);
    const dresySpolu = dresov > 0 ? cena.jednotkovaCena * cena.pocet : 0;
    return odpoved({ cena: { ...cena, pocet: dresov, trenirky, cenaSpolu: dresySpolu + (trenirky?.spolu || 0) + cena.doprava } });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
