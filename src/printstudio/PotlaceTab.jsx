import React, { useEffect, useState } from 'react';
import { Banknote, Calculator, TrendingUp } from 'lucide-react';
import { vypocitajCenuPotlace } from './cenotvorba';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';
import { vcSublimaciaGarment as vcSublimaciaGarmentZo, vcDtfGarment as vcDtfGarmentZo, vcVysivka as vcVysivkaZo, nakladFarbySietotlac, vcSietotlacZaklad, plochaFormatuSietotlac, vcRezanyTransfer as vcRezanyTransferZo } from './vyrobneNaklady';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';
const kostraNoteCls = 'text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 mb-3';

// Zhrnutie vysledku nakladovej kalkulacky — spolocne pre vsetky technologie. Marza sa berie
// z jednotneho maržového modulu (záložka "Cenotvorba" v PrintStudio Pro), nie z vlastneho nastavenia.
function NakladovyVysledok({ vc, ks, config, plochaCm2, jednotka, onPouzit, disabled }) {
  const predajna = priceAt(vc, ks, config);
  const marza = marginAt(vc, ks, config);
  const cenaCm2 = plochaCm2 > 0 ? predajna / plochaCm2 : 0;
  return (
    <div className="bg-slate-950 rounded-xl border border-indigo-900/40 p-4 mt-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div><span className="text-slate-500 block">Výrobná cena (VC)</span><span className="text-white font-bold">{vc.toFixed(3)} €/ks</span></div>
        <div><span className="text-slate-500 block">Marža</span><span className="text-white font-bold">{marza.toFixed(0)} %</span></div>
        <div><span className="text-slate-500 block">Odporúčaná cena</span><span className="text-emerald-400 font-bold">{predajna.toFixed(2)} €/ks</span></div>
        <div><span className="text-slate-500 block">= sadzba</span><span className="text-emerald-400 font-bold">{cenaCm2.toFixed(4)} {jednotka || '€/cm²'}</span></div>
      </div>
      <button onClick={() => onPouzit(cenaCm2)} disabled={disabled} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Použiť ako predajnú sadzbu</button>
    </div>
  );
}

export default function PotlaceTab({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  const [sublimacia, setSublimacia] = useState({ cena_cm2: 0, min_cena: 0 });
  const [dtf, setDtf] = useState({ cena_cm2: 0, min_cena: 0 });
  const [vysivka, setVysivka] = useState({ cena_cm2: 0, min_cena: 0 });
  const [sietotlac, setSietotlac] = useState({ cena_cm2: 0, cena_cm2_tmavy: 0, min_cena: 0, priplatok_farba: 0, cena_farba_kg: 0, naklady_manipulacia: 0, naklad_sito_zakazka: 0, naklad_cistenie_zakazka: 0, odporucany_min_ks: 30 });
  const [rezany, setRezany] = useState({ min_cena: 0, cena_prace_hod: 0, cas_rezania_min: 0, cas_vylupovania_min: 0, cas_nazehlovania_min: 0, naklady_manipulacia: 0, sirka_vyuzitelna_cm: 49 });
  const [folie, setFolie] = useState([]);

  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [textilSub, setTextilSub] = useState(null);
  const [sublimaciaGarment, setSublimaciaGarment] = useState(null);
  const [dtfNaklady, setDtfNaklady] = useState(null);
  const [vysivkaNaklady, setVysivkaNaklady] = useState(null);
  const [sietotlacVelkosti, setSietotlacVelkosti] = useState([]);

  const [testTech, setTestTech] = useState('sublimacia');
  const [testW, setTestW] = useState(10);
  const [testH, setTestH] = useState(10);
  const [testKs, setTestKs] = useState(1);
  const [testFarby, setTestFarby] = useState(1);
  const [testTmavyTextil, setTestTmavyTextil] = useState(false);
  const [testFoliaId, setTestFoliaId] = useState(null);
  const [testVelkostId, setTestVelkostId] = useState(null);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: tech }, { data: sieto }, { data: fol }, { data: rez }, { data: cfg }, { data: tSub }, { data: sGarment }, { data: dtfNak }, { data: vysNak }, { data: sietoVel }] = await Promise.all([
      supabase.from('cennik_technologie').select('*'),
      supabase.from('cennik_sietotlac').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_folie').select('*').order('id'),
      supabase.from('cennik_rezany_transfer').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('textil_naklady').select('*').eq('technologia', 'sublimacia').maybeSingle(),
      supabase.from('cennik_sublimacia_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('kostra_vysivka').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_sietotlac_velkosti').select('*').order('poradie'),
    ]);
    const subRow = (tech || []).find(t => t.technologia === 'sublimacia');
    const dtfRow = (tech || []).find(t => t.technologia === 'dtf');
    const vysRow = (tech || []).find(t => t.technologia === 'vysivka');
    if (subRow) setSublimacia({ cena_cm2: subRow.cena_cm2, min_cena: subRow.min_cena });
    if (dtfRow) setDtf({ cena_cm2: dtfRow.cena_cm2, min_cena: dtfRow.min_cena });
    if (vysRow) setVysivka({ cena_cm2: vysRow.cena_cm2, min_cena: vysRow.min_cena });
    if (sieto) setSietotlac({ cena_cm2: sieto.cena_cm2, cena_cm2_tmavy: sieto.cena_cm2_tmavy, min_cena: sieto.min_cena, priplatok_farba: sieto.priplatok_farba, cena_farba_kg: sieto.cena_farba_kg || 0, naklady_manipulacia: sieto.naklady_manipulacia || 0, naklad_sito_zakazka: sieto.naklad_sito_zakazka || 0, naklad_cistenie_zakazka: sieto.naklad_cistenie_zakazka || 0, odporucany_min_ks: sieto.odporucany_min_ks || 30 });
    if (rez) setRezany({ min_cena: rez.min_cena, cena_prace_hod: rez.cena_prace_hod || 0, cas_rezania_min: rez.cas_rezania_min || 0, cas_vylupovania_min: rez.cas_vylupovania_min || 0, cas_nazehlovania_min: rez.cas_nazehlovania_min || 0, naklady_manipulacia: rez.naklady_manipulacia || 0, sirka_vyuzitelna_cm: rez.sirka_vyuzitelna_cm || 49 });
    setFolie(fol || []);
    if ((fol || []).length > 0) setTestFoliaId(fol[0].id);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setTextilSub(tSub || null);
    setSublimaciaGarment(sGarment || null);
    setDtfNaklady(dtfNak || null);
    setVysivkaNaklady(vysNak || null);
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
  const ulozVysivka = async (patch) => {
    const next = { ...vysivka, ...patch };
    setVysivka(next);
    await supabase.from('cennik_technologie').upsert({ technologia: 'vysivka', ...next });
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
  const upravFoliu = async (id, patch) => {
    setFolie(f => f.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('cennik_folie').update(patch).eq('id', id);
  };

  const cennikProKalkulacku = { sublimacia, dtf, sietotlac, folie, rezanyMinCena: rezany.min_cena };
  const plocha = Math.round((parseFloat(testW) || 0) * (parseFloat(testH) || 0) * 10) / 10;
  const ks = Math.max(1, parseInt(testKs) || 1);
  const vysledok = vypocitajCenuPotlace(cennikProKalkulacku, testTech, plocha, parseInt(testFarby) || 1, testTmavyTextil, testFoliaId);

  // --- Vyrobne ceny (VC) — vzorce zdielane s Cenovymi ponukami cez vyrobneNaklady.js, nic sa tu
  // uz nezaduva duplicitne (viackrat sposobilo nezhodu cien medzi appkami).
  const kostraLive = { textilSub, sublimaciaGarment, dtf: dtfNaklady, sietotlac, sietotlacVelkosti, rezany, folie, vysivkaNaklady };

  const vcSublimacia = vcSublimaciaGarmentZo(kostraLive, plocha);
  const vcDtf = vcDtfGarmentZo(kostraLive, plocha);
  const vcVysivka = vcVysivkaZo(kostraLive, plocha, ks);

  const vybranaVelkost = sietotlacVelkosti.find(v => v.id === testVelkostId);
  const pocetFariebSiet = Math.max(1, parseInt(testFarby) || 1);
  const sietotlacFarbyRozpad = vybranaVelkost ? Array.from({ length: pocetFariebSiet }, (_, i) => nakladFarbySietotlac(kostraLive, testVelkostId, testTmavyTextil, i + 1)) : [];
  // VC pre zakladnu predajnu sadzbu (cena_cm2) je vzdy len za 1. farbu — dalsie farby sa predavaju
  // cez samostatny "priplatok za farbu" nizsie, nie namiesane do zakladnej sadzby.
  const vcSietotlac = vybranaVelkost ? vcSietotlacZaklad(kostraLive, testVelkostId, testTmavyTextil) : 0;
  const navrhPriplatokFarbaVC = vybranaVelkost ? nakladFarbySietotlac(kostraLive, testVelkostId, testTmavyTextil, 2).spolu : 0;
  const plochaSietotlacCm2 = plochaFormatuSietotlac(kostraLive, testVelkostId);

  const vcRezany = vcRezanyTransferZo(kostraLive, testFoliaId, plocha);

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-indigo-400 h-5 w-5" /> Potlače (predajné sadzby)</h2>
        <p className="text-xs text-slate-400 mt-1">Predajné sadzby nižšie sú tie, ktoré reálne používa zákaznícky konfigurátor. Výrobné náklady sa zadávajú v karte <strong className="text-slate-200">Kostra cien</strong> — tu len over výsledok a jedným klikom ho použi ako novú predajnú sadzbu.</p>
      </div>

      {/* SPOLOCNE VSTUPY PRE NAKLADOVU KALKULACKU */}
      <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Referenčná objednávka (pre nákladové kalkulačky nižšie)</h3>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          <div><label className={labelCls}>Šírka (cm)</label><input type="number" value={testW} onChange={(e) => setTestW(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Výška (cm)</label><input type="number" value={testH} onChange={(e) => setTestH(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Počet ks</label><input type="number" min="1" value={testKs} onChange={(e) => setTestKs(e.target.value)} className={inputCls} /></div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Plocha: <strong className="text-white">{plocha} cm²</strong> • Marža sa nastavuje v záložke <strong className="text-white">Cenotvorba</strong>.</p>
      </div>

      {/* SUBLIMÁCIA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sublimácia</h3>
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <div><label className={labelCls}>Predajná sadzba (€/cm²)</label><input type="number" step="0.001" value={sublimacia.cena_cm2} onChange={(e) => ulozSublimacia({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={sublimacia.min_cena} onChange={(e) => ulozSublimacia({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>
        <p className={kostraNoteCls}>Výrobné náklady sa berú živo z <strong>Kostra cien → Sublimácia → Potlač na tričká</strong>.</p>
        <NakladovyVysledok vc={vcSublimacia} ks={ks} config={pricingConfig} plochaCm2={plocha} onPouzit={(cena) => ulozSublimacia({ cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0} />
      </div>

      {/* DTF */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Digitálny transfer (DTF)</h3>
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <div><label className={labelCls}>Predajná sadzba (€/cm²)</label><input type="number" step="0.001" value={dtf.cena_cm2} onChange={(e) => ulozDtf({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={dtf.min_cena} onChange={(e) => ulozDtf({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>
        {!dtfNaklady ? (
          <p className="text-xs text-amber-400">Výrobné náklady DTF ešte nie sú vyplnené (Kostra cien → DTF).</p>
        ) : (
          <>
            <p className={kostraNoteCls}>Výrobné náklady sa berú živo z <strong>Kostra cien → DTF → Potlač textilu</strong>.</p>
            <NakladovyVysledok vc={vcDtf} ks={ks} config={pricingConfig} plochaCm2={plocha} onPouzit={(cena) => ulozDtf({ cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0} />
          </>
        )}
      </div>

      {/* SIEŤOTLAČ */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Sieťotlač</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = základ (plocha × sadzba, min. cena) + príplatok za každú ďalšiu farbu. Tmavý textil má vlastnú (vyššiu) sadzbu.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-3">
          <div><label className={labelCls}>Sadzba — svetlý (€/cm²)</label><input type="number" step="0.001" value={sietotlac.cena_cm2} onChange={(e) => ulozSietotlac({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Sadzba — tmavý (€/cm²)</label><input type="number" step="0.001" value={sietotlac.cena_cm2_tmavy} onChange={(e) => ulozSietotlac({ cena_cm2_tmavy: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={sietotlac.min_cena} onChange={(e) => ulozSietotlac({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Príplatok za ďalšiu farbu (€)</label><input type="number" step="0.1" value={sietotlac.priplatok_farba} onChange={(e) => ulozSietotlac({ priplatok_farba: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>
        <p className="text-[11px] text-slate-500 mb-2">💡 Odporúčaná minimálna zákazka: <strong className="text-slate-300">{sietotlac.odporucany_min_ks} ks</strong> (menšie objednávky sú možné, len drahšie na kus kvôli sitám — nastavuje sa v Kostra cien).</p>
        <p className={kostraNoteCls}>Cena farby, manipulácia, sito a formáty sa nastavujú v <strong>Kostra cien → Sieťotlač</strong>.</p>
        {sietotlacVelkosti.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <div>
                <label className={labelCls}>Formát pre výpočet</label>
                <select value={testVelkostId || ''} onChange={(e) => setTestVelkostId(parseInt(e.target.value))} className={`${inputCls} w-48`}>
                  {sietotlacVelkosti.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setTestTmavyTextil(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${!testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Svetlý</button>
                <button onClick={() => setTestTmavyTextil(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${testTmavyTextil ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Tmavý</button>
              </div>
              <div>
                <label className={labelCls}>Počet farieb</label>
                <input type="number" min="1" value={testFarby} onChange={(e) => setTestFarby(e.target.value)} className={`${inputCls} w-24`} />
              </div>
            </div>
            <NakladovyVysledok vc={vcSietotlac} ks={ks} config={pricingConfig} plochaCm2={plochaSietotlacCm2} onPouzit={(cena) => ulozSietotlac(testTmavyTextil ? { cena_cm2_tmavy: Number(cena.toFixed(4)) } : { cena_cm2: Number(cena.toFixed(4)) })} disabled={plochaSietotlacCm2 === 0} />
            <p className="text-[11px] text-slate-500 mt-2">VC vyššie je len za <strong>1. farbu</strong> (základná predajná sadzba). Rozpad nižšie pri {pocetFariebSiet} {pocetFariebSiet === 1 ? 'farbe' : 'farbách'} (nastav "Počet farieb" v referenčnej objednávke hore) ukazuje, koľko stojí každá ďalšia farba — spotreba farby klesá o 20% na farbu, sito sa počíta za každú znova:</p>
            <div className="bg-slate-950 rounded-xl border border-indigo-900/40 p-3 mt-1 space-y-1 text-xs">
              {sietotlacFarbyRozpad.map(r => (
                <div key={r.n} className="flex items-center justify-between text-slate-400">
                  <span>{r.n}. farba ({r.gramaz.toFixed(2)}g)</span>
                  <span className="text-white font-mono">{r.sitoCena.toFixed(2)}€ sito + {r.farbaCena.toFixed(3)}€ farba = {r.spolu.toFixed(3)}€</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                <span className="text-slate-300 font-semibold">Návrh predajnej ceny za 2. farbu (s maržou)</span>
                <span className="text-emerald-400 font-bold">{priceAt(navrhPriplatokFarbaVC, ks, pricingConfig).toFixed(2)} €</span>
              </div>
              <button onClick={() => ulozSietotlac({ priplatok_farba: Number(priceAt(navrhPriplatokFarbaVC, ks, pricingConfig).toFixed(2)) })} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-1.5 rounded-lg mt-1">Použiť ako príplatok za farbu</button>
            </div>
          </>
        )}
      </div>

      {/* REZANÝ TRANSFER */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Rezaný transfer (fóliový vinyl)</h3>
        <p className="text-xs text-slate-400 mb-3">Predajná cena = plocha (cm²) × sadzba fólie × počet farieb (min. cena úkonu).</p>
        <div className="max-w-xs mb-3">
          <label className={labelCls}>Minimálna cena úkonu (€)</label>
          <input type="number" step="0.1" value={rezany.min_cena} onChange={(e) => ulozRezany({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} />
        </div>
        <p className={kostraNoteCls}>Časy rezania/vyľupovania/nažehlovania, manipulácia a náklad materiálu na typ fólie sa nastavujú v <strong>Kostra cien → Rezaný transfer</strong>. Tu len nastav predajnú sadzbu (€/cm²) pre každý typ:</p>
        <div className="space-y-2 mb-4">
          {folie.map(f => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300">{f.nazov}</span>
              <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                <input type="number" step="0.001" value={f.cena_cm2} onChange={(e) => upravFoliu(f.id, { cena_cm2: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /> €/cm² predaj
              </div>
            </div>
          ))}
          {folie.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne typy fólie (pridaj v Kostra cien).</p>}
        </div>
        {folie.length > 0 && (
          <div className="mb-3 max-w-xs">
            <label className={labelCls}>Typ fólie pre výpočet</label>
            <select value={testFoliaId || ''} onChange={(e) => setTestFoliaId(parseInt(e.target.value))} className={inputCls}>
              {folie.map(f => <option key={f.id} value={f.id}>{f.nazov}</option>)}
            </select>
          </div>
        )}
        <NakladovyVysledok vc={vcRezany} ks={ks} config={pricingConfig} plochaCm2={plocha} onPouzit={(cena) => testFoliaId && upravFoliu(testFoliaId, { cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0 || !testFoliaId} />
      </div>

      {/* VÝŠIVKA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Výšivka</h3>
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <div><label className={labelCls}>Predajná sadzba (€/cm²)</label><input type="number" step="0.001" value={vysivka.cena_cm2} onChange={(e) => ulozVysivka({ cena_cm2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
          <div><label className={labelCls}>Minimálna cena úkonu (€)</label><input type="number" step="0.1" value={vysivka.min_cena} onChange={(e) => ulozVysivka({ min_cena: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        </div>
        {!vysivkaNaklady ? (
          <p className="text-xs text-amber-400">Výrobné náklady výšivky ešte nie sú vyplnené (Kostra cien → Výšivka).</p>
        ) : (
          <>
            <p className={kostraNoteCls}>Cena digitalizácie a cena od vyšívača sa nastavujú v <strong>Kostra cien → Výšivka</strong>.</p>
            <NakladovyVysledok vc={vcVysivka} ks={ks} config={pricingConfig} plochaCm2={plocha} onPouzit={(cena) => ulozVysivka({ cena_cm2: Number(cena.toFixed(4)) })} disabled={plocha === 0} />
          </>
        )}
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
                {folie.map(f => <option key={f.id} value={f.id}>{f.nazov} ({Number(f.cena_cm2).toFixed(2)} €/cm²)</option>)}
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
