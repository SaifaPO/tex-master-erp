import React from 'react';
import { RYCHLE_FARBY } from './dresPresets';

const ZONY = [
  { key: 'zakladna', cislo: 1, nazov: 'Hlavné telo (Základ)', popis: 'Dominantná farba' },
  { key: 'vzor', cislo: 2, nazov: 'Hlavný vzor', popis: 'Pásy a grafické prvky' },
  { key: 'akcent', cislo: 3, nazov: 'Doplnkový akcent', popis: 'Detaily a prechody' },
  { key: 'rukava', cislo: 4, nazov: 'Rukávy a manžety', popis: 'Farba rukávov' },
  { key: 'golier', cislo: 5, nazov: 'Golier & Lemy', popis: 'Lemovanie krku' },
];

export default function FarbyZonyTab({ configState, onZmenFarbu, aktivnaZona, onZmenAktivnuZonu }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Farebné zóny dresu</h3>
        <p className="text-xs text-slate-400">Prispôsobte farbu každej časti samostatne.</p>
      </div>

      <div className="space-y-3">
        {ZONY.map(z => (
          <div
            key={z.key}
            className={`bg-slate-950 p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${aktivnaZona === z.key ? 'border-indigo-500' : 'border-slate-800/80'}`}
            onClick={() => onZmenAktivnuZonu(z.key)}
          >
            <div>
              <span className="text-xs font-bold text-white block">{z.cislo}. {z.nazov}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">{z.popis}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={configState.farby[z.key]}
                onChange={(e) => onZmenFarbu(z.key, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-xs font-mono font-bold text-slate-300">{configState.farby[z.key].toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-bold text-slate-400 block mb-2">
          Rýchle farby pre zónu: <span className="text-slate-200">{ZONY.find(z => z.key === aktivnaZona)?.nazov}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {RYCHLE_FARBY.map(hex => (
            <button
              key={hex}
              onClick={() => onZmenFarbu(aktivnaZona, hex)}
              style={{ backgroundColor: hex }}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-slate-700 hover:scale-110 transition shadow"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
