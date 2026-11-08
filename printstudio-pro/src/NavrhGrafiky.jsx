import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import PlochaEditor from './fabricEditor/PlochaEditor';

// Celoobrazovkový editor jednej potlače (text, fonty, symboly, knižnica grafík, vlastný obrázok). Plocha má presný rozmer potlače v cm,
// pozadie je priehľadné. Výstup (PNG s priehľadným pozadím + JSON na ďalšiu úpravu) sa vráti cez onHotovo({ subor, nahlad, json }).
// Používa sa v appke Sieťotlač; editor je rovnaký ako v ostatných appkách (stolové vlajky, šnúrky).
const MAX_PX = 4096; // strop na dlhšiu stranu výstupu (limit plátna na mobiloch)

export default function NavrhGrafiky({ supabase, sirkaCm, vyskaCm, nazov, pocetFarieb, povodnyJson, onHotovo, onZrus, podkladFarba = null, upozornenie = undefined }) {
  const editorRef = useRef(null);
  const [d, setD] = useState({ fonty: [], grafiky: [] });
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState('');
  const sirkaMm = Math.max(10, Math.round(sirkaCm * 10)), vyskaMm = Math.max(10, Math.round(vyskaCm * 10));
  // väčšie plochy sa v editore zobrazujú v menšej mierke (výkon); výstup sa škáluje samostatne
  const ppm = Math.max(sirkaMm, vyskaMm) > 300 ? 1 : 2;

  useEffect(() => {
    let zrusene = false;
    (async () => {
      const [f, g] = await Promise.all([
        supabase.from('fonty').select('*').order('id'),
        supabase.from('grafiky').select('id, nazov, url, kategoria').order('nazov'),
      ]);
      if (!zrusene) setD({ fonty: f.data || [], grafiky: g.data || [] });
    })();
    return () => { zrusene = true; };
  }, [supabase]);

  // opätovné otvorenie návrhu — načítaj uložený stav (po prvom vykreslení editora)
  useEffect(() => {
    if (!povodnyJson) return undefined;
    const t = setTimeout(() => editorRef.current?.nacitajFront(povodnyJson), 150);
    return () => clearTimeout(t);
  }, [povodnyJson]);

  const pouzit = async () => {
    setChyba('');
    if (!editorRef.current || editorRef.current.pocetObjektov() === 0) { setChyba('Návrh je prázdny — pridajte text, symbol alebo obrázok.'); return; }
    setUklada(true);
    try {
      const ex = await editorRef.current.exportuj({ maxPx: MAX_PX });
      const subor = new File([ex.front], `navrh_${Date.now()}.png`, { type: 'image/png' });
      onHotovo({ subor, nahlad: URL.createObjectURL(ex.front), json: ex.json.front });
    } catch {
      setChyba('Návrh sa nepodarilo uložiť, skúste to prosím znova.');
      setUklada(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-modal="true" aria-label="Návrh potlače">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 text-base truncate">Návrh potlače — {nazov}</h2>
          <p className="text-xs text-slate-500">Plocha {sirkaCm} × {vyskaCm} cm{pocetFarieb ? ` · ${pocetFarieb} ${pocetFarieb === 1 ? 'farba' : pocetFarieb < 5 ? 'farby' : 'farieb'}` : ''}. Pozadie je priehľadné (v tlači sa vytlačia len vaše prvky){podkladFarba ? ' — zobrazené na farbe vášho textilu' : ''}.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onZrus} disabled={uklada} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"><X className="w-4 h-4" /> <span className="hidden sm:inline">Zrušiť</span></button>
          <button type="button" onClick={pouzit} disabled={uklada} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold flex items-center gap-1.5">
            {uklada ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Použiť návrh
          </button>
        </div>
      </div>
      {chyba && <p className="px-4 py-2 text-sm text-rose-600 bg-rose-50 border-b border-rose-100">{chyba}</p>}
      <div className="flex-1 overflow-y-auto">
        <PlochaEditor ref={editorRef} sirkaMm={sirkaMm} vyskaMm={vyskaMm} ppm={ppm} jednaStrana priehladne podkladFarba={podkladFarba} fonty={d.fonty} grafiky={d.grafiky}>
          {({ nastroje, plocha }) => (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 grid lg:grid-cols-[22rem_1fr] gap-4 items-start">
              <div className="lg:sticky lg:top-2 order-2 lg:order-1 min-w-0">
                {upozornenie !== null && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-snug">{upozornenie || `Sieťotlač je vhodná na jednoduché plné plochy a texty (${pocetFarieb} ${pocetFarieb === 1 ? 'farba' : pocetFarieb < 5 ? 'farby' : 'farieb'}). Fotografie a farebné prechody sa v sieťotlači nevytlačia — na ne je lepšia DTF potlač.`}</p>}
                {nastroje}
              </div>
              <div className="order-1 lg:order-2 min-w-0">{plocha}</div>
            </div>
          )}
        </PlochaEditor>
      </div>
    </div>
  );
}
