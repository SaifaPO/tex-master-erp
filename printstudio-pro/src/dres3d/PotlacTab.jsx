import React from 'react';

const FALLBACK_FONTY = ['Teko', 'Chakra Petch', 'Oswald', 'Inter'];

export default function PotlacTab({ configState, fonty, onZmenText }) {
  const zoznamFontov = fonty && fonty.length > 0 ? [...new Set(fonty.map(f => f.nazov))] : FALLBACK_FONTY;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Meno, Číslo a Tímový nápis</h3>
        <p className="text-xs text-slate-400">Nastavte písmo, čísla a klubové nápisy.</p>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Meno hráča (Chrbát)</span>
          <input type="checkbox" checked={configState.text.zobrazitMeno} onChange={(e) => onZmenText({ zobrazitMeno: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <input
          type="text" maxLength={15} placeholder="MENO HRÁČA"
          value={configState.text.menoHraca}
          onChange={(e) => onZmenText({ menoHraca: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Farba textu</label>
            <input type="color" value={configState.text.farbaTextu} onChange={(e) => onZmenText({ farbaTextu: e.target.value })} className="w-full h-8 rounded bg-transparent cursor-pointer" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Farba obrysu</label>
            <input type="color" value={configState.text.farbaObrysu} onChange={(e) => onZmenText({ farbaObrysu: e.target.value })} className="w-full h-8 rounded bg-transparent cursor-pointer" />
          </div>
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Číslo dresu</span>
          <input type="checkbox" checked={configState.text.zobrazitCislo} onChange={(e) => onZmenText({ zobrazitCislo: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <div className="flex gap-3">
          <input
            type="number" min={0} max={99}
            value={configState.text.cisloHraca}
            onChange={(e) => onZmenText({ cisloHraca: e.target.value })}
            className="w-20 sm:w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center text-xl font-extrabold text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={configState.text.cisloVpredu} onChange={(e) => onZmenText({ cisloVpredu: e.target.checked })} className="rounded text-indigo-500 bg-slate-900 border-slate-700" /> Malé vpredu
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={configState.text.cisloVzadu} onChange={(e) => onZmenText({ cisloVzadu: e.target.checked })} className="rounded text-indigo-500 bg-slate-900 border-slate-700" /> Veľké vzadu
            </label>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <span className="text-xs font-bold text-white uppercase tracking-wider block">Typ písma (Športový Font)</span>
        <div className="grid grid-cols-2 gap-2">
          {zoznamFontov.map(font => (
            <button
              key={font}
              onClick={() => onZmenText({ fontRodina: font })}
              className={`p-2.5 rounded-lg border-2 bg-slate-900 text-center transition ${configState.text.fontRodina === font ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'}`}
            >
              <span className="block text-lg font-bold text-white" style={{ fontFamily: `"${font}", sans-serif` }}>10 {font.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Názov klubu / Tímu (Hruď)</span>
          <input type="checkbox" checked={configState.text.zobrazitTimText} onChange={(e) => onZmenText({ zobrazitTimText: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <input
          type="text" placeholder="NÁZOV SPONZORA / TÍMU"
          value={configState.text.timText}
          onChange={(e) => onZmenText({ timText: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
