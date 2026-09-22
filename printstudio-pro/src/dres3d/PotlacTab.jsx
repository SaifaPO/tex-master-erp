import React from 'react';
import { POZICIE_CISLA_VPREDU } from './dresPresets';

const FALLBACK_FONTY = ['Teko', 'Chakra Petch', 'Oswald', 'Inter'];

export default function PotlacTab({ configState, fonty, onZmenText, onZmenCislo }) {
  const zoznamFontov = fonty && fonty.length > 0 ? [...new Set(fonty.map(f => f.nazov))] : FALLBACK_FONTY;
  const cislo = configState.cislo || {};

  return (
    <div className="space-y-3">
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Meno hráča (Chrbát)</span>
          <input type="checkbox" checked={configState.text.zobrazitMeno} onChange={(e) => onZmenText({ zobrazitMeno: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <input
          type="text" maxLength={30} placeholder="MENO HRÁČA"
          value={configState.text.menoHraca}
          onChange={(e) => onZmenText({ menoHraca: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Farba textu</label>
            <input type="color" value={configState.text.farbaTextu} onChange={(e) => onZmenText({ farbaTextu: e.target.value })} className="w-full h-7 rounded bg-transparent cursor-pointer" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Farba obrysu</label>
            <input type="color" value={configState.text.farbaObrysu} onChange={(e) => onZmenText({ farbaObrysu: e.target.value })} className="w-full h-7 rounded bg-transparent cursor-pointer" />
          </div>
        </div>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Obrys textu (Meno/Nápisy)</span>
          <input type="checkbox" checked={configState.text.obrysZapnuty} onChange={(e) => onZmenText({ obrysZapnuty: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        {configState.text.obrysZapnuty && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[11px] text-slate-400">Hrúbka obrysu</label>
              <span className="text-[11px] text-slate-300 font-semibold">{configState.text.obrysHrubkaMm} mm</span>
            </div>
            <input
              type="range" min={1} max={8} step={0.5}
              value={configState.text.obrysHrubkaMm}
              onChange={(e) => onZmenText({ obrysHrubkaMm: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[11px] text-slate-400">Medzera medzi písmenami</label>
            <span className="text-[11px] text-slate-300 font-semibold">{configState.text.pismenaMedzeraPx || 0} px</span>
          </div>
          <input
            type="range" min={-3} max={20} step={1}
            value={configState.text.pismenaMedzeraPx || 0}
            onChange={(e) => onZmenText({ pismenaMedzeraPx: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Číslo dresu</span>
          <input type="checkbox" checked={configState.text.zobrazitCislo} onChange={(e) => onZmenText({ zobrazitCislo: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <div className="flex gap-3">
          <input
            type="number" min={0} max={99}
            value={configState.text.cisloHraca}
            onChange={(e) => onZmenText({ cisloHraca: e.target.value })}
            className="w-20 sm:w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-center text-xl font-extrabold text-white focus:outline-none focus:border-indigo-500"
          />
          <div className="flex-1 flex flex-col justify-center gap-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={configState.text.cisloVpredu} onChange={(e) => onZmenText({ cisloVpredu: e.target.checked })} className="rounded text-indigo-500 bg-slate-900 border-slate-700" /> Malé vpredu
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={configState.text.cisloVzadu} onChange={(e) => onZmenText({ cisloVzadu: e.target.checked })} className="rounded text-indigo-500 bg-slate-900 border-slate-700" /> Veľké vzadu
            </label>
          </div>
        </div>
        {configState.text.cisloVpredu && (
          <select
            value={configState.text.cisloVpreduPozicia}
            onChange={(e) => onZmenText({ cisloVpreduPozicia: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white w-full focus:outline-none focus:border-indigo-500"
          >
            {POZICIE_CISLA_VPREDU.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
          </select>
        )}
        <div className="pt-1 border-t border-slate-800 space-y-2">
          <span className="text-[11px] text-slate-400 font-semibold">Farby čísla (nezávislé od mena)</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Výplň</label>
              <input type="color" value={cislo.farbaVypln} onChange={(e) => onZmenCislo({ farbaVypln: e.target.value })} className="w-full h-7 rounded bg-transparent cursor-pointer" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-0.5">Obrys 1</label>
              <input type="color" value={cislo.farbaObrys1} onChange={(e) => onZmenCislo({ farbaObrys1: e.target.value })} className="w-full h-7 rounded bg-transparent cursor-pointer" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[11px] text-slate-400">Hrúbka obrysu 1</label>
              <span className="text-[11px] text-slate-300 font-semibold">{cislo.obrys1HrubkaMm} mm</span>
            </div>
            <input type="range" min={0} max={8} step={0.5} value={cislo.obrys1HrubkaMm} onChange={(e) => onZmenCislo({ obrys1HrubkaMm: Number(e.target.value) })} className="w-full" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Druhý (vonkajší) obrys</span>
            <input type="checkbox" checked={cislo.zobrazitObrys2} onChange={(e) => onZmenCislo({ zobrazitObrys2: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
          </div>
          {cislo.zobrazitObrys2 && (
            <>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Farba obrysu 2</label>
                <input type="color" value={cislo.farbaObrys2} onChange={(e) => onZmenCislo({ farbaObrys2: e.target.value })} className="w-full h-7 rounded bg-transparent cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[11px] text-slate-400">Hrúbka obrysu 2</label>
                  <span className="text-[11px] text-slate-300 font-semibold">{cislo.obrys2HrubkaMm} mm</span>
                </div>
                <input type="range" min={0} max={8} step={0.5} value={cislo.obrys2HrubkaMm} onChange={(e) => onZmenCislo({ obrys2HrubkaMm: Number(e.target.value) })} className="w-full" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <span className="text-xs font-bold text-white uppercase tracking-wider block">Typ písma</span>
        <div className="grid grid-cols-2 gap-2">
          {zoznamFontov.map(font => (
            <button
              key={font}
              onClick={() => onZmenText({ fontRodina: font })}
              className={`p-2 rounded-lg border-2 bg-slate-900 text-center transition ${configState.text.fontRodina === font ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'}`}
            >
              <span className="block text-base font-bold text-white" style={{ fontFamily: `"${font}", sans-serif` }}>10 {font.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Nápis nad číslom (Hruď)</span>
          <input type="checkbox" checked={configState.text.zobrazitTimText} onChange={(e) => onZmenText({ zobrazitTimText: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <input
          type="text" placeholder="NÁZOV SPONZORA / TÍMU"
          value={configState.text.timText}
          onChange={(e) => onZmenText({ timText: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Nápis pod číslom (Hruď)</span>
          <input type="checkbox" checked={configState.text.zobrazitNapisPodCislom} onChange={(e) => onZmenText({ zobrazitNapisPodCislom: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>
        <input
          type="text" placeholder="DOPLNKOVÝ TEXT"
          value={configState.text.napisPodCislom}
          onChange={(e) => onZmenText({ napisPodCislom: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
