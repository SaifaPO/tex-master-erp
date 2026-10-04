import React from 'react';
import { Boxes, Zap, ShoppingBag, Loader2, AlertTriangle, Flag, GripVertical, Layers } from 'lucide-react';
import NumberInput from '../NumberInput';
import RozpisCeny from './RozpisCeny';

// Jednoduchy stepper s priamym zadanim kusov.
function Stepper({ hodnota, onZmen, min = 0 }) {
  return (
    <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shrink-0">
      <button type="button" onClick={() => onZmen(Math.max(min, hodnota - 1))} className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-xs">-</button>
      <NumberInput min={min} value={hodnota} onChange={(v) => onZmen(Math.max(min, v))} fallback={min} className="w-12 text-center text-xs font-bold border-x border-slate-200 py-1.5 focus:outline-none" />
      <button type="button" onClick={() => onZmen(hodnota + 1)} className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-xs">+</button>
    </div>
  );
}

export default function DoplnkyTab({
  katalog, cenyVolieb, doplnkyMnozstva, onZmenMnozstvo,
  tvarKod, velkostKod, stoziareMn, onStoziarMn, podstavceMn, onPodstavecMn,
  expresne, onExpresne, pocetKs, onPocetKs,
  osobnyOdber, onOsobnyOdber,
  cena, cenaNacitava, cenaChyba, isSubmitting, submitError, onObjednat, onSpat,
}) {
  const tvar = katalog.tvary.find(t => t.kod === tvarKod);
  const dostupnePruty = katalog.stoziare.filter(st => st.kod !== 'none' && (!st.tvarIds?.length || st.tvarIds.includes(tvar?.id)));
  const podstavce = katalog.podstavce;
  const riadokMnozstva = (kod, nazov, cenaTxt, hodnota, onZmen, extra) => (
    <div key={kod} className={`p-3 rounded-xl border flex items-center gap-3 ${hodnota > 0 ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white'}`}>
      <div className="flex-1 min-w-0">
        <span className="font-bold text-xs text-slate-900 block truncate">{nazov}</span>
        <span className="text-xs font-semibold text-indigo-600 block">{cenaTxt}</span>
        {extra}
      </div>
      <Stepper hodnota={hodnota} onZmen={onZmen} />
    </div>
  );
  const cenaKs = (c) => (c == null ? '…' : c > 0 ? `+${Number(c).toFixed(2)} € / ks` : 'V cene');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div>
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1"><Flag className="w-4 h-4 text-indigo-600" /> Množstvo</label>
          <p className="text-xs text-slate-500">Zvoľ, koľko kusov z čoho chceš.</p>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-indigo-600 bg-indigo-50/50">
          <span className="font-bold text-xs text-slate-900">Vlajky</span>
          <Stepper hodnota={pocetKs} onZmen={(v) => onPocetKs(Math.max(1, v))} min={1} />
        </div>

        <div>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2"><GripVertical className="w-3.5 h-3.5 text-indigo-600" /> Prúty / konštrukcie</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dostupnePruty.map(st => riadokMnozstva(st.kod, st.nazov, cenaKs(cenyVolieb?.stoziare?.[st.kod]), stoziareMn?.[st.kod] || 0, (v) => onStoziarMn(st.kod, v)))}
          </div>
        </div>

        <div>
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2"><Layers className="w-3.5 h-3.5 text-indigo-600" /> Podstavce</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {podstavce.map(p => {
              const nastavenie = p.ceny?.[velkostKod];
              return riadokMnozstva(p.kod, p.nazov, cenaKs(cenyVolieb?.podstavce?.[p.kod]), podstavceMn?.[p.kod] || 0, (v) => onPodstavecMn(p.kod, v),
                nastavenie?.vhodny === false ? <span className="text-[10px] text-amber-600 font-semibold block">Neodporúča sa pre túto veľkosť</span> : null);
            })}
            {podstavce.length === 0 && <p className="text-xs text-slate-400 italic">Žiadne podstavce.</p>}
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Cena za kus sa mierne znižuje s počtom kusov danej položky. Presná cena je v rozpise nižšie.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2"><Boxes className="w-4 h-4 text-indigo-600" /> Príslušenstvo</label>
          <span className="text-xs text-slate-500">Počet kusov celkom</span>
        </div>
        {katalog.doplnky.length === 0 && <p className="text-xs text-slate-400 italic">Žiadne ďalšie príslušenstvo. Podstavec sa vyberá v kroku Parametre.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {katalog.doplnky.map(d => {
            const qty = doplnkyMnozstva[d.kod] || 0;
            return (
              <div key={d.kod} className={`p-3 rounded-xl border flex items-center gap-3 ${qty > 0 ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-xs text-slate-900 block truncate">{d.nazov}</span>
                  <span className="text-xs font-semibold text-indigo-600 block">{cenyVolieb?.doplnky?.[d.kod] == null ? '…' : `+${Number(cenyVolieb.doplnky[d.kod]).toFixed(2)} € / ks`}</span>
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
              <p className="text-[11px] text-amber-700">Garantované dodanie do 5 pracovných dní od schválenia tlačových podkladov.</p>
            </div>
          </div>
          <span className="font-bold text-xs text-amber-800 bg-amber-200/60 px-2 py-1 rounded">+{Number(katalog.nastavenia.expresny_priplatok_percent).toFixed(0)}%</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={osobnyOdber} onChange={(e) => onOsobnyOdber(e.target.checked)} />
          <span className="text-xs text-slate-600">Osobný odber v Prešove alebo Košiciach (neplatím poštovné)</span>
        </label>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button onClick={onObjednat} disabled={isSubmitting || cenaNacitava || !cena} className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2">
            {isSubmitting || cenaNacitava ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Objednať {cena ? `(${cena.cenaSpolu.toFixed(2)} €)` : '…'}
          </button>
        </div>
      </div>

      {submitError && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg">{submitError}</p>}
      {cenaChyba && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {cenaChyba}</p>}

      <RozpisCeny cena={cena} pocetKs={pocetKs} osobnyOdber={osobnyOdber} />

      <div className="pt-2 flex justify-start">
        <button onClick={onSpat} className="text-slate-600 hover:text-slate-900 px-4 py-2 text-xs font-bold">← Späť na Grafiku</button>
      </div>
    </div>
  );
}
