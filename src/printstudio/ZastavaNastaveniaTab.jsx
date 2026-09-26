import React, { useEffect, useState } from 'react';
import { Settings, Calculator, Loader2, RefreshCw } from 'lucide-react';
import { mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';
import { vcLaserRezanie } from './vyrobneNaklady';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

const DEFAULT_NASTAVENIA = {
  naklad_sitia_min: 0.35, min_sitia_na_m2: 4.0, naklad_laser_m2: 1.8,
  naklad_tunel_bm: 1.5, naklad_ocko_ks: 0.25, naklad_karabinka_ks: 0.55, naklad_popruh_bm: 0.8,
  expresny_priplatok_percent: 10,
};

export default function ZastavaNastaveniaTab({ supabase }) {
  const [nastavenia, setNastavenia] = useState(DEFAULT_NASTAVENIA);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [materialy, setMaterialy] = useState([]);
  const [laserRezanie, setLaserRezanie] = useState(null);
  const [laserHrubky, setLaserHrubky] = useState([]);
  const [costMetrics, setCostMetrics] = useState([]);
  const [skladPolozky, setSkladPolozky] = useState([]);
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
    const [{ data: n }, { data: m }, { data: cfg }, { data: laserNak }, { data: laserHrub }, { data: costMet }, { data: sklad }] = await Promise.all([
      supabase.from('zastava_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('zastava_materialy').select('*').order('poradie'),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_laser_rezanie').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cennik_laser_hrubky').select('*').order('poradie'),
      supabase.from('cost_metrics').select('*'),
      supabase.from('materials').select('id, name, color, price_per_m, unit, qty').in('unit', ['ks', 'm']).order('name'),
    ]);
    if (n) setNastavenia(n);
    setMaterialy(m || []);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setLaserRezanie(laserNak || null);
    setLaserHrubky(laserHrub || []);
    setCostMetrics(costMet || []);
    setSkladPolozky(sklad || []);
    if ((m || []).length > 0) setTestMaterial(m[0].kod);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uloz = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('zastava_nastavenia').upsert({ id: 1, ...next });
  };

  // ---- Prepocitanie z realnych zdrojov (rovnaky princip ako prepojenie materialov na sklad) ----
  const prepocitajSitie = () => uloz({ naklad_sitia_min: pricingConfig.cenaMinutySitia });

  const prepocitajLaser = (hrubkaId) => {
    if (!hrubkaId) { uloz({ laser_hrubka_id: null }); return; }
    const vc = vcLaserRezanie({ laserRezanie, laserHrubky, costMetrics }, hrubkaId, 10000); // 1m² = 10000cm²
    uloz({ laser_hrubka_id: hrubkaId, naklad_laser_m2: Math.round(vc * 100) / 100 });
  };

  const SKLAD_POLIA = {
    ocko: { skladPole: 'ocko_sklad_id', nakladPole: 'naklad_ocko_ks', jednotka: 'ks' },
    karabinka: { skladPole: 'karabinka_sklad_id', nakladPole: 'naklad_karabinka_ks', jednotka: 'ks' },
    popruh: { skladPole: 'popruh_sklad_id', nakladPole: 'naklad_popruh_bm', jednotka: 'm' },
  };
  const prepojSklad = (kluc, skladId) => {
    const { skladPole, nakladPole } = SKLAD_POLIA[kluc];
    if (!skladId) { uloz({ [skladPole]: null }); return; }
    const polozka = skladPolozky.find(s => s.id === skladId);
    uloz({ [skladPole]: skladId, [nakladPole]: polozka ? Number(polozka.price_per_m) || 0 : nastavenia[nakladPole] });
  };
  const prepocitajSklad = (kluc) => {
    const { skladPole, nakladPole } = SKLAD_POLIA[kluc];
    const polozka = skladPolozky.find(s => s.id === nastavenia[skladPole]);
    if (polozka) uloz({ [nakladPole]: Number(polozka.price_per_m) || 0 });
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
        <div>
          <label className={labelCls}>Šitie (€/min práce)</label>
          <div className="flex items-center gap-1">
            <input type="number" step="0.05" value={nastavenia.naklad_sitia_min} onChange={(e) => uloz({ naklad_sitia_min: parseFloat(e.target.value) || 0 })} className={inputCls} />
            <button type="button" onClick={prepocitajSitie} title={`Natiahnuť aktuálnu sadzbu z Cenotvorby (${pricingConfig.cenaMinutySitia.toFixed(2)} €/min)`} className="shrink-0 text-slate-500 hover:text-indigo-400 p-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Reálna sadzba šitia sa nastavuje v Cenotvorbe — sem sa len natiahne.</p>
        </div>
        <div><label className={labelCls}>Minúty šitia na 1 m²</label><input type="number" step="0.5" value={nastavenia.min_sitia_na_m2} onChange={(e) => uloz({ min_sitia_na_m2: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
        <div>
          <label className={labelCls}>Laser orez (€/m²)</label>
          <div className="flex items-center gap-1">
            <input type="number" step="0.1" value={nastavenia.naklad_laser_m2} onChange={(e) => uloz({ naklad_laser_m2: parseFloat(e.target.value) || 0 })} className={inputCls} />
            {nastavenia.laser_hrubka_id && (
              <button type="button" onClick={() => prepocitajLaser(nastavenia.laser_hrubka_id)} title="Prepočítať z Kostry cien → Laserové rezanie" className="shrink-0 text-slate-500 hover:text-indigo-400 p-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
            )}
          </div>
          <select value={nastavenia.laser_hrubka_id || ''} onChange={(e) => prepocitajLaser(e.target.value ? parseInt(e.target.value) : null)} className={`${inputCls} mt-1.5 text-xs`}>
            <option value="">-- žiadna (zadať €/m² ručne) --</option>
            {laserHrubky.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">Vyber hrúbku vlajkoviny z Kostry cien → Laserové rezanie — dopočíta a natiahne skutočnú cenu.</p>
        </div>
        <div><label className={labelCls}>Tunel/rukáv (€/bm)</label><input type="number" step="0.1" value={nastavenia.naklad_tunel_bm} onChange={(e) => uloz({ naklad_tunel_bm: parseFloat(e.target.value) || 0 })} className={inputCls} /><p className="text-[10px] text-slate-500 mt-1">Zatiaľ len ručne — nemáme reálny zdroj (čas šitia tunela).</p></div>
        <SkladPole label="Kovové očko/priechodka (€/ks)" kluc="ocko" nastavenia={nastavenia} skladPolozky={skladPolozky} SKLAD_POLIA={SKLAD_POLIA} prepojSklad={prepojSklad} prepocitajSklad={prepocitajSklad} uloz={uloz} inputCls={inputCls} labelCls={labelCls} />
        <SkladPole label="Karabínka (€/ks)" kluc="karabinka" nastavenia={nastavenia} skladPolozky={skladPolozky} SKLAD_POLIA={SKLAD_POLIA} prepojSklad={prepojSklad} prepocitajSklad={prepocitajSklad} uloz={uloz} inputCls={inputCls} labelCls={labelCls} />
        <SkladPole label="Spevňujúci popruh (€/bm)" kluc="popruh" nastavenia={nastavenia} skladPolozky={skladPolozky} SKLAD_POLIA={SKLAD_POLIA} prepojSklad={prepojSklad} prepocitajSklad={prepocitajSklad} uloz={uloz} inputCls={inputCls} labelCls={labelCls} />
        <div>
          <label className={labelCls}>DPH (%)</label>
          <input type="number" disabled value={pricingConfig.dphPercent} className={`${inputCls} text-slate-400 opacity-70 cursor-not-allowed`} />
          <p className="text-[10px] text-slate-500 mt-1">Nastavuje sa centrálne v záložke Cenotvorba.</p>
        </div>
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

// Napojenie jedneho nakladoveho pola na sklad. polozku (ks/bm) — vyber + refresh, s manualnym
// zadanim ako zalohou, kym dana polozka v Sklade neexistuje.
function SkladPole({ label, kluc, nastavenia, skladPolozky, SKLAD_POLIA, prepojSklad, prepocitajSklad, uloz, inputCls, labelCls }) {
  const { skladPole, nakladPole, jednotka } = SKLAD_POLIA[kluc];
  const skladId = nastavenia[skladPole];
  const polozka = skladPolozky.find(s => s.id === skladId);
  const ponuka = skladPolozky.filter(s => s.unit === jednotka);
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" step="0.05" value={nastavenia[nakladPole]} onChange={(e) => uloz({ [nakladPole]: parseFloat(e.target.value) || 0 })} className={inputCls} />
        {skladId && (
          <button type="button" onClick={() => prepocitajSklad(kluc)} title="Prepočítať zo skladu" className="shrink-0 text-slate-500 hover:text-indigo-400 p-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <select value={skladId || ''} onChange={(e) => prepojSklad(kluc, e.target.value || null)} className={`${inputCls} mt-1.5 text-xs`}>
        <option value="">-- žiadna (zadať ručne) --</option>
        {ponuka.map(s => <option key={s.id} value={s.id}>{s.name}{s.color ? ` (${s.color})` : ''} — {Number(s.price_per_m).toFixed(2)} €/{jednotka} · sklad {s.qty}</option>)}
      </select>
      {skladId && !polozka && <p className="text-[10px] text-rose-500 mt-1">Prepojená skladová položka už neexistuje.</p>}
    </div>
  );
}
