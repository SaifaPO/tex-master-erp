import React from 'react';
import { Shapes, Ruler, Scissors, GripVertical } from 'lucide-react';

export default function ParametreTab({ katalog, tvarKod, velkostKod, dokoncenieKod, stoziarKod, onTvar, onVelkost, onDokoncenie, onStoziar, onDalej }) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Shapes className="w-4 h-4 text-indigo-600" /> 1. Tvar Beachflagu</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {katalog.tvary.map(t => {
            const active = t.kod === tvarKod;
            return (
              <button key={t.kod} type="button" onClick={() => onTvar(t.kod)} className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 font-bold shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <span className="text-xs">{t.nazov}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Ruler className="w-4 h-4 text-indigo-600" /> 2. Veľkosť a rozmery</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {katalog.velkosti.map(v => {
            const active = v.kod === velkostKod;
            return (
              <button key={v.kod} type="button" onClick={() => onVelkost(v.kod)} className={`p-3 rounded-xl border text-left transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm">{v.kod}</span>
                  <span className="font-bold text-xs text-indigo-600">{Number(v.cena).toFixed(2)} €</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-700">{v.vyska_cm} cm od zeme</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{v.rozmer_popis}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Scissors className="w-4 h-4 text-indigo-600" /> 3. Opracovanie okrajov</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {katalog.dokoncenie.map(d => {
            const active = d.kod === dokoncenieKod;
            return (
              <div key={d.kod} onClick={() => onDokoncenie(d.kod)} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{d.nazov}</span>
                    <span className="text-xs font-semibold text-slate-500">{d.cena > 0 ? `+${Number(d.cena).toFixed(2)} €` : 'V cene'}</span>
                  </div>
                  {d.popis && <p className="text-[11px] text-slate-500 mt-0.5">{d.popis}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><GripVertical className="w-4 h-4 text-indigo-600" /> 4. Konštrukcia / prút</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {katalog.stoziare.map(s => {
            const active = s.kod === stoziarKod;
            return (
              <div key={s.kod} onClick={() => onStoziar(s.kod)} className={`p-3 rounded-xl border cursor-pointer transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{s.nazov}</span>
                </div>
                <span className="text-xs font-bold text-indigo-600 block">{s.cena > 0 ? `+${Number(s.cena).toFixed(2)} €` : 'V cene'}</span>
                {s.popis && <p className="text-[10px] text-slate-500 mt-0.5">{s.popis}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button onClick={onDalej} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition-all">
          Pokračovať na Grafiku →
        </button>
      </div>
    </div>
  );
}
