import React, { useEffect, useState } from 'react';
import { Shirt, Scroll } from 'lucide-react';
import { supabase } from './supabaseClient';
import { nacitajKategorieAProdukty } from './produktData';
import Katalog from './Katalog';
import Dizajner from './Dizajner';
import DtfMetraz from './DtfMetraz';
import BeachflagApp from './beachflag/BeachflagApp';
import Dres3DApp from './dres3d/Dres3DApp';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kategorie, setKategorie] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [aktualnyProduktId, setAktualnyProduktId] = useState(null); // null = katalóg
  const [zobrazDtfMetraz, setZobrazDtfMetraz] = useState(() => new URLSearchParams(window.location.search).has('dtf'));
  const jeVlajka = new URLSearchParams(window.location.search).get('typ') === 'beachflag';

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'); setIsLoading(false); return; }
    if (jeVlajka) { setIsLoading(false); return; }
    (async () => {
      const { kategorie: kats, produkty: prods } = await nacitajKategorieAProdukty(supabase);
      setKategorie(kats);
      setProdukty(prods);

      const handleZUrl = new URLSearchParams(window.location.search).get('produkt');
      const zhoda = handleZUrl ? prods.find(p => p.shopify_handle === handleZUrl) : null;
      if (zhoda) setAktualnyProduktId(zhoda.id);
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  }
  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  }
  if (jeVlajka) {
    return <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col"><BeachflagApp supabase={supabase} /></div>;
  }

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><Shirt className="w-6 h-6" /></div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-900">PrintStudio Pro</h1>
              <p className="text-xs text-slate-500">Konfigurátor a tvorca potlače</p>
            </div>
          </div>
          {aktualnyProduktId != null && (
            <button onClick={() => setAktualnyProduktId(null)} className="text-slate-600 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
              ← <span className="hidden sm:inline">Katalóg</span>
            </button>
          )}
          {aktualnyProduktId == null && (
            <button onClick={() => setZobrazDtfMetraz(v => !v)} className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${zobrazDtfMetraz ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'}`}>
              <Scroll className="w-4 h-4" /> <span className="hidden sm:inline">DTF transfery na meter</span>
            </button>
          )}
        </div>
      </header>

      {aktualnyProduktId != null ? (
        produkty.find(p => p.id === aktualnyProduktId)?.typ_konfiguratora === '3d_dres' ? (
          <Dres3DApp supabase={supabase} produktId={aktualnyProduktId} />
        ) : (
          <Dizajner supabase={supabase} produktId={aktualnyProduktId} />
        )
      ) : zobrazDtfMetraz ? (
        <DtfMetraz supabase={supabase} onSpat={() => setZobrazDtfMetraz(false)} />
      ) : (
        <Katalog kategorie={kategorie} produkty={produkty} onVyberProduktu={setAktualnyProduktId} />
      )}
    </div>
  );
}
