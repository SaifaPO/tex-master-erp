import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CreditCard, ShoppingCart } from 'lucide-react';

// Živý náhľad ceny z Edge Function (preview: true) — cenu počíta server, zákazník nikdy nevidí nákupné ceny ani maržu.
export function useCenaNahlad(supabase, funkcia, telo, povolene = true) {
  const [cena, setCena] = useState(null);
  const [chyba, setChyba] = useState('');
  const idDotazu = useRef(0);
  const kluc = JSON.stringify(telo);
  useEffect(() => {
    if (!supabase || !povolene) { setCena(null); return undefined; }
    const id = ++idDotazu.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke(funkcia, { body: { ...telo, preview: true } });
      if (id !== idDotazu.current) return;
      if (error || !data?.ok) { setCena(null); setChyba(data?.error || `Cenu sa nepodarilo vypočítať (je funkcia ${funkcia} nasadená?).`); return; }
      setChyba(''); setCena(data);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, funkcia, kluc, povolene]);
  return { cena, chyba };
}

function Riadok({ label, value }) {
  return <div className="flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-100">{value}</span></div>;
}

// Súhrn ceny + tlačidlo „Objednať a zaplatiť“ (rovnaký vzhľad pre všetky nové appky)
export function CenaSuhrn({ cena, chyba, osobnyOdber, onOsobnyOdber, onObjednat, bezi, chybaObjednavky, potvrdenie, zakazane, poznamkaZakazane, riadky = [], children }) {
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
      <h3 className="text-base font-bold border-b border-slate-700 pb-3">Zhrnutie objednávky</h3>
      {riadky.length > 0 && <div className="space-y-1.5">{riadky.map(([l, v]) => <Riadok key={l} label={l} value={v} />)}</div>}
      {children}
      <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
        <input type="checkbox" checked={osobnyOdber} onChange={(e) => onOsobnyOdber(e.target.checked)} className="mt-0.5" />
        <span>Osobný odber v Prešove alebo Košiciach (neplatím poštovné)</span>
      </label>
      {chyba ? (
        <div className="bg-rose-950/60 border border-rose-700 text-rose-200 p-3 rounded-lg text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {chyba}</div>
      ) : cena ? (
        <div className="space-y-1.5 border-t border-slate-700 pt-3">
          <Riadok label="Cena za 1 ks (bez DPH)" value={`${cena.cenaKsBezDph.toFixed(2)} €`} />
          <Riadok label="Spolu za výrobu (bez DPH)" value={`${cena.logaSpoluBezDph.toFixed(2)} €`} />
          {cena.zlavaB2bEur > 0 && <Riadok label={`B2B zľava ${cena.zlavaB2bPercent} %`} value={`−${cena.zlavaB2bEur.toFixed(2)} €`} />}
          {cena.manipulaciaBezDph > 0 && <Riadok label="Manipulačný poplatok" value={`${cena.manipulaciaBezDph.toFixed(2)} €`} />}
          <Riadok label="Poštovné a balné" value={cena.postovneBezDph === 0 ? 'Zdarma' : `${cena.postovneBezDph.toFixed(2)} €`} />
          <Riadok label="Cena bez DPH" value={`${cena.spoluBezDph.toFixed(2)} €`} />
          <Riadok label={`DPH ${cena.dphPercent} %`} value={`${cena.dph.toFixed(2)} €`} />
          <div className="bg-indigo-600 rounded-xl p-3 mt-2">
            <div className="text-indigo-100 text-[11px]">Celkom s DPH:</div>
            <div className="text-2xl font-extrabold font-mono">{cena.spolu.toFixed(2)} €</div>
          </div>
        </div>
      ) : <p className="text-xs text-slate-400">Počítam cenu…</p>}
      <div className="p-2.5 rounded-lg bg-slate-800 flex items-center gap-2 text-[11px] text-slate-300"><CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify)</div>
      {chybaObjednavky && <p className="text-xs text-rose-300">{chybaObjednavky}</p>}
      {potvrdenie && <p className="text-xs text-emerald-300">{potvrdenie}</p>}
      <button onClick={onObjednat} disabled={bezi || !cena || zakazane} className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2">
        <ShoppingCart className="w-4 h-4" /> {bezi ? 'Vytváram objednávku…' : 'Objednať a zaplatiť'}
      </button>
      {zakazane && poznamkaZakazane && <p className="text-[11px] text-slate-400 text-center">{poznamkaZakazane}</p>}
    </div>
  );
}
