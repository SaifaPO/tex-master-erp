import React, { useEffect, useState } from 'react';
import { Layers3, Plus, Trash2 } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

function Field({ label, value, step, onChange }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="number" step={step} value={value ?? ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={inputCls} />
    </div>
  );
}

function VysledokVC({ label, value, unit }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <span className="text-sm font-mono font-bold text-emerald-400">{value.toFixed(4)} {unit}</span>
    </div>
  );
}

// Vsetky vzorce nizsie su zamerne rovnake ako doteraz pouzivane v CennikTab.jsx / DtfMetrazTab.jsx /
// TextilMetrazTab.jsx — tento tab len zjednocuje KDE sa naklady EDITUJU, samotny vypocet VC sa nemeni
// (okrem sublimacie na tricka, kde sa zdielane vstupy prvykrat naozaj zluvcujuju s metrazou — viz
// komentar pri SublimaciaCard).
export default function KostraCienTab({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  const [textilSub, setTextilSub] = useState(null);
  const [sublimaciaGarment, setSublimaciaGarment] = useState(null);
  const [rezany, setRezany] = useState(null);
  const [folie, setFolie] = useState([]);
  const [dtf, setDtf] = useState(null);
  const [sietotlac, setSietotlac] = useState(null);
  const [sietotlacVelkosti, setSietotlacVelkosti] = useState([]);
  const [vysivka, setVysivka] = useState(null);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: tn }, { data: sg }, { data: rez }, { data: fol }, { data: dtfN }, { data: siet }, { data: sietVel }, { data: vys }] = await Promise.all([
      supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
      supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_folie').select('*').order('id'),
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
      supabase.from('kostra_vysivka').select('*').eq('id', 1).maybeSingle(),
    ]);
    setTextilSub(tn || { technologia: 'sublimacia', cena_papier_bm: 0, cena_ochranny_papier_bm: 0, cena_atrament_l: 0, spotreba_atrament_ml_m2: 0, cena_prace_hod: 0, rychlost_m_hod: 1 });
    setSublimaciaGarment(sg || { id: 1, sirka_papiera_cm: 160, naklady_manipulacia: 0, naklady_ochranny_papier: 0, cas_nazehlovania_min: 0, koeficient_rizika_percent: 0 });
    setRezany(rez || { id: 1, cena_prace_hod: 0, cas_rezania_min: 0, cas_vylupovania_min: 0, cas_nazehlovania_min: 0, naklady_manipulacia: 0 });
    setFolie(fol || []);
    setDtf(dtfN || { id: 1, cena_cmyk_kg: 0, spotreba_cmyk_m2: 0, cena_biela_kg: 0, spotreba_biela_m2: 0, cena_lepidlo_kg: 0, spotreba_lepidlo_m2: 0, cena_prace_hod: 0, cena_folie_bm: 0, rychlost_tlace_m_hod: 1, naklady_manipulacia: 0, cas_nazehlovania_min: 0 });
    setSietotlac(siet || { id: 1, cena_farba_kg: 0, naklady_manipulacia: 0, naklad_sito_zakazka: 0, naklad_cistenie_zakazka: 0 });
    setSietotlacVelkosti(sietVel || []);
    setVysivka(vys || { id: 1, cena_digitalizacia: 0, cena_vysivky_cm2: 0 });
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ulozTextilSub = async (patch) => {
    const next = { ...textilSub, ...patch };
    setTextilSub(next);
    await supabase.from('textil_naklady').upsert({ technologia: 'sublimacia', ...next });
  };
  const ulozSublimaciaGarment = async (patch) => {
    const next = { ...sublimaciaGarment, ...patch };
    setSublimaciaGarment(next);
    await supabase.from('cennik_sublimacia_naklady').upsert({ id: 1, ...next });
  };
  const ulozRezany = async (patch) => {
    const next = { ...rezany, ...patch };
    setRezany(next);
    await supabase.from('cennik_rezany_transfer').upsert({ id: 1, ...next });
  };
  const ulozDtf = async (patch) => {
    const next = { ...dtf, ...patch };
    setDtf(next);
    await supabase.from('dtf_naklady').upsert({ id: 1, ...next });
  };
  const ulozSietotlac = async (patch) => {
    const next = { ...sietotlac, ...patch };
    setSietotlac(next);
    await supabase.from('cennik_sietotlac').upsert({ id: 1, ...next });
  };
  const ulozVysivka = async (patch) => {
    const next = { ...vysivka, ...patch };
    setVysivka(next);
    await supabase.from('kostra_vysivka').upsert({ id: 1, ...next });
  };

  const pridajFoliu = async () => {
    const { data, error } = await supabase.from('cennik_folie').insert({ nazov: 'Nová fólia', cena_cm2: 0.15, naklad_cm2: 0 }).select().single();
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
  const REF_PLOCHA_CM2 = 100; // 10x10cm
  const REF_PLOCHA_M2 = REF_PLOCHA_CM2 / 10000;

  // Sublimacia — metraz (presne rovnaky vzorec ako vypocitajNakladBm v TextilMetrazTab.jsx)
  const ROLL_WIDTH_M = 1.60;
  const subInkM2 = ((textilSub.cena_atrament_l || 0) * (textilSub.spotreba_atrament_ml_m2 || 0) / 1000) * ROLL_WIDTH_M;
  const subLaborBm = (textilSub.cena_prace_hod || 0) / Math.max(0.01, textilSub.rychlost_m_hod || 1);
  const vcSublimaciaMetrazBm = (textilSub.cena_papier_bm || 0) + (textilSub.cena_ochranny_papier_bm || 0) + subInkM2 + subLaborBm;

  // Sublimacia — potlac na tricka (zdielane vstupy z textilSub + garment-only extra polia)
  const subGarmentSirkaM = (sublimaciaGarment.sirka_papiera_cm || 0) / 100;
  const subCenaPapierCm2 = subGarmentSirkaM > 0 ? ((textilSub.cena_papier_bm || 0) / subGarmentSirkaM) / 10000 : 0;
  const subCenaAtramentCm2 = (((textilSub.cena_atrament_l || 0) / 1000) * (textilSub.spotreba_atrament_ml_m2 || 0)) / 10000;
  const subGarmentPraca = ((sublimaciaGarment.cas_nazehlovania_min || 0) / 60) * (textilSub.cena_prace_hod || 0);
  const vcSublimaciaGarmentZaklad = REF_PLOCHA_CM2 * (subCenaPapierCm2 + subCenaAtramentCm2) + (sublimaciaGarment.naklady_manipulacia || 0) + (sublimaciaGarment.naklady_ochranny_papier || 0) + subGarmentPraca;
  const vcSublimaciaGarment = vcSublimaciaGarmentZaklad * (1 + (sublimaciaGarment.koeficient_rizika_percent || 0) / 100);

  // Rezany transfer — cas rezania+vylupovania+nazehlovania + manipulacia spolocne pre vsetky folie,
  // naklad materialu per-folia (viz zoznam folii nizsie)
  const rezanyPraca = ((rezany.cas_rezania_min || 0) + (rezany.cas_vylupovania_min || 0) + (rezany.cas_nazehlovania_min || 0)) / 60 * (rezany.cena_prace_hod || 0) + (rezany.naklady_manipulacia || 0);

  // DTF — metraz (presne rovnaky vzorec ako v DtfMetrazTab.jsx, sirka role 56cm)
  const dtfFilmM2 = (dtf.cena_folie_bm || 0) / 0.56;
  const dtfGlueM2 = (dtf.cena_lepidlo_kg || 0) * (dtf.spotreba_lepidlo_m2 || 0);
  const dtfCmykM2 = (dtf.cena_cmyk_kg || 0) * (dtf.spotreba_cmyk_m2 || 0);
  const dtfWhiteM2 = (dtf.cena_biela_kg || 0) * (dtf.spotreba_biela_m2 || 0);
  const dtfLaborM2 = (dtf.cena_prace_hod || 0) / ((dtf.rychlost_tlace_m_hod || 1) * 0.56);
  const vcDtfMetrazBm = (dtfFilmM2 + dtfGlueM2 + dtfCmykM2 + dtfWhiteM2 + dtfLaborM2) * 0.56;

  // DTF — potlac textilu (presne rovnaky vzorec ako vcDtf v CennikTab.jsx)
  const dtfMaterialM2 = dtfCmykM2 + dtfWhiteM2 + dtfGlueM2;
  const dtfGarmentPraca = ((dtf.cas_nazehlovania_min || 0) / 60) * (dtf.cena_prace_hod || 0);
  const vcDtfGarment = REF_PLOCHA_M2 * dtfMaterialM2 + (dtf.naklady_manipulacia || 0) + dtfGarmentPraca;

  // Vysivka
  const vysivkaRefKs = 10;
  const vcVysivka = (vysivka.cena_digitalizacia || 0) / vysivkaRefKs + (vysivka.cena_vysivky_cm2 || 0) * REF_PLOCHA_CM2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers3 className="text-indigo-400 h-5 w-5" /> Kostra cien — výrobné náklady</h2>
        <p className="text-xs text-slate-400 mt-1">Jediné miesto na zadanie surových výrobných nákladov (materiál, farby, fólie, práca) pre všetky technológie. Karty <strong className="text-slate-200">Metráže</strong> a <strong className="text-slate-200">Potlače</strong> odtiaľto živo ťahajú výrobnú cenu (VC) — nič sa tam už neduplikuje.</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950 rounded-xl border border-teal-900/40">
              <span className="text-xs font-bold text-teal-400 block mb-2">Variant: Metráž (rolka)</span>
              <Field label="Rýchlosť tlače+fixácie (bm/hod)" value={textilSub.rychlost_m_hod} step="1" onChange={(v) => ulozTextilSub({ rychlost_m_hod: v })} />
              <VysledokVC label="VC metráž" value={vcSublimaciaMetrazBm} unit="€/bm" />
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40">
              <span className="text-xs font-bold text-amber-400 block mb-2">Variant: Potlač na tričká</span>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Šírka papiera pre tričká (cm)" value={sublimaciaGarment.sirka_papiera_cm} step="1" onChange={(v) => ulozSublimaciaGarment({ sirka_papiera_cm: v })} />
                <Field label="Manipulácia strihania (€/ks)" value={sublimaciaGarment.naklady_manipulacia} step="0.01" onChange={(v) => ulozSublimaciaGarment({ naklady_manipulacia: v })} />
                <Field label="Ochranný papier pri lise (€/ks)" value={sublimaciaGarment.naklady_ochranny_papier} step="0.01" onChange={(v) => ulozSublimaciaGarment({ naklady_ochranny_papier: v })} />
                <Field label="Čas nažehlenia (min/ks)" value={sublimaciaGarment.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozSublimaciaGarment({ cas_nazehlovania_min: v })} />
                <Field label="Koeficient rizika (%, pokazené kusy)" value={sublimaciaGarment.koeficient_rizika_percent} step="1" onChange={(v) => ulozSublimaciaGarment({ koeficient_rizika_percent: v })} />
              </div>
              <VysledokVC label={`VC pri ${REF_PLOCHA_CM2}cm²`} value={vcSublimaciaGarment} unit="€/ks" />
            </div>
          </div>
        </div>
      </div>

      {/* REZANY TRANSFER */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">2. Rezaný transfer (fóliový vinyl)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-3">
          <Field label="Cena práce (€/hod)" value={rezany.cena_prace_hod} step="0.5" onChange={(v) => ulozRezany({ cena_prace_hod: v })} />
          <Field label="Čas rezania (min/ks)" value={rezany.cas_rezania_min} step="0.1" onChange={(v) => ulozRezany({ cas_rezania_min: v })} />
          <Field label="Čas vyľupovania (min/ks)" value={rezany.cas_vylupovania_min} step="0.1" onChange={(v) => ulozRezany({ cas_vylupovania_min: v })} />
          <Field label="Čas nažehlovania (min/ks)" value={rezany.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozRezany({ cas_nazehlovania_min: v })} />
          <Field label="Manipulácia (€/ks)" value={rezany.naklady_manipulacia} step="0.01" onChange={(v) => ulozRezany({ naklady_manipulacia: v })} />
        </div>
        <VysledokVC label="Práca + manipulácia spolu na 1 zákazku" value={rezanyPraca} unit="€/ks" />
        <div className="flex items-center justify-between mt-4 mb-2">
          <label className={labelCls}>Typy fólie — surový náklad materiálu (predajná sadzba sa nastavuje v karte Potlače)</label>
          <button onClick={pridajFoliu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať typ fólie</button>
        </div>
        <div className="space-y-2">
          {folie.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <input type="text" value={f.nazov} onChange={(e) => upravFoliu(f.id, { nazov: e.target.value })} className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <input type="number" step="0.0001" value={f.naklad_cm2 || 0} onChange={(e) => upravFoliu(f.id, { naklad_cm2: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> €/cm² náklad
              </div>
              <button onClick={() => zmazFoliu(f.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-teal-900/40">
            <span className="text-xs font-bold text-teal-400 block mb-2">Variant: Metráž (rolka, 56cm)</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cena PET fólie (€/bm)" value={dtf.cena_folie_bm} step="0.1" onChange={(v) => ulozDtf({ cena_folie_bm: v })} />
              <Field label="Rýchlosť tlače (m/hod)" value={dtf.rychlost_tlace_m_hod} step="0.5" onChange={(v) => ulozDtf({ rychlost_tlace_m_hod: v })} />
            </div>
            <VysledokVC label="VC metráž" value={vcDtfMetrazBm} unit="€/bm" />
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40">
            <span className="text-xs font-bold text-amber-400 block mb-2">Variant: Potlač textilu</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Manipulácia strihania (€/ks)" value={dtf.naklady_manipulacia} step="0.01" onChange={(v) => ulozDtf({ naklady_manipulacia: v })} />
              <Field label="Čas nažehlovania (min/ks)" value={dtf.cas_nazehlovania_min} step="0.1" onChange={(v) => ulozDtf({ cas_nazehlovania_min: v })} />
            </div>
            <VysledokVC label={`VC pri ${REF_PLOCHA_CM2}cm²`} value={vcDtfGarment} unit="€/ks" />
          </div>
        </div>
      </div>

      {/* SIETOTLAC */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">4. Sieťotlač</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4">
          <Field label="Cena farby (€/kg)" value={sietotlac.cena_farba_kg} step="0.5" onChange={(v) => ulozSietotlac({ cena_farba_kg: v })} />
          <Field label="Manipulácia (€/ks)" value={sietotlac.naklady_manipulacia} step="0.01" onChange={(v) => ulozSietotlac({ naklady_manipulacia: v })} />
          <Field label="Sito — náklad na zákazku (€)" value={sietotlac.naklad_sito_zakazka} step="0.5" onChange={(v) => ulozSietotlac({ naklad_sito_zakazka: v })} />
          <Field label="Čistiace prípravky (€/zákazku)" value={sietotlac.naklad_cistenie_zakazka} step="0.1" onChange={(v) => ulozSietotlac({ naklad_cistenie_zakazka: v })} />
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Formáty a spotreba farby (svetlý / tmavý textil = 1 vrstva / 2 vrstvy)</label>
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
      </div>

      {/* VYSIVKA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">5. Výšivka</h3>
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 max-w-md">
          <Field label="Cena digitalizácie motívu (€, jednorazovo)" value={vysivka.cena_digitalizacia} step="1" onChange={(v) => ulozVysivka({ cena_digitalizacia: v })} />
          <Field label="Cena od vyšívača (€/cm²)" value={vysivka.cena_vysivky_cm2} step="0.001" onChange={(v) => ulozVysivka({ cena_vysivky_cm2: v })} />
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Náhľad pri {REF_PLOCHA_CM2}cm² motíve a zákazke {vysivkaRefKs}ks (digitalizácia sa rozpočíta na počet kusov):</p>
        <VysledokVC label={`VC pri ${vysivkaRefKs}ks`} value={vcVysivka} unit="€/ks" />
      </div>
    </div>
  );
}
