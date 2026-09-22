import React, { useEffect, useState } from 'react';
import { Layers3, Plus, Trash2 } from 'lucide-react';
import { elektrinaZariadeniaEurZaHod, vcSietotlacCelkom } from './vyrobneNaklady';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

function Field({ label, value, step, onChange, hint }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="number" step={step} value={value ?? ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={inputCls} />
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// Pomocny prepocet min/cm² -> sekundy/cm² + kolko to spolu vyjde na referencnej ploche (10x10cm) —
// min/cm² je zradna jednotka na priamy odhad (lahko sa splete rad velkosti), takze ukazeme aj
// konkretne sekundy pri realnej velkosti, nech sa da hned vizualne overit ci cislo dava zmysel.
function casNaCm2Hint(minPerCm2, refPlochaCm2) {
  const v = parseFloat(minPerCm2) || 0;
  const sekPerCm2 = v * 60;
  const spoluSek = v * refPlochaCm2 * 60;
  const spoluMin = spoluSek / 60;
  return `= ${sekPerCm2.toFixed(2)} sek/cm² → pri 10×10cm (${refPlochaCm2}cm²): ${spoluSek.toFixed(0)} sek (${spoluMin.toFixed(1)} min)`;
}
function casFlatHint(minPerKs) {
  const v = parseFloat(minPerKs) || 0;
  return `= ${(v * 60).toFixed(0)} sek/ks`;
}

function VysledokVC({ label, value, unit, decimals }) {
  const d = decimals ?? (unit === '€/cm²' ? 6 : 4);
  const zobrazenaJednotka = unit && unit.includes('€') ? `${unit} bez DPH` : unit;
  return (
    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <span className="text-sm font-mono font-bold text-emerald-400">{value.toFixed(d)} {zobrazenaJednotka}</span>
    </div>
  );
}

// Vsetky vzorce nizsie su zamerne rovnake ako doteraz pouzivane v CennikTab.jsx / DtfMetrazTab.jsx /
// TextilMetrazTab.jsx — tento tab len zjednocuje KDE sa naklady EDITUJU, samotny vypocet VC sa nemeni
// (okrem sublimacie na tricka, kde sa zdielane vstupy prvykrat naozaj zluvcujuju s metrazou — viz
// komentar pri SublimaciaCard).
export default function KostraCienTab({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  // Ukladanie bolo doteraz "tiché" — pri chybe (napr. chýbajúci stĺpec v DB) sa lokálny stav
  // nastavil OPTIMISTICKY ešte pred odpoveďou zo servera, takže hodnota v poli vyzerala uložená
  // aj keď upsert zlyhal a nič sa reálne neuložilo (zistilo sa až pri ďalšom načítaní stránky).
  // Teraz sa pri chybe zobrazí banner a pole sa vráti na poslednú naozaj uloženú hodnotu.
  const [chybaUlozenia, setChybaUlozenia] = useState('');
  const [textilSub, setTextilSub] = useState(null);
  const [sublimaciaGarment, setSublimaciaGarment] = useState(null);
  const [rezany, setRezany] = useState(null);
  const [folie, setFolie] = useState([]);
  const [dtf, setDtf] = useState(null);
  const [sietotlac, setSietotlac] = useState(null);
  const [sietotlacVelkosti, setSietotlacVelkosti] = useState([]);
  const [vysivka, setVysivka] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [costMetrics, setCostMetrics] = useState([]);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: tn }, { data: sg }, { data: rez }, { data: fol }, { data: dtfN }, { data: siet }, { data: sietVel }, { data: vys }, { data: mats }, { data: metriky }] = await Promise.all([
      supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
      supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_folie').select('*').order('id'),
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
      supabase.from('kostra_vysivka').select('*').eq('id', 1).maybeSingle(),
      supabase.from('materials').select('id, name, unit').order('name'),
      supabase.from('cost_metrics').select('id, name, category, value, power_kw, vykon_za_hodinu').order('name'),
    ]);
    setTextilSub(tn || { technologia: 'sublimacia', cena_papier_bm: 0, cena_ochranny_papier_bm: 0, cena_atrament_l: 0, spotreba_atrament_ml_m2: 0, cena_prace_hod: 0, rychlost_m_hod: 1 });
    setMaterials(mats || []);
    setCostMetrics(metriky || []);
    setSublimaciaGarment(sg || { id: 1, sirka_papiera_cm: 160, naklady_manipulacia: 0, naklady_ochranny_papier: 0, cas_nazehlovania_min: 0, koeficient_rizika_percent: 0 });
    setRezany(rez || { id: 1, cena_prace_hod: 0, cas_rezania_min: 0, cas_vylupovania_min: 0, cas_nazehlovania_min: 0, naklady_manipulacia: 0, sirka_folie_cm: 50, sirka_vyuzitelna_cm: 49 });
    setFolie(fol || []);
    setDtf(dtfN || { id: 1, cena_cmyk_kg: 0, spotreba_cmyk_m2: 0, cena_biela_kg: 0, spotreba_biela_m2: 0, cena_lepidlo_kg: 0, spotreba_lepidlo_m2: 0, cena_prace_hod: 0, cena_folie_bm: 0, rychlost_tlace_m_hod: 1, naklady_manipulacia: 0, cas_nazehlovania_min: 0 });
    setSietotlac(siet || { id: 1, cena_farba_kg: 0, naklady_manipulacia: 0, naklad_sito_zakazka: 0, naklad_cistenie_zakazka: 0, odporucany_min_ks: 30, cena_prace_hod: 0 });
    setSietotlacVelkosti(sietVel || []);
    setVysivka(vys || { id: 1, cena_digitalizacia: 0, cena_vysivky_cm2: 0 });
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Spoločný "bezpečný" save wrapper pre všetky karty nižšie — nastaví hodnotu hneď (pre plynulé
  // písanie do polí), ale pri chybe zo servera ju vráti späť a ukáže prečo.
  const ulozBezpecne = async (setter, predoslaHodnota, dalsiaHodnota, supabaseVolanie) => {
    setter(dalsiaHodnota);
    const { error } = await supabaseVolanie;
    if (error) {
      console.error('Uloženie zlyhalo:', error);
      setChybaUlozenia(`Uloženie zlyhalo: ${error.message}`);
      setter(predoslaHodnota);
    } else if (chybaUlozenia) {
      setChybaUlozenia('');
    }
  };

  const ulozTextilSub = (patch) => {
    const next = { ...textilSub, ...patch };
    ulozBezpecne(setTextilSub, textilSub, next, supabase.from('textil_naklady').upsert({ technologia: 'sublimacia', ...next }));
  };
  const ulozSublimaciaGarment = (patch) => {
    const next = { ...sublimaciaGarment, ...patch };
    ulozBezpecne(setSublimaciaGarment, sublimaciaGarment, next, supabase.from('cennik_sublimacia_naklady').upsert({ id: 1, ...next }));
  };
  const ulozRezany = (patch) => {
    const next = { ...rezany, ...patch };
    ulozBezpecne(setRezany, rezany, next, supabase.from('cennik_rezany_transfer').upsert({ id: 1, ...next }));
  };
  const ulozDtf = (patch) => {
    const next = { ...dtf, ...patch };
    ulozBezpecne(setDtf, dtf, next, supabase.from('dtf_naklady').upsert({ id: 1, ...next }));
  };
  const ulozSietotlac = (patch) => {
    const next = { ...sietotlac, ...patch };
    ulozBezpecne(setSietotlac, sietotlac, next, supabase.from('cennik_sietotlac').upsert({ id: 1, ...next }));
  };
  const ulozVysivka = (patch) => {
    const next = { ...vysivka, ...patch };
    ulozBezpecne(setVysivka, vysivka, next, supabase.from('kostra_vysivka').upsert({ id: 1, ...next }));
  };

  const pridajFoliu = async () => {
    const { data, error } = await supabase.from('cennik_folie').insert({ nazov: 'Nová fólia', cena_cm2: 0.15, naklad_bm: 0 }).select().single();
    if (!error && data) setFolie(f => [...f, data]);
  };
  const upravFoliu = async (id, patch) => {
    setFolie(f => f.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('cennik_folie').update(patch).eq('id', id);
  };
  const zmazFoliu = async (id) => {
    if (!window.confirm('Zmazať tento typ fólie?')) return;
    setFolie(f => f.filter(x => x.id !== id));
    await supabase.from('cennik_folie').delete().eq('id', id);
  };

  const pridajVelkost = async () => {
    const { data, error } = await supabase.from('cennik_sietotlac_velkosti').insert({ label: 'Nová veľkosť', sirka_cm: 10, vyska_cm: 10, spotreba_g_svetly: 0, spotreba_g_tmavy: 0, poradie: sietotlacVelkosti.length }).select().single();
    if (!error && data) setSietotlacVelkosti(v => [...v, data]);
  };
  const upravVelkost = async (id, patch) => {
    setSietotlacVelkosti(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('cennik_sietotlac_velkosti').update(patch).eq('id', id);
  };
  const zmazVelkost = async (id) => {
    if (!window.confirm('Zmazať túto veľkosť?')) return;
    setSietotlacVelkosti(v => v.filter(x => x.id !== id));
    await supabase.from('cennik_sietotlac_velkosti').delete().eq('id', id);
  };

  if (isLoading || !textilSub || !sublimaciaGarment || !rezany || !dtf || !sietotlac || !vysivka) {
    return <p className="text-sm text-slate-500">Načítavam…</p>;
  }

  // --- Referencna plocha/mnozstvo pre nahlady VC nizsie (len orientacne zobrazenie) ---
  const REF_PLOCHA_CM2 = 100; // 10x10cm — male orientacne logo
  const REF_PLOCHA_M2 = REF_PLOCHA_CM2 / 10000;
  // Max. format potlace na tricka (podla Martina — vsetko sa tlaci na tuto max. velkost alebo mensie
  // vyrezy z rovnakej 160cm rolky, nie na celu sirku rolky)
  const MAX_FORMAT_CM2 = 38 * 48;

  // Registre zariadeni pre vyber v dropdownoch (len kategoria "zariadenie") — cely costMetrics
  // (vratane "Cena elektriny") sa pouziva na dopocet sadzby cez elektrinaZariadeniaEurZaHod.
  const zariadenia = costMetrics.filter(m => m.category === 'zariadenie');
  const tlaciarenEurHod = elektrinaZariadeniaEurZaHod(costMetrics, textilSub.tlaciaren_zariadenie_id);
  const kalanderEurHod = elektrinaZariadeniaEurZaHod(costMetrics, textilSub.kalander_zariadenie_id);
  const lisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, textilSub.lis_zariadenie_id);

  // Sublimacia — metraz (presne rovnaky vzorec ako vypocitajNakladBm v TextilMetrazTab.jsx). Tlaciaren
  // aj kalander bezia POCAS CELEHO PRECHODU rolky pri rychlosti rychlost_m_hod — elektrina oboch sa
  // teda ratatuje rovnako (€/hod stroja / bm/hod rychlosti = €/bm).
  const ROLL_WIDTH_CM = 160;
  const ROLL_WIDTH_M = ROLL_WIDTH_CM / 100;
  const subInkM2 = ((textilSub.cena_atrament_l || 0) * (textilSub.spotreba_atrament_ml_m2 || 0) / 1000) * ROLL_WIDTH_M;
  const subLaborBm = (textilSub.cena_prace_hod || 0) / Math.max(0.01, textilSub.rychlost_m_hod || 1);
  const subElektrinaMetrazBm = (tlaciarenEurHod + kalanderEurHod) / Math.max(0.01, textilSub.rychlost_m_hod || 1);
  const vcSublimaciaMetrazBm = (textilSub.cena_papier_bm || 0) + (textilSub.cena_ochranny_papier_bm || 0) + subInkM2 + subLaborBm + subElektrinaMetrazBm;

  // Sublimacia — potlac na tricka: papier sa reze z tej istej 160cm rolky (nie samostatna sirka),
  // cena sa pocita proporcionalne podla plochy vyrezaneho kusa (max. format 38x48cm, vsetko mensie rovnako).
  // Tu uz NIE kalander ale samostatny LIS (jednotlive kusy, nie kontinualna rolka) — tlaciaren bezi
  // proporcionalne k ploche (rovnaky pomer ako papier/atrament), lis bezi flat cas na kus (nazehlenie).
  const subCenaPapierCm2 = ((textilSub.cena_papier_bm || 0) / ROLL_WIDTH_CM) / 100;
  const subCenaAtramentCm2 = (((textilSub.cena_atrament_l || 0) / 1000) * (textilSub.spotreba_atrament_ml_m2 || 0)) / 10000;
  const subElektrinaTlaciarenCm2 = tlaciarenEurHod / Math.max(0.01, textilSub.rychlost_m_hod || 1) / 16000;
  const subGarmentPraca = ((sublimaciaGarment.cas_nazehlovania_min || 0) / 60) * (textilSub.cena_prace_hod || 0);
  const subElektrinaLisFlat = lisEurHod * ((sublimaciaGarment.cas_nazehlovania_min || 0) / 60);
  const subGarmentFlat = (sublimaciaGarment.naklady_manipulacia || 0) + (sublimaciaGarment.naklady_ochranny_papier || 0) + subGarmentPraca + subElektrinaLisFlat;
  const subRizikoNasobok = 1 + (sublimaciaGarment.koeficient_rizika_percent || 0) / 100;
  const vcSublimaciaGarment = (REF_PLOCHA_CM2 * (subCenaPapierCm2 + subCenaAtramentCm2 + subElektrinaTlaciarenCm2) + subGarmentFlat) * subRizikoNasobok;
  const vcSublimaciaGarmentMax = (MAX_FORMAT_CM2 * (subCenaPapierCm2 + subCenaAtramentCm2 + subElektrinaTlaciarenCm2) + subGarmentFlat) * subRizikoNasobok;

  // Rezany transfer — cas rezania a vylupovania zavisi od grafiky, zadava sa ako min/cm² (nie flat
  // na zakazku) — nazehlovanie ostava flat na kus. Naklad materialu per-folia (viz zoznam folii nizsie).
  const ploterEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany.ploter_zariadenie_id);
  const rezanyLisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, rezany.transferovy_lis_zariadenie_id);
  const rezanyPracaFlat = ((rezany.cas_nazehlovania_min || 0) / 60) * (rezany.cena_prace_hod || 0) + (rezany.naklady_manipulacia || 0) + rezanyLisEurHod * ((rezany.cas_nazehlovania_min || 0) / 60);
  const rezanyPracaCm2 = ((rezany.cas_rezania_min || 0) + (rezany.cas_vylupovania_min || 0)) / 60 * (rezany.cena_prace_hod || 0) + ploterEurHod * ((rezany.cas_rezania_min || 0) / 60);
  const rezanyPraca = rezanyPracaFlat + rezanyPracaCm2 * REF_PLOCHA_CM2;

  // Sietotlac — karusel (tlac cez sita) + fixacny tunel (fixacia farby), oba flat cas na kus.
  const karuselEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.karusel_zariadenie_id);
  const sietotlacTunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, sietotlac.fixacny_tunel_zariadenie_id);
  const sietotlacElektrinaFlat = karuselEurHod * ((sietotlac.cas_tlace_min || 0) / 60) + sietotlacTunelEurHod * ((sietotlac.cas_fixacie_min || 0) / 60);

  // DTF — elektrina stroja (tlaciaren aj fixacny tunel) pri metrazi bezia obe pocas celeho prechodu
  // pasu, kazdy svojou rychlostou — tlaciaren pri rychlost_tlace_m_hod, tunel pri rychlost_tunela_m_hod.
  const dtfTlaciarenEurHod = elektrinaZariadeniaEurZaHod(costMetrics, dtf.tlaciaren_zariadenie_id);
  const dtfTunelEurHod = elektrinaZariadeniaEurZaHod(costMetrics, dtf.fixacny_tunel_zariadenie_id);
  const dtfLisEurHod = elektrinaZariadeniaEurZaHod(costMetrics, dtf.transferovy_lis_zariadenie_id);

  // DTF — metraz (presne rovnaky vzorec ako v DtfMetrazTab.jsx, sirka role 56cm)
  const dtfFilmM2 = (dtf.cena_folie_bm || 0) / 0.56;
  const dtfGlueM2 = (dtf.cena_lepidlo_kg || 0) * (dtf.spotreba_lepidlo_m2 || 0);
  const dtfCmykM2 = (dtf.cena_cmyk_kg || 0) * (dtf.spotreba_cmyk_m2 || 0);
  const dtfWhiteM2 = (dtf.cena_biela_kg || 0) * (dtf.spotreba_biela_m2 || 0);
  const dtfLaborM2 = (dtf.cena_prace_hod || 0) / ((dtf.rychlost_tlace_m_hod || 1) * 0.56);
  const dtfElektrinaMetrazBm = dtfTlaciarenEurHod / Math.max(0.01, dtf.rychlost_tlace_m_hod || 1) + dtfTunelEurHod / Math.max(0.01, dtf.rychlost_tunela_m_hod || 1);
  const vcDtfMetrazBm = (dtfFilmM2 + dtfGlueM2 + dtfCmykM2 + dtfWhiteM2 + dtfLaborM2) * 0.56 + dtfElektrinaMetrazBm;

  // DTF — potlac textilu (presne rovnaky vzorec ako vcDtf v CennikTab.jsx)
  const dtfMaterialM2 = dtfCmykM2 + dtfWhiteM2 + dtfGlueM2;
  const dtfGarmentPraca = ((dtf.cas_nazehlovania_min || 0) / 60) * (dtf.cena_prace_hod || 0);
  const dtfDlzkaBmGarment = REF_PLOCHA_CM2 / (56 * 100);
  const dtfElektrinaGarmentTlacTunel = dtfDlzkaBmGarment * (dtfTlaciarenEurHod / Math.max(0.01, dtf.rychlost_tlace_m_hod || 1) + dtfTunelEurHod / Math.max(0.01, dtf.rychlost_tunela_m_hod || 1));
  const dtfElektrinaGarmentLis = dtfLisEurHod * ((dtf.cas_nazehlovania_min || 0) / 60);
  const vcDtfGarment = REF_PLOCHA_M2 * dtfMaterialM2 + (dtf.naklady_manipulacia || 0) + dtfGarmentPraca + dtfElektrinaGarmentTlacTunel + dtfElektrinaGarmentLis;

  // Vysivka
  const vysivkaRefKs = 10;
  const vcVysivka = (vysivka.cena_digitalizacia || 0) / vysivkaRefKs + (vysivka.cena_vysivky_cm2 || 0) * REF_PLOCHA_CM2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers3 className="text-indigo-400 h-5 w-5" /> Kostra cien — výrobné náklady</h2>
        <p className="text-xs text-slate-400 mt-1">Jediné miesto na zadanie surových výrobných nákladov (materiál, farby, fólie, práca) pre všetky technológie. Karty <strong className="text-slate-200">Metráže</strong> a <strong className="text-slate-200">Potlače</strong> odtiaľto živo ťahajú výrobnú cenu (VC) — nič sa tam už neduplikuje.</p>
        <p className="text-[11px] text-amber-400/90 mt-2 bg-amber-950/20 border border-amber-900/40 rounded-lg px-3 py-2 inline-block">⚠️ Všetky ceny na tejto stránke (aj vstupy, aj vypočítané "VC" náhľady) sú <strong>BEZ DPH</strong> — je to interný náklad, nie predajná cena. DPH sa pripočíta až v Potlačiach/Metrážach (predajné sadzby) a v appkách, ktoré vidí zákazník.</p>
        {chybaUlozenia && (
          <p className="text-[11px] text-rose-300 mt-2 bg-rose-950/30 border border-rose-800/50 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <span>⚠️ {chybaUlozenia}</span>
            <button onClick={() => setChybaUlozenia('')} className="text-rose-400 hover:text-white font-bold shrink-0">✕</button>
          </p>
        )}
      </div>

      {/* SUBLIMACIA */}
      <div className="bg-slate-900/60 rounded-2xl border border-teal-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-3">1. Sublimácia</h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Spoločné vstupy (papier, atrament, práca) — používa Metráž aj Potlač na tričká</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Sublimačný papier (€/1bm, 160cm)" value={textilSub.cena_papier_bm} step="0.05" onChange={(v) => ulozTextilSub({ cena_papier_bm: v })} />
              <Field label="Ochranný kalandr. papier (€/bm)" value={textilSub.cena_ochranny_papier_bm} step="0.05" onChange={(v) => ulozTextilSub({ cena_ochranny_papier_bm: v })} />
              <Field label="Sublimačný atrament CMYK (€/l)" value={textilSub.cena_atrament_l} step="1" onChange={(v) => ulozTextilSub({ cena_atrament_l: v })} />
              <Field label="Spotreba atramentu (ml/m²)" value={textilSub.spotreba_atrament_ml_m2} step="1" onChange={(v) => ulozTextilSub({ spotreba_atrament_ml_m2: v })} />
              <Field label="Operátor + kalander (€/hod)" value={textilSub.cena_prace_hod} step="1" onChange={(v) => ulozTextilSub({ cena_prace_hod: v })} />
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Prepojenie na Sklad (reálne odčítanie pri zákazke)</span>
            <p className="text-[11px] text-slate-500 mb-2">Priraď ku každému spotrebnému materiálu konkrétnu položku zo Skladu — pri vygenerovaní zákazky s produktom, ktorý má zapnutú sublimáciu, sa spolu s látkou odpočíta aj toto (podľa plochy potlače). Bez priradenia sa nič zo skladu neodpočíta (len sa počíta cena ako doteraz).</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <label className={labelCls}>Sublimačný papier</label>
                <select value={textilSub.papier_material_id || ''} onChange={(e) => ulozTextilSub({ papier_material_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {materials.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.unit})</option>))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sublimačný atrament</label>
                <select value={textilSub.atrament_material_id || ''} onChange={(e) => ulozTextilSub({ atrament_material_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {materials.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.unit})</option>))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Protekčný papier</label>
                <select value={textilSub.protekcny_papier_material_id || ''} onChange={(e) => ulozTextilSub({ protekcny_papier_material_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {materials.map(m => (<option key={m.id} value={m.id}>{m.name} ({m.unit})</option>))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Prepojenie na stroje (elektrina v cene potlače)</span>
            <p className="text-[11px] text-slate-500 mb-2">Priraď konkrétny stroj z registra zariadení (Prehľady → Všeobecná tabuľka nákladov, kategória "Zariadenie") ku každému kroku — tlačiareň (Mimaki/Epson/Roland) tlačí motív pre OBA varianty (metráž aj tričká), kalander beží LEN pri metráži (kontinuálna rolka), lis beží LEN pri tričkách (jednotlivé kusy). Ich elektrina (kW × cena elektriny × reálny čas behu) sa pripočíta ako samostatná položka do ceny. Bez priradenia sa nič nemení.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <label className={labelCls}>Tlačiareň (metráž aj tričká)</label>
                <select value={textilSub.tlaciaren_zariadenie_id || ''} onChange={(e) => ulozTextilSub({ tlaciaren_zariadenie_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Kalander (len metráž)</label>
                <select value={textilSub.kalander_zariadenie_id || ''} onChange={(e) => ulozTextilSub({ kalander_zariadenie_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Lis (len tričká)</label>
                <select value={textilSub.lis_zariadenie_id || ''} onChange={(e) => ulozTextilSub({ lis_zariadenie_id: e.target.value || null })} className={inputCls}>
                  <option value="">— nepriradené —</option>
                  {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950 rounded-xl border border-teal-900/40">
              <span className="text-xs font-bold text-teal-400 block mb-2">Variant: Metráž (rolka)</span>
              <Field label="Rýchlosť tlače+fixácie (bm/hod)" value={textilSub.rychlost_m_hod} step="1" onChange={(v) => ulozTextilSub({ rychlost_m_hod: v })} />
              {(textilSub.tlaciaren_zariadenie_id || textilSub.kalander_zariadenie_id) && (
                <VysledokVC label="Elektrina tlačiareň+kalander" value={subElektrinaMetrazBm} unit="€/bm" />
              )}
              <VysledokVC label="VC metráž" value={vcSublimaciaMetrazBm} unit="€/bm" />
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40">
              <span className="text-xs font-bold text-amber-400 block mb-2">Variant: Potlač na tričká</span>
              <p className="text-[11px] text-slate-500 mb-2">Papier sa reže z tej istej 160cm rolky podľa plochy motívu — max. používaný formát je 38×48cm, všetko menšie sa počíta rovnako proporcionálne.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Manipulácia strihania (€/ks)" value={sublimaciaGarment.naklady_manipulacia} step="0.01" onChange={(v) => ulozSublimaciaGarment({ naklady_manipulacia: v })} />
                <Field label="Ochranný papier pri lise (€/ks)" value={sublimaciaGarment.naklady_ochranny_papier} step="0.01" onChange={(v) => ulozSublimaciaGarment({ naklady_ochranny_papier: v })} />
                <Field label="Čas nažehlenia (min/ks)" value={sublimaciaGarment.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozSublimaciaGarment({ cas_nazehlovania_min: v })} hint={casFlatHint(sublimaciaGarment.cas_nazehlovania_min)} />
                <Field label="Koeficient rizika (%, pokazené kusy)" value={sublimaciaGarment.koeficient_rizika_percent} step="1" onChange={(v) => ulozSublimaciaGarment({ koeficient_rizika_percent: v })} />
              </div>
              <VysledokVC label="Materiál (papier+atrament)" value={subCenaPapierCm2 + subCenaAtramentCm2} unit="€/cm²" />
              {textilSub.tlaciaren_zariadenie_id && (
                <VysledokVC label="Elektrina tlačiarne" value={subElektrinaTlaciarenCm2} unit="€/cm²" />
              )}
              <VysledokVC label="Fixné náklady na kus (manipulácia+papier+nažehlenie+lis)" value={subGarmentFlat} unit="€/ks" />
              {textilSub.lis_zariadenie_id && (
                <p className="text-[11px] text-slate-500 -mt-2">z toho elektrina lisu: {subElektrinaLisFlat.toFixed(4)} €/ks</p>
              )}
              <p className="text-[11px] text-slate-500 mt-2 mb-1">↓ Materiál×plocha + fixné náklady, × (1+riziko) — preto cena nerastie lineárne s plochou, kým fixné náklady dominujú:</p>
              <VysledokVC label={`VC pri malom logu (${REF_PLOCHA_CM2}cm² = 10×10cm)`} value={vcSublimaciaGarment} unit="€/ks" />
              <p className="text-[11px] text-slate-500 -mt-2">≈ {(vcSublimaciaGarment / REF_PLOCHA_CM2).toFixed(4)} €/cm² priemerne pri tejto ploche</p>
              <VysledokVC label="VC pri max. formáte (38×48cm = 1824cm²)" value={vcSublimaciaGarmentMax} unit="€/ks" />
              <p className="text-[11px] text-slate-500 -mt-2">≈ {(vcSublimaciaGarmentMax / MAX_FORMAT_CM2).toFixed(4)} €/cm² priemerne pri tejto ploche</p>
            </div>
          </div>
        </div>
      </div>

      {/* REZANY TRANSFER */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">2. Rezaný transfer (fóliový vinyl)</h3>
        <p className="text-[11px] text-slate-500 mb-2">Čas rezania a vyľupovania závisí od zložitosti grafiky, preto sa zadáva orientačne na 1cm² plochy motívu (nie fixne na kus) — napr. 0,01 min/cm² znamená 1 minútu pri 100cm² (10×10cm). Nažehlovanie a manipulácia sú fixné na kus.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-3">
          <Field label="Cena práce (€/hod)" value={rezany.cena_prace_hod} step="0.5" onChange={(v) => ulozRezany({ cena_prace_hod: v })} />
          <Field label="Čas rezania (min/cm²)" value={rezany.cas_rezania_min} step="0.01" onChange={(v) => ulozRezany({ cas_rezania_min: v })} hint={casNaCm2Hint(rezany.cas_rezania_min, REF_PLOCHA_CM2)} />
          <Field label="Čas vyľupovania (min/cm²)" value={rezany.cas_vylupovania_min} step="0.01" onChange={(v) => ulozRezany({ cas_vylupovania_min: v })} hint={casNaCm2Hint(rezany.cas_vylupovania_min, REF_PLOCHA_CM2)} />
          <Field label="Čas nažehlovania (min/ks)" value={rezany.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozRezany({ cas_nazehlovania_min: v })} hint={casFlatHint(rezany.cas_nazehlovania_min)} />
          <Field label="Manipulácia (€/ks)" value={rezany.naklady_manipulacia} step="0.01" onChange={(v) => ulozRezany({ naklady_manipulacia: v })} />
        </div>
        <VysledokVC label={`Práca + manipulácia pri ${REF_PLOCHA_CM2}cm² (10×10cm)`} value={rezanyPraca} unit="€/ks" />
        <p className="text-[11px] text-slate-500 -mt-2">≈ {(rezanyPraca / REF_PLOCHA_CM2).toFixed(4)} €/cm² priemerne pri tejto ploche</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mt-3">
          <div>
            <label className={labelCls}>Plotter (podľa času rezania)</label>
            <select value={rezany.ploter_zariadenie_id || ''} onChange={(e) => ulozRezany({ ploter_zariadenie_id: e.target.value || null })} className={inputCls}>
              <option value="">— nepriradené —</option>
              {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Transferový lis (podľa času nažehlenia)</label>
            <select value={rezany.transferovy_lis_zariadenie_id || ''} onChange={(e) => ulozRezany({ transferovy_lis_zariadenie_id: e.target.value || null })} className={inputCls}>
              <option value="">— nepriradené —</option>
              {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mt-4 mb-3 max-w-md">
          <Field label="Nominálna šírka fólie (cm)" value={rezany.sirka_folie_cm} step="1" onChange={(v) => ulozRezany({ sirka_folie_cm: v })} />
          <Field label="Efektívne využiteľná šírka (cm)" value={rezany.sirka_vyuzitelna_cm} step="1" onChange={(v) => ulozRezany({ sirka_vyuzitelna_cm: v })} />
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Typy fólie — náklad na bežný meter (predajná sadzba sa nastavuje v karte Potlače)</label>
          <button onClick={pridajFoliu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať typ fólie</button>
        </div>
        <div className="space-y-2">
          {folie.map(f => {
            const nakladCm2 = (rezany.sirka_vyuzitelna_cm || 0) > 0 ? ((parseFloat(f.naklad_bm) || 0) / rezany.sirka_vyuzitelna_cm) / 100 : 0;
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-2 bg-slate-950/40 rounded-lg p-2">
                <input type="text" value={f.nazov} onChange={(e) => upravFoliu(f.id, { nazov: e.target.value })} className="flex-1 min-w-[100px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <input type="number" step="0.05" value={f.naklad_bm || 0} onChange={(e) => upravFoliu(f.id, { naklad_bm: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> €/bm (bez DPH)
                </div>
                <button onClick={() => zmazFoliu(f.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0 ml-auto"><Trash2 className="w-4 h-4" /></button>
                <span className="text-[11px] text-slate-500 w-full">= {nakladCm2.toFixed(6)} €/cm² • {(nakladCm2 * 100).toFixed(4)} € pri 10×10cm (bez DPH)</span>
              </div>
            );
          })}
          {folie.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne typy fólie.</p>}
        </div>
      </div>

      {/* DTF */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">3. DTF (digitálny transfer)</h3>
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Spoločné vstupy (materiál) — používa Metráž aj Potlač textilu</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-3">
          <Field label="Cena CMYK (€/kg)" value={dtf.cena_cmyk_kg} step="1" onChange={(v) => ulozDtf({ cena_cmyk_kg: v })} />
          <Field label="Spotreba CMYK (kg/m²)" value={dtf.spotreba_cmyk_m2} step="0.001" onChange={(v) => ulozDtf({ spotreba_cmyk_m2: v })} />
          <Field label="Cena bielej (€/kg)" value={dtf.cena_biela_kg} step="1" onChange={(v) => ulozDtf({ cena_biela_kg: v })} />
          <Field label="Spotreba bielej (kg/m²)" value={dtf.spotreba_biela_m2} step="0.001" onChange={(v) => ulozDtf({ spotreba_biela_m2: v })} />
          <Field label="Cena lepidla (€/kg)" value={dtf.cena_lepidlo_kg} step="0.5" onChange={(v) => ulozDtf({ cena_lepidlo_kg: v })} />
          <Field label="Spotreba lepidla (kg/m²)" value={dtf.spotreba_lepidlo_m2} step="0.005" onChange={(v) => ulozDtf({ spotreba_lepidlo_m2: v })} />
          <Field label="Práca + energie (€/hod)" value={dtf.cena_prace_hod} step="1" onChange={(v) => ulozDtf({ cena_prace_hod: v })} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Prepojenie na stroje (elektrina v cene potlače)</span>
          <p className="text-[11px] text-slate-500 mb-2">Tlačiareň tlačí pre OBA varianty (metráž aj potlač textilu), fixačný tunel tiež (má vlastnú rýchlosť pása), transferový lis len pri potlači textilu (nažehlenie na kus).</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <label className={labelCls}>Tlačiareň (metráž aj textil)</label>
              <select value={dtf.tlaciaren_zariadenie_id || ''} onChange={(e) => ulozDtf({ tlaciaren_zariadenie_id: e.target.value || null })} className={inputCls}>
                <option value="">— nepriradené —</option>
                {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fixačný tunel (metráž aj textil)</label>
              <select value={dtf.fixacny_tunel_zariadenie_id || ''} onChange={(e) => ulozDtf({ fixacny_tunel_zariadenie_id: e.target.value || null })} className={inputCls}>
                <option value="">— nepriradené —</option>
                {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transferový lis (len textil)</label>
              <select value={dtf.transferovy_lis_zariadenie_id || ''} onChange={(e) => ulozDtf({ transferovy_lis_zariadenie_id: e.target.value || null })} className={inputCls}>
                <option value="">— nepriradené —</option>
                {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
              </select>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-teal-900/40">
            <span className="text-xs font-bold text-teal-400 block mb-2">Variant: Metráž (rolka, 56cm)</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cena PET fólie (€/bm)" value={dtf.cena_folie_bm} step="0.1" onChange={(v) => ulozDtf({ cena_folie_bm: v })} />
              <Field label="Rýchlosť tlače (m/hod)" value={dtf.rychlost_tlace_m_hod} step="0.5" onChange={(v) => ulozDtf({ rychlost_tlace_m_hod: v })} />
              <Field label="Rýchlosť fixačného tunela (m/hod)" value={dtf.rychlost_tunela_m_hod} step="0.5" onChange={(v) => ulozDtf({ rychlost_tunela_m_hod: v })} />
            </div>
            <VysledokVC label="VC metráž" value={vcDtfMetrazBm} unit="€/bm" />
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40">
            <span className="text-xs font-bold text-amber-400 block mb-2">Variant: Potlač textilu</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Manipulácia strihania (€/ks)" value={dtf.naklady_manipulacia} step="0.01" onChange={(v) => ulozDtf({ naklady_manipulacia: v })} />
              <Field label="Čas nažehlovania (min/ks)" value={dtf.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozDtf({ cas_nazehlovania_min: v })} hint={casFlatHint(dtf.cas_nazehlovania_min)} />
            </div>
            <VysledokVC label={`VC pri ${REF_PLOCHA_CM2}cm² (10×10cm)`} value={vcDtfGarment} unit="€/ks" />
            <p className="text-[11px] text-slate-500 -mt-2">≈ {(vcDtfGarment / REF_PLOCHA_CM2).toFixed(4)} €/cm² priemerne pri tejto ploche</p>
          </div>
        </div>
      </div>

      {/* SIETOTLAC */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">4. Sieťotlač</h3>
        <p className="text-[11px] text-slate-500 mb-2">Každá ďalšia farba = ďalšie sito (nasvietenie) + farba, ale so znižujúcou sa spotrebou (skúsenostne cca -20% na každú ďalšiu farbu oproti predchádzajúcej — nastavuje sa v Potlače pri testovacej kalkulačke, kde vidíš aj rozpad po farbách).</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4">
          <Field label="Cena farby (€/kg)" value={sietotlac.cena_farba_kg} step="0.5" onChange={(v) => ulozSietotlac({ cena_farba_kg: v })} />
          <Field label="Manipulácia (€/ks)" value={sietotlac.naklady_manipulacia} step="0.01" onChange={(v) => ulozSietotlac({ naklady_manipulacia: v })} />
          <Field label="Sito — náklad na 1 farbu/sito (€)" value={sietotlac.naklad_sito_zakazka} step="0.5" onChange={(v) => ulozSietotlac({ naklad_sito_zakazka: v })} hint="Pri 3 farbách sa počíta 3× (3 sitá)." />
          <Field label="Čistiace prípravky (€/zákazku)" value={sietotlac.naklad_cistenie_zakazka} step="0.1" onChange={(v) => ulozSietotlac({ naklad_cistenie_zakazka: v })} />
          <Field label="Odporúčaný min. počet ks" value={sietotlac.odporucany_min_ks} step="1" onChange={(v) => ulozSietotlac({ odporucany_min_ks: v })} hint="Informačne — toto je len ODPORÚČANIE, menšie zákazky sú možné, len drahšie na kus." />
          <Field label="Práca operátora (€/hod)" value={sietotlac.cena_prace_hod} step="1" onChange={(v) => ulozSietotlac({ cena_prace_hod: v })} hint="Obsluha karuselu + tunela, za čas tlače+fixácie zadaný nižšie." />
        </div>
        <div className="mb-4">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">Prepojenie na stroje (elektrina v cene potlače)</span>
          <p className="text-[11px] text-slate-500 mb-2">Karusel (tlač cez sitá) a fixačný tunel (fixácia farby) bežia flat čas na kus — zadaj minúty aj priraď stroj z registra zariadení.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <label className={labelCls}>Karusel</label>
              <select value={sietotlac.karusel_zariadenie_id || ''} onChange={(e) => ulozSietotlac({ karusel_zariadenie_id: e.target.value || null })} className={inputCls}>
                <option value="">— nepriradené —</option>
                {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
              </select>
            </div>
            <Field label="Čas tlače (min/ks)" value={sietotlac.cas_tlace_min} step="0.1" onChange={(v) => ulozSietotlac({ cas_tlace_min: v })} hint={casFlatHint(sietotlac.cas_tlace_min)} />
            <div>
              <label className={labelCls}>Fixačný tunel</label>
              <select value={sietotlac.fixacny_tunel_zariadenie_id || ''} onChange={(e) => ulozSietotlac({ fixacny_tunel_zariadenie_id: e.target.value || null })} className={inputCls}>
                <option value="">— nepriradené —</option>
                {zariadenia.map(z => (<option key={z.id} value={z.id}>{z.name}{z.power_kw ? ` (${z.power_kw}kW)` : ''}</option>))}
              </select>
            </div>
            <Field label="Čas fixácie (min/ks)" value={sietotlac.cas_fixacie_min} step="0.1" onChange={(v) => ulozSietotlac({ cas_fixacie_min: v })} hint={casFlatHint(sietotlac.cas_fixacie_min)} />
          </div>
          {(sietotlac.karusel_zariadenie_id || sietotlac.fixacny_tunel_zariadenie_id) && (
            <VysledokVC label="Elektrina karusel+tunel" value={sietotlacElektrinaFlat} unit="€/ks" />
          )}
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Formáty a spotreba farby pre 1. farbu (svetlý / tmavý textil = 1 vrstva / 2 vrstvy)</label>
          <button onClick={pridajVelkost} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať formát</button>
        </div>
        <div className="space-y-1.5">
          {sietotlacVelkosti.map(v => (
            <div key={v.id} className="flex flex-wrap items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg p-2">
              <input type="text" value={v.label} onChange={(e) => upravVelkost(v.id, { label: e.target.value })} className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white" />
              <input type="number" step="0.1" value={v.sirka_cm} onChange={(e) => upravVelkost(v.id, { sirka_cm: parseFloat(e.target.value) || 0 })} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white" title="šírka cm" />
              <span className="text-slate-600">×</span>
              <input type="number" step="0.1" value={v.vyska_cm} onChange={(e) => upravVelkost(v.id, { vyska_cm: parseFloat(e.target.value) || 0 })} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white" title="výška cm" />
              <span className="text-slate-500">cm •</span>
              <input type="number" step="0.5" value={v.spotreba_g_svetly} onChange={(e) => upravVelkost(v.id, { spotreba_g_svetly: parseFloat(e.target.value) || 0 })} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white" title="g svetlý" />
              <span className="text-slate-500">g svetlý /</span>
              <input type="number" step="0.5" value={v.spotreba_g_tmavy} onChange={(e) => upravVelkost(v.id, { spotreba_g_tmavy: parseFloat(e.target.value) || 0 })} className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white" title="g tmavý" />
              <span className="text-slate-500">g tmavý</span>
              <button onClick={() => zmazVelkost(v.id)} className="text-slate-500 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {sietotlacVelkosti.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne formáty.</p>}
        </div>
        {sietotlacVelkosti.length > 0 && (() => {
          const kostraPreview = { sietotlac, sietotlacVelkosti, costMetrics };
          const prvyFormat = sietotlacVelkosti[0];
          const vc1 = vcSietotlacCelkom(kostraPreview, prvyFormat.id, false, 1);
          const vc3 = vcSietotlacCelkom(kostraPreview, prvyFormat.id, false, 3);
          return (
            <div className="mt-3">
              <p className="text-[11px] text-slate-500 mb-1">Náhľad pri formáte "{prvyFormat.label}", svetlý textil:</p>
              <VysledokVC label="VC pri 1 farbe" value={vc1} unit="€/ks" />
              <VysledokVC label="VC pri 3 farbách" value={vc3} unit="€/ks" />
            </div>
          );
        })()}
      </div>

      {/* VYSIVKA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">5. Výšivka</h3>
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 max-w-md">
          <Field label="Cena digitalizácie motívu (€, jednorazovo)" value={vysivka.cena_digitalizacia} step="1" onChange={(v) => ulozVysivka({ cena_digitalizacia: v })} />
          <Field label="Cena od vyšívača (€/cm²)" value={vysivka.cena_vysivky_cm2} step="0.001" onChange={(v) => ulozVysivka({ cena_vysivky_cm2: v })} />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Náhľad pri {REF_PLOCHA_CM2}cm² motíve (10×10cm) a zákazke {vysivkaRefKs}ks (digitalizácia sa rozpočíta na počet kusov):</p>
        <VysledokVC label={`VC pri ${vysivkaRefKs}ks`} value={vcVysivka} unit="€/ks" />
        <p className="text-[11px] text-slate-500 -mt-2">≈ {(vcVysivka / REF_PLOCHA_CM2).toFixed(4)} €/cm² priemerne pri tejto ploche</p>
      </div>

      <p className="text-[11px] text-slate-500 italic">Laser a ostatné vlastné stroje (rezanie/vysekávanie) sa už nenastavujú tu — sú súčasťou registra zariadení vo Financiách → Réžia firiem, kde majú elektrinu aj výkon (jednotky/hod) pohromade s ostatnými nákladmi firmy.</p>
    </div>
  );
}
