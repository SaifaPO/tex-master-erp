import React from 'react';
import { EMOJI_ERBY, BRAND_LOGA } from './dresPresets';

export default function LogaTab({ configState, grafiky, onZmenLoga }) {
  const nacitajObrazokAkoErb = (src, crossOrigin = false) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => onZmenLoga({ typErbu: 'custom', vlastnyErbImg: img });
    img.src = src;
  };

  const naUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => nacitajObrazokAkoErb(ev.target.result, false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Klubový erb a sponzorské logá</h3>
        <p className="text-xs text-slate-400">Nahrajte vlastné logo alebo si vyberte z predvolených.</p>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">1. Klubový Znak (Na srdci)</span>
            <span className="text-[10px] text-slate-400">Umiestnenie na ľavej hrudi</span>
          </div>
          <input type="checkbox" checked={configState.loga.zobrazitErb} onChange={(e) => onZmenLoga({ zobrazitErb: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {EMOJI_ERBY.map(e => (
            <button
              key={e.id}
              onClick={() => onZmenLoga({ typErbu: e.id, vlastnyErbImg: null })}
              className={`p-2 rounded-lg bg-slate-800 border-2 flex flex-col items-center ${configState.loga.typErbu === e.id ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
            >
              <span className="text-lg">{e.emoji}</span>
              <span className="text-[9px] mt-1 font-semibold text-slate-300">{e.nazov}</span>
            </button>
          ))}
        </div>

        {grafiky && grafiky.length > 0 && (
          <div className="pt-1">
            <label className="block text-[11px] text-slate-400 mb-1.5">Alebo z knižnice grafík:</label>
            <div className="grid grid-cols-5 gap-2">
              {grafiky.map(g => (
                <button
                  key={g.id}
                  title={g.nazov}
                  onClick={() => nacitajObrazokAkoErb(g.url, true)}
                  className={`aspect-square rounded-lg bg-slate-800 border-2 overflow-hidden ${configState.loga.typErbu === 'custom' ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <img src={g.url} alt={g.nazov} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <label className="block text-[11px] text-slate-400 mb-1">Nahrať vlastné logo (.PNG, .SVG):</label>
          <input type="file" accept="image/*" onChange={naUpload} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer" />
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">2. Značka dresu (Pravá hruď)</span>
            <span className="text-[10px] text-slate-400">Logo športovej značky</span>
          </div>
          <input type="checkbox" checked={configState.loga.zobrazitBrandLogo} onChange={(e) => onZmenLoga({ zobrazitBrandLogo: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <select
          value={configState.loga.brandIcon}
          onChange={(e) => onZmenLoga({ brandIcon: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-indigo-500"
        >
          {BRAND_LOGA.map(b => <option key={b.id} value={b.id}>{b.nazov}</option>)}
        </select>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">3. Odznak ligy na rukáve</span>
          <span className="text-[10px] text-slate-400">Patch na pravom rukáve</span>
        </div>
        <input type="checkbox" checked={configState.loga.zobrazitOdznakRukav} onChange={(e) => onZmenLoga({ zobrazitOdznakRukav: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
      </div>
    </div>
  );
}
