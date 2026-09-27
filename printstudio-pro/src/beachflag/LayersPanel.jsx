import React, { useEffect, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Type as TypeIcon, Image as ImageIcon } from 'lucide-react';

// Aspon 10 bezpecnych systemovych fontov (Martin 2026-09-27) — ziadne nacitavanie z internetu,
// aby sa export (toDataURL pri objednavke) nikdy nepokazil kvoli nenacitanemu web fontu.
const FONTY = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Courier New', 'Palatino Linotype', 'Garamond', 'Tahoma'];
const UHLY = [0, 45, 90, 135, 180, 225, 270, 315];

// Zoznam vrstiev (texty/loga na platne) + panel vlastnosti pre prave vybranu vrstvu — Martin
// chcel vidiet co je na akej vrstve, vediet ich preusporiadat/zmazat a upravovat farbu/font/text/
// obrys priamo tu, nie len tahanim na platne.
export default function LayersPanel({ canvas }) {
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const refresh = () => setTick(v => v + 1);

  useEffect(() => {
    if (!canvas) return;
    const onSelect = () => setSelected(canvas.getActiveObject() || null);
    const onClear = () => setSelected(null);
    const udalosti = ['object:added', 'object:removed', 'object:modified', 'object:moving', 'object:scaling', 'object:rotating'];
    udalosti.forEach(u => canvas.on(u, refresh));
    canvas.on('selection:created', onSelect);
    canvas.on('selection:updated', onSelect);
    canvas.on('selection:cleared', onClear);
    return () => {
      udalosti.forEach(u => canvas.off(u, refresh));
      canvas.off('selection:created', onSelect);
      canvas.off('selection:updated', onSelect);
      canvas.off('selection:cleared', onClear);
    };
  }, [canvas]);

  if (!canvas) return null;
  const objekty = canvas.getObjects().filter(o => !o.isMaskOverlay).slice().reverse();

  const vyber = (o) => { canvas.setActiveObject(o); canvas.renderAll(); refresh(); };
  const zmaz = (o) => { canvas.remove(o); canvas.discardActiveObject(); canvas.renderAll(); refresh(); };
  const posunHore = (o) => { canvas.bringForward(o); canvas.renderAll(); refresh(); };
  const posunDole = (o) => { canvas.sendBackwards(o); canvas.renderAll(); refresh(); };
  const aktualizuj = (patch) => { if (!selected) return; selected.set(patch); canvas.renderAll(); refresh(); };

  const jeText = selected?.type === 'text' || selected?.type === 'i-text';
  const sirkaCm = selected ? Math.round(selected.getScaledWidth() * 10) / 10 : 0;
  const vyskaCm = selected ? Math.round(selected.getScaledHeight() * 10) / 10 : 0;
  const uhol = selected ? Math.round((selected.angle || 0) % 360) : 0;

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <h4 className="font-bold text-xs text-slate-800">Vrstvy (loga a texty na vlajke)</h4>
      {objekty.length === 0 ? (
        <p className="text-[11px] text-slate-500">Zatiaľ nie je pridaný žiadny text ani logo.</p>
      ) : (
        <div className="space-y-1.5">
          {objekty.map((o, i) => (
            <div key={i} onClick={() => vyber(o)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${selected === o ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              {o.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <TypeIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              <span className="flex-1 min-w-0 truncate text-xs text-slate-700">{o.type === 'image' ? 'Obrázok / logo' : (o.text || 'Text')}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); posunHore(o); }} title="Posunúť vyššie" className="text-slate-400 hover:text-slate-700 p-0.5"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); posunDole(o); }} title="Posunúť nižšie" className="text-slate-400 hover:text-slate-700 p-0.5"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); zmaz(o); }} title="Zmazať" className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="border-t border-slate-200 pt-3 space-y-2.5">
          <h5 className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">Vlastnosti vybranej vrstvy</h5>

          {jeText && (
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Text</label>
              <input type="text" value={selected.text || ''} onChange={(e) => aktualizuj({ text: e.target.value })} className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg" />
            </div>
          )}

          {jeText && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Font</label>
                <select value={selected.fontFamily || 'Arial'} onChange={(e) => aktualizuj({ fontFamily: e.target.value })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg">
                  {FONTY.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Veľkosť písma (cm)</label>
                <input type="number" step="0.5" min="1" value={Math.round((selected.fontSize || 0) * 10) / 10} onChange={(e) => aktualizuj({ fontSize: parseFloat(e.target.value) || 1 })} className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg" />
              </div>
            </div>
          )}

          {jeText && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Farba textu</label>
                <input type="color" value={selected.fill || '#000000'} onChange={(e) => aktualizuj({ fill: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer border border-slate-300" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Farba obrysu</label>
                <input type="color" value={selected.stroke || '#ffffff'} onChange={(e) => aktualizuj({ stroke: e.target.value })} className="w-full h-8 rounded-lg cursor-pointer border border-slate-300" />
              </div>
            </div>
          )}

          {jeText && (
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Hrúbka obrysu (cm) — 0 = bez obrysu</label>
              <input type="number" step="0.05" min="0" value={selected.strokeWidth || 0} onChange={(e) => aktualizuj({ strokeWidth: parseFloat(e.target.value) || 0 })} className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg" />
            </div>
          )}

          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Otočenie (°) — ťahaním za úchyt zaskočí po 45°</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="number" step="1" value={uhol} onChange={(e) => aktualizuj({ angle: parseFloat(e.target.value) || 0 })} className="w-16 text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {UHLY.map(a => (
                  <button key={a} type="button" onClick={() => aktualizuj({ angle: a })} className={`text-[10px] px-1.5 py-1 rounded border ${uhol === a ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{a}°</button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">Reálna veľkosť na vlajke: {sirkaCm} × {vyskaCm} cm</p>
        </div>
      )}
    </div>
  );
}
