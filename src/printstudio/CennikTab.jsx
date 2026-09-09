import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Banknote, Calculator, TrendingUp } from 'lucide-react';
import { vypocitajCenuPotlace } from './cenotvorba';

// Najde nasobok (marzu) pre dany pocet kusov v tabulke hladin — pouziva sa naprieč vsetkymi technologiami.
function najdiNasobok(hladiny, ks) {
  const h = (hladiny || []).find(h => ks >= h.min_ks && ks <= h.max_ks);
  return h ? h.nasobok : 1;
}

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

// Zhrnutie vysledku nakladovej kalkulacky — spolocne pre vsetky technologie.
function NakladovyVysledok({ vc, nasobok, predajna, plochaCm2, jednotka, onPouzit, disabled }) {
  const cenaCm2 = plochaCm2 > 0 ? predajna / plochaCm2 : 0;
  return (
    <div className="bg-slate-950 rounded-xl border border-indigo-900/40 p-4 mt-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div><span className="text-slate-500 block">Výrobná cena (VC)</span><span className="text-white font-bold">{vc.toFixed(3)} €/ks</span></div>
        <div><span className="text-slate-500 block">Násobok (marža)</span><span className="text-white font-bold">×{nasobok.toFixed(2)}</span></div>
        <div><span className="text-slate-500 block">Odporúčaná cena</span><span className="text-emerald-400 font-bold">{predajna.toFixed(2)} €/ks</span></div>
        <div><span className="text-slate-500 block">= sadzba</span><span className="text-emerald-400 font-bold">{cenaCm2.toFixed(4)} {jednotka || '€/cm²'}</span></div>
      </div>
      <button onClick={() => onPouzit(cenaCm2)} disabled={disabled} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Použiť ako predajnú sadzbu</button>
    </div>
  );
}

export default function CennikTab({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  const [sublimacia, setSublimacia] = useState({ cena_cm2: 0, min_cena: 0 });
  const [dtf, setDtf] = useState({ cena_cm2: 0, min_cena: 0 });
  const [sietotlac, setSietotlac] = useState({ cena_cm2: 0, cena_cm2_tmavy: 0, min_cena: 0, priplatok_farba: 0, cena_farba_kg: 0, naklady_manipulacia: 0 });
  const [rezany, setRezany] = useState({ min_cena: 0, cena_bm: 0, sirka_folie_cm: 50, sirka_vyuzitelna_cm: 49, naklady_manipulacia: 0, cas_nazehlovania_min: 0, cena_prace_hod: 0 });
  const [folie, setFolie] = useState([]);

  // Nakladove tabulky (nove)
  const [marzaHladiny, setMarzaHladiny] = useState([]);
  const [sublimaciaNaklady, setSublimaciaNaklady] = useState({ cena_papier_bm: 0, sirka_papiera_cm: 160, cena_farba_liter: 0, spotreba_farba_ml_m2: 0, naklady_manipulacia: 0, cas_nazehlovania_min: 0, cena_prace_hod: 0 });
  const [dtfNaklady, setDtfNaklady] = useState(null);
  const [sietotlacVelkosti, setSietotlacVelkosti] = useState([]);

  const [testTech, setTestTech] = useState('sublimacia');
  const [testW, setTestW] = useState(10);
  const [testH, setTestH] = useState(10);
  const [testKs, setTestKs] = useState(1);
  const [testFarby, setTestFarby] = useState(1);
  const [testTmavyTextil, setTestTmavyTextil] = useState(false);
  const [testFoliaId, setTestFoliaId] = useState(null);
  const [testVelkostId, setTestVelkostId] = useState(null);
  const [rezanyFoliaTarget, setRezanyFoliaTarget] = useState(null);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: tech }, { data: sieto }, { data: fol }, { data: rez }, { data: marza }, { data: subNak }, { data: dtfNak }, { data: sietoVel }] = await Promise.all([
      supabase.from('cennik_technologie').select('*'),
      supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_folie').select('*').order('id'),
      supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_marza_hladiny').select('*').order('poradie'),
      supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
    ]);
    const subRow = (tech || []).find(t => t.technologia === 'sublimacia');
    const dtfRow = (tech || []).find(t => t.technologia === 'dtf');
    if (subRow) setSublimacia({ cena_cm2: subRow.cena_cm2, min_cena: subRow.min_cena });
    if (dtfRow) setDtf({ cena_cm2: dtfRow.cena_cm2, min_cena: dtfRow.min_cena });
    if (sieto) setSietotlac({ cena_cm2: sieto.cena_cm2, cena_cm2_tmavy: sieto.cena_cm2_tmavy, min_cena: sieto.min_cena, priplatok_farba: sieto.priplatok_farba, cena_farba_kg: sieto.cena_farba_kg || 0, naklady_manipulacia: sieto.naklady_manipulacia || 0 });
    if (rez) setRezany({ min_cena: rez.min_cena, cena_bm: rez.cena_bm || 0, sirka_folie_cm: rez.sirka_folie_cm || 50, sirka_vyuzitelna_cm: rez.sirka_vyuzitelna_cm || 49, naklady_manipulacia: rez.naklady_manipulacia || 0, cas_nazehlovania_min: rez.cas_nazehlovania_min || 0, cena_prace_hod: rez.cena_prace_hod || 0 });
    setFolie(fol || []);
    if ((fol || []).length > 0) { setTestFoliaId(fol[0].id); setRezanyFoliaTarget(fol[0].id); }
    setMarzaHladiny(marza || []);
    if (subNak) setSublimaciaNaklady(subNak);
    setDtfNaklady(dtfNak || null);
    setSietotlacVelkosti(sietoVel || []);
    if ((sietoVel || []).length > 0) setTestVelkostId(sietoVel[0].id);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []);

  const ulozSublimacia = async (patch) => {
    const next = { ...sublimacia, ...patch };
    setSublimacia(next);
    await supabase.from('cennik_technologie').upsert({ technologia: 'sublimacia', ...next });
  };
  const ulozDtf = async (patch) => {
    const next = { ...dtf, ...patch };
    setDtf(next);
    await supabase.from('cennik_technologie').upsert({ technologia: 'dtf', ...next });
  };
  const ulozSietotlac = async (patch) => {
    const next = { ...sietotlac, ...patch };
    setSietotlac(next);
    await supabase.from('cennik_sietotlac').upsert({ id: 1, ...next });
  };
  const ulozRezany = async (patch) => {
    const next = { ...rezany, ...patch };
    setRezany(next);
    await supabase.from('cennik_rezany_transfer').upsert({ id: 1, ...next });
  };
  const ulozSublimaciaNaklady = async (patch) => {
    const next = { ...sublimaciaNaklady, ...patch };
    setSublimaciaNaklady(next);
    await supabase.from('cennik_sublimacia_naklady').upsert({ id: 1, ...next });
  };
  const ulozDtfNaklady = async (patch) => {
    const next = { ...(dtfNaklady || {}), ...patch };
    setDtfNaklady(next);
    await supabase.from('dtf_naklady').update(patch).eq('id', 1);
  };

  const pridajFoliu = async () => {
    const { data, error } = await supabase.from('cennik_folie').insert({ nazov: 'Nová fólia', cena_cm2: 0.15 }).select().single();
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

  // --- Marzovy matrix (spolocny) ---
  const pridajHladinu = async () => {
    const { data, error } = await supabase.from('cennik_marza_hladiny').insert({ min_ks: 1, max_ks: 1, nasobok: 2, poradie: marzaHladiny.length }).select().single();
    if (!error && data) setMarzaHladiny(h => [...h, data]);
  };
  const upravHladinu = async (id, patch) => {
    setMarzaHladiny(h => h.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('cennik_marza_hladiny').update(patch).eq('id', id);
  };
  const zmazHladinu = async (id) => {
    if (!window.confirm('Zmazať túto maržovú hladinu?')) return;
    setMarzaHladiny(h => h.filter(x => x.id !== id));
    await supabase.from('cennik_marza_hladiny').delete().eq('id', id);
  };

  // --- Sietotlac velkosti ---
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

  const cennikProKalkulacku = { sublimacia, dtf, sietotlac, folie, rezanyMinCena: rezany.min_cena };
  const plocha = Math.round((parseFloat(testW) || 0) * (parseFloat(testH) || 0) * 10) / 10;
  const ks = Math.max(1, parseInt(testKs) || 1);
  const nasobok = najdiNasobok(marzaHladiny, ks);
  const vysledok = vypocitajCenuPotlace(cennikProKalkulacku, testTech, plocha, parseInt(testFarby) || 1, testTmavyTextil, testFoliaId);

  // --- Nakladove vypocty (VC = vyrobna cena na 1ks pri referencnej velkosti/plose) ---
  const plochaM2 = plocha / 10000;

  const vcSublimacia = (() => {
    const n = sublimaciaNaklady;
    const sirkaM = (parseFloat(n.sirka_papiera_cm) || 0) / 100;
    const cenaPapierM2 = sirkaM > 0 ? (parseFloat(n.cena_papier_bm) || 0) / sirkaM : 0;
    const cenaFarbaM2 = ((parseFloat(n.cena_farba_liter) || 0) / 1000) * (parseFloat(n.spotreba_farba_ml_m2) || 0);
    const material = (cenaPapierM2 + cenaFarbaM2) * plochaM2;
    const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
    return material + (parseFloat(n.naklady_manipulacia) || 0) + praca;
  })();

  const vcDtf = dtfNaklady ? (() => {
    const n = dtfNaklady;
    const material = plochaM2 * (
      (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
      (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
      (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0)
    );
    const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
    return material + (parseFloat(n.naklady_manipulacia) || 0) + praca;
  })() : 0;

  const vybranaVelkost = sietotlacVelkosti.find(v => v.id === testVelkostId);
  const vcSietotlac = vybranaVelkost ? (() => {
    const gramaz = testTmavyTextil ? vybranaVelkost.spotreba_g_tmavy : vybranaVelkost.spotreba_g_svetly;
    const material = ((parseFloat(sietotlac.cena_farba_kg) || 0) / 1000) * (parseFloat(gramaz) || 0);
    return material + (parseFloat(sietotlac.naklady_manipulacia) || 0);
  })() : 0;
  const plochaSietotlacCm2 = vybranaVelkost ? (parseFloat(vybranaVelkost.sirka_cm) || 0) * (parseFloat(vybranaVelkost.vyska_cm) || 0) : 0;

  const vcRezany = (() => {
    const sirkaVyuzM = (parseFloat(rezany.sirka_vyuzitelna_cm) || 0) / 100;
    const cenaM2 = sirkaVyuzM > 0 ? (parseFloat(rezany.cena_bm) || 0) / sirkaVyuzM : 0;
    const cenaCm2 = cenaM2 / 10000;
    const material = plocha * cenaCm2;
    const praca = ((parseFloat(rezany.cas_nazehlovania_min) || 0) / 60) * (parseFloat(rezany.cena_prace_hod) || 0);
    return { vc: material + (parseFloat(rezany.naklady_manipulacia) || 0) + praca, cenaM2, cenaCm2 };
  })();

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-indigo-400 h-5 w-5" /> Cenník potlače</h2>
        <p className="text-xs text-slate-400 mt-1">Predajné sadzby nižšie sú tie, ktoré reálne používa zákaznícky konfigurátor. Pri každej technológii je aj nákladová kalkulačka — vyplň v nej materiál/prácu, over si výsledok a jedným klikom ho použi ako novú predajnú sadzbu.</p>
      </div>

      {/* SPOLOCNE VSTUPY PRE NAKLADOVU KALKULACKU */}
      <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Referenčná objednávka (pre nákladové kalkulačky nižšie)</h3>
        <p className="text-xs text-slate-400 mb-3">Toto je veľkosť a počet kusov, pre ktoré si nižšie vieš pozrieť odporúčanú cenu pri každej technológii.</p>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <div><label className={labelCls}>Šírka (cm)</label><input type="number" value={testW} onChange={(e) => setTestW(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Výška (cm)</label><input type="number" value={testH} onChange={(e) => setTestH(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Počet ks</label><input type="number" min="1" value={testKs} onChange={(e) => setTestKs(e.target.value)} className={inputCls} /></div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Plocha: <strong className="text-white">{plocha} cm²</strong> • Marža pri {ks} ks: <strong className="text-white">×{nasobok.toFixed(2)}</strong></p>
      </div>

      {/* MARZOVY MATRIX */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-sm text-white">Maržový matrix (spoločný pre všetky technológie)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Násobok sa aplikuje na výrobnú cenu podľa počtu kusov v objednávke (napr. VC 1 € × 4,0 = 4 € pri 1 ks).</p>
          </div>
          <button onClick={pridajHladinu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> Pridať hladinu</button>
        </div>
        <div className="space-y-1.5">
          {marzaHladiny.map(h => (
            <div key={h.id} className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 w-10">od</span>
              <input type="number" value={h.min_ks} onChange={(e) => upravHladinu(h.id, { min_ks: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" />
              <span className="text-slate-500 w-10">do</span>
              <input type="number" value={h.max_ks} onChange={(e) => upravHladinu(h.id, { max_ks: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" />
              <span className="text-slate-500">ks → násobok</span>
              <input type="number" step="0.1" value={h.nasobok} onChange={(e) => upravHladinu(h.id, { nasobok: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-white" />
              <button onClick={() => zmazHladinu(h.id)} className="text-slate-500 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {marzaHladiny.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne hladiny — kým nejaké pridáš, násobok bude vždy ×1.</p>}
        </div>
      </div>

      {/* SUBLIMÁCIA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sublimácia</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = plocha (cm²) × sadzba (min. cena úkonu).</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div><label className={labelCls}>Predajná sadzba (€/cm²)</label><input type="number" step="0.001" value={sublimacia.cena_cm2} onChange={(e) => ulozSublimacia({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={sublimacia.min_cena} onChange={(e) => ulozSublimacia({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Nákladová kalkulačka — papier, farba, práca</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Cena papiera (€/bm)</label><input type="number" step="0.01" value={sublimaciaNaklady.cena_papier_bm} onChange={(e) => ulozSublimaciaNaklady({ cena_papier_bm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Šírka papiera (cm)</label><input type="number" step="1" value={sublimaciaNaklady.sirka_papiera_cm} onChange={(e) => ulozSublimaciaNaklady({ sirka_papiera_cm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Cena farby (€/liter)</label><input type="number" step="0.01" value={sublimaciaNaklady.cena_farba_liter} onChange={(e) => ulozSublimaciaNaklady({ cena_farba_liter: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Spotreba farby (ml/m²)</label><input type="number" step="0.1" value={sublimaciaNaklady.spotreba_farba_ml_m2} onChange={(e) => ulozSublimaciaNaklady({ spotreba_farba_ml_m2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Manipulácia (€/ks)</label><input type="number" step="0.01" value={sublimaciaNaklady.naklady_manipulacia} onChange={(e) => ulozSublimaciaNaklady({ naklady_manipulacia: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Čas nažehľovania (min/ks)</label><input type="number" step="0.1" value={sublimaciaNaklady.cas_nazehlovania_min} onChange={(e) => ulozSublimaciaNaklady({ cas_nazehlovania_min: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Cena práce (€/hod)</label><input type="number" step="0.5" value={sublimaciaNaklady.cena_prace_hod} onChange={(e) => ulozSublimaciaNaklady({ cena_prace_hod: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          </div>
          <NakladovyVysledok vc={vcSublimacia} nasobok={nasobok} predajna={vcSublimacia * nasobok} plochaCm2={plocha} onPouzit={(cena) => ulozSublimacia({ cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0} />
        </div>
      </div>

      {/* DTF */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Digitálny transfer (DTF)</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = plocha (cm²) × sadzba (min. cena úkonu).</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div><label className={labelCls}>Predajná sadzba (€/cm²)</label><input type="number" step="0.001" value={dtf.cena_cm2} onChange={(e) => ulozDtf({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={dtf.min_cena} onChange={(e) => ulozDtf({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Nákladová kalkulačka — ťahá materiály z modulu DTF metráž</h4>
          {!dtfNaklady ? (
            <p className="text-xs text-amber-400">Modul DTF metráž ešte nemá vyplnené náklady (PrintStudio Pro → DTF metráž → Náklady).</p>
          ) : (
            <>
              <p className="text-[11px] text-slate-500 mb-2">CMYK {dtfNaklady.spotreba_cmyk_m2} kg/m² @ {dtfNaklady.cena_cmyk_kg} €/kg • Biela {dtfNaklady.spotreba_biela_m2} kg/m² @ {dtfNaklady.cena_biela_kg} €/kg • Lepidlo {dtfNaklady.spotreba_lepidlo_m2} kg/m² @ {dtfNaklady.cena_lepidlo_kg} €/kg (uprav v DTF metráž → Náklady)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className={labelCls}>Manipulácia (€/ks)</label><input type="number" step="0.01" value={dtfNaklady.naklady_manipulacia || 0} onChange={(e) => ulozDtfNaklady({ naklady_manipulacia: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Čas nažehľovania (min/ks)</label><input type="number" step="0.1" value={dtfNaklady.cas_nazehlovania_min || 0} onChange={(e) => ulozDtfNaklady({ cas_nazehlovania_min: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                <div><label className={labelCls}>Cena práce (€/hod)</label><input type="number" step="0.5" value={dtfNaklady.cena_prace_hod || 0} onChange={(e) => ulozDtfNaklady({ cena_prace_hod: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
              </div>
              <NakladovyVysledok vc={vcDtf} nasobok={nasobok} predajna={vcDtf * nasobok} plochaCm2={plocha} onPouzit={(cena) => ulozDtf({ cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0} />
            </>
          )}
        </div>
      </div>

      {/* SIEŤOTLAČ */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sieťotlač</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = základ (plocha × sadzba, min. cena) + príplatok za každú ďalšiu farbu. Tmavý textil má vlastnú (vyššiu) sadzbu.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          <div><label className={labelCls}>Sadzba — svetlý (€/cm²)</label><input type="number" step="0.001" value={sietotlac.cena_cm2} onChange={(e) => ulozSietotlac({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Sadzba — tmavý (€/cm²)</label><input type="number" step="0.001" value={sietotlac.cena_cm2_tmavy} onChange={(e) => ulozSietotlac({ cena_cm2_tmavy: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={sietotlac.min_cena} onChange={(e) => ulozSietotlac({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Príplatok za ďalšiu farbu (€)</label><input type="number" step="0.1" value={sietotlac.priplatok_farba} onChange={(e) => ulozSietotlac({ priplatok_farba: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Nákladová kalkulačka — spotreba farby podľa veľkosti</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 max-w-lg">
            <div><label className={labelCls}>Cena farby (€/kg)</label><input type="number" step="0.5" value={sietotlac.cena_farba_kg} onChange={(e) => ulozSietotlac({ cena_farba_kg: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Manipulácia (€/ks)</label><input type="number" step="0.01" value={sietotlac.naklady_manipulacia} onChange={(e) => ulozSietotlac({ naklady_manipulacia: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls}>Spotreba (g) podľa veľkosti</label>
            <button onClick={pridajVelkost} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať veľkosť</button>
          </div>
          <div className="space-y-1.5 mb-3">
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
            {sietotlacVelkosti.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne veľkosti.</p>}
          </div>
          {sietotlacVelkosti.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <div>
                  <label className={labelCls}>Veľkosť pre výpočet</label>
                  <select value={testVelkostId || ''} onChange={(e) => setTestVelkostId(parseInt(e.target.value))} className={`${inputCls} w-48`}>
                    {sietotlacVelkosti.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button onClick={() => setTestTmavyTextil(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${!testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Svetlý</button>
                  <button onClick={() => setTestTmavyTextil(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Tmavý</button>
                </div>
              </div>
              <NakladovyVysledok vc={vcSietotlac} nasobok={nasobok} predajna={vcSietotlac * nasobok} plochaCm2={plochaSietotlacCm2} onPouzit={(cena) => ulozSietotlac(testTmavyTextil ? { cena_cm2_tmavy: Number(cena.toFixed(4)) } : { cena_cm2: Number(cena.toFixed(4)) })} disabled={plochaSietotlacCm2 === 0} />
            </>
          )}
        </div>
      </div>

      {/* REZANÝ TRANSFER */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Rezaný transfer (fóliový vinyl)</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = plocha (cm²) × sadzba fólie × počet farieb (min. cena úkonu).</p>
        <div className="max-w-xs mb-3">
          <label className={labelCls}>Minimálna cena úkonu (€)</label>
          <input type="number" step="0.1" value={rezany.min_cena} onChange={(e) => ulozRezany({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} />
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Typy fólie a ich predajná sadzba (€/cm²)</label>
          <button onClick={pridajFoliu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať typ fólie</button>
        </div>
        <div className="space-y-2">
          {folie.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <input type="text" value={f.nazov} onChange={(e) => upravFoliu(f.id, { nazov: e.target.value })} className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <input type="number" step="0.001" value={f.cena_cm2} onChange={(e) => upravFoliu(f.id, { cena_cm2: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> €/cm²
              </div>
              <button onClick={() => zmazFoliu(f.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {folie.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne typy fólie.</p>}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Nákladová kalkulačka — cena za bežný meter</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Cena fólie (€/bm)</label><input type="number" step="0.01" value={rezany.cena_bm} onChange={(e) => ulozRezany({ cena_bm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Šírka fólie — nominálna (cm)</label><input type="number" step="1" value={rezany.sirka_folie_cm} onChange={(e) => ulozRezany({ sirka_folie_cm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Šírka — reálne využiteľná (cm)</label><input type="number" step="1" value={rezany.sirka_vyuzitelna_cm} onChange={(e) => ulozRezany({ sirka_vyuzitelna_cm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Manipulácia (€/ks)</label><input type="number" step="0.01" value={rezany.naklady_manipulacia} onChange={(e) => ulozRezany({ naklady_manipulacia: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Čas nažehľovania (min/ks)</label><input type="number" step="0.1" value={rezany.cas_nazehlovania_min} onChange={(e) => ulozRezany({ cas_nazehlovania_min: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
            <div><label className={labelCls}>Cena práce (€/hod)</label><input type="number" step="0.5" value={rezany.cena_prace_hod} onChange={(e) => ulozRezany({ cena_prace_hod: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">→ {vcRezany.cenaM2.toFixed(2)} €/m² • {vcRezany.cenaCm2.toFixed(5)} €/cm² (len materiál, pri {rezany.sirka_vyuzitelna_cm} cm využiteľnej šírky)</p>
          {folie.length > 0 && (
            <div className="mt-2 max-w-xs">
              <label className={labelCls}>Zapísať výsledok do fólie</label>
              <select value={rezanyFoliaTarget || ''} onChange={(e) => setRezanyFoliaTarget(parseInt(e.target.value))} className={inputCls}>
                {folie.map(f => <option key={f.id} value={f.id}>{f.nazov}</option>)}
              </select>
            </div>
          )}
          <NakladovyVysledok vc={vcRezany.vc} nasobok={nasobok} predajna={vcRezany.vc * nasobok} plochaCm2={plocha} onPouzit={(cena) => rezanyFoliaTarget && upravFoliu(rezanyFoliaTarget, { cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0 || !rezanyFoliaTarget} />
        </div>
      </div>

      {/* TESTOVACIA KALKULAČKA (predajnych cien) */}
      <div className="bg-slate-950 rounded-2xl p-5 border border-indigo-900/40">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Testovacia kalkulačka predajnej ceny</h3>
        <p className="text-xs text-slate-400 mb-4">Over si, akú cenu dostane zákazník pri aktuálne nastavených predajných sadzbách (používa rovnakú referenčnú veľkosť ako vyššie).</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400">Technológia</label>
            <select value={testTech} onChange={(e) => setTestTech(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              <option value="sublimacia">Sublimácia</option>
              <option value="dtf">Digitálny transfer</option>
              <option value="sietotlac">Sieťotlač</option>
              <option value="rezany">Rezaný transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Počet farieb</label>
            <input type="number" min="1" value={testFarby} onChange={(e) => setTestFarby(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          {testTech === 'rezany' && (
            <div>
              <label className="text-xs text-slate-400">Typ fólie</label>
              <select value={testFoliaId || ''} onChange={(e) => setTestFoliaId(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
                {folie.map(f => <option key={f.id} value={f.id}>{f.nazov} ({f.cena_cm2.toFixed(2)} €/cm²)</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Plocha: <span className="text-white font-semibold">{plocha} cm²</span>
            <span className="block mt-0.5">{vysledok.vzorec}</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">{vysledok.cena.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  );
}
