import React from 'react';
import { Scroll, CircleDot, Link as LinkIcon, Ribbon, Plus, Zap, ShoppingBag, Loader2 } from 'lucide-react';

const STRANY = [
  { value: 'top', label: 'Hore' }, { value: 'bottom', label: 'Dole' },
  { value: 'left', label: 'Vľavo' }, { value: 'right', label: 'Vpravo' },
];

export default function DoplnkyTab({
  tunely, onTunely, ocka, onOcka, karabinky, onKarabinky, popruhy, onPopruhy,
  expresne, onExpresne, expresnyPriplatokPercent,
  pocetKs, onPocetKs,
  cena, cenaChyba, cenaNacitava,
  isSubmitting, submitError, onObjednat, onSpat,
}) {
  const pridajTunel = () => onTunely([...tunely, { side: 'bottom' }]);
  const zmazTunel = (i) => onTunely(tunely.filter((_, idx) => idx !== i));
  const upravTunel = (i, patch) => onTunely(tunely.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  const pridajOcko = () => onOcka([...ocka, { side: 'all', count: 10 }]);
  const zmazOcko = (i) => onOcka(ocka.filter((_, idx) => idx !== i));
  const upravOcko = (i, patch) => onOcka(ocka.map((o, idx) => idx === i ? { ...o, ...patch } : o));

  const pridajKarabinku = () => onKarabinky([...karabinky, { side: 'left', count: 5 }]);
  const zmazKarabinku = (i) => onKarabinky(karabinky.filter((_, idx) => idx !== i));
  const upravKarabinku = (i, patch) => onKarabinky(karabinky.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Scroll className="w-4 h-4 text-indigo-600" /> Tunely / rukávy</span>
          <button onClick={pridajTunel} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3" /> Pridať tunel</button>
        </div>
        {tunely.map((t, i) => (
          <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
            <select value={t.side} onChange={(e) => upravTunel(i, { side: e.target.value })} className="border rounded p-1">
              {STRANY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => zmazTunel(i)} className="text-red-500 hover:text-red-700 ml-auto font-bold px-1">×</button>
          </div>
        ))}
        {tunely.length === 0 && <p className="text-[11px] text-slate-400">Zatiaľ žiadny tunel.</p>}
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><CircleDot className="w-4 h-4 text-indigo-600" /> Kovové priechodky (očká)</span>
          <button onClick={pridajOcko} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3" /> Pridať očká</button>
        </div>
        {ocka.map((o, i) => (
          <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
            <select value={o.side} onChange={(e) => upravOcko(i, { side: e.target.value })} className="border rounded p-1">
              <option value="all">Všetky strany</option>
              {STRANY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              <option value="corners">4 rohy</option>
            </select>
            {o.side !== 'corners' && (
              <>
                <span className="text-slate-500">Počet:</span>
                <input type="number" min="1" value={o.count} onChange={(e) => upravOcko(i, { count: parseInt(e.target.value) || 1 })} className="w-14 border rounded p-1 text-center" />
              </>
            )}
            <button onClick={() => zmazOcko(i)} className="text-red-500 hover:text-red-700 ml-auto font-bold px-1">×</button>
          </div>
        ))}
        {ocka.length === 0 && <p className="text-[11px] text-slate-400">Zatiaľ žiadne očká.</p>}
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Ribbon className="w-4 h-4 text-indigo-600" /> Spevňujúci popruh</span>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {STRANY.map(s => (
            <label key={s.value} className="p-1.5 bg-white border rounded text-center cursor-pointer hover:bg-slate-100">
              <input type="checkbox" checked={!!popruhy[s.value]} onChange={(e) => onPopruhy({ ...popruhy, [s.value]: e.target.checked })} className="mb-1 block mx-auto" />
              <span className="text-[11px] block">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><LinkIcon className="w-4 h-4 text-indigo-600" /> Kovové karabínky</span>
          <button onClick={pridajKarabinku} className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium px-2 py-1 rounded flex items-center gap-1"><Plus className="w-3 h-3" /> Pridať karabínky</button>
        </div>
        {karabinky.map((c, i) => (
          <div key={i} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200 text-xs">
            <select value={c.side} onChange={(e) => upravKarabinku(i, { side: e.target.value })} className="border rounded p-1">
              {STRANY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              <option value="all">Všetky strany</option>
            </select>
            <span className="text-slate-500">Počet:</span>
            <input type="number" min="1" value={c.count} onChange={(e) => upravKarabinku(i, { count: parseInt(e.target.value) || 1 })} className="w-14 border rounded p-1 text-center" />
            <button onClick={() => zmazKarabinku(i)} className="text-red-500 hover:text-red-700 ml-auto font-bold px-1">×</button>
          </div>
        ))}
        {karabinky.length === 0 && <p className="text-[11px] text-slate-400">Zatiaľ žiadne karabínky.</p>}
      </div>

      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
        <label className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/80">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={expresne} onChange={(e) => onExpresne(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded" />
            <div>
              <span className="font-bold text-xs sm:text-sm text-amber-900 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-600" /> Expresné vyhotovenie</span>
              <p className="text-[11px] text-amber-700">Garantované odoslanie do 24/48 hodín od schválenia tlačových podkladov.</p>
            </div>
          </div>
          <span className="font-bold text-xs text-amber-800 bg-amber-200/60 px-2 py-1 rounded">+{Number(expresnyPriplatokPercent || 10).toFixed(0)}%</span>
        </label>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-700">Počet kusov</label>
            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
              <button onClick={() => onPocetKs(Math.max(1, pocetKs - 1))} className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold">-</button>
              <input type="number" min="1" value={pocetKs} onChange={(e) => onPocetKs(Math.max(1, parseInt(e.target.value) || 1))} className="w-12 text-center text-xs font-bold border-x border-slate-200 py-2 focus:outline-none" />
              <button onClick={() => onPocetKs(pocetKs + 1)} className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold">+</button>
            </div>
          </div>

          <button onClick={onObjednat} disabled={isSubmitting || !cena} className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Objednať {cena ? `(${cena.cenaSpolu.toFixed(2)} €)` : ''}
          </button>
        </div>
      </div>

      {submitError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg">{submitError}</p>}
      {cenaChyba && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg">Cenu sa nepodarilo prepočítať: {cenaChyba}</p>}

      <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Rozpis ceny</h4>
        {cenaNacitava ? (
          <p className="text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Prepočítavam…</p>
        ) : cena ? (
          <>
            <div className="flex justify-between"><span>Cena za kus</span><span className="font-semibold">{cena.cenaKus.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span>Medzisúčet ({pocetKs} ks)</span><span className="font-semibold">{cena.subtotal.toFixed(2)} €</span></div>
            {cena.expresnyPriplatok > 0 && <div className="flex justify-between text-amber-700 font-semibold"><span>Expresný príplatok</span><span>{cena.expresnyPriplatok.toFixed(2)} €</span></div>}
            <div className="flex justify-between pt-1 border-t border-slate-200"><span>Spolu bez DPH</span><span className="font-semibold">{cena.cenaBezDph.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span>DPH</span><span className="font-semibold">{cena.dphSuma.toFixed(2)} €</span></div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1"><span>Celkom s DPH</span><span>{cena.cenaSpolu.toFixed(2)} €</span></div>
          </>
        ) : (
          <p className="text-slate-400">—</p>
        )}
      </div>

      <div className="pt-2 flex justify-start">
        <button onClick={onSpat} className="text-slate-600 hover:text-slate-900 px-4 py-2 text-xs font-bold">← Späť na Grafiku</button>
      </div>
    </div>
  );
}
