import React, { useEffect, useMemo, useState } from 'react';
import { pripravFotkuCache, vyfarbiFotku } from './trickoFarba';

// Vizualizácia produktu (tričko, mikina…) so zvolenou farbou a potlačami v mierke a na správnych miestach.
// Fotka je biela a farba sa prefarbuje automaticky (trickoFarba.js). Pozícia každého umiestnenia je v produkte (pozicie): { kod: { predok|zadok: { x, y, kotva, rot } } }.
const PALETA = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#475569', '#db2777'];

export default function TrickoNahlad({ produkt, farbaHex, pohlad, onPohlad, tlace, umiestnenia, vybranaId, onVyber }) {
  const url = pohlad === 'zadok' && produkt.fotoZadok ? produkt.fotoZadok : produkt.fotoPredok;
  const [prep, setPrep] = useState(null);
  const [chyba, setChyba] = useState('');
  useEffect(() => {
    let zrusene = false;
    setChyba('');
    pripravFotkuCache(url).then((p) => { if (!zrusene) setPrep(p); }).catch((e) => { if (!zrusene) setChyba(e.message); });
    return () => { zrusene = true; };
  }, [url]);
  const src = useMemo(() => (prep ? vyfarbiFotku(prep, farbaHex) : null), [prep, farbaHex]);
  const pomer = prep ? prep.w / prep.h : 900 / 1017;

  const pocetNaProtistrane = tlace.filter((t) => {
    const poz = produkt.pozicie?.[t.umiestnenie];
    return poz && !poz[pohlad] && (poz.predok || poz.zadok);
  }).length;
  const maZadok = !!produkt.fotoZadok;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">
          {[['predok', 'Spredu'], ['zadok', 'Zozadu']].map(([k, n]) => (
            <button key={k} type="button" disabled={k === 'zadok' && !maZadok} onClick={() => onPohlad(k)}
              className={`px-3 py-1.5 rounded-md font-semibold transition disabled:opacity-40 ${pohlad === k ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>{n}</button>
          ))}
        </div>
        {pocetNaProtistrane > 0 && <span className="text-[11px] text-slate-500">+ {pocetNaProtistrane} potlač na {pohlad === 'predok' ? 'zadnej' : 'prednej'} strane</span>}
      </div>
      <div className="relative w-full mx-auto bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ aspectRatio: String(pomer), maxWidth: 460 }}>
        {src && <img src={src} alt={`${produkt.nazov} — ${pohlad === 'zadok' ? 'zozadu' : 'spredu'}`} className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />}
        {!src && !chyba && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Načítavam fotku…</div>}
        {chyba && <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-500 px-4 text-center">{chyba}</div>}
        {src && tlace.map((t) => {
          const poz = produkt.pozicie?.[t.umiestnenie]?.[pohlad];
          if (!poz) return null;
          const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
          const sirkaPct = (t.sirka / produkt.fotoSirkaCm) * 100;
          const vyskaPct = (t.vyska / produkt.fotoSirkaCm) * pomer * 100;
          const hore = poz.kotva === 'hore';
          const vybrana = vybranaId === t.id;
          return (
            <button key={t.id} type="button" onClick={() => onVyber?.(t.id)} title={`${u?.nazov || ''}: ${t.sirka} × ${t.vyska} cm`}
              className={`absolute p-0 border ${vybrana ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-dashed border-indigo-400/70'} ${t.nahlad ? 'bg-transparent' : 'bg-white/20'}`}
              style={{
                left: `${poz.x * 100}%`, top: `${poz.y * 100}%`, width: `${sirkaPct}%`, height: `${vyskaPct}%`,
                transform: `translate(-50%, ${hore ? '0' : '-50%'}) rotate(${poz.rot || 0}deg)`, transformOrigin: hore ? '50% 0' : '50% 50%',
              }}>
              {t.nahlad
                ? <img src={t.nahlad} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                : <span className="absolute inset-0 flex">{PALETA.slice(0, Math.min(t.farby || 1, 4)).map((c) => <span key={c} className="flex-1" style={{ background: c, opacity: 0.45 }} />)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
