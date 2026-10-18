import React, { useMemo, useState } from 'react';

// Knižnica grafík a log pre editory (čelenky, buffky): zoskupená podľa kategórie, so skrolovaním a výberom farby pre jednofarebné ikony
// (kategória "Športové ikony" — čierne ikony, ktoré sa pri vložení prefarbia na zvolenú farbu).
const JEDNOFAREBNE = ['Športové ikony'];

export default function KniznicaGrafik({ grafiky, onVloz, tmava = false }) {
  const [farba, setFarba] = useState('#ffffff');
  const [povodna, setPovodna] = useState(false);
  const [otvorena, setOtvorena] = useState(null);

  const skupiny = useMemo(() => {
    const m = new Map();
    grafiky.forEach((g) => { const k = g.kategoria || 'Ostatné'; if (!m.has(k)) m.set(k, []); m.get(k).push(g); });
    return [...m.entries()].sort((a, b) => (JEDNOFAREBNE.includes(a[0]) ? 1 : 0) - (JEDNOFAREBNE.includes(b[0]) ? 1 : 0));
  }, [grafiky]);

  const trieda = {
    nadpis: tmava ? 'text-slate-400' : 'text-slate-700',
    tlacidlo: tmava ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-cyan-500' : 'bg-slate-100 hover:bg-slate-50 border-slate-200 hover:border-indigo-500',
    okraj: tmava ? 'border-slate-800' : 'border-slate-200',
  };

  return (
    <div className="space-y-2 max-w-full">
      <label className={`block text-[11px] font-semibold uppercase tracking-wider ${trieda.nadpis}`}>Knižnica grafík a log</label>
      {skupiny.some(([k]) => JEDNOFAREBNE.includes(k)) && (
        <div className={`flex items-center gap-2 text-[11px] ${trieda.nadpis}`}>
          <span>Farba ikon:</span>
          <input type="color" value={farba} onChange={(e) => { setFarba(e.target.value); setPovodna(false); }} className="w-8 h-6 rounded border border-slate-400 cursor-pointer" />
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={povodna} onChange={(e) => setPovodna(e.target.checked)} /> pôvodná (čierna)</label>
        </div>
      )}
      <div className={`max-h-56 overflow-y-auto pr-1 space-y-2 rounded-lg`}>
        {skupiny.map(([kategoria, polozky]) => {
          const jednofarebna = JEDNOFAREBNE.includes(kategoria);
          const zbalena = jednofarebna && otvorena !== kategoria && skupiny.length > 1 && polozky.length > 12;
          return (
            <div key={kategoria} className={`border-t pt-1.5 ${trieda.okraj}`}>
              <button type="button" onClick={() => setOtvorena(otvorena === kategoria ? null : kategoria)} className={`text-[11px] font-bold ${trieda.nadpis} flex items-center gap-1`}>
                {kategoria} <span className="font-normal opacity-60">({polozky.length}){polozky.length > 12 ? (zbalena ? ' ▸ zobraziť všetky' : ' ▾') : ''}</span>
              </button>
              <div className="grid grid-cols-6 gap-1.5 mt-1">
                {(zbalena ? polozky.slice(0, 12) : polozky).map((g) => (
                  <button key={g.id} type="button" title={g.nazov} onClick={() => onVloz(g.url, jednofarebna && !povodna ? farba : null)} className={`aspect-square rounded-lg border p-1 overflow-hidden transition ${trieda.tlacidlo}`}>
                    <img src={g.url} alt={g.nazov} loading="lazy" className={`w-full h-full object-contain ${jednofarebna ? "bg-white rounded" : ""}`} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
