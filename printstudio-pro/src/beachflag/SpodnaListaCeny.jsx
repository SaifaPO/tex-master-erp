import React, { useState } from 'react';
import RozpisCeny from './RozpisCeny';

// Lista s cenou prilepena dole — viditelna pocas celeho objednavania (kroky Parametre, Grafika, Doplnky),
// aby zakaznik nemusel prepinat medzi krokmi, ked skusa rozne varianty vlajky.
export default function SpodnaListaCeny({ cena, cenaNacitava, pocetKs, osobnyOdber }) {
  const [otvorena, setOtvorena] = useState(false);
  if (!cena) return null;
  const pocetPoloziek = cena.rozpis ? cena.rozpis.stoziare.length + cena.rozpis.podstavce.length + cena.rozpis.doplnky.length : 0;
  return (
    <>
      <div className="h-24" />
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {otvorena && (
          <div className="max-w-7xl mx-auto px-4 pt-3 pb-1 max-h-[55vh] overflow-y-auto">
            <RozpisCeny cena={cena} pocetKs={pocetKs} osobnyOdber={osobnyOdber} />
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 truncate">
              {pocetKs}× vlajka{pocetPoloziek > 0 ? ' + prúty / podstavce / príslušenstvo' : ''}
              {!cena.doprava ? ' · doprava zdarma' : ` · doprava ${Number(cena.doprava).toFixed(2)} €`}
            </div>
            <div className="text-lg font-black text-slate-900 leading-tight">
              {cenaNacitava ? 'Prepočítavam…' : `${cena.cenaSpolu.toFixed(2)} € s DPH`}
            </div>
          </div>
          <button type="button" onClick={() => setOtvorena(o => !o)} className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-2 bg-indigo-50">
            {otvorena ? 'Skryť rozpis ▼' : 'Rozpis ceny ▲'}
          </button>
        </div>
      </div>
    </>
  );
}
