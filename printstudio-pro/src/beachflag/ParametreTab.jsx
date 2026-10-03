import React from 'react';
import { Shapes, Ruler, Scissors, GripVertical, Layers, TriangleAlert } from 'lucide-react';

// undefined = cenovnik sa este nacitava (alebo zlyhal) — radsej nic nez zavadzajuce 'V cene'.
const cenaText = (c) => (c == null ? '…' : c > 0 ? `+${Number(c).toFixed(2)} €` : 'V cene');

export default function ParametreTab({ katalog, cenyVolieb, tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, onTvar, onVelkost, onMaterial, onDokoncenie, onStoziar, onPodstavec, onDalej }) {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Shapes className="w-4 h-4 text-indigo-600" /> 1. Tvar Beachflagu</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {katalog.tvary.map(t => {
            const active = t.kod === tvarKod;
            return (
              <button key={t.kod} type="button" onClick={() => onTvar(t.kod)} className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 font-bold shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <span className="text-xs">{t.nazov}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Ruler className="w-4 h-4 text-indigo-600" /> 2. Veľkosť a rozmery</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {katalog.velkosti.filter(v => { const t = katalog.tvary.find(x => x.kod === tvarKod); return !t?.rozmery || Object.keys(t.rozmery).length === 0 || t.rozmery[v.kod]; }).map(v => {
            const active = v.kod === velkostKod;
            const vybranyTvar = katalog.tvary.find(t => t.kod === tvarKod);
            const vyskaPreTvar = vybranyTvar?.rozmery?.[v.kod]?.vyska_cm ?? v.vyska_cm;
            return (
              <button key={v.kod} type="button" onClick={() => onVelkost(v.kod)} className={`p-3 rounded-xl border text-left transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                <div className="mb-1">
                  <span className="font-black text-sm">{v.kod}</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-700">{vyskaPreTvar} cm od zeme</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{vybranyTvar?.rozmery?.[v.kod]?.rozmer_popis || v.rozmer_popis}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-indigo-600" /> 3. Materiál</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {katalog.materialy.map(m => {
            const active = m.kod === materialKod;
            return (
              <div key={m.kod} onClick={() => onMaterial(m.kod)} className={`p-3 rounded-xl border cursor-pointer transition-all flex gap-3 ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                {m.obrazok_url && <img src={m.obrazok_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0">
                  <span className="font-bold text-xs block">{m.nazov}</span>
                  {m.popis && <p className="text-[11px] text-slate-500 mt-0.5">{m.popis}</p>}
                  {m.pouzitie && <p className="text-[10px] text-slate-400 mt-0.5">{m.pouzitie}</p>}
                </div>
              </div>
            );
          })}
          {katalog.materialy.length === 0 && <p className="text-xs text-rose-500 sm:col-span-2">Zatiaľ nie je nastavený žiadny materiál — doplň ho v admin paneli (PrintStudio Pro → Beachvlajky → Materiály).</p>}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Scissors className="w-4 h-4 text-indigo-600" /> 4. Opracovanie okrajov</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {katalog.dokoncenie.map(d => {
            const active = d.kod === dokoncenieKod;
            return (
              <div key={d.kod} onClick={() => onDokoncenie(d.kod)} className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                {d.obrazok_url && <img src={d.obrazok_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{d.nazov}</span>
                    <span className="text-xs font-semibold text-slate-500">{cenaText(cenyVolieb?.dokoncenie?.[d.kod])}</span>
                  </div>
                  {d.popis && <p className="text-[11px] text-slate-500 mt-0.5">{d.popis}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><GripVertical className="w-4 h-4 text-indigo-600" /> 5. Konštrukcia / prút</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {katalog.stoziare.map(s => {
            const active = s.kod === stoziarKod;
            return (
              <div key={s.kod} onClick={() => onStoziar(s.kod)} className={`p-3 rounded-xl border cursor-pointer transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                {s.obrazok_url && <img src={s.obrazok_url} alt="" className="w-full h-16 rounded-lg object-cover mb-1.5" />}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{s.nazov}</span>
                </div>
                <span className="text-xs font-bold text-indigo-600 block">{cenaText(cenyVolieb?.stoziare?.[s.kod])}</span>
                {s.popis && <p className="text-[10px] text-slate-500 mt-0.5">{s.popis}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-indigo-600" /> 6. Podstavec (voliteľné)</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div onClick={() => onPodstavec('')} className={`p-3 rounded-xl border cursor-pointer transition-all ${!podstavecKod ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
            <span className="font-bold text-xs">Bez podstavca</span>
            <span className="text-xs font-bold text-indigo-600 block">V cene</span>
          </div>
          {katalog.podstavce.map(p => {
            const active = p.kod === podstavecKod;
            const nastavenie = p.ceny?.[velkostKod];
            const vhodny = nastavenie?.vhodny !== false;
            return (
              <div key={p.kod} onClick={() => onPodstavec(p.kod)} className={`p-3 rounded-xl border cursor-pointer transition-all ${active ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 text-indigo-900 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'}`}>
                {p.obrazok_url && <img src={p.obrazok_url} alt="" className="w-full h-16 rounded-lg object-cover mb-1.5" />}
                <span className="font-bold text-xs">{p.nazov}</span>
                <span className="text-xs font-bold text-indigo-600 block">{cenaText(cenyVolieb?.podstavce?.[p.kod])}</span>
                {p.popis && <p className="text-[10px] text-slate-500 mt-0.5">{p.popis}</p>}
                {!vhodny && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-start gap-1"><TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" /> Neodporúča sa pre túto veľkosť</p>
                )}
                {nastavenie?.poznamka && <p className="text-[10px] text-slate-500 mt-0.5 italic">{nastavenie.poznamka}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button onClick={onDalej} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition-all">
          Pokračovať na Grafiku →
        </button>
      </div>
    </div>
  );
}
