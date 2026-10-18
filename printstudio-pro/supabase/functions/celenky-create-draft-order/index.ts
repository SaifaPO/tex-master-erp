// Vytvorí Shopify Draft Order s presnou cenou pre Čelenky. Rovnaky vzor ako
// dtf-metraz-create-draft-order/index.ts a ostatne create-draft-order funkcie v projekte.
// Cena sa VZDY prepocita server-side z aktualnych DB tabuliek — klientom poslana cena sa
// nikdy nepouzije priamo. Tlacovy subor (300 DPI, 51x9cm) uz nahral klient priamo do Storage
// pred zavolanim tejto funkcie — tu sa len referencuje cesta.
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

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

// B2B zlava (reklamne agentury): kod sa overuje na serveri v tabulke b2b_kody (servisny kluc). Neplatny / vypnuty kod = 0 %.
async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(Number(data?.zlava_percent) || 0, 0), 90);
}

// Kontaktné a fakturačné údaje zákazníka z konfigurátora -> polia Shopify draft objednávky. E-mail a telefón sú povinné (kuriér
// vyžaduje obe). Firma: IČO/DIČ/IČ DPH idú do poznámkových atribútov, fakturačná adresa do billing_address a (ak je iná) dodacia
// adresa do shipping_address. Ak konfigurátor údaje nepošle (starší klient), draft sa vytvorí ako doteraz.
function zakaznikDoDraftOrder(z: any): Record<string, unknown> {
  if (!z || typeof z !== 'object') return {};
  const email = String(z.email || '').trim();
  const telefon = String(z.telefon || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Zadaj platný e-mail.');
  if (telefon.replace(/\D/g, '').length < 8) throw new Error('Zadaj telefónne číslo — kuriér ho vyžaduje spolu s e-mailom.');
  const out: Record<string, unknown> = { email, phone: telefon };
  if (z.firma) {
    const firma = String(z.nazovFirmy || '').trim();
    const ico = String(z.ico || '').trim();
    if (!firma || !ico) throw new Error('Pri objednávke na firmu je potrebný názov firmy a IČO.');
    const [meno, ...zvysok] = String(z.meno || firma).trim().split(/\s+/);
    const adresa = (a: any) => ({
      first_name: meno || firma, last_name: zvysok.join(' ') || '-', company: firma,
      address1: String(a?.ulica || '').trim(), zip: String(a?.psc || '').trim(), city: String(a?.mesto || '').trim(),
      country_code: String(a?.krajina || 'SK').trim() || 'SK', phone: telefon,
    });
    out.billing_address = adresa(z.fakturacna);
    if (z.inaDodacia) out.shipping_address = adresa(z.dodacia);
    out.note_attributes = [
      { name: 'Objednávka na firmu', value: 'áno' },
      { name: 'Firma', value: firma },
      { name: 'IČO', value: ico },
      { name: 'DIČ', value: String(z.dic || '').trim() },
      { name: 'IČ DPH', value: String(z.icDph || '').trim() },
      { name: 'Iná dodacia adresa', value: z.inaDodacia ? 'áno' : 'nie' },
    ];
  }
  return out;
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
      pocetKs, velkost = 'adult_standard', material = 'combed', deliverySpeed = 'standard', osobnyOdber = false, b2bKod = null,
      suborNazov = null, suborCesta = null, dizajnJson = null,
    } = body;

    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    if (!suborCesta) throw new Error('Chýba tlačový súbor čelenky.');

    // Variant (velkost x material) urcuje rozmer strihu aj nakupnu cenu; ak tabulka variantov este neexistuje, pouzije sa povodny jednotny naklad.
    const { data: variant } = await supabase.from('celenky_varianty_verejny').select('*').eq('velkost_kod', String(velkost)).eq('material_kod', String(material)).maybeSingle();
    const [{ data: nakPovodny }, { data: cfg }, { data: nastavenia }] = await Promise.all([
      supabase.from('celenky_naklady_verejny').select('naklad_ks').maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('celenky_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    const nak = variant || nakPovodny;
    if (!nak) throw new Error('Výrobné náklady čeleniek nie sú nastavené.');
    if (!nastavenia) throw new Error('Nastavenia čeleniek sa nenašli.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

    const nakladKs = Number(nak.naklad_ks) || 0;
    const cenaKus = priceAt(nakladKs, ks, pricingConfig);
    const subtotalPredZlavou = Math.max(cenaKus * ks, Number(nastavenia.minimalna_cena_objednavky) || 0);
    // B2B zlava sa odpocita z ceny tovaru (pred expresom, dopravou a DPH)
    const b2bZlavaPercent = await b2bZlava(supabase, b2bKod);
    const subtotal = subtotalPredZlavou - Math.round(subtotalPredZlavou * b2bZlavaPercent) / 100;
    const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia.priplatok_expres_percent) || 0) / 100) : 0;
    const shippingFee = osobnyOdber ? 0 : (Number(nastavenia.cena_doprava) || 0);
    const grandTotalBezDph = subtotal + expressFee + shippingFee;
    const dphPercent = Number(pricingConfig.dphPercent) || 0;
    const dphSuma = grandTotalBezDph * (dphPercent / 100);
    const grandTotal = grandTotalBezDph + dphSuma;

    const objednavkaId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('celenky_objednavky').insert({
      id: objednavkaId,
      pocet_ks: ks,
      cena_kus: Math.round(cenaKus * 100) / 100,
      cena_spolu: Math.round(grandTotal * 100) / 100,
      doprava_rychlost: deliverySpeed,
      dizajn_json: dizajnJson ? JSON.parse(dizajnJson) : null,
      subor_nazov: suborNazov,
      subor_cesta: suborCesta,
      osobny_odber: !!osobnyOdber,
      ...(variant ? { velkost: variant.velkost_kod, material: variant.material_kod, sirka_cm: variant.sirka_cm, vyska_cm: variant.vyska_cm } : {}),
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    const draftPayload = {
      draft_order: {
        ...zakaznikDoDraftOrder(body.zakaznik),
        line_items: [
          {
            title: `Čelenka — vlastný dizajn${variant ? ` (${variant.velkost_nazov}, ${variant.material_kod === 'smooth' ? 'hladký' : 'počesaný'} ${variant.sirka_cm}×${variant.vyska_cm} cm)` : ''} (${ks} ks)` + (osobnyOdber ? ' (osobný odber)' : ''),
            price: grandTotal.toFixed(2),
            quantity: 1,
            taxable: false, // cena uz zahrna DPH (vypocitana server-side) — Shopify ju druhykrat neprirata
            requires_shipping: !osobnyOdber,
            properties: [
              { name: '_objednavka_id', value: objednavkaId },
              { name: '_pocet_ks', value: String(ks) },
              { name: '_velkost', value: variant ? String(variant.velkost_kod) : '' },
              { name: '_material', value: variant ? String(variant.material_kod) : '' },
              { name: '_rozmer_cm', value: variant ? `${variant.sirka_cm}x${variant.vyska_cm}` : '' },
              { name: '_subor', value: suborNazov || '' },
              { name: '_osobny_odber', value: osobnyOdber ? 'áno' : 'nie' },
              { name: '_b2b_kod', value: b2bZlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '' },
              { name: '_b2b_zlava_percent', value: b2bZlavaPercent > 0 ? String(b2bZlavaPercent) : '' },
            ],
          },
        ],
        note: `Čelenka objednávka ${objednavkaId}`,
        tags: 'celenky',
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
