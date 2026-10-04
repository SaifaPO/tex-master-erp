import React from 'react';

// Rozpis ceny po polozkach — pouziva sa v poslednom kroku aj v lište dole (viditelnom pocas celeho objednavania).
export default function RozpisCeny({ cena, pocetKs, osobnyOdber, kompaktny = false }) {
  if (!cena) return null;
  return (
    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Rozpis ceny</h4>
      {cena.rozpis ? (
        <div className="space-y-2">
          <div>
            <div className="font-semibold text-slate-800">Vlajka</div>
            <div className="flex justify-between pl-3"><span>{cena.rozpis.vlajka.mnozstvo} ks × {cena.rozpis.vlajka.cenaZaKus.toFixed(2)} € (materiál + opracovanie)</span><span className="font-semibold">{cena.rozpis.vlajka.spolu.toFixed(2)} €</span></div>
          </div>
          {cena.rozpis.stoziare.length > 0 && (
            <div>
              <div className="font-semibold text-slate-800">Konštrukcia / prút</div>
              {cena.rozpis.stoziare.map((x, i) => <div key={i} className="flex justify-between pl-3"><span>{x.nazov} · {x.mnozstvo} ks × {x.cenaZaKus.toFixed(2)} €</span><span className="font-semibold">{x.spolu.toFixed(2)} €</span></div>)}
            </div>
          )}
          {cena.rozpis.podstavce.length > 0 && (
            <div>
              <div className="font-semibold text-slate-800">Podstavec</div>
              {cena.rozpis.podstavce.map((x, i) => <div key={i} className="flex justify-between pl-3"><span>{x.nazov} · {x.mnozstvo} ks × {x.cenaZaKus.toFixed(2)} €</span><span className="font-semibold">{x.spolu.toFixed(2)} €</span></div>)}
            </div>
          )}
          {cena.rozpis.doplnky.length > 0 && (
            <div>
              <div className="font-semibold text-slate-800">Príslušenstvo / doplnky</div>
              {cena.rozpis.doplnky.map((x, i) => <div key={i} className="flex justify-between pl-3"><span>{x.nazov} · {x.mnozstvo} ks × {x.cenaZaKus.toFixed(2)} €</span><span className="font-semibold">{x.spolu.toFixed(2)} €</span></div>)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-between"><span>Vlajky ({pocetKs}× materiál + opracovanie)</span><span className="font-semibold">{Number(cena.vlajkySpolu ?? cena.zaklad * pocetKs).toFixed(2)} €</span></div>
      )}
      {cena.expresnyPriplatok > 0 && <div className="flex justify-between text-amber-700 font-semibold"><span>Expresný príplatok</span><span>{cena.expresnyPriplatok.toFixed(2)} €</span></div>}
      <div className="flex justify-between"><span>Doprava</span><span className="font-semibold">{!cena.doprava ? 'Zdarma' : `${Number(cena.doprava).toFixed(2)} €`}</span></div>
      {cena.postovneZdarmaOd > 0 && !osobnyOdber && (cena.doDopravyZdarma > 0
        ? <p className="text-[11px] text-emerald-700">Poštovné zdarma pri objednávke od {Number(cena.postovneZdarmaOd).toFixed(0)} € (ešte {Number(cena.doDopravyZdarma).toFixed(2)} € s DPH).</p>
        : (cena.doprava === 0 && <p className="text-[11px] text-emerald-700">Poštovné zdarma, objednávka je nad {Number(cena.postovneZdarmaOd).toFixed(0)} €.</p>))}
      <div className="flex justify-between pt-1 border-t border-slate-200"><span>Spolu bez DPH</span><span className="font-semibold">{cena.cenaBezDph.toFixed(2)} €</span></div>
      <div className="flex justify-between"><span>DPH</span><span className="font-semibold">{cena.dphSuma.toFixed(2)} €</span></div>
      <div className="flex justify-between text-sm font-black text-slate-900 pt-1"><span>Celkom s DPH</span><span>{cena.cenaSpolu.toFixed(2)} €</span></div>
    </div>
  );
}
