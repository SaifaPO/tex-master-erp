import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Move } from 'lucide-react';
import { POZICIE_LOGA_PRED } from './dresPresets';
import ErbEditor from './ErbEditor';
import { vytvorSablonuDresu } from './dresRenderer';
import { nacitajZoSuboru } from './obrazokUtil';

export default function LogaTab({ configState, grafiky, fonty, onZmenLoga, onVlastnaGrafika }) {
  const stiahniSablonu = () => {
    const canvas = vytvorSablonuDresu();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'sablona-dres-2048x2048.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };
  const naUploadGrafiky = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file || !onVlastnaGrafika) return;
    const img = await nacitajZoSuboru(file);
    if (img) onVlastnaGrafika(img);
  };

  const rukavLoga = configState.loga.rukavLoga || [];

  const pridajRukavLogo = async (strana, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = await nacitajZoSuboru(file);
    if (!img) return;
    const poctStrana = rukavLoga.filter((l) => l.strana === strana).length;
    const nove = { id: Date.now(), strana, img, velkost: 1, poradie: poctStrana, offsetX: 0, offsetY: 0 };
    onZmenLoga({ rukavLoga: [...rukavLoga, nove] });
  };

  const zmazRukavLogo = (id) => onZmenLoga({ rukavLoga: rukavLoga.filter((l) => l.id !== id) });

  const zmenVelkostRukavLogo = (id, velkost) => onZmenLoga({ rukavLoga: rukavLoga.map((l) => (l.id === id ? { ...l, velkost } : l)) });

  const resetPoziciuRukavLogo = (id) => onZmenLoga({ rukavLoga: rukavLoga.map((l) => (l.id === id ? { ...l, offsetX: 0, offsetY: 0 } : l)) });

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

      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-start gap-2">
        <Move className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-200 leading-snug">Tip: erb aj logá si môžete presunúť aj priamo ťahaním myšou na 3D modeli dresu.</p>
      </div>

      <ErbEditor configState={configState} grafiky={grafiky} fonty={fonty} onZmenLoga={onZmenLoga} />

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">2. Logo výrobcu</span>
            <span className="text-[10px] text-slate-400">Vpredu aj na krku vzadu je vždy súčasť dizajnu — dá sa len presunúť (predné).</span>
          </div>
          <button type="button" onClick={() => onZmenLoga({ logoPredOffset: { x: 0, y: 0 } })} title="Vrátiť na pôvodné miesto" className="text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded border border-slate-700 hover:border-slate-500 shrink-0">Reset polohy</button>
        </div>
        <label className="block text-[11px] text-slate-400 mb-1">Umiestnenie predného loga (alebo ťahajte priamo na modeli)</label>
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
          <span className="text-xs font-bold text-white block">3. Logá na rukávoch</span>
          <span className="text-[10px] text-slate-400">Ľubovoľný počet, poukladané nad sebou — poradie a veľkosť si nastavíte.</span>
        </div>

        {rukavLoga.length > 1 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400">Rozostup medzi logami</label>
              <span className="text-[11px] text-slate-300 font-semibold">{configState.loga.rukavMedzeraMm ?? 6} mm</span>
            </div>
            <input
              type="range" min={0} max={20} step={1}
              value={configState.loga.rukavMedzeraMm ?? 6}
              onChange={(e) => onZmenLoga({ rukavMedzeraMm: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        )}

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
                  type="range" min={0.5} max={2} step={0.05}
                  value={logo.velkost}
                  onChange={(e) => zmenVelkostRukavLogo(logo.id, Number(e.target.value))}
                  className="flex-1"
                />
                <button onClick={() => presunRukavLogo(logo.id, -1)} className="text-slate-400 hover:text-white p-1"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => presunRukavLogo(logo.id, 1)} className="text-slate-400 hover:text-white p-1"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => resetPoziciuRukavLogo(logo.id)} title="Vrátiť na pôvodné miesto (ťahaním posunuté)" className="text-slate-400 hover:text-indigo-400 p-1"><Move className="w-3.5 h-3.5" /></button>
                <button onClick={() => zmazRukavLogo(logo.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {onVlastnaGrafika && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div>
            <span className="text-xs font-bold text-white block">4. Vlastná grafika na celý dres</span>
            <span className="text-[10px] text-slate-400">Stiahnite šablónu, nakreslite do nej vlastný dizajn (napr. v Canve alebo Photoshope) a nahrajte hotový obrázok. Nahradí vzor dresu.</span>
          </div>
          <button type="button" onClick={stiahniSablonu} className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg">⬇ Stiahnuť šablónu (PNG, 2048 × 2048 px)</button>
          <label className="block text-[11px] text-slate-400">Nahrať hotovú grafiku (PNG alebo JPG, 2048 × 2048 px):</label>
          <input type="file" accept="image/*" onChange={naUploadGrafiky} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200" />
          {configState.vlastnaGrafika?.img && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2">
              <img src={configState.vlastnaGrafika.img.src} alt="" className="w-12 h-12 object-contain bg-slate-800 rounded" />
              <span className="text-[11px] text-slate-300 flex-1">Vaša grafika je na drese.</span>
              <button type="button" onClick={() => onVlastnaGrafika(null)} className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold">Odstrániť</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
