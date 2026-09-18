// Vytvorí Shopify Draft Order s presnou cenou pre DTF metráž (namiesto triku s velkym poctom
// kusov jednotkovej ceny cez /cart/add.js — Shopify bezny plan nedovoli nastavit vlastnu cenu
// riadku kosika). Rovnaky vzor ako beachflag-create-draft-order/index.ts. Cena sa VZDY prepocita
// server-side z aktualnych DB tabuliek — klientom poslana cena sa nikdy nepouzije priamo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Marzovy vzorec je duplikat z src/printstudio/pricingEngine.js — pri zmene uprav aj tam.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLL_WIDTH_CM = 56;
const MARGIN_CM = 0.5;

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

// Rovnaky vzorec ako vypocitajJednuOrientaciu v DtfMetraz.jsx — kolko bm rolky treba na dany
// pocet kusov pri danom rozmere (skladanie do riadkov na 56cm sirku).
function vypocitajJednuOrientaciu(itemWidthCm: number, itemHeightCm: number, qty: number) {
  const effectiveWidth = Math.min(itemWidthCm, ROLL_WIDTH_CM);
  const itemsPerRow = Math.max(1, Math.floor((ROLL_WIDTH_CM + MARGIN_CM) / (effectiveWidth + MARGIN_CM)));
  const totalRows = Math.ceil(qty / itemsPerRow);
  const rowHeightCm = itemHeightCm + MARGIN_CM;
  const totalHeightCm = totalRows * rowHeightCm;
  return Math.max(0.1, totalHeightCm / 100);
}

// Vyskusa obe orientacie motivu (tak ako zadal zakaznik, aj otocenu o 90°) a vyberie tu, ktora
// vyjde na kratsiu dlzku metraze — AUTORITATIVNY vypocet ceny aj pre production (efektivnaSirkaCm/
// efektivnaVyskaCm sa uklada do objednavky, aby vyroba vedela, v akej orientacii ma motiv polozit).
// Rovnaky vzorec je duplikovany aj v DtfMetraz.jsx pre zivy nahlad — musia davat rovnaky vysledok.
function vypocitajRozlozenie(widthCm: number, heightCm: number, qty: number) {
  const normalBm = vypocitajJednuOrientaciu(widthCm, heightCm, qty);
  const otocenyBm = vypocitajJednuOrientaciu(heightCm, widthCm, qty);
  if (otocenyBm < normalBm) {
    return { dlzkaBm: otocenyBm, jeOtoceny: true, efektivnaSirkaCm: heightCm, efektivnaVyskaCm: widthCm };
  }
  return { dlzkaBm: normalBm, jeOtoceny: false, efektivnaSirkaCm: widthCm, efektivnaVyskaCm: heightCm };
}

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Citatelne cislo objednavky (napr. "DTF-260001") namiesto holeho UUID v Shopify — pocitadlo
// podla predpony+roka, resetuje sa kazdy rok. UUID (id stlpca v *_objednavky) ostava interny kluc,
// toto je len na zobrazenie zamestnancom. Nie je 100% atomicke pri subeznych requestoch v tej istej
// sekunde (rovnaka uroven ako existujuci order_number_counters v hlavnom ERP) — pri realnom objeme
// objednavok tohto obchodu je to zanedbatelne riziko.
async function ziskajCisloObjednavky(supabase: ReturnType<typeof createClient>, prefix: string) {
  const year = new Date().getFullYear();
  const shortYear = String(year).slice(-2);
  const { data: counter } = await supabase.from('print_objednavky_pocitadla').select('next_number').eq('prefix', prefix).eq('year', year).maybeSingle();
  const nextNum = (counter as { next_number: number } | null)?.next_number || 1;
  await supabase.from('print_objednavky_pocitadla').upsert({ prefix, year, next_number: nextNum + 1 }, { onConflict: 'prefix,year' });
  return `${prefix}-${shortYear}${String(nextNum).padStart(4, '0')}`;
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
      mode, widthCm, heightCm, qty, directLengthBm,
      deliverySpeed = 'standard', harmonogram = '',
      suborNazov = null, suborCesta = null,
      grafickaPriprava = false,
    } = body;

    if (mode !== 'auto' && mode !== 'subor' && mode !== 'vzorky' && mode !== 'paleta') throw new Error('Neplatný režim objednávky.');
    if (mode === 'vzorky' && !suborCesta) throw new Error('Pre vzorku je potrebné nahrať súbor s grafikou.');

    const [{ data: nak }, { data: cfg }, { data: nastavenia }] = await Promise.all([
      supabase.from('dtf_naklady_verejny').select('naklad_bm').maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!nak) throw new Error('Výrobné náklady DTF metráže nie sú nastavené.');
    if (!nastavenia) throw new Error('Nastavenia DTF metráže sa nenašli.');

    const pricingConfig: PricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor), dphPercent: Number(cfg.dph_percent ?? 23) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000, dphPercent: 23 };

    // Vzorka (A4, 1 ks) a paleta farieb maju pevnu cenu 5€ s DPH (vratane postovneho), nepocitaju
    // sa podla bm ako zvysok appky — vzorka: zakaznik nahra vlastnu grafiku, vyskladane na A4;
    // paleta: PBT posiela zakaznikovi fyzicku paletu vzoriek, ziadny subor sa nenahrava.
    const VZORKA_CENA_S_DPH = 5;
    const PALETA_CENA_S_DPH = 5;
    const PRIPRAVA_GRAFIKY_EUR = 10;

    let totalLengthBm = 0, totalM2 = 0, baseRate = 0, grandTotal = mode === 'paleta' ? PALETA_CENA_S_DPH : VZORKA_CENA_S_DPH;
    let rozlozenie: { dlzkaBm: number; jeOtoceny: boolean; efektivnaSirkaCm: number; efektivnaVyskaCm: number } | null = null;
    if (mode === 'auto' || mode === 'subor') {
      if (mode === 'auto') {
        const w = Number(widthCm) || 0, h = Number(heightCm) || 0, q = Math.max(1, Math.round(Number(qty)) || 1);
        if (w <= 0 || h <= 0) throw new Error('Neplatný rozmer loga.');
        rozlozenie = vypocitajRozlozenie(w, h, q);
        totalLengthBm = rozlozenie.dlzkaBm;
      } else {
        totalLengthBm = Math.max(0.01, Number(directLengthBm) || 0.01);
      }
      totalM2 = totalLengthBm * (ROLL_WIDTH_CM / 100);

      const nakladBm = Number(nak.naklad_bm) || 0;
      baseRate = priceAt(nakladBm, totalLengthBm, pricingConfig);
      const subtotal = Math.max(totalLengthBm * baseRate, Number(nastavenia.minimalna_cena_objednavky) || 0);
      const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia.priplatok_expres_percent) || 0) / 100) : 0;
      const shippingFee = Number(nastavenia.cena_doprava) || 0;
      const grandTotalBezDph = subtotal + expressFee + shippingFee + (grafickaPriprava ? PRIPRAVA_GRAFIKY_EUR : 0);
      const dphPercent = Number(pricingConfig.dphPercent) || 0;
      const dphSuma = grandTotalBezDph * (dphPercent / 100);
      grandTotal = grandTotalBezDph + dphSuma;
    }

    const objednavkaId = crypto.randomUUID();
    const cisloObjednavky = await ziskajCisloObjednavky(supabase, 'DTF');

    // Podpisany odkaz na stiahnutie nahrateho suboru (bucket je sukromny) — bez tohto malo Martin
    // v Shopify objednavke len holy text s ID, ziadny sposob ako sa hned dostat k tlacovemu suboru.
    // Platnost 1 rok (staci na cely zivotny cyklus objednavky aj pripadnu reklamaciu/reprint).
    // Uklada sa aj do DB, aby sa dal zobrazit priamo v admin fronte v ERP, nielen v Shopify note.
    let suborUrl: string | null = null;
    if (suborCesta) {
      const { data: signed } = await supabase.storage.from('print-designs').createSignedUrl(suborCesta, 60 * 60 * 24 * 365);
      suborUrl = signed?.signedUrl || null;
    }

    const { error: insertErr } = await supabase.from('dtf_objednavky').insert({
      id: objednavkaId,
      cislo_objednavky: cisloObjednavky,
      rezim: mode,
      sirka_cm: mode === 'auto' ? rozlozenie!.efektivnaSirkaCm : null,
      vyska_cm: mode === 'auto' ? rozlozenie!.efektivnaVyskaCm : null,
      otoceny: mode === 'auto' ? rozlozenie!.jeOtoceny : false,
      pocet_ks: mode === 'auto' ? Math.max(1, Math.round(Number(qty)) || 1) : null,
      dlzka_bm: mode === 'auto' || mode === 'subor' ? Math.round(totalLengthBm * 100) / 100 : 0,
      plocha_m2: mode === 'auto' || mode === 'subor' ? Math.round(totalM2 * 100) / 100 : null,
      cena_hladina: mode === 'vzorky' ? 'A4 vzorka — pevná cena' : mode === 'paleta' ? 'Paleta farieb — pevná cena' : `${baseRate.toFixed(2)} €/bm`,
      cena_spolu: Math.round(grandTotal * 100) / 100,
      doprava_rychlost: mode === 'auto' || mode === 'subor' ? deliverySpeed : 'standard',
      harmonogram: mode === 'vzorky' ? 'A4 vzorka' : mode === 'paleta' ? 'Paleta farieb' : (harmonogram || null),
      subor_nazov: suborNazov,
      subor_cesta: suborCesta,
      subor_url: suborUrl,
      graficka_priprava: (mode === 'auto' || mode === 'subor') && !!grafickaPriprava,
    });
    if (insertErr) throw insertErr;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!domain || !clientId || !clientSecret) throw new Error('SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID alebo SHOPIFY_CLIENT_SECRET nie je nastavený v Supabase secrets.');
    const token = await ziskajAdminToken(domain, clientId, clientSecret);

    const nazovPolozky = mode === 'auto'
      ? `DTF transfer — metráž ${totalLengthBm.toFixed(2)}bm (${qty}× ${widthCm}×${heightCm}cm)` + (grafickaPriprava ? ' + príprava grafiky' : '')
      : mode === 'vzorky'
      ? 'DTF transfer — vzorka vlastnej grafiky (A4, 1 ks)'
      : mode === 'paleta'
      ? 'DTF transfer — paleta farieb'
      : `DTF transfer — hotová rolka ${totalLengthBm.toFixed(2)}bm` + (grafickaPriprava ? ' + príprava grafiky' : '');

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
              { name: '_cislo_objednavky', value: cisloObjednavky },
              { name: '_objednavka_id', value: objednavkaId },
              { name: '_dlzka_bm', value: mode === 'auto' || mode === 'subor' ? totalLengthBm.toFixed(2) : mode === 'vzorky' ? 'A4' : '—' },
              { name: '_harmonogram', value: mode === 'auto' || mode === 'subor' ? (harmonogram || '') : '' },
              { name: '_subor', value: suborNazov || '' },
              { name: '_subor_link', value: suborUrl || '' },
              { name: '_priprava_grafiky', value: grafickaPriprava ? 'áno (+10€)' : 'nie' },
            ],
          },
        ],
        note: `${cisloObjednavky} (DTF metráž)` + (suborUrl ? `\nSúbor na tlač: ${suborUrl}` : ''),
        tags: 'dtf-metraz',
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

    return odpoved({ checkoutUrl: draftOrder.invoice_url, cenaSpolu: grandTotal, objednavkaId, cisloObjednavky });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e));
    return odpoved({ error: msg });
  }
});
