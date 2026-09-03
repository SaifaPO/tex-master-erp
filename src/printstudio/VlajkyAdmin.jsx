import React, { useState } from 'react';
import { Flag, Ruler, Package, ClipboardList } from 'lucide-react';
import VlajkaTvaryTab from './VlajkaTvaryTab';
import VlajkaVelkostiTab from './VlajkaVelkostiTab';
import VlajkaDoplnkyTab from './VlajkaDoplnkyTab';
import VlajkaObjednavkyTab from './VlajkaObjednavkyTab';

const SUBTABS = [
  { id: 'tvary', label: 'Tvary', icon: Flag },
  { id: 'velkosti', label: 'Veľkosti a DPH', icon: Ruler },
  { id: 'doplnky', label: 'Doplnky', icon: Package },
  { id: 'objednavky', label: 'Objednávky', icon: ClipboardList },
];

export default function VlajkyAdmin({ supabase }) {
  const [subtab, setSubtab] = useState('objednavky');

  if (!supabase) {
    return <div className="text-sm text-rose-400">Supabase klient nie je nakonfigurovaný.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
        {SUBTABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubtab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${subtab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        {subtab === 'tvary' && <VlajkaTvaryTab supabase={supabase} />}
        {subtab === 'velkosti' && <VlajkaVelkostiTab supabase={supabase} />}
        {subtab === 'doplnky' && <VlajkaDoplnkyTab supabase={supabase} />}
        {subtab === 'objednavky' && <VlajkaObjednavkyTab supabase={supabase} />}
      </div>
    </div>
  );
}
