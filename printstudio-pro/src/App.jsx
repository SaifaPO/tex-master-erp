import React, { useEffect, useState } from 'react';
import { Shirt, Scroll } from 'lucide-react';
import PbtHeader from './PbtHeader';
import { supabase } from './supabaseClient';
import { nacitajKategorieAProdukty } from './produktData';
import Katalog from './Katalog';
import Dizajner from './Dizajner';
import DtfMetraz from './DtfMetraz';
import TextilMetraz from './TextilMetraz';
import BeachflagApp from './beachflag/BeachflagApp';
import ZastavaApp from './zastava/ZastavaApp';
import Dres3DApp from './dres3d/Dres3DApp';
import Celenky from './Celenky';
import Buffky from './Buffky';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kategorie, setKategorie] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [aktualnyProduktId, setAktualnyProduktId] = useState(null); // null = katalóg
  const [zobrazDtfMetraz, setZobrazDtfMetraz] = useState(() => new URLSearchParams(window.location.search).has('dtf'));
  const [zobrazTextilMetraz, setZobrazTextilMetraz] = useState(() => new URLSearchParams(window.location.search).has('textil'));
  const jeVlajka = new URLSearchParams(window.location.search).get('typ') === 'beachflag';
  const jeZastava = new URLSearchParams(window.location.search).get('typ') === 'zastava';
  const jeCelenka = new URLSearchParams(window.location.search).get('typ') === 'celenka';
  const jeBuffka = new URLSearchParams(window.location.search).get('typ') === 'buffka';

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'); setIsLoading(false); return; }
    if (jeVlajka || jeZastava || jeCelenka || jeBuffka) { setIsLoading(false); return; }
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
  if (jeZastava) {
    return <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col"><ZastavaApp supabase={supabase} /></div>;
  }
  if (jeCelenka) {
    return <Celenky supabase={supabase} />;
  }
  if (jeBuffka) {
    return <Buffky supabase={supabase} />;
  }

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader
        title="PrintStudio Pro"
        subtitle="Konfigurátor a tvorca potlače"
        right={aktualnyProduktId != null ? (
          <button onClick={() => setAktualnyProduktId(null)} className="text-slate-600 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5">
            ← <span className="hidden sm:inline">Katalóg</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setZobrazDtfMetraz(v => !v); setZobrazTextilMetraz(false); }} className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${zobrazDtfMetraz ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'}`}>
              <Scroll className="w-4 h-4" /> <span className="hidden sm:inline">DTF transfery na meter</span>
            </button>
            <button onClick={() => { setZobrazTextilMetraz(v => !v); setZobrazDtfMetraz(false); }} className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${zobrazTextilMetraz ? 'text-teal-600 bg-teal-50' : 'text-slate-600 hover:text-teal-600 hover:bg-slate-100'}`}>
              <Shirt className="w-4 h-4" /> <span className="hidden sm:inline">Textilná metráž</span>
            </button>
          </div>
        )}
      />

      {aktualnyProduktId != null ? (
        produkty.find(p => p.id === aktualnyProduktId)?.typ_konfiguratora === '3d_dres' ? (
          <Dres3DApp supabase={supabase} produktId={aktualnyProduktId} />
        ) : (
          <Dizajner supabase={supabase} produktId={aktualnyProduktId} />
        )
      ) : zobrazDtfMetraz ? (
        <DtfMetraz supabase={supabase} onSpat={() => setZobrazDtfMetraz(false)} />
      ) : zobrazTextilMetraz ? (
        <TextilMetraz supabase={supabase} onSpat={() => setZobrazTextilMetraz(false)} />
      ) : (
        <Katalog kategorie={kategorie} produkty={produkty} onVyberProduktu={setAktualnyProduktId} />
      )}
    </div>
  );
}
