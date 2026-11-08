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

async function vytvorErpZakazku(supabase: ReturnType<typeof createClient>, order: any, li: any, druh: 'celenky' | 'buffky' | 'transfer3d' | 'stolova' | 'snurka' | 'folie' | 'sietotlac' | 'potlac') {
  const TABULKY: Record<string, string> = { celenky: 'celenky_objednavky', buffky: 'buffky_objednavky', transfer3d: 'transfer3d_objednavky', stolova: 'stolova_objednavky', snurka: 'snurka_objednavky', folie: 'folie_objednavky', sietotlac: 'sietotlac_objednavky', potlac: 'potlac_objednavky' };
  const NAZVY: Record<string, string> = { celenky: 'čelenka', buffky: 'buffka', transfer3d: '3D transfer', stolova: 'stolová vlajka', snurka: 'šnúrka na krk', folie: 'rezaná fólia', sietotlac: 'sieťotlač', potlac: 'potlač textilu' };
  const tabulka = TABULKY[druh];
  const druhNazov = NAZVY[druh];
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
  } else if (druh === 'transfer3d' || druh === 'folie' || druh === 'sietotlac' || druh === 'potlac') {
    const { data: n } = await supabase.from(druh === 'folie' ? 'folie_nastavenia' : druh === 'sietotlac' ? 'sietotlac_nastavenia' : druh === 'potlac' ? 'potlac_nastavenia' : 'transfer3d_nastavenia').select('produkt_id').eq('id', 1).maybeSingle();
    blankId = n?.produkt_id ?? null;
  } else if (druh === 'stolova' || druh === 'snurka') {
    const { data: v } = druh === 'stolova'
      ? await supabase.from('stolova_velkosti').select('produkt_id').eq('kod', obj.velkost || '').maybeSingle()
      : await supabase.from('snurka_modely').select('produkt_id').eq('kod', obj.model || '').maybeSingle();
    blankId = v?.produkt_id ?? null;
    if (!blankId) { const { data: n } = await supabase.from(druh === 'stolova' ? 'stolova_nastavenia' : 'snurka_nastavenia').select('produkt_id').eq('id', 1).maybeSingle(); blankId = n?.produkt_id ?? null; }
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
  if (druh === 'sietotlac' || (druh === 'potlac' && obj.technologia === 'sietotlac')) {
    aktivne.add('sietotlac'); // sieťotlač: tlač na stanici sietotlac
  } else if (druh === 'potlac') {
    aktivne.add('transfer'); // potlač textilu cez DTF / rezaný transfer: stanica transfer
  } else if (druh === 'transfer3d' || druh === 'folie') {
    aktivne.add('transfer'); // 3D transfer / rezaná fólia: tlač/rezanie na stanici transfer
  } else if (druh === 'stolova' || druh === 'snurka') {
    aktivne.add('sublimacia');
    if (druh === 'stolova') aktivne.add('sitie');
  } else {
    if (!produkt || produkt.tlac_sublimacia !== false) aktivne.add('sublimacia');
    if (produkt?.striha_sa_reze_vyseka) aktivne.add(produkt.laser_zariadenie_id ? 'laser' : 'strihanie');
    if (!produkt || produkt.minuty_sitia == null || Number(produkt.minuty_sitia) > 0) aktivne.add('sitie');
  }
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
  const TECH_NAZOV: Record<string, string> = { dtf: 'DTF', rezany: 'rezaný transfer', sietotlac: 'sieťotlač' };
  const textilPopis = (): string => (obj.vlastny_textil ? 'VLASTNÝ TEXTIL zákazníka' : `TEXTIL OD NÁS: ${obj.produkt_nazov || ''}, ${obj.farba_nazov || ''}${obj.velkosti ? ', veľkosti: ' + Object.entries(obj.velkosti).map(([k, q]) => `${k}×${q}`).join(', ') : ''}`);
  const nazovVarianty = druh === 'potlac' ? `${TECH_NAZOV[obj.technologia] || obj.technologia}, ${obj.vlastny_textil ? 'vlastný textil' : `${obj.produkt_nazov || ''} ${obj.farba_nazov || ''}`}, ${(obj.polozky || []).map((p: any) => `${p.nazov} ${p.sirkaCm}×${p.vyskaCm} cm`).join(' + ')}` : druh === 'sietotlac' ? `${obj.material === 'polyester' ? 'polyester' : 'bavlna'}, ${obj.tmavy ? 'tmavý' : 'svetlý'} textil, ${(obj.polozky || []).map((p: any) => `${p.nazov} ${p.sirkaCm}×${p.vyskaCm} cm/${p.farby} f.`).join(' + ')}` : druh === 'stolova' ? `${obj.velkost || ''}, ${obj.tvar || ''}, ${obj.okraj || ''}, ${obj.podstavec || ''}` : druh === 'snurka' ? `${obj.model || ''}` : druh === 'folie' ? `${obj.druh || ''} ${obj.farba || ''}, ${obj.sirka_mm}×${obj.vyska_mm} mm${obj.separacia ? ', separácia' : ''}` : druh === 'transfer3d' ? `${obj.sirka_cm}×${obj.vyska_cm} cm, 3D ${obj.uroven || ''}, lak ${obj.lak || ''}` : druh === 'celenky' ? `${obj.velkost || ''} ${obj.material || ''}`.trim() : (obj.typ === 'premium' ? `Premium ${obj.material_kod || ''}`.trim() : 'Tubular Basic');
  const atributy = (order.note_attributes || []).map((a: any) => `${a.name}: ${a.value}`).join(', ');
  const kontakt = [order.email, order.phone || order.shipping_address?.phone].filter(Boolean).join(', ');
  const poznamka = [
    `E-shop ${order.name} (${druhNazov}, ${nazovVarianty}, ${obj.pocet_ks} ks)`,
    druh === 'potlac' ? `${(TECH_NAZOV[obj.technologia] || obj.technologia).toUpperCase()} | ${textilPopis()} | ` + (obj.polozky || []).map((p: any, i: number) => `POTLAČ ${i + 1}: ${p.nazov} ${p.sirkaCm}×${p.vyskaCm} cm${obj.technologia !== 'dtf' ? `, ${p.farby} farieb` : ''}${obj.technologia === 'sietotlac' && p.efekt ? `, efekt ${p.efekt}` : ''}${p.suborUrl ? ` — súbor: ${p.suborUrl}` : ''}`).join(' | ') + (obj.b2b_kod ? ` | B2B ${obj.b2b_kod}` : '') : '',
    druh === 'sietotlac' ? (obj.polozky || []).map((p: any, i: number) => `POTLAČ ${i + 1}: ${p.nazov} ${p.sirkaCm}×${p.vyskaCm} cm, ${p.farby} farieb, efekt ${p.efekt}${p.suborUrl ? ` — súbor: ${p.suborUrl}` : ''}`).join(' | ') + (obj.dve_velkosti ? ' | DVE VEĽKOSTI POTLAČE (2 sady sít)' : '') + (obj.b2b_kod ? ` | B2B ${obj.b2b_kod}` : '') : '',
    obj.skupina_id ? `MOTÍV ${obj.poradie || '?'} z viacerých v jednej objednávke (spoločné poštovné)` : '',
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
      itemId: `${orderId}-1`, productId: produkt?.id || null, productName: produkt?.name || li.title || (druh === 'celenky' ? 'Čelenka' : druh === 'transfer3d' ? '3D transfer' : druh === 'stolova' ? 'Stolová vlajka' : druh === 'snurka' ? 'Šnúrka na krk' : druh === 'folie' ? 'Rezaná fólia' : druh === 'sietotlac' ? 'Sieťotlač' : druh === 'potlac' ? 'Potlač textilu' : 'Buffka'),
      customCode: produkt?.custom_code || '', qualityTier: '', gender: 'neutral', qty: obj.pocet_ks, notes: poznamka, imageUrl: '', assignedDesignerId: '', addons: [],
      rozpisUrl, rozpisFileName: obj.subor_nazov || '', rozpisMimeType: /.pdf$/i.test(obj.subor_nazov || '') ? 'application/pdf' : (/.jpe?g$/i.test(obj.subor_nazov || '') ? 'image/jpeg' : 'image/png'),
      materialsNeeded: [], threadQtyM: 0, priority: (count || 0) + 1, productionDate: termin, stationDates: stanicDatumy, stationStatuses: stanicStatusy, materialDeducted: false,
    }],
    order_log: [{ date: casNow, author: 'E-shop', text: `Zákazka založená automaticky zo zaplatenej objednávky ${order.name} (${druh}).` }],
    legacy_order_number: null, company_brand: 'PBT', order_number: cislo, accounting_status: null,
    variable_symbol: orderId.replace(/\D/g, '').slice(-10), expected_amount: (obj.skupina_id ? Number(obj.cena_spolu) : Number(order.total_price)) || Number(order.total_price) || null, variable_symbol_confirmed: false,
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
    // Objednávka s viacerými motívmi (košík motívov) má viac položiek — zákazka v ERP vznikne pre KAŽDÝ motív zvlášť.
    const erpVysledky: Record<string, unknown>[] = [];
    for (const li of (order.line_items || [])) {
      if (!najdiVlastnost(li.properties, '_objednavka_id')) continue;
      const jeCelenka = stitky.includes('celenky') || (li.properties || []).some((p: any) => p.name === '_rozmer_cm');
      const jeBuffka = stitky.includes('buffky') || (li.properties || []).some((p: any) => p.name === '_typ');
      const jeTransfer3d = stitky.includes('transfer3d') || (li.properties || []).some((p: any) => p.name === '_uroven');
      const props = (li.properties || []).map((p: any) => p.name);
      const druh = jeTransfer3d ? 'transfer3d' : props.includes('_stolova') ? 'stolova' : props.includes('_snurka') ? 'snurka' : props.includes('_folie') ? 'folie' : props.includes('_potlac') ? 'potlac' : props.includes('_sietotlac') ? 'sietotlac' : jeCelenka ? 'celenky' : jeBuffka ? 'buffky' : null;
      if (!druh) continue;
      await new Promise((r) => setTimeout(r, 5)); // unikátne ZAK-ID aj pri viacerých motívoch v jednej objednávke
      const vysledok = await vytvorErpZakazku(supabase, order, li, druh);
      erpVysledky.push({ druh, ...vysledok });
    }
    if (erpVysledky.length > 0) return odpoved(200, { ok: true, druh: erpVysledky[0].druh, vysledky: erpVysledky });
    const zastavaPolozky = (order.line_items || []).filter((li: any) =>
      najdiVlastnost(li.properties, '_zastava_order') === 'true'
    );
    if (zastavaPolozky.length > 0) {
      const bezpecnyJsonParse = (s: string, fallback: unknown) => { try { return JSON.parse(s); } catch { return fallback; } };
      for (const zastavaItem of zastavaPolozky) {
      const props = zastavaItem.properties as { name: string; value: string }[];
      // Pri viacerých motívoch je každý motív jedna položka (množstvo 1) a počet kusov je vo vlastnosti _pocet_ks
      const ksMotivu = parseInt(najdiVlastnost(props, '_pocet_ks')) || zastavaItem.quantity || 1;
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
        pocet_ks: ksMotivu,
        expresne: najdiVlastnost(props, '_expresne') === 'áno',
        ...(najdiVlastnost(props, '_obojstranna') ? { obojstranna: true } : {}),
        cena_kus: (parseFloat(zastavaItem.price) || 0) * (zastavaItem.quantity || 1) / ksMotivu || null,
        cena_spolu: (parseFloat(zastavaItem.price) || 0) * (zastavaItem.quantity || 1),
        status: 'na_schvalenie',
        nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
        zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
        zakaznik_email: order.email || null,
        raw_shopify_payload: order,
      };
      const { error } = await supabase.from('zastava_objednavky').insert(riadok);
      if (error) throw error;
      }
      return odpoved(200, { ok: true, motivov: zastavaPolozky.length });
    }

    const beachflagPolozky = (order.line_items || []).filter((li: any) =>
      najdiVlastnost(li.properties, '_beachflag_order') === 'true'
    );
    if (beachflagPolozky.length === 0) {
      // Bežná (nie-beachflag, nie-zastava) objednávka — nič nerobíme, ale odpovieme 200, nech Shopify webhook nezopakuje.
      return odpoved(200, { ignored: true });
    }

    // Prúty, podstavce a doplnky sú pri viacerých motívoch spoločné pre celú objednávku — majú vlastnú položku (_beachflag_prislusenstvo)
    // a v ERP sa pripoja k prvému motívu.
    const prislusenstvoPolozka = (order.line_items || []).find((li: any) => najdiVlastnost(li.properties, '_beachflag_prislusenstvo') === 'true');
    for (let idx = 0; idx < beachflagPolozky.length; idx++) {
    const beachflagItem = beachflagPolozky[idx];
    const props = ((idx === 0 && prislusenstvoPolozka ? [...beachflagItem.properties, ...prislusenstvoPolozka.properties.filter((p: any) => ['_stoziar', '_podstavec', '_doplnky'].includes(p.name))] : beachflagItem.properties)) as { name: string; value: string }[];
    const ksMotivu = parseInt(najdiVlastnost(props, '_pocet_vlajok')) || beachflagItem.quantity || 1;
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
      pocet_ks: ksMotivu,
      expresne: najdiVlastnost(props, '_expresne') === 'áno',
      ...(najdiVlastnost(props, '_obojstranna') ? { obojstranna: true } : {}),
      cena_kus: (parseFloat(beachflagItem.price) || 0) * (beachflagItem.quantity || 1) / ksMotivu || null,
      cena_spolu: (parseFloat(beachflagItem.price) || 0) * (beachflagItem.quantity || 1),
      status: 'na_schvalenie',
      nahlad_url: najdiVlastnost(props, '_nahlad_url') || null,
      zakaznik_meno: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
      zakaznik_email: order.email || null,
      raw_shopify_payload: order,
    };

    const { error } = await supabase.from('vlajka_objednavky').insert(riadok);
    if (error) throw error;
    }

    return odpoved(200, { ok: true, motivov: beachflagPolozky.length });
  } catch (e) {
    return odpoved(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
