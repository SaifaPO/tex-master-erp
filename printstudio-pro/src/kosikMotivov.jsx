// Spolocne prvky "kosika motivov": zakaznik si v jednej objednavke navrhne viac motivov (napr. 2 buffky s roznou
// grafikou) a zaplati postovne len raz. Pouzivaju Buffky (tmavy vzhlad) a Celenky (svetly vzhlad).
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const eur = (v) => `${Number(v || 0).toFixed(2)} €`;

// Male nahlad navrhu z 2D platna editora (Buffky: #designCanvas, Celenky: #editorCanvas) — len na zobrazenie v zozname motivov.
export function nahladZCanvasu(root, sirka = 120, selektor = '#designCanvas') {
  try {
    const c = root && root.querySelector && root.querySelector(selektor);
    if (!c || !c.width || !c.height) return '';
    const out = document.createElement('canvas');
    out.width = sirka; out.height = Math.max(1, Math.round(sirka * c.height / c.width));
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.8);
  } catch { return ''; }
}

// Zoznam motivov v objednavke + tlacidlo "Pridat tento motiv".
export function KosikMotivov({ polozky, riadky, onOdober, onPridat, bezi, popisKrok, svetly = false }) {
  const t = svetly
    ? { tlacidlo: 'border-indigo-400 text-indigo-700 hover:bg-indigo-50', popis: 'text-slate-500', nadpis: 'text-slate-700', riadok: 'bg-white border-slate-200', meno: 'text-slate-800', info: 'text-slate-500', nahlad: 'border-slate-200', prazdny: 'bg-slate-100', zmaz: 'text-rose-600 hover:bg-rose-50' }
    : { tlacidlo: 'border-cyan-500/70 text-cyan-300 hover:bg-cyan-500/10', popis: 'text-slate-400', nadpis: 'text-slate-300', riadok: 'bg-slate-950 border-slate-800', meno: 'text-slate-100', info: 'text-slate-400', nahlad: 'border-slate-700', prazdny: 'bg-slate-800', zmaz: 'text-rose-300 hover:bg-rose-950/60' };
  return (
    <div className="space-y-2">
      <button type="button" onClick={onPridat} disabled={bezi} className={`w-full py-2.5 rounded-xl border-2 border-dashed disabled:opacity-60 font-bold text-xs flex items-center justify-center gap-2 transition ${t.tlacidlo}`}>
        <Plus className="w-4 h-4" /> {bezi ? 'Pracujem…' : 'Pridať tento motív do objednávky'}
      </button>
      {popisKrok && <p className={`text-[11px] ${t.popis}`}>{popisKrok}</p>}
      {polozky.length > 0 && (
        <div className="space-y-1.5">
          <div className={`text-[11px] font-bold ${t.nadpis}`}>Motívy v objednávke ({polozky.length}) — poštovné platíš len raz</div>
          {polozky.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-2 border rounded-lg p-1.5 ${t.riadok}`}>
              {p.nahlad ? <img src={p.nahlad} alt="" className={`w-16 h-10 rounded object-contain border ${t.nahlad}`} /> : <div className={`w-16 h-10 rounded ${t.prazdny}`} />}
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${t.meno}`}>Motív {i + 1}: {p.popis}</div>
                <div className={`text-[11px] ${t.info}`}>{p.pocetKs} ks{riadky && riadky[i] ? ` × ${eur(riadky[i].cenaKus)} = ${eur(riadky[i].tovar)} bez DPH` : ''}</div>
              </div>
              <button type="button" onClick={() => onOdober(p.id)} title="Odstrániť motív" className={`p-1.5 rounded-lg ${t.zmaz}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Stav košíka motívov pre aplikácie, kde sa motív pridáva do objednávky (šnúrky, stolové vlajky, fólie, 3D transfery).
//  vytvorPolozku()   -> nahrá súbory a vráti { id, vstup, popis, nahlad, podpis, pocetKs }; vstup = objekt, ktorý sa pošle serveru (polozky[])
//  podpisAktualneho() -> reťazec, ktorý jednoznačne opíše aktuálny návrh/súbor (null = v editore nie je čo pridať)
export function useKosikMotivov({ vytvorPolozku, podpisAktualneho }) {
  const [kosik, setKosik] = useState([]);
  const [pridavam, setPridavam] = useState(false);
  const [chyba, setChyba] = useState('');
  const [info, setInfo] = useState('');
  const pridaj = async () => {
    setPridavam(true); setChyba(''); setInfo('');
    try {
      const p = await vytvorPolozku();
      setKosik((k) => [...k, p]);
      setInfo('Motív je v objednávke. Návrh môžeš upraviť a pridať ďalší motív, alebo objednávku dokončiť.');
      return p;
    } catch (e) {
      setChyba('Motív sa nepodarilo pridať: ' + e.message);
      return null;
    } finally {
      setPridavam(false);
    }
  };
  const odober = (id) => setKosik((k) => k.filter((p) => p.id !== id));
  // Vráti zoznam motívov na odoslanie (pridá aktuálny návrh, ak ešte nie je v objednávke) alebo null, ak zákazník zruší.
  const pripravNaObjednanie = async () => {
    const pod = podpisAktualneho();
    if (kosik.length > 0 && (pod === null || kosik.some((p) => p.podpis === pod))) return kosik;
    if (kosik.length > 0 && !window.confirm('Aktuálny návrh ešte nie je v objednávke. Pridať ho a objednať všetky motívy spolu? (OK = pridať a objednať, Zrušiť = vrátiť sa a upraviť)')) return null;
    const p = await vytvorPolozku();
    return [...kosik, p];
  };
  return { kosik, pridavam, chyba, info, setChyba, setInfo, pridaj, odober, pripravNaObjednanie };
}

// Riadky ceny motívov z odpovede servera (cena.polozky) pre zoznam motívov
export const riadkyZCeny = (cena, pocet) => (cena && Array.isArray(cena.polozky) && cena.polozky.length === pocet && pocet > 1 ? cena.polozky.map((r) => ({ cenaKus: r.cenaKsBezDph, tovar: r.logaSpoluBezDph })) : null);
