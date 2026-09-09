import React, { useEffect, useState } from 'react';
import { Settings, Calculator, Loader2 } from 'lucide-react';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

const DEFAULT_NASTAVENIA = {
  naklad_sitia_min: 0.35, min_sitia_na_m2: 4.0, naklad_laser_m2: 1.8,
  naklad_tunel_bm: 1.5, naklad_ocko_ks: 0.25, naklad_karabinka_ks: 0.55, naklad_popruh_bm: 0.8,
  dph_percent: 23, expresny_priplatok_percent: 10,
};

export default function ZastavaNastaveniaTab({ supabase }) {
  const [nastavenia, setNastavenia] = useState(DEFAULT_NASTAVENIA);
  const [materialy, setMaterialy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [testMaterial, setTestMaterial] = useState('');
  const [testSirka, setTestSirka] = useState(150);
  const [testVyska, setTestVyska] = useState(100);
  const [testVyhotovenie, setTestVyhotovenie] = useState('obsite');
  const [testKs, setTestKs] = useState(1);
  const [testVysledok, setTestVysledok] = useState(null);
  const [testChyba, setTestChyba] = useState('');
  const [testBeziaci, setTestBeziaci] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: m }] = await Promise.all([
      supabase.from('zastava_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('zastava_materialy').select('*').order('poradie'),
    ]);
    if (n) setNastavenia(n);
    setMaterialy(m || []);
    if ((m || []).length > 0) setTestMaterial(m[0].kod);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uloz = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('zastava_nastavenia').upsert({ id: 1, ...next });
  };

  const spustiTest = async () => {
    setTestBeziaci(true);
    setTestChyba('');
    setTestVysledok(null);
    const { data, error } = await supabase.functions.invoke('zastava-price-preview', {
      body: {
        materialKod: testMaterial, sirkaCm: testSirka, vyskaCm: testVyska,
        vyhotovenie: testVyhotovenie, pocetKs: testKs,
        tunely: [], ocka: [], karabinky: [], popruhy: {},
      },
    });
    setTestBeziaci(false);
    if (error) { setTestChyba(error.message); return; }
    if (data?.error) { setTestChyba(data.error); return; }
    setTestVysledok(data.cena);
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="text-indigo-400 h-5 w-5" /> Nákladové sadzby</h2>
        <p className="text-xs text-slate-400 mt-1">Toto sú výrobné náklady (nie predajné ceny) — marža sa nastavuje jednotne v záložke Cenotvorba.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className={labelCls}>Šitie (€/min práce)</label><input type="number" step="0.05" value={nastavenia.naklad_sitia_min} onChange={(e) => uloz({ naklad_sitia_min: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Minúty šitia na 1 m²</label><input type="number" step="0.5" value={nastavenia.min_sitia_na_m2} onChange={(e) => uloz({ min_sitia_na_m2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Laser orez (€/m²)</label><input type="number" step="0.1" value={nastavenia.naklad_laser_m2} onChange={(e) => uloz({ naklad_laser_m2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Tunel/rukáv (€/bm)</label><input type="number" step="0.1" value={nastavenia.naklad_tunel_bm} onChange={(e) => uloz({ naklad_tunel_bm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Kovové očko/priechodka (€/ks)</label><input type="number" step="0.05" value={nastavenia.naklad_ocko_ks} onChange={(e) => uloz({ naklad_ocko_ks: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Karabínka (€/ks)</label><input type="number" step="0.05" value={nastavenia.naklad_karabinka_ks} onChange={(e) => uloz({ naklad_karabinka_ks: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Spevňujúci popruh (€/bm)</label><input type="number" step="0.1" value={nastavenia.naklad_popruh_bm} onChange={(e) => uloz({ naklad_popruh_bm: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>DPH (%)</label><input type="number" step="1" value={nastavenia.dph_percent} onChange={(e) => uloz({ dph_percent: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div><label className={labelCls}>Expresný príplatok (%)</label><input type="number" step="1" value={nastavenia.expresny_priplatok_percent} onChange={(e) => uloz({ expresny_priplatok_percent: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
      </div>

      <div className="bg-slate-950 rounded-2xl p-5 border border-indigo-900/40">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-indigo-400" /> Testovacia kalkulačka</h3>
        <p className="text-xs text-slate-400 mb-4">Zavolá rovnakú Edge Function ako zákaznícky konfigurátor — presne to isté, čo uvidí zákazník.</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          <div>
            <label className={labelCls}>Materiál</label>
            <select value={testMaterial} onChange={(e) => setTestMaterial(e.target.value)} className={inputCls}>
              {materialy.map(m => <option key={m.kod} value={m.kod}>{m.nazov}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Šírka (cm)</label><input type="number" value={testSirka} onChange={(e) => setTestSirka(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
          <div><label className={labelCls}>Výška (cm)</label><input type="number" value={testVyska} onChange={(e) => setTestVyska(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Okraje</label>
            <select value={testVyhotovenie} onChange={(e) => setTestVyhotovenie(e.target.value)} className={inputCls}>
              <option value="obsite">Obšité</option>
              <option value="laser">Laser orez</option>
            </select>
          </div>
          <div><label className={labelCls}>Počet ks</label><input type="number" min="1" value={testKs} onChange={(e) => setTestKs(parseInt(e.target.value) || 1)} className={inputCls} /></div>
        </div>
        <button onClick={spustiTest} disabled={testBeziaci || !testMaterial} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5">
          {testBeziaci && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Prepočítať cenu
        </button>
        {testChyba && <p className="text-xs text-rose-400 mt-3">{testChyba}</p>}
        {testVysledok && (
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">Marža pri tomto odbere: <strong className="text-white">{testVysledok.marzaPercent}%</strong></div>
            <div className="text-2xl font-black text-emerald-400">{testVysledok.cenaSpolu.toFixed(2)} € <span className="text-xs text-slate-500 font-normal">s DPH</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
