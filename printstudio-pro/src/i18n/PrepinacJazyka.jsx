import React, { useEffect, useState } from 'react';
import { JAZYKY, aktualnyJazyk, nastavJazyk, jePripraveny } from './prekladac';

// Malý prepínač jazyka (SK / EN / DE) v rohu obrazovky pre všetky appky. Jazyk sa zapamätá; pri prvej návšteve sa vyberie automaticky.
export default function PrepinacJazyka() {
  const [j, setJ] = useState(aktualnyJazyk());
  const [ok, setOk] = useState(jePripraveny());
  useEffect(() => {
    const f = (e) => setJ(e.detail);
    const g = () => setOk(true);
    window.addEventListener('pbt-jazyk', f);
    window.addEventListener('pbt-preklad-pripraveny', g);
    return () => { window.removeEventListener('pbt-jazyk', f); window.removeEventListener('pbt-preklad-pripraveny', g); };
  }, []);
  if (!ok) return null;
  return (
    <div translate="no" className="fixed left-2 bottom-2 z-[90] flex rounded-full bg-white/95 backdrop-blur border border-slate-300 shadow-md overflow-hidden text-[11px] font-bold">
      {JAZYKY.map((l) => (
        <button key={l} type="button" onClick={() => nastavJazyk(l)} aria-label={l.toUpperCase()}
          className={`px-2.5 py-1.5 ${j === l ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
