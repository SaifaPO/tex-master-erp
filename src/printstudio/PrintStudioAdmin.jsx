import React, { useState } from 'react';
import { Tag, Box, Palette, Type, Image as ImageIcon, Banknote, Camera, ShoppingBag, Flag, Shirt, Calculator, Waves, ShoppingCart, ExternalLink, Layers3, Ruler, Printer } from 'lucide-react';
import KategorieTab from './KategorieTab';
import ProduktyTab from './ProduktyTab';
import FarbyTab from './FarbyTab';
import FontyTab from './FontyTab';
import GrafikyTab from './GrafikyTab';
import CenotvorbaTab from './CenotvorbaTab';
import KostraCienTab from './KostraCienTab';
import MetrazeTab from './MetrazeTab';
import PotlaceTab from './PotlaceTab';
import MockupyTab from './MockupyTab';
import ShopifyTab from './ShopifyTab';
import VlajkyAdmin from './VlajkyAdmin';
import ZastavyAdmin from './ZastavyAdmin';
import DresAdmin from './DresAdmin';
import KalkulackaTlaceTab from './KalkulackaTlaceTab';
import PredajnyCennikTab from './PredajnyCennikTab';

// Vsetky Shopify konfiguratory (dotlac na tricka, DTF metraz, vlajky/beachvlajky, vyroba dresov)
// zoskupene pod jednou kartou "PrintStudio Pro" v hlavnom ERP navigacii — namiesto samostatnych kariet.
//
// PRINTSTUDIO_BASE_URL = zivá adresa printstudio-pro na Verceli. Ak sa domena niekedy zmení
// (vlastná doména namiesto *.vercel.app), staci upravit len tento jeden riadok.
const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';

const SUBTABS = [
  { id: 'kategorie', label: 'Kategórie', icon: Tag },
  { id: 'produkty', label: 'Produkty (Blanks)', icon: Box, appUrl: PRINTSTUDIO_BASE_URL },
  { id: 'farby', label: 'Farby', icon: Palette },
  { id: 'fonty', label: 'Fonty', icon: Type },
  { id: 'grafiky', label: 'Grafiky (Design)', icon: ImageIcon },
  { id: 'mockupy', label: 'Fotky produktov', icon: Camera },
  { id: 'cenotvorba', label: 'Cenotvorba (marže)', icon: Calculator },
  { id: 'kostra-cien', label: 'Kostra cien', icon: Layers3 },
  { id: 'metraze', label: 'Metráže', icon: Ruler },
  { id: 'potlace', label: 'Potlače', icon: Banknote },
  { id: 'kalkulacka-tlace', label: 'Kalkulačka tlače (Cen. ponuky)', icon: ShoppingCart },
  { id: 'predajny-cennik', label: 'Predajný cenník (tlač A4)', icon: Printer },
  { id: 'shopify', label: 'Shopify prepojenie', icon: ShoppingBag },
  { id: 'vlajky', label: 'Vlajky', icon: Flag, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=zastava` },
  { id: 'beachvlajky', label: 'Beachvlajky', icon: Waves, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=beachflag` },
  { id: 'dresy', label: 'Výroba dresov', icon: Shirt, appUrl: PRINTSTUDIO_BASE_URL },
];

export default function PrintStudioAdmin({ supabase }) {
  const [subtab, setSubtab] = useState('produkty');
  const activeAppUrl = SUBTABS.find(t => t.id === subtab)?.appUrl;

  if (!supabase) {
    return <p className="text-sm text-rose-400">Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>;
  }

  return (
    <div className="space-y-6 print:hidden animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {activeAppUrl && (
          <a
            href={activeAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Otvoriť appku v novej karte
          </a>
        )}
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        {subtab === 'kategorie' && <KategorieTab supabase={supabase} />}
        {subtab === 'produkty' && <ProduktyTab supabase={supabase} />}
        {subtab === 'farby' && <FarbyTab supabase={supabase} />}
        {subtab === 'fonty' && <FontyTab supabase={supabase} />}
        {subtab === 'grafiky' && <GrafikyTab supabase={supabase} />}
        {subtab === 'mockupy' && <MockupyTab supabase={supabase} />}
        {subtab === 'cenotvorba' && <CenotvorbaTab supabase={supabase} />}
        {subtab === 'kostra-cien' && <KostraCienTab supabase={supabase} />}
        {subtab === 'metraze' && <MetrazeTab supabase={supabase} />}
        {subtab === 'potlace' && <PotlaceTab supabase={supabase} />}
        {subtab === 'kalkulacka-tlace' && <KalkulackaTlaceTab supabase={supabase} />}
        {subtab === 'predajny-cennik' && <PredajnyCennikTab supabase={supabase} />}
        {subtab === 'shopify' && <ShopifyTab supabase={supabase} />}
        {subtab === 'vlajky' && <ZastavyAdmin supabase={supabase} />}
        {subtab === 'beachvlajky' && <VlajkyAdmin supabase={supabase} />}
        {subtab === 'dresy' && <DresAdmin supabase={supabase} />}
      </div>
    </div>
  );
}
