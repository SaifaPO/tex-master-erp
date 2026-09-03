import React from 'react';
import { Boxes, Zap, ShoppingBag, Loader2 } from 'lucide-react';

export default function DoplnkyTab({
  katalog, doplnkyMnozstva, onZmenMnozstvo,
  expresne, onExpresne, pocetKs, onPocetKs,
  cena, isSubmitting, submitError, onObjednat, onSpat,
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2"><Boxes className="w-4 h-4 text-indigo-600" /> Podstavce a príslušenstvo</label>
          <span className="text-xs text-slate-500">Môžete vybrať aj viaceré kusy</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {katalog.doplnky.map(d => {
            const qty = doplnkyMnozstva[d.kod] || 0;
            return (
              <div key={d.kod} className={`p-3 rounded-xl border flex items-center gap-3 ${qty > 0 ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-xs text-slate-900 block truncate">{d.nazov}</span>
                  <span className="text-xs font-semibold text-indigo-600 block">+{Number(d.cena).toFixed(2)} € / ks</span>
                  {d.popis && <p className="text-[10px] text-slate-500 truncate">{d.popis}</p>}
                </div>
                <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shrink-0">
                  <button onClick={() => onZmenMnozstvo(d.kod, -1)} className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs">-</button>
                  <span className="px-2 text-xs font-bold text-slate-800">{qty}</span>
                  <button onClick={() => onZmenMnozstvo(d.kod, 1, d.max_mnozstvo)} className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs">+</button>
                </div>
              </div>
            );
          })}
        </div>
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
          <span className="font-bold text-xs text-amber-800 bg-amber-200/60 px-2 py-1 rounded">+{Number(katalog.nastavenia.expresny_priplatok_percent).toFixed(0)}%</span>
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

          <button onClick={onObjednat} disabled={isSubmitting} className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Objednať ({cena.cenaSpolu.toFixed(2)} €)
          </button>
        </div>
      </div>

      {submitError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg">{submitError}</p>}

      <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Rozpis ceny</h4>
        <div className="flex justify-between"><span>Základ (veľkosť + opracovanie + prút)</span><span className="font-semibold">{cena.zaklad.toFixed(2)} €</span></div>
        <div className="flex justify-between"><span>Doplnky</span><span className="font-semibold">{cena.doplnkySpolu.toFixed(2)} €</span></div>
        {cena.expresnyPriplatok > 0 && <div className="flex justify-between text-amber-700 font-semibold"><span>Expresný príplatok</span><span>{cena.expresnyPriplatok.toFixed(2)} €</span></div>}
        <div className="flex justify-between pt-1 border-t border-slate-200"><span>Spolu bez DPH</span><span className="font-semibold">{cena.cenaBezDph.toFixed(2)} €</span></div>
        <div className="flex justify-between"><span>DPH</span><span className="font-semibold">{cena.dphSuma.toFixed(2)} €</span></div>
        <div className="flex justify-between text-sm font-black text-slate-900 pt-1"><span>Celkom s DPH</span><span>{cena.cenaSpolu.toFixed(2)} €</span></div>
      </div>

      <div className="pt-2 flex justify-start">
        <button onClick={onSpat} className="text-slate-600 hover:text-slate-900 px-4 py-2 text-xs font-bold">← Späť na Grafiku</button>
      </div>
    </div>
  );
}
