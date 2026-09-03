import React, { useState } from 'react';
import { Shirt, Percent, ClipboardList } from 'lucide-react';
import DresNastaveniaTab from './DresNastaveniaTab';
import DresZlavyTab from './DresZlavyTab';
import DresObjednavkyTab from './DresObjednavkyTab';

// Admin pre 3D konfigurátor dresov (printstudio-pro/src/dres3d) — rovnaký vzor ako VlajkyAdmin.jsx.
// Zámerne NEZAPOJENÉ do App.jsx (viď brief-claude-code-balik1.md / poznámka v pláne) —
// pridaj v App.jsx: import DresAdmin from './printstudio/DresAdmin'; a
// {activeTab === 'dres3d' && <div className="space-y-6 print:hidden animate-in fade-in duration-150"><DresAdmin supabase={supabase} /></div>}
// plus tlačidlo do navigácie s activeTab 'dres3d', rovnako ako existujúce pre 'vlajky'.
const SUBTABS = [
  { id: 'nastavenia', label: 'Nastavenia dresu', icon: Shirt },
  { id: 'zlavy', label: 'Množstevné zľavy', icon: Percent },
  { id: 'objednavky', label: 'Objednávky', icon: ClipboardList },
];

export default function DresAdmin({ supabase }) {
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
        {subtab === 'nastavenia' && <DresNastaveniaTab supabase={supabase} />}
        {subtab === 'zlavy' && <DresZlavyTab supabase={supabase} />}
        {subtab === 'objednavky' && <DresObjednavkyTab supabase={supabase} />}
      </div>
    </div>
  );
}
