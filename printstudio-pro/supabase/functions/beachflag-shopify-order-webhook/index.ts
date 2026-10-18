// Prijíma Shopify webhook "orders/create". Spracuje objednávky z konfigurátorov Čelenky/Buffky (-> rovno zákazka v ERP pod číslom PBT, pozri
// vytvorErpZakazku nižšie) a z DVOCH ďalších konfigurátorov
// (rozpoznané podľa vlastnosti na položke — _beachflag_order alebo _zastava_order) a vloží ich
// do zodpovedajúcej tabuľky (vlajka_objednavky / zastava_objednavky) so stavom "na_schvalenie" —
// žiadne automatické vytváranie výrobnej zákazky, to si ERP owner robí ručne po schválení.
// Zámerne JEDNA funkcia pre oba produkty, aby nebolo treba v Shopify registrovať druhý webhook.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Subor je zamerne SAMOSTATNY (ziadny import z ../_shared/) — Supabase Dashboard (rucne
// vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function odpoved(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function overHmac(rawBody: string, hmacHeader: string | null, secret: string): Promise<boolean> {
  if (!hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
  return computed === hmacHeader;
}

function najdiVlastnost(properties: { name: string; value: string }[] | undefined, nazov: string): string {
  return (properties || []).find((p) => p.name === nazov)?.value || '';
}

// ---------- Čelenky a Buffky -> zákazka v ERP (číslo PBT-RR-XXXX) ----------
// Po zaplatení objednávky z konfigurátora čelenky/buffky sa v ERP založí zákazka (tabuľka orders) so správnym produktom podľa mapovania
// (PrintStudio -> Prepojenie na ERP). Tlačový súbor sa pridá ako rozpis, stanice sa odvodia z produktu. Idempotentné — tá istá objednávka
// sa nezaloží dvakrát (erp_zakazka_id).
const STANICE_PORADIE = ['grafik', 'strihanie', 'laser', 'sublimacia', 'transfer', 'sietotlac', 'sitie', 'balenie'];

function pracovneDniDopredu(dni: number): string {
  const d = new Date();
  let n = 0;
  while (n < dni) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return d.toISOString().slice(0, 10);
}

async function vytvorErpZakazku(supabase: ReturnType<typeof createClient>, order: any, li: any, druh: 'celenky' | 'buffky') {
  const tabulka = druh === 'celenky' ? 'celenky_objednavky' : 'buffky_objednavky';
  const objId = najdiVlastnost(li.properties, '_objednavka_id');
  const { data: obj } = await supabase.from(tabulka).select('*').eq('id', objId).maybeSingle();
  if (!obj) return { preskocene: 'objednavka_nenajdena' };
  if (obj.erp_zakazka_id) return { preskocene: 'uz_zalozena', cislo: obj.erp_cislo };

  // Produkt v ERP sa nájde cez BLANKS (produkty), ktoré fungujú ako sprostredkovateľ: variant v appke -> blank -> ERP produkt (produkty.erp_produkt_id).
  let blankId: number | null = null;
  if (druh === 'celenky') {
    const { data: v } = await supabase.from('celenky_varianty').select('produkt_id').eq('velkost_kod', obj.velkost || '').eq('material_kod', obj.material || '').maybeSingle();
    blankId = v?.produkt_id ?? null;
    if (!blankId) { const { data: n } = await supabase.from('celenky_naklady').select('produkt_id').eq('id', 1).maybeSingle(); blankId = n?.produkt_id ?? null; }
  } else if (obj.typ === 'premium') {
    const { data: m } = await supabase.from('buffky_premium_materialy').select('produkt_id').eq('kod', obj.material_kod || '').maybeSingle();
    blankId = m?.produkt_id ?? null;
  } else {
    const { data: n } = await supabase.from('buffky_naklady').select('produkt_id').eq('id', 1).maybeSingle();
    blankId = n?.produkt_id ?? null;
  }
  let erpProduktId: string | null = null;
  if (blankId) {
    const { data: b } = await supabase.from('produkty').select('erp_produkt_id').eq('id', blankId).maybeSingle();
    erpProduktId = b?.erp_produkt_id ?? null;
  }
  let produkt: any = null;
  if (erpProduktId) {
    const { data } = await supabase.from('products').select('id, name, custom_code, tlac_sublimacia, minuty_sitia, striha_sa_reze_vyseka, laser_zariadenie_id').eq('id', erpProduktId).maybeSingle();
    produkt = data;
  }

  // výrobné stanice: grafik + (sublimácia) + (strihanie/laser) + (šitie) + balenie
  const aktivne = new Set<string>(['grafik', 'balenie']);
  if (!produkt || produkt.tlac_sublimacia !== false) aktivne.add('sublimacia');
  if (produkt?.striha_sa_reze_vyseka) aktivne.add(produkt.laser_zariadenie_id ? 'laser' : 'strihanie');
  if (!produkt || produkt.minuty_sitia == null || Number(produkt.minuty_sitia) > 0) aktivne.add('sitie');
  const stanice = STANICE_PORADIE.filter((x) => aktivne.has(x));

  const rok = new Date().getFullYear();
  const { data: pocitadlo } = await supabase.from('order_number_counters').select('*').eq('company', 'PBT').eq('year', rok).maybeSingle();
  const dalsie = pocitadlo?.next_number || 1;
  const cislo = `PBT-${String(rok).slice(-2)}-${String(dalsie).padStart(4, '0')}`;
  await supabase.from('order_number_counters').upsert({ company: 'PBT', year: rok, next_number: dalsie + 1 }, { onConflict: 'company,year' });

  const express = obj.doprava_rychlost === 'express';
  const termin = pracovneDniDopredu(express ? 5 : 10);
  const dnes = new Date().toISOString().slice(0, 10);
  const orderId = `ZAK-${Date.now()}`;
  const nazovVarianty = druh === 'celenky' ? `${obj.velkost || ''} ${obj.material || ''}`.trim() : (obj.typ === 'premium' ? `Premium ${obj.material_kod || ''}`.trim() : 'Tubular Basic');
  const atributy = (order.note_attributes || []).map((a: any) => `${a.name}: ${a.value}`).join(', ');
  const kontakt = [order.email, order.phone || order.shipping_address?.phone].filter(Boolean).join(', ');
  const poznamka = [
    `E-shop ${order.name} (${druh === 'celenky' ? 'čelenka' : 'buffka'}, ${nazovVarianty}, ${obj.pocet_ks} ks)`,
    express ? 'EXPRES dodanie' : 'štandardné dodanie',
    obj.osobny_odber ? 'OSOBNÝ ODBER' : '',
    kontakt ? `kontakt: ${kontakt}` : '',
    atributy,
    !produkt ? '⚠️ Blank tohto variantu nie je prepojený na produkt v Katalógu produktov (PrintStudio → Produkty (Blanks)) — doplň produkt ručne.' : '',
  ].filter(Boolean).join(' | ');
  const rozpisUrl = obj.subor_cesta ? supabase.storage.from('print-designs').getPublicUrl(obj.subor_cesta).data?.publicUrl || '' : '';

  const meno = order.billing_address?.company || order.shipping_address?.company
    || [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ')
    || [order.billing_address?.first_name, order.billing_address?.last_name].filter(Boolean).join(' ') || order.email || `E-shop ${order.name}`;

  const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true });
  const stanicStatusy: Record<string, string> = {}; const stanicDatumy: Record<string, string> = {};
  stanice.forEach((sid) => { stanicStatusy[sid] = 'caka'; stanicDatumy[sid] = termin; });
  const teraz = new Date();
  const casNow = `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, '0')}-${String(teraz.getDate()).padStart(2, '0')} ${String(teraz.getHours()).padStart(2, '0')}:${String(teraz.getMinutes()).padStart(2, '0')}`;

  const { error: errOrder } = await supabase.from('orders').insert({
    id: orderId, customer: meno, created_at: casNow, scheduled_day: termin, drive_link: '', notes: poznamka, payment_type: 'faktura',
    items: [{
      itemId: `${orderId}-1`, productId: produkt?.id || null, productName: produkt?.name || li.title || (druh === 'celenky' ? 'Čelenka' : 'Buffka'),
      customCode: produkt?.custom_code || '', qualityTier: '', gender: 'neutral', qty: obj.pocet_ks, notes: poznamka, imageUrl: '', assignedDesignerId: '', addons: [],
      rozpisUrl, rozpisFileName: obj.subor_nazov || '', rozpisMimeType: 'image/png',
      materialsNeeded: [], threadQtyM: 0, priority: (count || 0) + 1, productionDate: termin, stationDates: stanicDatumy, stationStatuses: stanicStatusy, materialDeducted: false,
    }],
    order_log: [{ date: casNow, author: 'E-shop', text: `Zákazka založená automaticky zo zaplatenej objednávky ${order.name} (${druh}).` }],
    legacy_order_number: null, company_brand: 'PBT', order_number: cislo, accounting_status: null,
    variable_symbol: orderId.replace(/\D/g, '').slice(-10), expected_amount: Number(order.total_price) || null, variable_symbol_confirmed: false,
  });
  if (errOrder) throw new Error('Zákazku v ERP sa nepodarilo založiť: ' + errOrder.message);

  await supabase.from(tabulka).update({ erp_zakazka_id: orderId, erp_cislo: cislo, shopify_order_id: String(order.id) }).eq('id', objId);

  // zákazník do adresára (nepremazáva existujúce údaje)
  try {
    const { data: ex } = await supabase.from('customers').select('*').eq('name', meno).maybeSingle();
    await supabase.from('customers').upsert({
      name: meno, phone: order.phone || ex?.phone || order.shipping_address?.phone || null, email: order.email || ex?.email || null,
      contact_person: ex?.contact_person || null, address: ex?.address || null, notes: ex?.notes || null, interaction_log: ex?.interaction_log || [],
    });
  } catch { /* adresár je len pohodlie */ }

  return { zalozena: cislo, produkt: produkt?.name || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return odpoved(405, { error: 'Len POST.' });

  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
  if (!secret) return odpoved(500, { error: 'SHOPIFY_WEBHOOK_SECRET nie je nastavený v Supabase secrets.' });

  const rawBody = await req.text();
  const platny = await overHmac(rawBody, req.headers.get('X-Shopify-Hmac-Sha256'), secret);
  if (!platny) return odpoved(401, { error: 'Neplatný HMAC podpis.' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const order = JSON.parse(rawBody);

    // Čelenky / buffky: zákazka v ERP (rozpoznané podľa štítku objednávky alebo vlastností položky)
    const stitky = String(order.tags || '').split(',').map((t: string) => t.trim().toLowerCase());
    for (const li of (order.line_items || [])) {
      if (!najdiVlastnost(li.properties, '_objednavka_id')) continue;
      const jeCelenka = stitky.includes('celenky') || (li.properties || []).some((p: any) => p.name === '_rozmer_cm');
      const jeBuffka = stitky.includes('buffky') || (li.properties || []).some((p: any) => p.name === '_typ');
      const druh = jeCelenka ? 'celenky' : jeBuffka ? 'buffky' : null;
      if (!druh) continue;
      const vysledok = await vytvorErpZakazku(supabase, order, li, druh);
      return odpoved(200, { ok: true, druh, ...vysledok });
    }
    const zastavaItem = (order.line_items || []).find((li: any) =>
      najdiVlastnost(li.properties, '_zastava_order') === 'true'
    );
    if (zastavaItem) {
      const props = zastavaItem.properties as { name: string; value: string }[];
      const bezpecnyJsonParse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
      const riadok = {
        shopify_order_id: String(order.id),
        shopify_order_number: order.name || null,
        design_id: najdiVlastnost(props, '_design_id') || null,
        sirka_cm: parseFloat((najdiVlastnost(props, '_rozmery').split('x')[0] || '').trim()) || null,
        vyska_cm: parseFloat((najdiVlastnost(props, '_rozmery').split('x')[1] || '').replace('cm', '').trim()) || null,
        material_kod: najdiVlastnost(props, '_material') || null,
        vyhotovenie: najdiVlastnost(props, '_vyhotovenie').includes('Laser') || najdiVlastnost(props, '_vyhotovenie').includes('laser') ? 'laser' : 'obsite',
        tunely: bezpecnyJsonParse(najdiVlastnost(props, '_tunely'), []),
        ocka: bezpecnyJsonParse(najdiVlastnost(props, '_ocka'), []),
        karabinky: bezpecnyJsonParse(najdiVlastnost(props, '_karabinky'), []),
        popruhy: bezpecnyJsonParse(najdiVlastnost(props, '_popruhy'), {}),
        statna_vlajka: najdiVlastnost(props, '_statna_vlajka') || null,
        farba_hex: najdiVlastnost(props, '_farba_hex') || null,
        farba_poznamka: najdiVlastnost(props, '_farba_poznamka') || null,
        text_na_vlajke: najdiVlastnost(props, '_text_na_vlajke') || null,
        pocet_ks: zastavaItem.quantity || 1,
        expresne: najdiVlastnost(props, '_expresne') === 'áno',
        ...(najdiVlastnost(props, '_obojstranna') ? { obojstranna: true } : {}),
        cena_kus: parseFloat(zastavaItem.price) || null,
        cena_spolu: (parseFloat(zastavaItem.price) || 0) * (zastavaItem.quantity || 1),
        status: 'na_schvalenie',
        nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
        zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
        zakaznik_email: order.email || null,
        raw_shopify_payload: order,
      };
      const { error } = await supabase.from('zastava_objednavky').insert(riadok);
      if (error) throw error;
      return odpoved(200, { ok: true });
    }

    const beachflagItem = (order.line_items || []).find((li: any) =>
      najdiVlastnost(li.properties, '_beachflag_order') === 'true'
    );
    if (!beachflagItem) {
      // Bežná (nie-beachflag, nie-zastava) objednávka — nič nerobíme, ale odpovieme 200, nech Shopify webhook nezopakuje.
      return odpoved(200, { ignored: true });
    }

    const props = beachflagItem.properties as { name: string; value: string }[];
    const doplnkyText = najdiVlastnost(props, '_doplnky');
    const doplnky = doplnkyText
      ? doplnkyText.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
          const m = s.match(/^(\d+)×\s*(.+)$/);
          return m ? { nazov: m[2], mnozstvo: parseInt(m[1]), kod: m[2], cena_ks: null } : { nazov: s, mnozstvo: 1, kod: s, cena_ks: null };
        })
      : [];

    const riadok = {
      shopify_order_id: String(order.id),
      shopify_order_number: order.name || null,
      design_id: najdiVlastnost(props, '_design_id') || null,
      tvar_kod: najdiVlastnost(props, '_tvar') || null,
      velkost_kod: najdiVlastnost(props, '_velkost') || null,
      dokoncenie_kod: najdiVlastnost(props, '_opracovanie') || null,
      stoziar_kod: najdiVlastnost(props, '_stoziar') || null,
      doplnky,
      farba_hex: najdiVlastnost(props, '_farba_hex') || null,
      farba_poznamka: najdiVlastnost(props, '_farba_poznamka') || null,
      text_na_vlajke: najdiVlastnost(props, '_text_na_vlajke') || null,
      ma_ai_pozadie: false,
      pocet_ks: beachflagItem.quantity || 1,
      expresne: najdiVlastnost(props, '_expresne') === 'áno',
      ...(najdiVlastnost(props, '_obojstranna') ? { obojstranna: true } : {}),
      cena_kus: parseFloat(beachflagItem.price) || null,
      cena_spolu: (parseFloat(beachflagItem.price) || 0) * (beachflagItem.quantity || 1),
      status: 'na_schvalenie',
      nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
      zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
      zakaznik_email: order.email || null,
      raw_shopify_payload: order,
    };

    const { error } = await supabase.from('vlajka_objednavky').insert(riadok);
    if (error) throw error;

    return odpoved(200, { ok: true });
  } catch (e) {
    return odpoved(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
