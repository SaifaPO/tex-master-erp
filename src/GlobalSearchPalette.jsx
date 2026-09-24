import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';

// Odstrani diakritiku a zmensi na male pismena — nech "zastavy" najde aj "Vlajky/Zástavy".
function normalize(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Globalne vyhladavanie/prepinac kariet (Ctrl+K) — `entries` uz je vopred zredukovane na to,
// co sa sme aktualnemu pouzivatelovi smie zobrazit (filtrovanie podla role robi App.jsx).
export default function GlobalSearchPalette({ isOpen, onClose, entries }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return entries.slice(0, 8);
    return entries
      .filter(e => e.searchText.includes(q))
      .slice(0, 8);
  }, [entries, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!isOpen) return null;

  const vybrat = (entry) => {
    if (!entry) return;
    entry.onSelect();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); vybrat(results[activeIndex]); return; }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800">
          <Search className="h-4 w-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kam chceš prejsť? (napr. sklad, financie, vlajky...)"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
          />
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">Nič sa nenašlo.</p>
          )}
          {results.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => vybrat(entry)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIndex ? 'bg-indigo-600/90 text-white' : 'text-slate-300'}`}
            >
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-semibold truncate">{entry.label}</span>
                {entry.breadcrumb && <span className={`text-[11px] truncate ${i === activeIndex ? 'text-indigo-200' : 'text-slate-500'}`}>{entry.breadcrumb}</span>}
              </span>
              {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-3 text-[10px] text-slate-500">
          <span>↑↓ pohyb</span><span>Enter potvrdiť</span><span>Esc zavrieť</span>
        </div>
      </div>
    </div>
  );
}
