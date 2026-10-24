import React, { useState } from 'react';
import { Move, Copy, ExternalLink, Trash2, Sparkles } from 'lucide-react';
import { ERB_TVARY, ERB_VZORY_VNUTRA, ERB_OBJEKTY } from './erbRenderer';
import { nacitajObrazok, nacitajZoSuboru, odstranBielePozadie } from './obrazokUtil';

const STYLY = [
  { id: 'modern', popis: 'modern, plochý vektorový štýl' },
  { id: 'tradicny', popis: 'tradičný klubový erb so štítom a ozdobnou lemovkou' },
  { id: 'minimal', popis: 'minimalistický, jednoduché tvary' },
  { id: 'retro', popis: 'retro, ako zo starej futbalovej odznakovej kolekcie' },
  { id: 'agresivny', popis: 'silný, agresívny, so zvieraťom v erbe (napr. lev, orol, býk)' },
];

function Sekcia({ nadpis, children }) {
  return (
    <div className="pt-3 border-t border-slate-800/80 space-y-2">
      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide block">{nadpis}</span>
      {children}
    </div>
  );
}

function Farba({ label, value, onChange, volitelna, onVymaz }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="w-8 h-7 rounded border border-slate-700 bg-slate-900 cursor-pointer" />
        {volitelna && <button type="button" onClick={onVymaz} className="text-[10px] text-slate-500 hover:text-white">auto</button>}
      </span>
    </label>
  );
}

function Posuvnik({ label, value, min, max, step, onChange, jednotka = '' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[11px] text-slate-400">{label}</label>
        <span className="text-[11px] text-slate-300 font-semibold">{Number(value).toFixed(step < 1 ? 1 : 0)}{jednotka}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

export default function ErbEditor({ configState, grafiky, fonty, onZmenLoga }) {
  const L = configState.loga;
  const f = configState.farby;
  const zoznamFontov = fonty && fonty.length > 0 ? [...new Set(fonty.map((x) => x.nazov))] : ['Teko', 'Chakra Petch', 'Oswald', 'Inter'];
  const aktTvar = L.erbTvar || (ERB_TVARY.some((t) => t.id === L.typErbu) ? L.typErbu : 'kruh');
  const [bielePozadie, setBielePozadie] = useState(true);
  const [aiNazov, setAiNazov] = useState('');
  const [aiStyl, setAiStyl] = useState('modern');
  const [aiFarby, setAiFarby] = useState('');
  const [aiNapad, setAiNapad] = useState('');
  const [skopirovane, setSkopirovane] = useState(false);

  const nastavTvar = (id) => onZmenLoga({ erbTvar: id, typErbu: id });

  const spracujObrazok = async (file) => {
    const img = await nacitajZoSuboru(file);
    if (!img) return null;
    return bielePozadie ? odstranBielePozadie(img) : img;
  };
  const naUploadHotove = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const img = await spracujObrazok(file);
    if (img) onZmenLoga({ typErbu: 'custom', vlastnyErbImg: img });
  };
  const naUploadObrazokDoZnaku = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const img = await spracujObrazok(file);
    if (img) onZmenLoga({ erbObrazok: img, typErbu: aktTvar });
  };
  const vyberZKniznice = async (url) => {
    const img = await nacitajObrazok(url, true);
    if (img) onZmenLoga({ typErbu: 'custom', vlastnyErbImg: img });
  };

  const aiPrompt = `Create a flat vector-style football (soccer) club crest / badge logo for the club "${aiNazov || 'FC TÍM'}". Style: ${STYLY.find((s) => s.id === aiStyl)?.popis}. Main colors: ${aiFarby || 'blue, red and white'}.${aiNapad ? ` Design idea: ${aiNapad}.` : ''} Square 1:1 format, the emblem centered with a small margin, clean bold shapes and thick outlines so it prints well on a jersey, only the club name as text (no other words, no mockup, no shadow), on a plain pure white background.`;
  const kopirujPrompt = async () => {
    try { await navigator.clipboard.writeText(aiPrompt); setSkopirovane(true); setTimeout(() => setSkopirovane(false), 2000); } catch { window.prompt('Skopírujte si text:', aiPrompt); }
  };

  const jeCustom = L.typErbu === 'custom' && L.vlastnyErbImg;

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">1. Klubový znak (na srdci)</span>
          <span className="text-[10px] text-slate-400">Znak si presuniete ťahaním myšou priamo na modeli dresu.</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onZmenLoga({ erbOffset: { x: 0, y: 0 } })} title="Vrátiť na pôvodné miesto" className="text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded border border-slate-700 flex items-center gap-1"><Move className="w-3 h-3" /> pôvodné miesto</button>
          <label className="flex items-center gap-1 text-[11px] text-slate-300"><input type="checkbox" checked={L.zobrazitErb} onChange={(e) => onZmenLoga({ zobrazitErb: e.target.checked })} className="w-4 h-4 rounded text-indigo-500 bg-slate-900 border-slate-700" /> zobraziť</label>
        </div>
      </div>

      {jeCustom && (
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-2">
          <img src={L.vlastnyErbImg.src} alt="" className="w-10 h-10 object-contain bg-slate-800 rounded" />
          <span className="text-[11px] text-indigo-200 flex-1">Používa sa vaše hotové logo. Úpravy nižšie sa prejavia po návrate ku generátoru.</span>
          <button type="button" onClick={() => onZmenLoga({ typErbu: aktTvar, vlastnyErbImg: null })} className="text-[11px] text-white bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded-lg font-semibold">Späť ku generátoru</button>
        </div>
      )}

      <Sekcia nadpis="Tvar">
        <div className="grid grid-cols-4 gap-1.5">
          {ERB_TVARY.map((t) => (
            <button key={t.id} type="button" onClick={() => nastavTvar(t.id)} className={`p-1.5 rounded-lg bg-slate-800 border-2 text-[10px] font-semibold text-slate-300 ${!jeCustom && aktTvar === t.id ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}>{t.nazov}</button>
          ))}
        </div>
      </Sekcia>

      <Sekcia nadpis="Text (až 3 riadky)">
        <textarea
          rows={3} placeholder={'FC\nTÍM'}
          value={L.erbText}
          onChange={(e) => onZmenLoga({ erbText: e.target.value.split('\n').slice(0, 3).map((r) => r.slice(0, 14)).join('\n'), typErbu: jeCustom ? 'kruh' : L.typErbu })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold uppercase tracking-widest focus:outline-none focus:border-indigo-500 resize-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-0.5">Písmo</label>
            <select value={L.erbFont || ''} onChange={(e) => onZmenLoga({ erbFont: e.target.value || null })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
              <option value="">Rovnaké ako na drese</option>
              {zoznamFontov.map((n) => <option key={n} value={n} style={{ fontFamily: n }}>{n}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Farba label="Farba textu" value={L.erbFarbaText || f.vzor} onChange={(v) => onZmenLoga({ erbFarbaText: v })} volitelna onVymaz={() => onZmenLoga({ erbFarbaText: null })} />
            <Farba label="Obrys textu" value={L.erbTextObrys || '#000000'} onChange={(v) => onZmenLoga({ erbTextObrys: v })} volitelna onVymaz={() => onZmenLoga({ erbTextObrys: null })} />
          </div>
        </div>
        <Posuvnik label="Veľkosť textu" value={L.erbTextVelkost ?? 1} min={0.5} max={1.4} step={0.05} onChange={(v) => onZmenLoga({ erbTextVelkost: v })} jednotka="×" />
      </Sekcia>

      <Sekcia nadpis="Farba vnútra znaku">
        <div className="grid grid-cols-2 gap-2 items-end">
          <Farba label="Hlavná" value={L.erbFarbaVnutro || '#ffffff'} onChange={(v) => onZmenLoga({ erbFarbaVnutro: v })} />
          <Farba label="Druhá" value={L.erbVnutroDruha || f.vzor} onChange={(v) => onZmenLoga({ erbVnutroDruha: v })} />
        </div>
        <select value={L.erbVnutroVzor || 'plne'} onChange={(e) => onZmenLoga({ erbVnutroVzor: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
          {ERB_VZORY_VNUTRA.map((v) => <option key={v.id} value={v.id}>{v.nazov}</option>)}
        </select>
      </Sekcia>

      <Sekcia nadpis="Lemovky">
        <Farba label="Farba lemovky" value={L.erbFarbaLemovka || f.akcent} onChange={(v) => onZmenLoga({ erbFarbaLemovka: v })} volitelna onVymaz={() => onZmenLoga({ erbFarbaLemovka: null })} />
        <Posuvnik label="Hrúbka lemovky" value={L.erbLemovkaHrubka ?? 3.4} min={0} max={9} step={0.2} onChange={(v) => onZmenLoga({ erbLemovkaHrubka: v })} jednotka=" mm" />
        <Farba label="Vonkajšia lemovka" value={L.erbLemovka2Farba || '#000000'} onChange={(v) => onZmenLoga({ erbLemovka2Farba: v })} />
        <Posuvnik label="Hrúbka vonkajšej lemovky" value={L.erbLemovka2Hrubka ?? 0} min={0} max={6} step={0.2} onChange={(v) => onZmenLoga({ erbLemovka2Hrubka: v })} jednotka=" mm" />
      </Sekcia>

      <Sekcia nadpis="Futbalový objekt v znaku">
        <div className="grid grid-cols-4 gap-1.5">
          {ERB_OBJEKTY.map((o) => (
            <button key={o.id} type="button" onClick={() => onZmenLoga({ erbObjekt: o.id })} className={`p-1.5 rounded-lg bg-slate-800 border-2 flex flex-col items-center gap-0.5 ${(L.erbObjekt || 'none') === o.id ? 'border-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}>
              <span className="text-base leading-none">{o.ikona}</span>
              <span className="text-[9px] font-semibold text-slate-300 leading-tight text-center">{o.nazov}</span>
            </button>
          ))}
        </div>
        {(L.erbObjekt || 'none') !== 'none' && (
          <div className="space-y-1.5">
            <select value={L.erbObjektPoz || 'hore'} onChange={(e) => onZmenLoga({ erbObjektPoz: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
              <option value="hore">Nad textom</option>
              <option value="stred">V strede (text pod ním)</option>
              <option value="dole">Pod textom</option>
            </select>
            <Posuvnik label="Veľkosť objektu" value={L.erbObjektVelkost ?? 1} min={0.5} max={1.6} step={0.05} onChange={(v) => onZmenLoga({ erbObjektVelkost: v })} jednotka="×" />
            <Farba label="Farba objektu" value={L.erbObjektFarba || f.akcent} onChange={(v) => onZmenLoga({ erbObjektFarba: v })} volitelna onVymaz={() => onZmenLoga({ erbObjektFarba: null })} />
          </div>
        )}
      </Sekcia>

      <Sekcia nadpis="Vlastný obrázok v znaku (napr. erb obce)">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-300"><input type="checkbox" checked={bielePozadie} onChange={(e) => setBielePozadie(e.target.checked)} /> Pri nahraní odstrániť biele pozadie obrázka</label>
        <input type="file" accept="image/*" onChange={naUploadObrazokDoZnaku} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200" />
        {L.erbObrazok && (
          <div className="flex items-center gap-2">
            <img src={L.erbObrazok.src} alt="" className="w-9 h-9 object-contain bg-slate-800 rounded" />
            <div className="flex-1"><Posuvnik label="Veľkosť obrázka" value={L.erbObrazokVelkost ?? 1} min={0.4} max={1.5} step={0.05} onChange={(v) => onZmenLoga({ erbObrazokVelkost: v })} jednotka="×" /></div>
            <button type="button" onClick={() => onZmenLoga({ erbObrazok: null })} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </Sekcia>

      <Sekcia nadpis="Hotové logo (nahradí celý znak)">
        {/* knižnica hotových log (športové ikony pre čelenky a buffky) sa v 3D dresoch nepoužíva — dres má vlastný editor erbu a nahranie vlastného loga */}
        <label className="block text-[11px] text-slate-400">Nahrať vlastné hotové logo (.PNG, .JPG, .SVG):</label>
        <input type="file" accept="image/*" onChange={naUploadHotove} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200" />
      </Sekcia>

      <Sekcia nadpis="Logo zadarmo cez ChatGPT alebo Gemini">
        <p className="text-[11px] text-slate-400 leading-snug">Vyplňte údaje, skopírujte pripravený text, vložte ho do ChatGPT alebo Gemini (bežný bezplatný účet s dennými limitmi), stiahnite vygenerovaný obrázok a nahrajte ho vyššie. Biele pozadie odstránime my.</p>
        <input type="text" placeholder="Názov klubu" value={aiNazov} onChange={(e) => setAiNazov(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
        <select value={aiStyl} onChange={(e) => setAiStyl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
          {STYLY.map((s) => <option key={s.id} value={s.id}>{s.popis}</option>)}
        </select>
        <input type="text" placeholder="Farby (napr. modrá, žltá, biela)" value={aiFarby} onChange={(e) => setAiFarby(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
        <input type="text" placeholder="Nápad (napr. lev s loptou, hrad, horský štít)" value={aiNapad} onChange={(e) => setAiNapad(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-400 leading-snug max-h-24 overflow-y-auto">{aiPrompt}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={kopirujPrompt} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg"><Copy className="w-3.5 h-3.5" /> {skopirovane ? 'Skopírované ✓' : 'Skopírovať text'}</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Otvoriť ChatGPT</a>
          <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg"><Sparkles className="w-3.5 h-3.5" /> Otvoriť Gemini</a>
        </div>
      </Sekcia>
    </div>
  );
}
