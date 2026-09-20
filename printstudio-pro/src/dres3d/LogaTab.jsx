import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { ERB_TVARY, POZICIE_LOGA_PRED } from './dresPresets';

const nacitajObrazok = (src, crossOrigin = false) => new Promise((resolve) => {
  const img = new Image();
  if (crossOrigin) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const nacitajZoSuboru = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (ev) => nacitajObrazok(ev.target.result).then(resolve);
  reader.readAsDataURL(file);
});

export default function LogaTab({ configState, grafiky, onZmenLoga }) {
  const naUploadErb = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await nacitajZoSuboru(file);
    if (img) onZmenLoga({ typErbu: 'custom', vlastnyErbImg: img });
  };

  const vyberZKniznice = async (url) => {
    const img = await nacitajObrazok(url, true);
    if (img) onZmenLoga({ typErbu: 'custom', vlastnyErbImg: img });
  };

  const naUploadLogoPred = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await nacitajZoSuboru(file);
    if (img) onZmenLoga({ logoPredImg: img });
  };

  const naUploadLogoZad = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await nacitajZoSuboru(file);
    if (img) onZmenLoga({ logoZadImg: img });
  };

  const rukavLoga = configState.loga.rukavLoga || [];

  const pridajRukavLogo = async (strana, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await nacitajZoSuboru(file);
    if (!img) return;
    const poctStrana = rukavLoga.filter((l) => l.strana === strana).length;
    const nove = { id: Date.now(), strana, img, velkost: 0.6, poradie: poctStrana };
    onZmenLoga({ rukavLoga: [...rukavLoga, nove] });
  };

  const zmazRukavLogo = (id) => onZmenLoga({ rukavLoga: rukavLoga.filter((l) => l.id !== id) });

  const zmenVelkostRukavLogo = (id, velkost) => onZmenLoga({ rukavLoga: rukavLoga.map((l) => (l.id === id ? { ...l, velkost } : l)) });

  const presunRukavLogo = (id, smer) => {
    const logo = rukavLoga.find((l) => l.id === id);
    if (!logo) return;
    const naStrane = rukavLoga.filter((l) => l.strana === logo.strana).sort((a, b) => a.poradie - b.poradie);
    const idx = naStrane.findIndex((l) => l.id === id);
    const cielIdx = idx + smer;
    if (cielIdx < 0 || cielIdx >= naStrane.length) return;
    const a = naStrane[idx], b = naStrane[cielIdx];
    onZmenLoga({
      rukavLoga: rukavLoga.map((l) => {
        if (l.id === a.id) return { ...l, poradie: b.poradie };
        if (l.id === b.id) return { ...l, poradie: a.poradie };
        return l;
      }),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Klubový erb a logá</h3>
        <p className="text-xs text-slate-400">Vytvorte si vlastný znak, logo a doplnkové logá na rukávoch.</p>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">1. Klubový Znak (Na srdci)</span>
            <span className="text-[10px] text-slate-400">Umiestnenie na ľavej hrudi</span>
          </div>
          <input type="checkbox" checked={configState.loga.zobrazitErb} onChange={(e) => onZmenLoga({ zobrazitErb: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" />
        </div>

        <label className="block text-[11px] text-slate-400 mb-1">Text v znaku (napr. názov klubu)</label>
        <input
          type="text" maxLength={12} placeholder="FC TÍM"
          value={configState.loga.erbText}
          onChange={(e) => onZmenLoga({ typErbu: ERB_TVARY.some((t) => t.id === configState.loga.typErbu) ? configState.loga.typErbu : 'kruh', erbText: e.target.value })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500"
        />

        <div className="grid grid-cols-4 gap-2">
          {ERB_TVARY.map(t => (
            <button
              key={t.id}
              onClick={() => onZmenLoga({ typErbu: t.id })}
              className={`p-2 rounded-lg bg-slate-800 border-2 flex flex-col items-center ${configState.loga.typErbu === t.id ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
            >
              <span className="text-[10px] font-semibold text-slate-300">{t.nazov}</span>
            </button>
          ))}
        </div>

        {grafiky && grafiky.length > 0 && (
          <div className="pt-1">
            <label className="block text-[11px] text-slate-400 mb-1.5">Alebo vlastné logo z knižnice grafík:</label>
            <div className="grid grid-cols-5 gap-2">
              {grafiky.map(g => (
                <button
                  key={g.id}
                  title={g.nazov}
                  onClick={() => vyberZKniznice(g.url)}
                  className={`aspect-square rounded-lg bg-slate-800 border-2 overflow-hidden ${configState.loga.typErbu === 'custom' ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <img src={g.url} alt={g.nazov} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <label className="block text-[11px] text-slate-400 mb-1">Alebo nahrať vlastné hotové logo (.PNG, .SVG):</label>
          <input type="file" accept="image/*" onChange={naUploadErb} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer" />
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div>
          <span className="text-xs font-bold text-white block">2. Predné logo</span>
          <span className="text-[10px] text-slate-400">Vždy súčasť dizajnu — dá sa len presunúť.</span>
        </div>
        <input type="file" accept="image/*" onChange={naUploadLogoPred} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer" />
        <label className="block text-[11px] text-slate-400 mb-1">Umiestnenie</label>
        <select
          value={configState.loga.logoPredPozicia}
          onChange={(e) => onZmenLoga({ logoPredPozicia: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-indigo-500"
        >
          {POZICIE_LOGA_PRED.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
        </select>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div>
          <span className="text-xs font-bold text-white block">3. Logo výrobcu (Chrbát, nad menom)</span>
        </div>
        <input type="file" accept="image/*" onChange={naUploadLogoZad} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-indigo-400 hover:file:bg-slate-700 cursor-pointer" />
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div>
          <span className="text-xs font-bold text-white block">4. Logá na rukávoch</span>
          <span className="text-[10px] text-slate-400">Ľubovoľný počet, poukladané nad sebou — poradie a veľkosť si nastavíte.</span>
        </div>

        {['lavy', 'pravy'].map((strana) => (
          <div key={strana} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase">{strana === 'lavy' ? 'Ľavý rukáv' : 'Pravý rukáv'}</span>
              <label className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Pridať
                <input type="file" accept="image/*" onChange={(e) => pridajRukavLogo(strana, e)} className="hidden" />
              </label>
            </div>
            {rukavLoga.filter((l) => l.strana === strana).sort((a, b) => a.poradie - b.poradie).map((logo) => (
              <div key={logo.id} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2">
                <img src={logo.img.src} alt="" className="w-8 h-8 object-contain bg-slate-800 rounded" />
                <input
                  type="range" min={0.2} max={1} step={0.05}
                  value={logo.velkost}
                  onChange={(e) => zmenVelkostRukavLogo(logo.id, Number(e.target.value))}
                  className="flex-1"
                />
                <button onClick={() => presunRukavLogo(logo.id, -1)} className="text-slate-400 hover:text-white p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => presunRukavLogo(logo.id, 1)} className="text-slate-400 hover:text-white p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => zmazRukavLogo(logo.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
