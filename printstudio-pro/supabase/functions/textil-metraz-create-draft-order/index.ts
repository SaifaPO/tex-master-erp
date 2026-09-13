// Vytvorí Shopify Draft Order s presnou cenou pre Textilnú metráž (namiesto triku s velkym
// poctom kusov jednotkovej ceny cez /cart/add.js). Rovnaky vzor ako
// beachflag-create-draft-order/index.ts a dtf-metraz-create-draft-order/index.ts. Cena sa VZDY
// prepocita server-side z aktualnych DB tabuliek — klientom poslana cena sa nikdy nepouzije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingConfig { coefA: number; coefB: number; marginFloor: number; coefP: number; qtyAtFloor: number; dphPercent: number; }

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

const REZERVA_SPADAVKA_CM = 8; // rezerva na spadavku/okraje (4cm z kazdej strany), odpocitana zo sirky skladovej rolky
const MAX_SIRKA_CM: Record<string, number> = { sublimacia: 160, bavlna: 180 };

// Nikdy neveri klientom poslanej cene/sirke latky — vzdy nanovo zisti aktualne udaje zo skladu
// (ak je latka prepojena), rovnaky vzor ako resolveNakladM2 v zastava/beachflag price-preview
// funkciach. Vracia aj sirku tlace (sirka rolky - rezerva), orezanu na strojovy max danej technologie.
async function resolveMaterialLive(
  supabase: ReturnType<typeof createClient>,
  material: { naklad_m2: number; sklad_material_id: string | null; sirka_tlace_cm: number | null },
  technologia: string,
) {
  const maxSirka = MAX_SIRKA_CM[technologia] || 160;
  if (!material.sklad_material_id) {
    return {
      nakladM2: Number(material.naklad_m2) || 0,
      sirkaTlaceCm: Math.min(Number(material.sirka_tlace_cm) || maxSirka, maxSirka),
    };
  }
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) {
    return {
      nakladM2: Number(material.naklad_m2) || 0,
      sirkaTlaceCm: Math.min(Number(material.sirka_tlace_cm) || maxSirka, maxSirka),
    };
  }
  return {
    nakladM2: (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100),
    sirkaTlaceCm: Math.min(Math.max(0, Number(sklad.width) - REZERVA_SPADAVKA_CM), maxSirka),
  };
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Obchod uz nema klasicky staly "Admin API access token" (Shopify presiel na Dev Dashboard
// aplikacie bez tejto moznosti) — token si preto appka vyziada sama, za behu, cez OAuth
// "client credentials" grant (Client ID + Secret appky, ktora ma nastavene opravnenie
// write_draft_orders). Token je kratkodoby (cca 2 hodiny), preto sa nikdy neuklada, len pouzije.
async function ziskajAdminToken(domain: string, clientId: string, clientSecret: string) {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Nepodarilo sa získať Shopify token (${res.status}): ${await res.text()}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error('Shopify nevrátil access_token.');
  return data.access_token as string;
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
      technologia, mode, lengthBm, directLengthBm, widthCm, heightCm, patternRepeat,
      deliverySpeed = 'standard', harmonogram = '',
      suborNazov = null, suborCesta = null,
      materialKod = null, manualSirkaCm = null,
    } = body;

    if (technologia !== 'sublimacia' && technologia !== 'bavlna') throw new Error('Neplatná technológia.');
    if (mode !== 'auto' && mode !== 'subor') throw new Error('Neplatný režim objednávky.');

    const [{ data: nakRows }, { data: cfg }, { data: nastavenia }] = await Promise.all([
      supabase.from('textil_naklady_verejny').select('technologia, naklad_bm'),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('textil_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    const nakladBm = Number((nakRows || []).find((r: any) => r.technologia === technologia)?.naklad_bm) || 0;
    if (!nastavenia) throw new Error('Nastavenia Textilnej metráže sa nenašli.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000, dphPercent: 23 };

    // Rovnako ako v TextilMetraz.jsx — v oboch rezimoch si zakaznik priamo zvoli dlzku rolky
    // (sirka/vyska pri "auto" rezime sluzia len na nahlad opakovania vzoru, nie na vypocet dlzky).
    const totalLengthBm = mode === 'auto' ? Math.max(0.5, Number(lengthBm) || 0.5) : Math.max(0.5, Number(directLengthBm) || 0.5);

    const baseRate = priceAt(nakladBm, totalLengthBm, pricingConfig);

    // Ak si zakaznik vybral aj nasu latku, jej cena aj sirka tlace sa zistia SAMOSTATNE (zivo zo
    // skladu) a pripocitaju k cene potlace. Cena/sirka sa NIKDY neveri klientovi — materialKod len
    // urcuje KTORU latku, hodnoty si funkcia zisti sama. Pri vlastnom materiali sa pouzije sirka,
    // ktoru zadal zakaznik (orezana na strojovy max danej technologie).
    const maxSirka = MAX_SIRKA_CM[technologia] || 160;
    let fabricRate = 0, fabricSubtotal = 0, printWidthCm = Math.min(Number(manualSirkaCm) || maxSirka, maxSirka);
    let vybranyMaterial: { kod: string; nazov: string } | null = null;
    if (materialKod) {
      const { data: material } = await supabase.from('textil_materialy').select('kod, nazov, naklad_m2, sklad_material_id, sirka_tlace_cm, aktivny, technologia').eq('kod', materialKod).maybeSingle();
      if (material && material.aktivny && (material.technologia === 'obe' || material.technologia === technologia)) {
        const { nakladM2, sirkaTlaceCm } = await resolveMaterialLive(supabase, material, technologia);
        printWidthCm = sirkaTlaceCm;
        const fabricNakladBm = nakladM2 * (printWidthCm / 100);
        fabricRate = priceAt(fabricNakladBm, totalLengthBm, pricingConfig);
        fabricSubtotal = totalLengthBm * fabricRate;
        vybranyMaterial = { kod: material.kod, nazov: material.nazov };
      }
    }
    const totalM2 = totalLengthBm * (printWidthCm / 100);

    const subtotal = Math.max(totalLengthBm * baseRate + fabricSubtotal, Number(nastavenia.minimalna_cena_objednavky) || 0);
    const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia.priplatok_expres_percent) || 0) / 100) : 0;
    const shippingFee = Number(nastavenia.cena_doprava) || 0;
    const grandTotalBezDph = subtotal + expressFee + shippingFee;
    const dphPercent = Number(pricingConfig.dphPercent) || 0;
    const dphSuma = grandTotalBezDph * (dphPercent / 100);
    const grandTotal = grandTotalBezDph + dphSuma;

    const objednavkaId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('textil_objednavky').insert({
      id: objednavkaId,
      technologia,
      rezim: mode,
      raster_typ: mode === 'auto' ? (patternRepeat || null) : null,
      sirka_cm: mode === 'auto' ? Number(widthCm) || null : null,
      vyska_cm: mode === 'auto' ? Number(heightCm) || null : null,
      dlzka_bm: Math.round(totalLengthBm * 100) / 100,
      plocha_m2: Math.round(totalM2 * 100) / 100,
      sirka_tlace_cm: Math.round(printWidthCm * 10) / 10,
      cena_hladina: `${baseRate.toFixed(2)} €/bm`,
      cena_spolu: Math.round(grandTotal * 100) / 100,
      doprava_rychlost: deliverySpeed,
      harmonogram: harmonogram || null,
      subor_nazov: suborNazov,
      subor_cesta: suborCesta,
      material_kod: vybranyMaterial?.kod || null,
      material_nazov: vybranyMaterial?.nazov || null,
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    const technikaLabel = technologia === 'sublimacia' ? 'Sublimačná potlač' : 'Digitálna potlač bavlny';
    const nazovPolozky = `Textilná metráž — ${technikaLabel} ${totalLengthBm.toFixed(2)}bm` + (vybranyMaterial ? ` + látka: ${vybranyMaterial.nazov}` : '');

    const draftPayload = {
      draft_order: {
        line_items: [
          {
            title: nazovPolozky,
            price: grandTotal.toFixed(2),
            quantity: 1,
            taxable: false, // cena uz zahrna DPH (vypocitana server-side) — Shopify ju druhykrat neprirata
            requires_shipping: true,
            properties: [
              { name: '_objednavka_id', value: objednavkaId },
              { name: '_technologia', value: technikaLabel },
              { name: '_dlzka_bm', value: totalLengthBm.toFixed(2) },
              { name: '_sirka_tlace_cm', value: String(Math.round(printWidthCm * 10) / 10) },
              { name: '_harmonogram', value: harmonogram || '' },
              { name: '_subor', value: suborNazov || '' },
              { name: '_material', value: vybranyMaterial?.nazov || '' },
            ],
          },
        ],
        note: `Textilná metráž objednávka ${objednavkaId}`,
        tags: 'textil-metraz',
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

    return odpoved({ checkoutUrl: draftOrder.invoice_url, cenaSpolu: grandTotal, objednavkaId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ error: msg });
  }
});
