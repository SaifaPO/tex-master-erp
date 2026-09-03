import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Share2, Users, ShoppingCart, Grid3x3, Palette, Type, Image as ImageIcon, Shirt } from 'lucide-react';
import { nacitajDresKatalog } from './dresData';
import { DEFAULT_CONFIG_STATE, GOOGLE_FONTS_HREF } from './dresPresets';
import { vypocitajCenuDresu } from './dres3dCenotvorba';
import ThreeViewport from './ThreeViewport';
import VzoryTab from './VzoryTab';
import FarbyZonyTab from './FarbyZonyTab';
import PotlacTab from './PotlacTab';
import LogaTab from './LogaTab';
import GolierMaterialTab from './GolierMaterialTab';
import RosterModal from './RosterModal';
import SuhrnModal from './SuhrnModal';

const TABY = [
  { id: 'vzory', label: 'Vzory', icon: Grid3x3 },
  { id: 'farby', label: 'Farby', icon: Palette },
  { id: 'text', label: 'Potlač', icon: Type },
  { id: 'loga', label: 'Logá', icon: ImageIcon },
  { id: 'golier', label: 'Strih', icon: Shirt },
];

export default function Dres3DApp({ supabase, produktId }) {
  const [katalog, setKatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [aktivnyTab, setAktivnyTab] = useState('vzory');
  const [configState, setConfigState] = useState(DEFAULT_CONFIG_STATE);
  const [aktivnaZona, setAktivnaZona] = useState('zakladna');
  const [roster, setRoster] = useState([{ id: 1, meno: 'RONALDO', cislo: '7', velkost: 'L' }]);
  const [zobrazitRoster, setZobrazitRoster] = useState(false);
  const [zobrazitSuhrn, setZobrazitSuhrn] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);

  const viewportRef = useRef(null);

  // Google Fonts pre športové písma (Teko/Chakra Petch/Oswald) — vloží sa len keď je 3D konfigurátor otvorený
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_HREF;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    let zrusene = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await nacitajDresKatalog(supabase, produktId);
        if (zrusene) return;
        setKatalog(data);

        const n = data.nastavenia;
        setConfigState(prev => ({
          ...prev,
          farby: n ? {
            zakladna: n.farba_zakladna, vzor: n.farba_vzor, akcent: n.farba_akcent,
            rukava: n.farba_rukava, golier: n.farba_golier,
          } : prev.farby,
          materialKod: data.materialy[0]?.kod || null,
        }));

        const prvaVelkost = data.velkosti[Math.floor(data.velkosti.length / 2)] || 'L';
        setRoster([{ id: 1, meno: 'RONALDO', cislo: '7', velkost: prvaVelkost }]);
      } catch (e) {
        if (!zrusene) setLoadError(e.message || 'Katalóg sa nepodarilo načítať.');
      }
      if (!zrusene) setIsLoading(false);
    })();
    return () => { zrusene = true; };
  }, [supabase, produktId]);

  const material = useMemo(() => katalog?.materialy.find(m => m.kod === configState.materialKod), [katalog, configState.materialKod]);

  const cena = useMemo(() => vypocitajCenuDresu({
    zakladnaCena: katalog?.produkt?.zakladna_cena || 0,
    priplatokMaterial: material?.priplatok_eur || 0,
    pocetHracov: roster.length,
    zlavy: katalog?.zlavy || [],
  }), [katalog, material, roster.length]);

  const handleZmenText = (patch) => {
    setConfigState(prev => ({ ...prev, text: { ...prev.text, ...patch } }));
    if (patch.menoHraca !== undefined || patch.cisloHraca !== undefined) {
      setRoster(prev => prev.length === 0 ? prev : prev.map((h, i) => (i === 0
        ? { ...h, ...(patch.menoHraca !== undefined ? { meno: patch.menoHraca.toUpperCase() } : {}), ...(patch.cisloHraca !== undefined ? { cislo: patch.cisloHraca } : {}) }
        : h)));
    }
  };

  const handleZmenRoster = (newRoster) => {
    setRoster(newRoster);
    if (newRoster.length > 0) {
      const prvy = newRoster[0];
      setConfigState(prev => ({ ...prev, text: { ...prev.text, menoHraca: prvy.meno, cisloHraca: prvy.cislo } }));
    }
  };

  const handleZmenFarbu = (zona, hex) => {
    setConfigState(prev => ({ ...prev, farby: { ...prev.farby, [zona]: hex } }));
  };

  const handlePreset = (pal) => {
    setConfigState(prev => ({ ...prev, farby: { zakladna: pal.base, vzor: pal.pattern, akcent: pal.accent, rukava: pal.sleeves, golier: pal.collar } }));
  };

  const handleZmenLoga = (patch) => setConfigState(prev => ({ ...prev, loga: { ...prev.loga, ...patch } }));

  const resetKonfiguraciu = () => {
    setConfigState(prev => ({ ...DEFAULT_CONFIG_STATE, materialKod: prev.materialKod }));
  };

  const otvorSuhrn = () => {
    setSnapshotUrl(viewportRef.current?.captureSnapshot() || null);
    setZobrazitSuhrn(true);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam 3D konfigurátor…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!katalog) return null;

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-slate-950 min-h-[calc(100vh-64px)]">
      <div className="w-full lg:w-auto flex items-center justify-between gap-2 p-2.5 lg:absolute lg:top-3 lg:right-3 lg:z-20 bg-slate-900/90 lg:bg-transparent border-b lg:border-0 border-slate-800">
        <span className="text-xs font-bold text-slate-300 lg:hidden">{katalog.produkt.nazov}</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={resetKonfiguraciu} title="Resetovať konfiguráciu" className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition bg-slate-800/60">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => navigator.clipboard?.writeText(window.location.href)} title="Zdieľať dizajn" className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition bg-slate-800/60">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={() => setZobrazitRoster(true)} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
            <Users className="w-4 h-4 text-indigo-400" /> Súpiska
            <span className="bg-indigo-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{roster.length}</span>
          </button>
          <button onClick={otvorSuhrn} className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
            <ShoppingCart className="w-4 h-4" />
            <span className="bg-slate-950/20 px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-extrabold">{cena.cenaSpolu.toFixed(2)} €</span>
          </button>
        </div>
      </div>

      <div className="p-2 lg:p-4 lg:pt-16 flex-1">
        <ThreeViewport ref={viewportRef} configState={configState} />
      </div>

      <div className="w-full lg:w-[480px] xl:w-[520px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[58vh] sm:h-[50vh] lg:h-auto">
        <div className="flex border-b border-slate-800 bg-slate-950/70 p-1.5 sm:p-2 gap-1 overflow-x-auto">
          {TABY.map(t => {
            const Icon = t.icon;
            const active = aktivnyTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setAktivnyTab(t.id)}
                className={`flex-1 min-w-[65px] sm:min-w-[70px] py-2 px-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${active ? 'bg-indigo-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] sm:text-xs">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {aktivnyTab === 'vzory' && (
            <VzoryTab configState={configState} dostupneVzory={katalog.nastavenia?.dostupne_vzory} onVzor={(id) => setConfigState(p => ({ ...p, vzor: id }))} onPreset={handlePreset} />
          )}
          {aktivnyTab === 'farby' && (
            <FarbyZonyTab configState={configState} onZmenFarbu={handleZmenFarbu} aktivnaZona={aktivnaZona} onZmenAktivnuZonu={setAktivnaZona} />
          )}
          {aktivnyTab === 'text' && (
            <PotlacTab configState={configState} fonty={katalog.fonty} onZmenText={handleZmenText} />
          )}
          {aktivnyTab === 'loga' && (
            <LogaTab configState={configState} grafiky={katalog.grafiky} onZmenLoga={handleZmenLoga} />
          )}
          {aktivnyTab === 'golier' && (
            <GolierMaterialTab
              configState={configState}
              dostupneGoliere={katalog.nastavenia?.dostupne_goliere}
              materialy={katalog.materialy}
              onGolier={(id) => setConfigState(p => ({ ...p, golierTyp: id }))}
              onMaterial={(kod) => setConfigState(p => ({ ...p, materialKod: kod }))}
            />
          )}
        </div>

        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider block">Kalkulácia</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-extrabold text-white">{cena.jednotkovaCena.toFixed(2)} €</span>
              <span className="text-[11px] text-slate-400">/ ks s DPH</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold block">
              {cena.zlavaPercent > 0 ? `Aplikovaná tímová zľava ${cena.zlavaPercent}%` : 'Objednajte 5+ ks a získajte zľavu'}
            </span>
          </div>
          <button onClick={otvorSuhrn} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-slate-950 font-extrabold text-xs sm:text-sm transition">
            Objednať
          </button>
        </div>
      </div>

      {zobrazitRoster && (
        <RosterModal roster={roster} velkosti={katalog.velkosti} cena={cena} onZmenRoster={handleZmenRoster} onClose={() => setZobrazitRoster(false)} />
      )}
      {zobrazitSuhrn && (
        <SuhrnModal
          supabase={supabase}
          produkt={katalog.produkt}
          configState={configState}
          roster={roster}
          materialy={katalog.materialy}
          cena={cena}
          snapshotUrl={snapshotUrl}
          onClose={() => setZobrazitSuhrn(false)}
          onBackToEdit={() => setZobrazitSuhrn(false)}
        />
      )}
    </div>
  );
}
