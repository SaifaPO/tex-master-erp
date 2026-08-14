import React, { useEffect, useState } from 'react';
import { Shirt } from 'lucide-react';
import { supabase } from './supabaseClient';
import { nacitajKategorieAProdukty } from './produktData';
import Katalog from './Katalog';
import Dizajner from './Dizajner';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kategorie, setKategorie] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [aktualnyProduktId, setAktualnyProduktId] = useState(null); // null = katalóg

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'); setIsLoading(false); return; }
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
        </div>
      </header>

      {aktualnyProduktId == null ? (
        <Katalog kategorie={kategorie} produkty={produkty} onVyberProduktu={setAktualnyProduktId} />
      ) : (
        <Dizajner supabase={supabase} produktId={aktualnyProduktId} />
      )}
    </div>
  );
}
