import React, { useState } from 'react';
import { Palette, Type, Image as ImageIcon, Sparkles } from 'lucide-react';
import LayersPanel from './LayersPanel';

export default function GrafikaTab({
  katalog, bgColor, onBgColor, pantoneNote, onPantoneNote,
  customText, onCustomTextChange, onPridajText,
  onUploadObrazok,
  canvas, canvasVersion,
  onSpat, onDalej,
}) {
  const [pantoneFilter, setPantoneFilter] = useState('');

  const filtrovanePantone = katalog.pantone.filter(p =>
    p.kod.toLowerCase().includes(pantoneFilter.toLowerCase()) || p.hex.toLowerCase().includes(pantoneFilter.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Palette className="w-4 h-4 text-indigo-600" /> Farba pozadia vlajky a Pantone vzorkovník</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rýchly výber farby pozadia</label>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={(e) => onBgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-slate-300" />
              <input type="text" value={bgColor} onChange={(e) => onBgColor(e.target.value)} className="w-28 text-xs font-mono uppercase px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Hľadať v Pantone knižnici</label>
            <input type="text" value={pantoneFilter} onChange={(e) => setPantoneFilter(e.target.value)} placeholder="napr. 185, Yellow, Blue…" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
          {filtrovanePantone.map(p => (
            <button key={p.id} type="button" onClick={() => { onBgColor(p.hex); onPantoneNote(`Vybrané z palety: ${p.kod}`); }} className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100">
              <span className="w-5 h-5 rounded-md border border-slate-300 shadow-inner block" style={{ background: p.hex }} />
              <span className="text-[11px] font-mono font-medium text-slate-700">{p.kod}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Poznámka k farbe / špeciálny odtieň</label>
          <input type="text" value={pantoneNote} onChange={(e) => onPantoneNote(e.target.value)} placeholder="napr. Presná farba podľa nášho manuálu" className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Type className="w-4 h-4 text-indigo-600" /> Pridať vlastný text</h4>
          <div className="flex gap-2">
            <input type="text" value={customText} onChange={(e) => onCustomTextChange(e.target.value)} placeholder="Váš text sem…" className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg" />
            <button onClick={onPridajText} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold">Pridať</button>
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-600" /> Nahrať vlastné logo / grafiku</h4>
          <p className="text-[11px] text-slate-500">PNG, JPG, SVG. Transparentné pozadie je ideálne.</p>
          <label className="block cursor-pointer bg-white border border-dashed border-indigo-300 hover:border-indigo-500 rounded-lg p-3 text-center">
            <span className="block text-xs font-bold text-slate-700">Vybrať súbor z počítača</span>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUploadObrazok(e.target.files[0])} className="hidden" />
          </label>
        </div>
      </div>

      <LayersPanel canvas={canvas} />

      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-indigo-700/50 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-300" />
          <div>
            <h4 className="font-bold text-sm text-indigo-100">Nemáte grafiku? Vytvorte si ju zadarmo</h4>
            <p className="text-[11px] text-indigo-300">Napíšte si svoj nápad (napr. "letná plážová vlna, tropické palmy") do niektorého z bezplatných AI nástrojov a výsledok si sem nahrajte tlačidlom vyššie.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {[{ n: 'Google Gemini', u: 'https://gemini.google.com' }, { n: 'ChatGPT', u: 'https://chatgpt.com' }, { n: 'Microsoft Copilot Designer', u: 'https://copilot.microsoft.com/images/create' }].map(t => (
            <a key={t.n} href={t.u} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg">{t.n} ↗</a>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-between">
        <button onClick={onSpat} className="text-slate-600 hover:text-slate-900 px-4 py-2 text-xs font-bold">← Späť na Parametre</button>
        <button onClick={onDalej} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">Pokračovať na Doplnky →</button>
      </div>
    </div>
  );
}
