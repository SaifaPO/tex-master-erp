import React, { useEffect, useState } from 'react';
import { Ruler, Calculator } from 'lucide-react';
import { vypocitajCenuVlajky } from './vlajkaCenotvorba';
import { mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';
import NumberInput from '../NumberInput';

export default function VlajkaVelkostiTab({ supabase }) {
  const [velkosti, setVelkosti] = useState([]);
  const [tvary, setTvary] = useState([]); // kazdy tvar so svojimi rozmermi (rozmer plachty + vyska od zeme PER TVAR a velkost)
  const [materialy, setMaterialy] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [nastavenia, setNastavenia] = useState({ dph_percent: 23, expresny_priplatok_percent: 10 });
  const [nakladBmSublimacia, setNakladBmSublimacia] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Rovnaka nominalna sirka, na akej je kalibrovany naklad_bm sublimacie, ako v Edge Functions
  // (beachflag-price-preview) a v Textilnej metrazi — prevod EUR/bm na EUR/m2.
  const SUBLIMACIA_ROLL_WIDTH_CM = 160;
  const nakladM2Sublimacia = nakladBmSublimacia / (SUBLIMACIA_ROLL_WIDTH_CM / 100);

  const [testVelkostId, setTestVelkostId] = useState(null);
  const [testMaterialId, setTestMaterialId] = useState(null);
  const [testSpotreba, setTestSpotreba] = useState('0.35');
  const [testExpres, setTestExpres] = useState(false);
  const [testKs, setTestKs] = useState(1);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: v }, { data: m }, { data: n }, { data: cfg }, { data: tn }, { data: t }] = await Promise.all([
      supabase.from('vlajka_velkosti').select('*').order('poradie').order('id'),
      supabase.from('vlajka_materialy').select('*').order('poradie').order('id'),
      supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('textil_naklady_verejny').select('naklad_bm').eq('technologia', 'sublimacia').maybeSingle(),
      supabase.from('vlajka_tvary').select('id, kod, nazov, poradie, vlajka_tvar_rozmery(id, velkost, rozmer_popis, vyska_cm, spotreba_m2)').order('poradie').order('id'),
    ]);
    setTvary(t || []);
    setVelkosti(v || []);
    setMaterialy(m || []);
    if (n) setNastavenia(n);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setNakladBmSublimacia(tn ? Number(tn.naklad_bm) : 0);
    if ((v || []).length > 0) setTestVelkostId(v[0].id);
    if ((m || []).length > 0) setTestMaterialId(m[0].id);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upravVelkost = async (id, patch) => {
    setVelkosti(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('vlajka_velkosti').update(patch).eq('id', id);
  };

  // Rozmer plachty a vyska od zeme sa zadavaju PER TVAR a velkost (Basic/Blade/Feather maju ine rozmery nez Wave, Wing, Square).
  const upravRozmerTvaru = async (tvarId, rozmerId, patch) => {
    setTvary(ts => ts.map(t => t.id !== tvarId ? t : { ...t, vlajka_tvar_rozmery: t.vlajka_tvar_rozmery.map(x => x.id === rozmerId ? { ...x, ...patch } : x) }));
    await supabase.from('vlajka_tvar_rozmery').update(patch).eq('id', rozmerId);
  };

  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('vlajka_nastavenia').upsert({ id: 1, ...next });
  };

  const testMaterial = materialy.find(m => m.id === testMaterialId);
  const testVelkost = velkosti.find(v => v.id === testVelkostId);
  const nakladSitia = (Number(testVelkost?.minuty_sitia) || 0) * (Number(pricingConfig.cenaMinutySitia) || 0);
  const nakladMaterial = (parseFloat(testSpotreba) || 0) * ((Number(testMaterial?.naklad_m2) || 0) + nakladM2Sublimacia) + nakladSitia;
  const vysledok = vypocitajCenuVlajky({
    nakladMaterial,
    pricingConfig,
    dokoncenie: null,
    stoziar: null,
    doplnky: [],
    expresne: testExpres,
    pocetKs: testKs,
    nastavenia,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Ruler className="text-indigo-400 h-5 w-5" /> Veľkosti, DPH a expres</h2>
        <p className="text-xs text-slate-400 mt-1">Cena veľkosti sa už nezadáva ručne — počíta sa z nákladu (spotreba m² × (látka + sublimačná potlač) + šitie, záložky "Materiály" a "Tvary") cez jednotný maržový vzorec. Tu nastavuješ rozmery plachty a výšku od zeme (po tvaroch) a minúty šitia — k tomu sa v konfigurátore pripočíta opracovanie, prút a doplnky.</p>
      </div>

      {/* ROZMERY PODLA TVARU: rozmer plachty + vyska od zeme (kazdy tvar ma ine) */}
      <div className="space-y-4">
        <p className="text-xs text-slate-400">Rozmery plachty a výška od zeme sa zadávajú <strong className="text-slate-200">pre každý tvar zvlášť</strong> (Basic, Blade a Feather majú rovnaké, Wave, Wing a Square iné). Zákazník ich vidí pri výbere veľkosti a v náhľade s postavou.</p>
        {tvary.map(t => {
          const rozmery = (t.vlajka_tvar_rozmery || []).slice().sort((a, b) => ['S', 'M', 'L', 'XL'].indexOf(a.velkost) - ['S', 'M', 'L', 'XL'].indexOf(b.velkost));
          return (
            <div key={t.id} className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">{t.nazov}</h3>
                <span className="text-[10px] text-slate-500 font-mono">{t.kod}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Veľkosť</th>
                    <th className="text-left px-4 py-2">Rozmer plachty (šírka x výška)</th>
                    <th className="text-left px-4 py-2">Výška od zeme (cm)</th>
                    <th className="text-left px-4 py-2">Spotreba (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {rozmery.map(rz => (
                    <tr key={rz.id} className="border-t border-slate-800">
                      <td className="px-4 py-2 text-white font-bold">{rz.velkost}</td>
                      <td className="px-4 py-2"><input type="text" value={rz.rozmer_popis || ''} placeholder="napr. 55 x 200 cm" onChange={(e) => upravRozmerTvaru(t.id, rz.id, { rozmer_popis: e.target.value })} className="w-40 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                      <td className="px-4 py-2"><NumberInput value={rz.vyska_cm ?? 0} onChange={(val) => upravRozmerTvaru(t.id, rz.id, { vyska_cm: val })} fallback={0} className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                      <td className="px-4 py-2 text-slate-400 font-mono text-xs">{rz.spotreba_m2 != null ? Number(rz.spotreba_m2).toFixed(3) : '—'}</td>
                    </tr>
                  ))}
                  {rozmery.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-xs text-slate-500">Tvar zatiaľ nemá žiadne veľkosti (pridaj ich v záložke Tvary).</td></tr>}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* MINUTY SITIA: spolocne pre velkost (S, M, L, XL) */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5">Veľkosť</th>
              <th className="text-left px-4 py-2.5">Minúty šitia (rovnaké pre všetky tvary)</th>
            </tr>
          </thead>
          <tbody>
            {velkosti.map(v => (
              <tr key={v.id} className="border-t border-slate-800">
                <td className="px-4 py-2 text-white font-bold">{v.kod}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <NumberInput step="1" value={v.minuty_sitia ?? 0} onChange={(val) => upravVelkost(v.id, { minuty_sitia: val })} fallback={0} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                    <span className="text-xs text-slate-500">min × {Number(pricingConfig.cenaMinutySitia || 0).toFixed(2)} €/min = {(Number(v.minuty_sitia || 0) * Number(pricingConfig.cenaMinutySitia || 0)).toFixed(2)} €</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-500 px-4 pb-3">Sadzba €/min šitia sa nastavuje centrálne v záložke Cenotvorba (Sitie/Krajčírky).</p>
      </div>

      <div className="bg-indigo-950/30 border border-indigo-900/40 p-4 rounded-xl grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="text-xs text-indigo-300 font-medium">DPH (%)</label>
          <input type="number" disabled value={pricingConfig.dphPercent} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-indigo-900/40 rounded-lg text-sm text-slate-400 opacity-70 cursor-not-allowed" />
          <p className="text-[10px] text-slate-500 mt-1">Nastavuje sa centrálne v záložke Cenotvorba.</p>
        </div>
        <div>
          <label className="text-xs text-indigo-300 font-medium">Expresný príplatok (%)</label>
          <NumberInput step="0.5" value={nastavenia.expresny_priplatok_percent} onChange={(v) => ulozNastavenia({ expresny_priplatok_percent: v })} fallback={0} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-indigo-800 rounded-lg text-sm text-white" />
        </div>
      </div>

      {/* TESTOVACIA KALKULAČKA */}
      <div className="bg-slate-950 rounded-2xl p-5 border border-indigo-900/40">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Testovacia kalkulačka</h3>
        <p className="text-xs text-slate-400 mb-4">Rýchla kontrola ceny podľa materiálu a spotreby (bez opracovania/prútu/doplnkov — tie sa pripočítajú rovnako v konfigurátore). Reálnu spotrebu pre konkrétny tvar+veľkosť nájdeš v záložke "Tvary".</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 max-w-2xl">
          <div>
            <label className="text-xs text-slate-400">Veľkosť</label>
            <select value={testVelkostId || ''} onChange={(e) => setTestVelkostId(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              {velkosti.map(v => <option key={v.id} value={v.id}>{v.kod}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Materiál</label>
            <select value={testMaterialId || ''} onChange={(e) => setTestMaterialId(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white">
              {materialy.map(m => <option key={m.id} value={m.id}>{m.nazov} ({Number(m.naklad_m2).toFixed(2)} €/m²)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Spotreba (m²)</label>
            <input type="number" step="0.01" min="0" value={testSpotreba} onChange={(e) => setTestSpotreba(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Počet kusov</label>
            <NumberInput min="1" value={testKs} onChange={setTestKs} fallback={1} className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white" />
          </div>
          <div className="flex items-end pb-1">
            <label className="text-xs text-slate-400 flex items-center gap-2">
              <input type="checkbox" checked={testExpres} onChange={(e) => setTestExpres(e.target.checked)} /> Expres
            </label>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mb-2">Náklad: {(parseFloat(testSpotreba) || 0).toFixed(2)} m² × ({(Number(testMaterial?.naklad_m2) || 0).toFixed(2)} € látka + {nakladM2Sublimacia.toFixed(2)} € sublimácia) + {nakladSitia.toFixed(2)} € šitie = {nakladMaterial.toFixed(2)} € spolu</p>
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">{vysledok.vzorec}</div>
          <div className="text-2xl font-black text-emerald-400">{vysledok.cenaSpolu.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  );
}
