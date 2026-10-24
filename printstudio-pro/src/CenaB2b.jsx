import React from 'react';

// Zobrazenie ceny pri zapnutom B2B kóde: pôvodná cena (preškrtnutá) + cena po zľave. Bez kódu (percent 0) sa zobrazí len obyčajná cena.
// Zľavnená cena sa počíta rovnako ako na serveri: cena × (100 − %) / 100, zaokrúhlené na centy.
export const zlavnena = (v, percent) => Math.round((Number(v) || 0) * (100 - (Number(percent) || 0))) / 100;

export function CenaB2b({ v, p, suffix = ' €', digits = 2, staraCls = 'text-slate-500', novaCls = 'text-emerald-400' }) {
  const n = Number(v) || 0;
  const percent = Number(p) || 0;
  if (percent <= 0 || n <= 0) return <>{n.toFixed(digits)}{suffix}</>;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
      <s className={`${staraCls} font-normal`}>{n.toFixed(digits)}{suffix}</s>
      <span className={`font-bold ${novaCls}`}>{zlavnena(n, percent).toFixed(digits)}{suffix}</span>
    </span>
  );
}
