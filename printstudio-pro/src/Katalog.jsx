import React, { useState } from 'react';

const NAZVY_POHLAVIA = { muz: 'Muž', zena: 'Žena', dieta: 'Dieťa', unisex: 'Unisex' };

export default function Katalog({ kategorie, produkty, onVyberProduktu }) {
  const [aktivnaKategoria, setAktivnaKategoria] = useState(null);

  if (aktivnaKategoria == null) {
    return (
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        <h2 className="text-xl font-extrabold text-slate-900 mb-1">Čo chceš potlačiť?</h2>
        <p className="text-sm text-slate-500 mb-5">Vyber kategóriu a potom konkrétny produkt zo skladu.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {kategorie.map(k => {
            const pocet = produkty.filter(p => p.kategoria_id === k.id).length;
            if (pocet === 0) return null;
            return (
              <button key={k.id} onClick={() => setAktivnaKategoria(k)} className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-indigo-400 hover:shadow-sm transition">
                <div className="font-bold text-slate-900">{k.nazov}</div>
                <div className="text-xs text-slate-400 mt-1">{pocet} produkt{pocet === 1 ? '' : 'y'}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const produktyKategorie = produkty.filter(p => p.kategoria_id === aktivnaKategoria.id);
  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
      <button onClick={() => setAktivnaKategoria(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-4">
        ← Späť na kategórie
      </button>
      <h2 className="text-xl font-extrabold text-slate-900 mb-5">{aktivnaKategoria.nazov}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {produktyKategorie.map(p => (
          <button key={p.id} onClick={() => onVyberProduktu(p.id)} className="relative bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-indigo-400 hover:shadow-sm transition">
            {p.typ_konfiguratora === '3d_dres' && (
              <span className="absolute top-2.5 right-2.5 text-[9px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">3D</span>
            )}
            <div className="w-full h-20 rounded-lg mb-2 flex items-center justify-center bg-slate-50 text-slate-300 text-xs">{p.nazov}</div>
            <div className="font-semibold text-sm text-slate-900">{p.nazov}</div>
            <div className="text-xs text-slate-400">{NAZVY_POHLAVIA[p.pohlavie] || ''} · {Number(p.zakladna_cena).toFixed(2)} €</div>
          </button>
        ))}
        {produktyKategorie.length === 0 && <p className="text-sm text-slate-400 col-span-full">Žiadne produkty v tejto kategórii.</p>}
      </div>
    </div>
  );
}
