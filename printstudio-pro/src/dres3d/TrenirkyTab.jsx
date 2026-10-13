import React from 'react';
import { RYCHLE_FARBY } from './dresPresets';
import { ZONY_TRENIROK, farbyTrenirok } from './trenirkyRenderer';
import { TRENIRKY_PRESETY } from './trenirkyPresety';

// Záložka "Trenírky": hotové dizajny (jedným klikom), ručné farby po zónach a logá + malé číslo na prednej strane nohavíc.
export default function TrenirkyTab({ configState, onZmenTrenirky }) {
  const t = configState.trenirky || {};
  const prepojene = t.prepojit !== false;
  const farby = farbyTrenirok(configState);
  const cisloNoha = t.cisloNoha === 'prava' ? 'prava' : 'lava';
  const erbNoha = cisloNoha === 'lava' ? 'prava' : 'lava';
  const [aktivnaZona, setAktivnaZona] = React.useState('noha');

  const jePresetAktivny = (p) => (p.prepojit ? prepojene : (!prepojene && ZONY_TRENIROK.every(z => (farby[z.key] || '').toLowerCase() === p.farby[z.key].toLowerCase())));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Dizajn trenírok</h3>
        <p className="text-xs text-slate-400">Vyberte si hotový dizajn a potom ho ľubovoľne upravte po častiach.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TRENIRKY_PRESETY.map(p => {
          const aktivny = jePresetAktivny(p);
          const f = p.prepojit ? null : p.farby;
          return (
            <button
              key={p.id}
              onClick={() => onZmenTrenirky(p.prepojit ? { prepojit: true } : { prepojit: false, farby: { ...p.farby } })}
              className={`p-2.5 rounded-xl border text-left transition ${aktivny ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
            >
              <div className="flex h-5 rounded overflow-hidden border border-slate-700 mb-1.5">
                {p.prepojit
                  ? <div className="flex-1 bg-gradient-to-r from-slate-300 to-slate-500 text-[9px] text-slate-900 font-bold flex items-center justify-center">dres</div>
                  : ['pas', 'noha', 'bok', 'pasik', 'lem'].map(k => <div key={k} className="flex-1" style={{ background: f[k] }} />)}
              </div>
              <span className="text-[11px] font-bold text-slate-200 block leading-tight">{p.nazov}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Farby jednotlivých častí</h4>
        {prepojene && <p className="text-[11px] text-amber-300">Trenírky teraz preberajú farby dresu. Zmenou farby nižšie sa prepnú na vlastné farby.</p>}
        {ZONY_TRENIROK.map(z => (
          <div key={z.key} onClick={() => setAktivnaZona(z.key)} className={`bg-slate-950 p-3 rounded-xl border flex items-center justify-between cursor-pointer ${aktivnaZona === z.key ? 'border-indigo-500' : 'border-slate-800/80'}`}>
            <div>
              <span className="text-xs font-bold text-white block">{z.cislo}. {z.nazov}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">{z.popis}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={farby[z.key]}
                onChange={(e) => onZmenTrenirky({ prepojit: false, farby: { ...farby, [z.key]: e.target.value } })}
                onClick={(e) => e.stopPropagation()}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-xs font-mono font-bold text-slate-300">{farby[z.key].toUpperCase()}</span>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {RYCHLE_FARBY.map(hex => (
            <button key={hex} onClick={() => onZmenTrenirky({ prepojit: false, farby: { ...farby, [aktivnaZona]: hex } })} style={{ backgroundColor: hex }} className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-slate-700 hover:scale-110 transition shadow" title={`Farba pre: ${ZONY_TRENIROK.find(z => z.key === aktivnaZona)?.nazov}`} />
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div>
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Logá a číslo vpredu na nohaviciach</h4>
          <p className="text-[11px] text-slate-400">Logo výrobcu je vždy na ľavej nohe (rovnako veľké ako na drese). Strany sú z pohľadu nositeľa.</p>
        </div>

        <label className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 cursor-pointer">
          <input type="checkbox" checked={t.erbZobrazit !== false} onChange={(e) => onZmenTrenirky({ erbZobrazit: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
          <span className="text-xs font-bold text-white">Klubový erb (ako na srdci dresu)</span>
          <span className="text-[10px] text-slate-400 ml-auto">{t.erbZobrazit === false ? 'vypnutý' : (erbNoha === 'prava' ? 'pravá noha' : 'ľavá noha, nad logom výrobcu')}</span>
        </label>

        <label className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 cursor-pointer">
          <input type="checkbox" checked={t.cisloZobrazit !== false} onChange={(e) => onZmenTrenirky({ cisloZobrazit: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
          <span className="text-xs font-bold text-white">Malé číslo vpredu</span>
          <span className="text-[10px] text-slate-400 ml-auto">{t.cisloZobrazit === false ? 'vypnuté' : (cisloNoha === 'lava' ? 'ľavá noha, nad logom výrobcu' : 'pravá noha')}</span>
        </label>

        <div>
          <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Rozloženie</span>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => onZmenTrenirky({ cisloNoha: 'lava' })} className={`p-2.5 rounded-xl border text-left text-xs transition ${cisloNoha === 'lava' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'}`}>
              <b>Číslo vľavo, erb vpravo</b><span className="block text-[10px] opacity-80">Ľavá noha: logo výrobcu + číslo nad ním • Pravá noha: erb</span>
            </button>
            <button onClick={() => onZmenTrenirky({ cisloNoha: 'prava' })} className={`p-2.5 rounded-xl border text-left text-xs transition ${cisloNoha === 'prava' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'}`}>
              <b>Číslo vpravo, erb vľavo</b><span className="block text-[10px] opacity-80">Ľavá noha: logo výrobcu + erb nad ním • Pravá noha: číslo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
