import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { VELKOSTI_FALLBACK } from './dresPresets';

export default function RosterModal({ roster, velkosti, cena, onZmenRoster, onClose }) {
  const velkostiOptions = velkosti && velkosti.length > 0 ? velkosti : VELKOSTI_FALLBACK;

  const pridajHraca = () => {
    const dalsieCislo = roster.length + 1;
    onZmenRoster([...roster, { id: Date.now(), meno: `HRÁČ ${dalsieCislo}`, cislo: `${dalsieCislo}`, velkost: velkostiOptions[Math.floor(velkostiOptions.length / 2)] || 'L' }]);
  };

  const zmazHraca = (idx) => {
    onZmenRoster(roster.filter((_, i) => i !== idx));
  };

  const zmenHraca = (idx, patch) => {
    onZmenRoster(roster.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Tímová súpiska & Veľkosti</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">Množstevná zľava</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Zadajte mená, čísla a konfekčné veľkosti hráčov.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
            <table className="w-full text-left text-xs min-w-[340px]">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                  <th className="py-2.5 px-2.5">Meno</th>
                  <th className="py-2.5 px-2.5 w-20 text-center">Číslo</th>
                  <th className="py-2.5 px-2.5 w-24 text-center">Veľkosť</th>
                  <th className="py-2.5 px-2.5 w-10 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {roster.map((h, idx) => (
                  <tr key={h.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-2 px-2 text-center text-slate-500 font-bold">{idx + 1}</td>
                    <td className="py-2 px-2">
                      <input
                        type="text" value={h.meno}
                        onChange={(e) => zmenHraca(idx, { meno: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold uppercase text-xs focus:border-indigo-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number" min={0} max={99} value={h.cislo}
                        onChange={(e) => zmenHraca(idx, { cislo: e.target.value })}
                        className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-white font-bold text-xs focus:border-indigo-500"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <select
                        value={h.velkost}
                        onChange={(e) => zmenHraca(idx, { velkost: e.target.value })}
                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-semibold text-xs focus:border-indigo-500"
                      >
                        {velkostiOptions.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-center">
                      {roster.length > 1 ? (
                        <button onClick={() => zmazHraca(idx)} className="text-slate-400 hover:text-red-400 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={pridajHraca} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-indigo-400 text-xs font-bold transition flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Pridať ďalšieho hráča
          </button>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
            <div className="bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800 text-center sm:text-left">
              <span className="text-[10px] text-slate-400 block">Kusov</span>
              <span className="text-sm sm:text-base font-bold text-white">{cena.pocet} ks</span>
            </div>
            <div className="bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800 text-center sm:text-left">
              <span className="text-[10px] text-slate-400 block">Zľava</span>
              <span className="text-sm sm:text-base font-bold text-indigo-400">{cena.zlavaPercent} %</span>
            </div>
            <div className="bg-slate-950 p-2.5 sm:p-3 rounded-xl border border-slate-800 text-center sm:text-left">
              <span className="text-[10px] text-slate-400 block">Cena spolu</span>
              <span className="text-sm sm:text-base font-bold text-white">{cena.cenaSpolu.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
          <button onClick={onClose} className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800">Zavrieť</button>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-slate-950 font-bold text-xs sm:text-sm">Uložiť súpisku</button>
        </div>
      </div>
    </div>
  );
}
