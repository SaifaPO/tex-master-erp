import React, { useState } from 'react';
import { Layers, Settings, ClipboardList } from 'lucide-react';
import ZastavaMaterialyTab from './ZastavaMaterialyTab';
import ZastavaNastaveniaTab from './ZastavaNastaveniaTab';
import ZastavaObjednavkyTab from './ZastavaObjednavkyTab';

const SUBTABS = [
  { id: 'materialy', label: 'Materiály', icon: Layers },
  { id: 'nastavenia', label: 'Náklady a marža', icon: Settings },
  { id: 'objednavky', label: 'Objednávky', icon: ClipboardList },
];

export default function ZastavyAdmin({ supabase }) {
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
        {subtab === 'materialy' && <ZastavaMaterialyTab supabase={supabase} />}
        {subtab === 'nastavenia' && <ZastavaNastaveniaTab supabase={supabase} />}
        {subtab === 'objednavky' && <ZastavaObjednavkyTab supabase={supabase} />}
      </div>
    </div>
  );
}
