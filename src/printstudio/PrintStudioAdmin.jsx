import React, { useState } from 'react';
import { Tag, Box, Palette, Type, Image as ImageIcon, Banknote, Camera, ShoppingBag, Scroll, Flag, Shirt } from 'lucide-react';
import KategorieTab from './KategorieTab';
import ProduktyTab from './ProduktyTab';
import FarbyTab from './FarbyTab';
import FontyTab from './FontyTab';
import GrafikyTab from './GrafikyTab';
import CennikTab from './CennikTab';
import MockupyTab from './MockupyTab';
import ShopifyTab from './ShopifyTab';
import DtfMetrazTab from './DtfMetrazTab';
import VlajkyAdmin from './VlajkyAdmin';
import DresAdmin from './DresAdmin';

// Vsetky Shopify konfiguratory (dotlac na tricka, DTF metraz, vlajky/beachvlajky, vyroba dresov)
// zoskupene pod jednou kartou "PrintStudio Pro" v hlavnom ERP navigacii — namiesto samostatnych kariet.
const SUBTABS = [
  { id: 'kategorie', label: 'Kategórie', icon: Tag },
  { id: 'produkty', label: 'Produkty (Blanks)', icon: Box },
  { id: 'farby', label: 'Farby', icon: Palette },
  { id: 'fonty', label: 'Fonty', icon: Type },
  { id: 'grafiky', label: 'Grafiky (Design)', icon: ImageIcon },
  { id: 'mockupy', label: 'Fotky produktov', icon: Camera },
  { id: 'cennik', label: 'Cenník potlače', icon: Banknote },
  { id: 'shopify', label: 'Shopify prepojenie', icon: ShoppingBag },
  { id: 'dtf-metraz', label: 'DTF metráž', icon: Scroll },
  { id: 'vlajky', label: 'Vlajky', icon: Flag },
  { id: 'dresy', label: 'Výroba dresov', icon: Shirt },
];

export default function PrintStudioAdmin({ supabase }) {
  const [subtab, setSubtab] = useState('produkty');

  if (!supabase) {
    return <p className="text-sm text-rose-400">Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>;
  }

  return (
    <div className="space-y-6 print:hidden animate-in fade-in duration-150">
      <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
        {SUBTABS.map(t => {
          const Icon = t.icon;
          const active = subtab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubtab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        {subtab === 'kategorie' && <KategorieTab supabase={supabase} />}
        {subtab === 'produkty' && <ProduktyTab supabase={supabase} />}
        {subtab === 'farby' && <FarbyTab supabase={supabase} />}
        {subtab === 'fonty' && <FontyTab supabase={supabase} />}
        {subtab === 'grafiky' && <GrafikyTab supabase={supabase} />}
        {subtab === 'mockupy' && <MockupyTab supabase={supabase} />}
        {subtab === 'cennik' && <CennikTab supabase={supabase} />}
        {subtab === 'shopify' && <ShopifyTab supabase={supabase} />}
        {subtab === 'dtf-metraz' && <DtfMetrazTab supabase={supabase} />}
        {subtab === 'vlajky' && <VlajkyAdmin supabase={supabase} />}
        {subtab === 'dresy' && <DresAdmin supabase={supabase} />}
      </div>
    </div>
  );
}
