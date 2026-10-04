// Vytvorí Shopify Draft Order pre 3D dres s presnou server-side prepočítanou cenou.
// Jeden line item pre celú tímovú súpisku (množstvo = počet hráčov, cena = jednotková
// cena po množstevnej zľave) — celá súpiska (meno/číslo/veľkosť na hráča) sa posiela
// v jednej _roster_json property, spolu so zdieľanými vlastnosťami dizajnu.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// vypocitajCenuDresu je duplikat z ../_shared/dresCena.ts — pri zmene vzorca uprav oba subory
// (aj src/dres3d/dres3dCenotvorba.js).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      designId, produktId, vzorKod, farby = {}, golierTyp, materialKod, font, timText,
      roster = [], osobnyOdber = false, nahladUrl, b2bKod = null,
    } = body;

    if (!produktId) throw new Error('Chýba produktId.');
    if (!Array.isArray(roster) || roster.length === 0) throw new Error('Súpiska hráčov je prázdna.');

    const [{ data: produkt }, { data: material }, { data: zlavy }, { data: nastavenia }, { data: naklad }, { data: cfg }] = await Promise.all([
      supabase.from('produkty').select('*').eq('id', produktId).maybeSingle(),
      materialKod
        ? supabase.from('produkt_dres_materialy').select('*').eq('produkt_id', produktId).eq('kod', materialKod).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('dres_mnozstevne_zlavy').select('*'),
      supabase.from('dres_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('produkt_dres_naklady').select('naklad_ks').eq('produkt_id', produktId).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    let nakladMaterial = 0;
    if (material?.id) {
      const { data: nm } = await supabase.from('produkt_dres_material_naklady').select('naklad_eur').eq('material_id', material.id).maybeSingle();
      nakladMaterial = Number(nm?.naklad_eur) || 0;
    }

    if (!produkt) throw new Error(`Produkt ${produktId} sa v katalógu nenašiel.`);

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const doprava = osobnyOdber ? 0 : (Number(nastavenia?.cena_doprava) || 0);
    const cena = vypocitajCenuDresu({
      zakladnaCena: produkt.zakladna_cena,
      priplatokMaterial: material?.priplatok_eur || 0,
      pocetHracov: roster.length,
      zlavy: zlavy || [],
      doprava,
      nakladKs: Number(naklad?.naklad_ks) || 0,
      nakladMaterial,
      pricingConfig,
      b2bZlavaPercent: await b2bZlava(supabase, b2bKod),
    });

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const rosterText = roster.map((h: { meno: string; cislo: string; velkost: string }) => `${h.cislo} ${h.meno} (${h.velkost})`).join(', ');
    const nazovPolozky = `Dres 3D — ${produkt.nazov}`;
    const properties: Record<string, string> = {
      _dres_order: 'true',
      _design_id: designId || '',
      _produkt_id: String(produktId),
      _vzor: vzorKod || '',
      _golier: golierTyp || '',
      _material: material?.nazov || '',
      _font: font || '',
      _tim_text: timText || '',
      _farba_zakladna: farby.zakladna || '',
      _farba_vzor: farby.vzor || '',
      _farba_akcent: farby.akcent || '',
      _farba_rukava: farby.rukava || '',
      _farba_golier: farby.golier || '',
      _roster: rosterText,
      _roster_json: JSON.stringify(roster),
      _doprava: doprava.toFixed(2),
      _osobny_odber: osobnyOdber ? 'áno' : 'nie',
      _nahlad_url: nahladUrl || '',
      _b2b_kod: cena.b2bZlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '',
      _b2b_zlava_percent: cena.b2bZlavaPercent > 0 ? String(cena.b2bZlavaPercent) : '',
    };

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky + (osobnyOdber ? ' (osobný odber)' : ''),
            // Doprava je flat jednorazovy poplatok, nie za kus — rozpocita sa rovnomerne do
            // jednotkovej ceny (quantity = pocet hracov), aby sucet quantity*price presne
            // sedel s cena.cenaSpolu (rovnaky vzor ako beachflag/zastava-create-draft-order).
            price: (cena.cenaSpolu / roster.length).toFixed(2),
            quantity: roster.length,
            taxable: false, // cena už zahŕňa DPH (produkty.zakladna_cena) aj dopravu — Shopify ju druhýkrát nepripočíta
            requires_shipping: !osobnyOdber,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Dres 3D objednávka — dizajn ${designId || '—'} (${roster.length} ks)`,
        tags: 'dres3d',
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
