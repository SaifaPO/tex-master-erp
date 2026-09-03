import React from 'react';
import { VSETKY_VZORY, PRESET_PALETY } from './dresPresets';

export default function VzoryTab({ configState, dostupneVzory, onVzor, onPreset }) {
  const vzory = VSETKY_VZORY.filter(v => !dostupneVzory || dostupneVzory.includes(v.id));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Výber dizajnu dresu</h3>
        <p className="text-xs text-slate-400">Vyberte si štruktúru a grafický štýl dresu.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {vzory.map(v => {
          const isActive = configState.vzor === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onVzor(v.id)}
              className={`p-2 sm:p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${isActive ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-400'}`}
            >
              <svg className={`w-6 h-6 sm:w-8 sm:h-8 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d={v.icon} />
              </svg>
              <span className="text-[10px] sm:text-[11px] font-bold tracking-tight truncate w-full">{v.nazov}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Rýchle farebné inšpirácie</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_PALETY.map(pal => (
            <button
              key={pal.nazov}
              onClick={() => onPreset(pal)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-600 transition flex items-center justify-between text-left"
            >
              <span className="text-xs font-semibold text-slate-200">{pal.nazov}</span>
              <div className="flex -space-x-1">
                <div className="w-3.5 h-3.5 rounded-full border border-slate-900" style={{ background: pal.base }} />
                <div className="w-3.5 h-3.5 rounded-full border border-slate-900" style={{ background: pal.pattern }} />
                <div className="w-3.5 h-3.5 rounded-full border border-slate-900" style={{ background: pal.accent }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
