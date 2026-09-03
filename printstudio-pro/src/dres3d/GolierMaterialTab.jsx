import React from 'react';
import { VSETKY_GOLIERE } from './dresPresets';

export default function GolierMaterialTab({ configState, dostupneGoliere, materialy, onGolier, onMaterial }) {
  const goliere = VSETKY_GOLIERE.filter(g => !dostupneGoliere || dostupneGoliere.includes(g.id));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Typ goliera & Strih</h3>
        <p className="text-xs text-slate-400">Vyberte konštrukciu a materiálové spracovanie dresu.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {goliere.map(g => (
          <button
            key={g.id}
            onClick={() => onGolier(g.id)}
            className={`p-2.5 rounded-xl bg-slate-950 border-2 text-center transition flex flex-col items-center gap-1.5 ${configState.golierTyp === g.id ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'}`}
          >
            <div className="w-8 h-8 rounded-full border-4 border-slate-600 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-700" />
            </div>
            <span className="text-[11px] font-bold text-white">{g.nazov}</span>
          </button>
        ))}
      </div>

      {materialy && materialy.length > 0 && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider block">Materiál a úprava dresu</span>
          <div className="space-y-2">
            {materialy.map(m => (
              <label key={m.kod} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="radio" name="materialType" checked={configState.materialKod === m.kod} onChange={() => onMaterial(m.kod)} className="text-indigo-500" />
                  <div>
                    <span className="text-xs font-bold text-white block">{m.nazov}</span>
                    {m.popis && <span className="text-[10px] text-slate-400">{m.popis}</span>}
                  </div>
                </div>
                <span className={`text-[11px] font-bold ${Number(m.priplatok_eur) > 0 ? 'text-slate-400' : 'text-indigo-400'}`}>
                  {Number(m.priplatok_eur) > 0 ? `+ ${Number(m.priplatok_eur).toFixed(2)} €` : 'Štandard'}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
