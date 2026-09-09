import React from 'react';
import { Ruler, Layers, Scissors, Sparkles } from 'lucide-react';

const STD_ROZMERY = [[150, 100], [200, 100], [300, 100]];

const SABLONY = [
  { id: 'stoziar', nazov: 'Stožiarová vlajka', popis: 'Tunel hore + karabínky vľavo' },
  { id: 'ulicna', nazov: 'Uličná zástava', popis: 'Obojstranný tunel hore aj dole' },
  { id: 'plot', nazov: 'Plotový banner', popis: 'Očká po celom obvode' },
  { id: 'karabiny', nazov: 'Karabínky + popruh', popis: 'Spevnená ľavá strana' },
];

export default function RozmeryTab({
  materialy, materialKod, onMaterial,
  sirkaCm, vyskaCm, onRozmery,
  vyhotovenie, onVyhotovenie,
  onSablona,
  onDalej,
}) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2"><Ruler className="w-4 h-4 text-indigo-600" /> Rozmery vlajky (cm)</label>
          <div className="flex gap-1">
            {STD_ROZMERY.map(([w, h]) => (
              <button key={`${w}x${h}`} onClick={() => onRozmery(w, h)} className="text-[11px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-700">{w}×{h}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[11px] text-slate-500 mb-1">Šírka (cm)</span>
            <input type="number" min="20" max="1000" value={sirkaCm} onChange={(e) => onRozmery(parseInt(e.target.value) || 20, vyskaCm)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 mb-1">Výška (cm)</span>
            <input type="number" min="20" max="1000" value={vyskaCm} onChange={(e) => onRozmery(sirkaCm, parseInt(e.target.value) || 20)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Plocha: {((sirkaCm * vyskaCm) / 10000).toFixed(2)} m²</p>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Layers className="w-4 h-4 text-indigo-600" /> Materiál vlajkoviny</label>
        <div className="space-y-2">
          {materialy.map(m => (
            <label key={m.kod} className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer transition ${materialKod === m.kod ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="material" checked={materialKod === m.kod} onChange={() => onMaterial(m.kod)} className="mt-1 text-indigo-600" />
              <div className="flex-1 text-xs">
                <span className="font-bold text-slate-800 block">{m.nazov}</span>
                {m.popis && <p className="text-slate-500 text-[11px]">{m.popis}</p>}
                {m.pouzitie && <p className="text-slate-400 text-[10px] mt-0.5">Použitie: {m.pouzitie}</p>}
              </div>
            </label>
          ))}
          {materialy.length === 0 && <p className="text-xs text-slate-500">Katalóg materiálov je zatiaľ prázdny.</p>}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Scissors className="w-4 h-4 text-indigo-600" /> Úprava okrajov</label>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer ${vyhotovenie === 'obsite' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" checked={vyhotovenie === 'obsite'} onChange={() => onVyhotovenie('obsite')} className="text-indigo-600" />
            <div><span className="font-bold block text-slate-800">Obšité dookola</span><span className="text-[10px] text-slate-500">Dvojitý steh s nitou</span></div>
          </label>
          <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer ${vyhotovenie === 'laser' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" checked={vyhotovenie === 'laser'} onChange={() => onVyhotovenie('laser')} className="text-indigo-600" />
            <div><span className="font-bold block text-slate-800">Orezané laserom</span><span className="text-[10px] text-slate-500">Tepelne zatavený okraj</span></div>
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-600" /> Rýchle šablóny vyhotovenia</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {SABLONY.map(s => (
            <button key={s.id} onClick={() => onSablona(s.id)} className="p-2 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-lg text-left transition">
              <div className="font-bold text-slate-800">{s.nazov}</div>
              <div className="text-[10px] text-slate-500">{s.popis}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Šablóna len predvyplní tunely/karabínky/popruh v ďalšom kroku — vždy si ich tam vieš doladiť.</p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button onClick={onDalej} disabled={!materialKod} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">Pokračovať na Grafiku →</button>
      </div>
    </div>
  );
}
