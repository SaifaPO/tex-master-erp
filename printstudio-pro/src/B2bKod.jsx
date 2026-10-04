import React, { useState } from 'react';
import { BadgePercent, X } from 'lucide-react';

// Malé pole "Mám B2B kód" — po overení ukáže zelený štítok so zľavou. Vsetky ceny v appke sa potom pocitaju so zlavou.
export default function B2bKod({ b2b, className = '' }) {
  const [otvorene, setOtvorene] = useState(false);
  const [vstup, setVstup] = useState('');

  if (b2b.kod) {
    return (
      <div className={`flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-xs ${className}`}>
        <BadgePercent className="w-4 h-4 shrink-0" />
        <span className="font-bold">B2B zľava {Number(b2b.zlavaPercent)} %</span>
        {b2b.agentura && <span className="text-emerald-700 truncate">· {b2b.agentura}</span>}
        <button type="button" onClick={b2b.zrus} title="Zrušiť kód" className="ml-auto text-emerald-700 hover:text-emerald-900"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className={className}>
      {!otvorene ? (
        <button type="button" onClick={() => setOtvorene(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5">
          <BadgePercent className="w-3.5 h-3.5" /> Mám B2B kód (reklamné agentúry a firmy)
        </button>
      ) : (
        <form onSubmit={async (e) => { e.preventDefault(); const ok = await b2b.over(vstup); if (ok) { setVstup(''); setOtvorene(false); } }} className="flex items-center gap-2 flex-wrap">
          <input type="text" value={vstup} onChange={(e) => setVstup(e.target.value)} placeholder="Zadajte B2B kód" autoFocus className="px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase w-48" />
          <button type="submit" disabled={b2b.overujem || !vstup.trim()} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold">{b2b.overujem ? 'Overujem…' : 'Uplatniť'}</button>
          <button type="button" onClick={() => { setOtvorene(false); setVstup(''); }} className="text-xs text-slate-500 hover:text-slate-800">Zrušiť</button>
          {b2b.chyba && <span className="text-xs text-rose-600 w-full">{b2b.chyba}</span>}
        </form>
      )}
    </div>
  );
}
