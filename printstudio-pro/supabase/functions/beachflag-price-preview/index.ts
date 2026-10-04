// Zivy nahlad ceny pre konfigurator beachvlajok — bezi so servisnym klucom, aby klient (anon)
// nikdy nevidel surove vyrobne naklady (vlajka_materialy.naklad_m2) ani marzove koeficienty
// (pricing_config) priamo — vidi len hotovu cenu z tejto odpovede.
//
// Naklad vlajky = latka + sublimacna potlac + sitie (predtym pocitalo LEN latku, cena bola
// drasticky podhodnotena). Sublimacia je ziva z textil_naklady_verejny (rovnaky zdroj ako
// Buffky/Textilna metraz), sitie = vlajka_velkosti.minuty_sitia x pricing_config.cena_minuty_sitia.
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
async function resolveNakladM2(supabase: ReturnType<typeof createClient>, material: { naklad_m2: number; sklad_material_id: string | null; naklad_m2_rucne?: number | null }) {
  // Rucne zadana cena €/m2 (ERP: Materialy -> "rucne") ma prednost pred cenou zo skladu.
  if (Number(material.naklad_m2_rucne) > 0) return Number(material.naklad_m2_rucne);
  if (!material.sklad_material_id) return Number(material.naklad_m2) || 0;
  const { data: sklad } = await supabase.from('materials').select('price_per_m, width').eq('id', material.sklad_material_id).maybeSingle();
  if (!sklad || !sklad.width || Number(sklad.width) <= 0) return Number(material.naklad_m2) || 0;
  return (Number(sklad.price_per_m) || 0) / (Number(sklad.width) / 100);
}

// Nominalna sirka, na ktorej je kalibrovany textil_naklady_verejny.naklad_bm pre sublimaciu
// (rovnaka konvencia ako printstudio-pro/src/TextilMetraz.jsx ROLL_WIDTH_CM) — prevod EUR/bm na EUR/m2.
const SUBLIMACIA_ROLL_WIDTH_CM = 160;
async function resolveNakladSublimacieM2(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('textil_naklady_verejny').select('naklad_bm').eq('technologia', 'sublimacia').maybeSingle();
  return (Number(data?.naklad_bm) || 0) / (SUBLIMACIA_ROLL_WIDTH_CM / 100);
}

// Cena stoziara sa lisi podla velkosti vlajky (vacsia vlajka = dlhsi/pevnejsi stoziar) —
// vlajka_stoziare.cena (flat) je uz nepouzivane, nahradza ho vlajka_stoziare_ceny per velkost.
async function resolveStoziarCena(supabase: ReturnType<typeof createClient>, stoziarKod: string | null, velkostKod: string) {
  if (!stoziarKod) return 0;
  const { data: st } = await supabase.from('vlajka_stoziare').select('id').eq('kod', stoziarKod).maybeSingle();
  if (!st) return 0;
  const { data: cenaRow } = await supabase.from('vlajka_stoziare_ceny').select('cena').eq('stoziar_id', st.id).eq('velkost', velkostKod).maybeSingle();
  return Number(cenaRow?.cena) || 0;
}

// Podstavec je volitelny — cena (a vhodnost) sa tiez lisi podla velkosti vlajky.
async function resolvePodstavecCena(supabase: ReturnType<typeof createClient>, podstavecKod: string | null, velkostKod: string) {
  if (!podstavecKod) return 0;
  const { data: p } = await supabase.from('vlajka_podstavce').select('id').eq('kod', podstavecKod).maybeSingle();
  if (!p) return 0;
  const { data: cenaRow } = await supabase.from('vlajka_podstavce_ceny').select('cena').eq('podstavec_id', p.id).eq('velkost', velkostKod).maybeSingle();
  return Number(cenaRow?.cena) || 0;
}

// B2B zlava (reklamne agentury): kod sa overuje na serveri v tabulke b2b_kody (servisny kluc). Neplatny / vypnuty kod = 0 %.
async function b2bZlava(supabase: ReturnType<typeof createClient>, kod: unknown) {
  const k = String(kod || '').trim().toUpperCase();
  if (!k) return 0;
  const { data } = await supabase.from('b2b_kody').select('zlava_percent').eq('kod', k).eq('aktivny', true).maybeSingle();
  return Math.min(Math.max(Number(data?.zlava_percent) || 0, 0), 90);
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

// Cely vypocet ceny jednej konfiguracie. Pouziva ho aj rezim "matica" (cena pri kazdej velkosti a kazdom materiali).
async function spocitaj(supabase: ReturnType<typeof createClient>, v: Record<string, any>) {
  const { tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnky = [], pocetKs = 1, expresne = false, osobnyOdber = false, stoziare = null, podstavce = null, b2bKod = null } = v;
  if (!tvarKod || !velkostKod) throw new Error('Chýba tvar alebo veľkosť vlajky.');
  if (!materialKod) throw new Error('Chýba materiál.');

  const [{ data: tvar }, { data: material }, { data: dokoncenie }, cenaStoziara, cenaPodstavca, { data: doplnkyDb }, { data: nastavenia }, { data: cfg }, nakladM2Sublimacia, { data: velkostRiadok }] = await Promise.all([
    supabase.from('vlajka_tvary').select('id').eq('kod', tvarKod).maybeSingle(),
    supabase.from('vlajka_materialy').select('naklad_m2, sklad_material_id, naklad_m2_rucne').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
    dokoncenieKod ? supabase.from('vlajka_dokoncenie').select('cena').eq('kod', dokoncenieKod).maybeSingle() : Promise.resolve({ data: null }),
    resolveStoziarCena(supabase, stoziarKod, velkostKod),
    resolvePodstavecCena(supabase, podstavecKod, velkostKod),
    supabase.from('vlajka_doplnky').select('*'),
    supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
    supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    resolveNakladSublimacieM2(supabase),
    supabase.from('vlajka_velkosti').select('minuty_sitia').eq('kod', velkostKod).maybeSingle(),
  ]);

  if (!tvar) throw new Error(`Tvar "${tvarKod}" sa nenašiel.`);
  if (!material) throw new Error(`Materiál "${materialKod}" sa nenašiel.`);

  const { data: rozmer } = await supabase.from('vlajka_tvar_rozmery').select('spotreba_m2').eq('tvar_id', tvar.id).eq('velkost', velkostKod).maybeSingle();
  if (!rozmer || rozmer.spotreba_m2 == null) throw new Error(`Spotreba materiálu pre tvar "${tvarKod}" a veľkosť "${velkostKod}" nie je nastavená (admin: Vlajky → Tvary).`);

  const pricingConfig: PricingConfig = cfg
    ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), cielovaHodnotaZakazky: Number(cfg.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfg.dph_percent ?? 23) }
    : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };

  const doplnkyVypocet = (doplnky as { kod: string; mnozstvo: number }[]).map((d) => {
    const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
    return { cena: dbRow ? Number(dbRow.cena) : 0, mnozstvo: Number(d.mnozstvo) || 0 };
  });

  const nakladM2Latka = await resolveNakladM2(supabase, material);
  const ks = Math.max(1, Math.round(Number(pocetKs)) || 1);
  const minutySitia = Number(velkostRiadok?.minuty_sitia) || 0;
  const cenaMinutySitia = Number(cfg?.cena_minuty_sitia) || 0;
  const nakladSitia = minutySitia * cenaMinutySitia;
  // Rezerva na odpad a kazy (ERP: Beachvlajky -> Veľkosti -> Rezerva) sa pripocita k spotrebe latky aj sublimacie, nie k sitiu.
  const rezervaKoef = 1 + (Number(nastavenia?.rezerva_odpad_percent ?? 3) || 0) / 100;
  const nakladMaterial = Number(rozmer.spotreba_m2) * rezervaKoef * (nakladM2Latka + nakladM2Sublimacia) + nakladSitia;
  const cenaMaterialKus = priceAt(nakladMaterial, ks, pricingConfig);
  const marzaPercent = Math.round(marginAt(nakladMaterial, ks, pricingConfig));

  // Opracovanie, prut, podstavec aj doplnky su v DB ulozene ako NAKUPNE ceny — predajna cena sa
  // dopocita rovnakym maržovym vzorcom ako material (marza klesa s poctom kusov).
  // Vlajky: ks x (material + opracovanie), marza podla poctu vlajok. Prúty, podstavce a prislusenstvo
  // maju kazdy VLASTNY pocet kusov (marza sa pocita z poctu kusov danej polozky). Ak klient neposle
  // polia stoziare/podstavce, plati stary sposob: vybrany prut/podstavec x pocet vlajok.
  const predajVlajka = (nakup: number) => priceAt(Number(nakup) || 0, ks, pricingConfig);
  const cenaDokoncenia = predajVlajka(Number(dokoncenie?.cena) || 0);
  const zaklad = cenaMaterialKus + cenaDokoncenia; // na 1 vlajku
  const vlajkySpolu = zaklad * ks;
  const polozky = (pole: unknown, kodFallback: string | null) => (Array.isArray(pole)
    ? (pole as { kod: string; mnozstvo: number }[]).filter((x) => x?.kod && Number(x.mnozstvo) > 0).map((x) => ({ kod: String(x.kod), mnozstvo: Math.round(Number(x.mnozstvo)) }))
    : (kodFallback ? [{ kod: kodFallback, mnozstvo: ks }] : []));
  // Detailny rozpis po polozkach (nazov, kusy, cena za kus, spolu) pre zobrazenie zakaznikovi.
  const r2 = (x: number) => Math.round(x * 100) / 100;
  type Riadok = { nazov: string; mnozstvo: number; cenaZaKus: number; spolu: number };
  const stoziareRiadky: Riadok[] = [];
  for (const p of polozky(stoziare, stoziarKod)) {
    const cena = p.kod === stoziarKod ? cenaStoziara : await resolveStoziarCena(supabase, p.kod, velkostKod);
    const { data: st } = await supabase.from('vlajka_stoziare').select('nazov').eq('kod', p.kod).maybeSingle();
    const jedn = priceAt(Number(cena) || 0, p.mnozstvo, pricingConfig);
    stoziareRiadky.push({ nazov: st?.nazov || p.kod, mnozstvo: p.mnozstvo, cenaZaKus: r2(jedn), spolu: r2(jedn * p.mnozstvo) });
  }
  const podstavceRiadky: Riadok[] = [];
  for (const p of polozky(podstavce, podstavecKod)) {
    const cena = p.kod === podstavecKod ? cenaPodstavca : await resolvePodstavecCena(supabase, p.kod, velkostKod);
    const { data: pd } = await supabase.from('vlajka_podstavce').select('nazov').eq('kod', p.kod).maybeSingle();
    const jedn = priceAt(Number(cena) || 0, p.mnozstvo, pricingConfig);
    podstavceRiadky.push({ nazov: pd?.nazov || p.kod, mnozstvo: p.mnozstvo, cenaZaKus: r2(jedn), spolu: r2(jedn * p.mnozstvo) });
  }
  const doplnkyRiadky: Riadok[] = (doplnky as { kod: string; mnozstvo: number }[]).filter((d) => Number(d.mnozstvo) > 0).map((d) => {
    const dbRow = (doplnkyDb || []).find((x: any) => x.kod === d.kod);
    const m = Math.round(Number(d.mnozstvo));
    const jedn = priceAt(Number(dbRow?.cena) || 0, Math.max(1, m), pricingConfig);
    return { nazov: dbRow?.nazov || d.kod, mnozstvo: m, cenaZaKus: r2(jedn), spolu: r2(jedn * m) };
  });
  const stoziareSpolu = stoziareRiadky.reduce((a, x) => a + x.spolu, 0);
  const podstavceSpolu = podstavceRiadky.reduce((a, x) => a + x.spolu, 0);
  const doplnkySpolu = doplnkyRiadky.reduce((a, x) => a + x.spolu, 0);

  const subtotal = vlajkySpolu + stoziareSpolu + podstavceSpolu + doplnkySpolu;
  // B2B zlava sa odpocita z ceny tovaru (pred expresom, postovnym a DPH)
  const b2bZlavaPercent = await b2bZlava(supabase, b2bKod);
  const b2bZlavaEur = r2(subtotal * b2bZlavaPercent / 100);
  const subtotalPoZlave = subtotal - b2bZlavaEur;

  const naklady = nastavenia || { expresny_priplatok_percent: 10 };
  const expresnyPercent = Number(naklady.expresny_priplatok_percent) || 0;
  const expresnyPriplatok = expresne ? subtotalPoZlave * (expresnyPercent / 100) : 0;
  const dphPercent = Number(pricingConfig.dphPercent) || 0;
  // Postovne zdarma od urcitej sumy objednavky (s DPH, bez dopravy) — predvolene 150 EUR, nastavitelne v ERP.
  const postovneZdarmaOd = Number(naklady.postovne_zdarma_od_eur ?? 150) || 0;
  const tovarSDph = (subtotalPoZlave + expresnyPriplatok) * (1 + dphPercent / 100);
  const doprava = osobnyOdber || (postovneZdarmaOd > 0 && tovarSDph >= postovneZdarmaOd) ? 0 : (Number(naklady.cena_doprava) || 0);

  const cenaBezDph = subtotalPoZlave + expresnyPriplatok + doprava;
  const dphSuma = cenaBezDph * (dphPercent / 100);
  const cenaSpolu = cenaBezDph + dphSuma;

  return {
      zaklad: Math.round(zaklad * 100) / 100,
      vlajkySpolu: Math.round(vlajkySpolu * 100) / 100,
      rozpis: {
        vlajka: { mnozstvo: ks, cenaZaKus: r2(zaklad), spolu: r2(vlajkySpolu) },
        stoziare: stoziareRiadky,
        podstavce: podstavceRiadky,
        doplnky: doplnkyRiadky,
      },
      b2bZlavaPercent,
      b2bZlavaEur,
      postovneZdarmaOd,
      doDopravyZdarma: osobnyOdber || postovneZdarmaOd <= 0 ? 0 : Math.max(0, r2(postovneZdarmaOd - tovarSDph)),
      stoziareSpolu: Math.round(stoziareSpolu * 100) / 100,
      podstavceSpolu: Math.round(podstavceSpolu * 100) / 100,
      doplnkySpolu: Math.round(doplnkySpolu * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      expresnyPriplatok: Math.round(expresnyPriplatok * 100) / 100,
      doprava: Math.round(doprava * 100) / 100,
      cenaBezDph: Math.round(cenaBezDph * 100) / 100,
      dphSuma: Math.round(dphSuma * 100) / 100,
      cenaSpolu: Math.round(cenaSpolu * 100) / 100,
      cenaMaterialKus,
      marzaPercent,
  };
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
      tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod,
      doplnky = [], pocetKs = 1, expresne = false, osobnyOdber = false, cenovnik = false,
      stoziare = null, podstavce = null, b2bKod = null, // volitelne: [{ kod, mnozstvo }] — zakaznik si zvoli pocet kusov kazdeho pruta/podstavca zvlast
    } = body;

    // Rezim "cenovnik": vrati PREDAJNE ceny jednotlivych volieb (opracovanie, prut, podstavec,
    // doplnky) pre danu velkost a pocet kusov. V DB su ulozene NAKUPNE ceny (anon ich nesmie
    // citat) — predajna cena = priceAt(nakup, pocetKs), rovnako ako material.
    if (cenovnik) {
      if (!velkostKod) throw new Error('Chýba veľkosť vlajky.');
      const ksC = Math.max(1, Math.round(Number(pocetKs)) || 1);
      const [{ data: cfgC }, { data: dokC }, { data: stoC }, { data: stoCeny }, { data: podC }, { data: podCeny }, { data: dopC }] = await Promise.all([
        supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('vlajka_dokoncenie').select('kod, cena').eq('aktivny', true),
        supabase.from('vlajka_stoziare').select('id, kod').eq('aktivny', true),
        supabase.from('vlajka_stoziare_ceny').select('stoziar_id, cena').eq('velkost', velkostKod),
        supabase.from('vlajka_podstavce').select('id, kod').eq('aktivny', true),
        supabase.from('vlajka_podstavce_ceny').select('podstavec_id, cena').eq('velkost', velkostKod),
        supabase.from('vlajka_doplnky').select('kod, cena').eq('aktivny', true),
      ]);
      const cfgCenovnik: PricingConfig = cfgC
        ? { coefA: Number(cfgC.coef_a), coefB: Number(cfgC.coef_b), marginFloor: Number(cfgC.margin_floor), coefP: Number(cfgC.coef_p), cielovaHodnotaZakazky: Number(cfgC.cielova_hodnota_zakazky ?? 25000), dphPercent: Number(cfgC.dph_percent ?? 23) }
        : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, cielovaHodnotaZakazky: 25000, dphPercent: 23 };
      const zlavaC = await b2bZlava(supabase, b2bKod);
      const predaj = (nakup: unknown) => Math.round(priceAt(Number(nakup) || 0, ksC, cfgCenovnik) * (1 - zlavaC / 100) * 100) / 100;
      return odpoved({
        cenovnik: {
          dokoncenie: Object.fromEntries((dokC || []).map((r: any) => [r.kod, predaj(r.cena)])),
          stoziare: Object.fromEntries((stoC || []).map((s: any) => [s.kod, predaj((stoCeny || []).find((c: any) => c.stoziar_id === s.id)?.cena)])),
          podstavce: Object.fromEntries((podC || []).map((p: any) => [p.kod, predaj((podCeny || []).find((c: any) => c.podstavec_id === p.id)?.cena)])),
          doplnky: Object.fromEntries((dopC || []).map((d: any) => [d.kod, predaj(d.cena)])),
        },
      });
    }

    // Rezim "b2bCennik" (ERP -> B2B kody): bezne PREDAJNE ceny za 1 ks bez DPH pri roznych poctoch kusov —
    // vlajka (material + opracovanie), kazdy prut, kazdy podstavec, kazdy doplnok. Zlavu (%) si pripocita
    // az ERP podla zadaneho percenta, server vracia len ceny bez zlavy.
    if (body.b2bCennik) {
      if (!tvarKod || !materialKod) throw new Error('Chýba tvar alebo materiál.');
      const hladiny = [1, 5, 10, 25, 50, 100];
      const [{ data: velk }, { data: stoAll }, { data: stoTvary }, { data: tvarRow }, { data: podAll }, { data: dopAll }, { data: dokAll }, { data: cfgB }] = await Promise.all([
        supabase.from('vlajka_velkosti').select('kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_stoziare').select('id, kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_stoziare_tvary').select('stoziar_id, tvar_id'),
        supabase.from('vlajka_tvary').select('id').eq('kod', tvarKod).maybeSingle(),
        supabase.from('vlajka_podstavce').select('id, kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_doplnky').select('kod, nazov').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('vlajka_dokoncenie').select('kod').eq('aktivny', true).order('poradie').order('id'),
        supabase.from('pricing_config').select('dph_percent').eq('id', 1).maybeSingle(),
      ]);
      const stoziare = (stoAll || []).filter((s: any) => {
        const riadky = (stoTvary || []).filter((x: any) => x.stoziar_id === s.id);
        return riadky.length === 0 || riadky.some((x: any) => x.tvar_id === tvarRow?.id);
      });
      const dokKod = dokoncenieKod || dokAll?.[0]?.kod || null;
      const velkosti = await Promise.all((velk || []).map(async (v: any) => {
        const ceny = await Promise.all(hladiny.map(async (h) => {
          try {
            const c = await spocitaj(supabase, {
              tvarKod, velkostKod: v.kod, materialKod, dokoncenieKod: dokKod, pocetKs: h,
              stoziarKod: null, podstavecKod: null,
              stoziare: stoziare.map((s: any) => ({ kod: s.kod, mnozstvo: h })),
              podstavce: (podAll || []).map((p: any) => ({ kod: p.kod, mnozstvo: h })),
              doplnky: (dopAll || []).map((d: any) => ({ kod: d.kod, mnozstvo: h })),
            });
            return c.rozpis;
          } catch { return null; }
        }));
        const cenyRiadka = (pole: 'stoziare' | 'podstavce' | 'doplnky', nazov: string) => ceny.map((rz: any) => rz?.[pole]?.find((x: any) => x.nazov === nazov)?.cenaZaKus ?? null);
        return {
          kod: v.kod,
          nazov: v.nazov || v.kod,
          vlajka: ceny.map((rz: any) => rz?.vlajka?.cenaZaKus ?? null),
          stoziare: stoziare.map((s: any) => ({ nazov: s.nazov, ceny: cenyRiadka('stoziare', s.nazov) })),
          podstavce: (podAll || []).map((p: any) => ({ nazov: p.nazov, ceny: cenyRiadka('podstavce', p.nazov) })),
          doplnky: (dopAll || []).map((d: any) => ({ nazov: d.nazov, ceny: cenyRiadka('doplnky', d.nazov) })),
        };
      }));
      return odpoved({ b2bCennik: { hladiny, dphPercent: Number(cfgB?.dph_percent ?? 23), velkosti } });
    }

    const vstup = { tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnky, pocetKs, expresne, osobnyOdber, stoziare, podstavce, b2bKod };

    // Rezim "matica": cena samotnej vlajky (material + opracovanie, bez DPH, 1 ks) pri KAZDEJ velkosti a KAZDOM materiali (so zvyskom konfiguracie nezmeneným) —
    // zakaznik vidi cenu priamo pri vybere velkosti a materialu.
    if (body.matica) {
      if (!tvarKod || !velkostKod || !materialKod) throw new Error('Chýba tvar, veľkosť alebo materiál.');
      const [{ data: velk }, { data: mats }] = await Promise.all([
        supabase.from('vlajka_velkosti').select('kod').eq('aktivny', true),
        supabase.from('vlajka_materialy').select('kod').eq('aktivny', true),
      ]);
      const spolu = async (zmena: Record<string, string>) => { try { const c = await spocitaj(supabase, { ...vstup, ...zmena }); return Math.round(c.zaklad * (1 - (Number(c.b2bZlavaPercent) || 0) / 100) * 100) / 100; } catch { return null; } };
      const [velkosti, materialy] = await Promise.all([
        Promise.all((velk || []).map(async (x: any) => [x.kod, await spolu({ velkostKod: x.kod })])),
        Promise.all((mats || []).map(async (x: any) => [x.kod, await spolu({ materialKod: x.kod })])),
      ]);
      return odpoved({ matica: { velkosti: Object.fromEntries(velkosti), materialy: Object.fromEntries(materialy) } });
    }

    return odpoved({ cena: await spocitaj(supabase, vstup) });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
