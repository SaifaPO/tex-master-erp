import React, { useEffect, useState } from 'react';

// Bezny <input type="number"> viazany priamo na cisselny state ma znamy React bug: ked
// pouzivatel oznaci vsetko a zmaze (hodnota je docasne ""), parseInt/parseFloat("") vrati NaN,
// "NaN || fallback" hned nastavi fallback cislo naspat — pole sa preto NIKDY nedostane do
// prazdneho stavu a nejde ho normalne cely vymazat a prepisat (Martin 2026-09-30). Riesenie:
// vlastny lokalny textovy stav nezavisly od rodicovskeho cisla, synchronizovany len spatne
// (externy reset) a na blur (doplnenie, ak pouzivatel odide s prazdnym/nespravnym textom).
export default function NumberInput({ value, onChange, min, max, step, fallback, className, ...rest }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));

  useEffect(() => {
    // len ked sa zvonku skutocne zmenila cisla hodnota (nie kazdy render) - inak by to
    // prepisalo rozpracovany text pouzivatela (napr. "12." pri pisani desatinnej bodky).
    const aktualne = parseFloat(text);
    if (value !== aktualne && !(text === '' && (value === null || value === undefined))) {
      setText(value === null || value === undefined ? '' : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    if (v === '' || v === '-' || v === '.' || v === '-.') return; // rozpracovany vstup, este neposielat rodicovi
    const num = parseFloat(v);
    if (!Number.isNaN(num)) onChange(num);
  };

  const handleBlur = (e) => {
    const num = parseFloat(text);
    if (text === '' || Number.isNaN(num)) {
      const doplnena = fallback ?? min ?? 0;
      setText(String(doplnena));
      onChange(doplnena);
    }
    rest.onBlur?.(e);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      className={className}
      {...rest}
    />
  );
}
