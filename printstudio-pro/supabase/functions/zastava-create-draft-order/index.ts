// Vytvorí Shopify Draft Order s presnou cenou pre zástavu (rovnaký princíp ako
// beachflag-create-draft-order) — cena sa VŽDY prepočíta server-side z aktuálnych
// nákladov + marzoveho vzorca, klientom poslaná cena sa nikdy nepoužije priamo.
//
// POZOR: subor je zamerne SAMOSTATNY (ziadne importy z ../_shared/) — Supabase Dashboard
// (rucne vlepenie kodu bez CLI) nevie zbalit viacsuborove funkcie a hlasi "Module not found".
// Cenovy vzorec je duplikat z ../_shared/zastavaCena.ts (rovnaky ako zastava-price-preview,
// src/printstudio/pricingEngine.js a printstudio-pro/src/pricingEngine.js) — pri zmene vzorca
// uprav VSETKY styri miesta rovnako.
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
// Obojstranna (sendvicova) vlajka: 2 potlacene vonkajsie latky + vnutorna blackout vrstva.
// Nakladove sadzby su v sukromnej tabulke sendvic_nastavenia (len servisny kluc). Mesh (dierkovany)
// material sa na sendvic nepouziva.
async function nacitajSendvic(supabase: ReturnType<typeof createClient>, material: { je_mesh?: boolean | null }) {
  if (material.je_mesh) throw new Error('Dierkovaný (mesh) materiál sa na obojstrannú vlajku nepoužíva — zvoľ iný materiál.');
  const { data } = await supabase.from('sendvic_nastavenia').select('*').eq('id', 1).maybeSingle();
  if (!data) throw new Error('Nastavenia sendviča (sendvic_nastavenia) nie sú k dispozícii — treba spustiť migration_sendvic_vlajky.sql.');
  return { vlozkaM2: Number(data.vlozka_naklad_m2) || 0, pracaM2: Number(data.praca_naklad_m2) || 0, sitieKoef: Number(data.sitie_koef) || 1 };
}

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

// ---- Pravidla rozmiestnenia ociek/karabiniek (kopia zo src/zastava/okaLayout.ts — pri zmene uprav OBA miesta) ----
// Pravidlá rozmiestnenia kovových očiek (priechodiek) a karabínok na zástave. JEDNO miesto pravdy — rovnaký kód je skopírovaný aj do
// edge funkcií zastava-price-preview a zastava-create-draft-order (musia byť samostatné súbory), aby počet kusov v cene vždy sedel s náhľadom.
//
// Pravidlá:
//  1) Body na strane idú rovnomerne od okraja po okraj, prvý a posledný v ROHU (2 kusy = oba konce strany).
//  2) Na strane s tunelom sa očká ani karabínky nedajú (strana sa preskočí). Na susedných stranách začínajú HNEĎ VEDĽA tunela, nie v rohu cez tunel.
//  3) Ak je na strane spevňujúci popruh, body idú CEZ popruh (stred popruhu), rovnaké pozdĺž strany ako bez popruhu.
//  4) Jeden kus na strane: zákazník volí, na ktorom konci strany ('start' = vľavo/hore, 'end' = vpravo/dole).
//  5) Roh, ktorý patrí dvom stranám, sa počíta len raz (jeden fyzický kus).
type Strana = 'top' | 'right' | 'bottom' | 'left';
interface SkupinaBodov { side: string; count?: number; poz?: string }
interface KontextBodov {
  w?: number; h?: number;                 // rozmer plátna (ľubovoľná jednotka — pre počítanie kusov nie je dôležitá)
  tunelSides: Set<string>;                // strany s tunelom
  popruhy?: Record<string, boolean>;      // strany so spevňujúcim popruhom
  okraj?: number;                         // odstup stredu bodu od okraja, ak na strane nie je popruh
  tunelT?: number;                        // hrúbka tunela
  strapT?: number;                        // hrúbka popruhu
  medzera?: number;                       // medzera medzi tunelom a prvým bodom
}
interface Bod { id: string; x: number; y: number; side: Strana }

const STRANY: Strana[] = ['top', 'right', 'bottom', 'left'];
// susedná strana na začiatku [0] a na konci [1] danej strany (začiatok = vľavo/hore)
const SUSED: Record<Strana, [Strana, Strana]> = { top: ['left', 'right'], bottom: ['left', 'right'], left: ['top', 'bottom'], right: ['top', 'bottom'] };
const ROHY: Record<string, string> = { 'top|left': 'TL', 'top|right': 'TR', 'bottom|left': 'BL', 'bottom|right': 'BR' };
const rohId = (a: Strana, b: Strana) => ROHY[`${a}|${b}`] || ROHY[`${b}|${a}`];
// 4 rohy: [strana, koniec] dvojice stráv, ktoré roh tvoria
const ROHY_SKUPINA: [[Strana, 0 | 1], [Strana, 0 | 1]][] = [
  [['top', 0], ['left', 0]], [['top', 1], ['right', 0]], [['bottom', 0], ['left', 1]], [['bottom', 1], ['right', 1]],
];

function rozlozBody(skupiny: SkupinaBodov[], k: KontextBodov): Bod[] {
  const w = k.w ?? 100;
  const h = k.h ?? 100;
  const okraj = k.okraj ?? 3;
  const tunelT = k.tunelT ?? 8;
  const strapT = k.strapT ?? 4;
  const medzera = k.medzera ?? 2;
  const popruhy = k.popruhy || {};
  const jeTunel = (s: Strana) => k.tunelSides.has(s);
  const inset = (s: Strana) => (popruhy[s] ? strapT / 2 : okraj);
  const vodorovna = (s: Strana) => s === 'top' || s === 'bottom';
  const dlzka = (s: Strana) => (vodorovna(s) ? w : h);
  // súradnica na osi strany pre jej koniec (0 = začiatok, 1 = koniec): v rohu, alebo hneď vedľa tunela na susednej strane
  const koniec = (s: Strana, e: 0 | 1) => {
    const sused = SUSED[s][e];
    const p = jeTunel(sused) ? tunelT + medzera : inset(sused);
    return e === 0 ? p : dlzka(s) - p;
  };
  const koniecId = (s: Strana, e: 0 | 1) => {
    const sused = SUSED[s][e];
    return jeTunel(sused) ? `${s}:${e === 0 ? 'start' : 'end'}` : rohId(s, sused);
  };
  const bod = (s: Strana, a: number, id: string): Bod => (vodorovna(s)
    ? { id, x: a, y: s === 'top' ? inset('top') : h - inset('bottom'), side: s }
    : { id, x: s === 'left' ? inset('left') : w - inset('right'), y: a, side: s });

  const vysledok = new Map<string, Bod>();
  const pridaj = (b: Bod) => { if (!vysledok.has(b.id)) vysledok.set(b.id, b); };
  const naStrane = (s: Strana, n: number, poz: string) => {
    if (jeTunel(s) || n < 1) return;
    if (n === 1) {
      const e: 0 | 1 = poz === 'end' ? 1 : 0;
      pridaj(bod(s, koniec(s, e), koniecId(s, e)));
      return;
    }
    const a0 = koniec(s, 0);
    const a1 = koniec(s, 1);
    for (let i = 0; i < n; i++) {
      const id = i === 0 ? koniecId(s, 0) : i === n - 1 ? koniecId(s, 1) : `${s}:${i}`;
      pridaj(bod(s, a0 + ((a1 - a0) * i) / (n - 1), id));
    }
  };

  for (const g of skupiny || []) {
    const n = Math.max(0, Math.floor(Number(g.count) || 0));
    if (g.side === 'corners') {
      for (const [[sa, ea], [sb, eb]] of ROHY_SKUPINA) {
        const aT = jeTunel(sa);
        const bT = jeTunel(sb);
        if (aT && bT) continue;                                       // roh leží v tuneli oboch strán
        const [s, e]: [Strana, 0 | 1] = aT ? [sb, eb] : [sa, ea];     // ak je tunel na jednej strane, kus ide hneď vedľa neho na druhej
        pridaj(bod(s, koniec(s, e), koniecId(s, e)));
      }
    } else {
      const strany = g.side === 'all' ? STRANY : STRANY.filter((s) => s === g.side);
      for (const s of strany) naStrane(s, n, g.poz || 'start');
    }
  }
  return [...vysledok.values()];
}
// ---- koniec pravidiel rozmiestnenia ----

function vypocitajHardwareRozmery(
  sirkaCm: number, vyskaCm: number,
  tunely: { side: string }[], ocka: { side: string; count: number; poz?: string }[],
  karabinky: { side: string; count: number; poz?: string }[], popruhy: Record<string, boolean>,
  strapce: { side: string }[],
) {
  const tunelyBm = (tunely || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  // pocet kusov = fyzicky pocet bodov podla pravidiel rozmiestnenia (nie na strane s tunelom, spolocny roh sa pocita raz)
  const tunelStrany = new Set((tunely || []).map((t) => String(t.side)));
  const ockaPocet = rozlozBody(ocka as SkupinaBodov[], { tunelSides: tunelStrany, popruhy }).length;
  const karabinkyPocet = rozlozBody(karabinky as SkupinaBodov[], { tunelSides: tunelStrany, popruhy }).length;
  let popruhBm = 0;
  if (popruhy?.left) popruhBm += vyskaCm / 100;
  if (popruhy?.right) popruhBm += vyskaCm / 100;
  if (popruhy?.top) popruhBm += sirkaCm / 100;
  if (popruhy?.bottom) popruhBm += sirkaCm / 100;
  const strapceBm = (strapce || []).reduce((s, t) => s + ((t.side === 'top' || t.side === 'bottom' ? sirkaCm : vyskaCm) / 100), 0);
  return { tunelyBm, ockaPocet, karabinkyPocet, popruhBm, strapceBm };
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
      designId, materialKod, sirkaCm, vyskaCm, vyhotovenie,
      tunely = [], ocka = [], karabinky = [], popruhy = {}, strapce = [], strapceFarba = null,
      statnaVlajka, farbaHex, farbaPoznamka, textNaVlajke,
      expresne = false, pocetKs = 1, osobnyOdber = false, nahladUrl, b2bKod = null, obojstranna = false,
    } = body;

    if (!materialKod || !sirkaCm || !vyskaCm) throw new Error('Chýba materiál alebo rozmery vlajky.');
    if (vyhotovenie !== 'obsite' && vyhotovenie !== 'laser') throw new Error('Neplatné vyhotovenie okrajov.');

    const [{ data: material }, { data: naklady }, { data: cfg }] = await Promise.all([
      supabase.from('zastava_materialy').select('*').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
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
    const sv = obojstranna ? await nacitajSendvic(supabase, material) : null;
    const nakladMaterial = sv ? m2 * (2 * nakladM2Material + sv.vlozkaM2 + sv.pracaM2) : m2 * nakladM2Material;
    const nakladVyhotovenieZakl = vyhotovenie === 'laser'
      ? m2 * Number(naklady.naklad_laser_m2)
      : m2 * Number(naklady.min_sitia_na_m2) * Number(naklady.naklad_sitia_min);
    const nakladVyhotovenie = sv && vyhotovenie === 'obsite' ? nakladVyhotovenieZakl * sv.sitieKoef : nakladVyhotovenieZakl;
    const nakladHardware =
      tunelyBm * Number(naklady.naklad_tunel_bm) +
      ockaPocet * Number(naklady.naklad_ocko_ks) +
      karabinkyPocet * Number(naklady.naklad_karabinka_ks) +
      popruhBm * Number(naklady.naklad_popruh_bm) +
      strapceBm * (Number(naklady.naklad_strapce_bm) || 0);
    const nakladKus = nakladMaterial + nakladVyhotovenie + nakladHardware;

    const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
    const cenaKus = priceAt(nakladKus, ks, pricingConfig);

    const subtotalPredZlavou = cenaKus * ks;
    const b2bZlavaPercent = await b2bZlava(supabase, b2bKod);
    const subtotal = subtotalPredZlavou - Math.round(subtotalPredZlavou * b2bZlavaPercent) / 100;
    const expresnyPriplatok = expresne ? subtotal * (Number(naklady.expresny_priplatok_percent) / 100) : 0;
    const doprava = osobnyOdber ? 0 : (Number(naklady.cena_doprava) || 0);
    const cenaBezDph = subtotal + expresnyPriplatok + doprava;
    const dphSuma = cenaBezDph * (Number(pricingConfig.dphPercent) / 100);
    const cenaSpolu = Math.round((cenaBezDph + dphSuma) * 100) / 100;

    const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const token = Deno.env.get('SHOPIFY_ADMIN_TOKEN');
    if (!domain || !token) throw new Error('SHOPIFY_STORE_DOMAIN alebo SHOPIFY_ADMIN_TOKEN nie je nastavený v Supabase secrets.');

    const nazovPolozky = `Zástava — ${material.nazov} (${sirkaCm}×${vyskaCm} cm)${obojstranna ? ' — obojstranná sendvičová' : ''}`;
    const properties: Record<string, string> = {
      _zastava_order: 'true',
      _design_id: designId || '',
      _material: material.nazov,
      _obojstranna: obojstranna ? 'áno (sendvič 3 vrstvy)' : '',
      _rozmery: `${sirkaCm} x ${vyskaCm} cm`,
      _vyhotovenie: vyhotovenie === 'obsite' ? 'Obšité dookola' : 'Orezané laserom',
      _tunely: JSON.stringify(tunely),
      _ocka: JSON.stringify(ocka),
      _karabinky: JSON.stringify(karabinky),
      _popruhy: JSON.stringify(popruhy),
      _strapce: strapce.length > 0 ? JSON.stringify(strapce) : '',
      _strapce_farba: strapceFarba || '',
      _statna_vlajka: statnaVlajka || '',
      _farba_hex: farbaHex || '',
      _farba_poznamka: farbaPoznamka || '',
      _text_na_vlajke: textNaVlajke || '',
      _expresne: expresne ? 'áno' : 'nie',
      _doprava: doprava.toFixed(2),
      _osobny_odber: osobnyOdber ? 'áno' : 'nie',
      _nahlad_url: nahladUrl || '',
      _b2b_kod: b2bZlavaPercent > 0 ? String(b2bKod).trim().toUpperCase() : '',
      _b2b_zlava_percent: b2bZlavaPercent > 0 ? String(b2bZlavaPercent) : '',
    };

    const draftPayload = {
      draft_order: {
        ...zakaznikDoDraftOrder(body.zakaznik),
        line_items: [
          {
            title: nazovPolozky + (osobnyOdber ? ' (osobný odber)' : ''),
            price: (cenaSpolu / ks).toFixed(2),
            quantity: ks,
            taxable: false, // cena uz zahrna DPH aj dopravu (vypocitana server-side)
            requires_shipping: !osobnyOdber,
            properties: Object.entries(properties).map(([name, value]) => ({ name, value })),
          },
        ],
        note: `Zástava objednávka — dizajn ${designId || '—'}`,
        tags: 'zastava',
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

    return odpoved({ draftOrderId: draftOrder.id, checkoutUrl: draftOrder.invoice_url, cenaSpolu });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
