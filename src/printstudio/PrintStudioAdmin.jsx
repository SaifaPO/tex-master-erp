import React, { useState, useEffect } from 'react';
import { Link2, Scissors, Tag, Box, Palette, Type, Image as ImageIcon, Banknote, Camera, ShoppingBag, Flag, Shirt, Calculator, Waves, ShoppingCart, ExternalLink, Layers3, Ruler, Printer, Circle, Wind, Grid3x3, HardDrive, BadgePercent, Inbox, LayoutGrid, Library, Coins, Settings2 } from 'lucide-react';
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
import ManualyTab from './ManualyTab';
import CelenkyTab from './CelenkyTab';
import BuffkyTab from './BuffkyTab';
import Transfer3dTab from './Transfer3dTab';
import StolovaTab from './StolovaTab';
import VysivkaModul from '../VysivkaModul';
import SnurkyTab from './SnurkyTab';
import FolieTab from './FolieTab';
import ObjednavkyVsetkyTab from './ObjednavkyVsetkyTab';
import DtfSeparatorTab from './DtfSeparatorTab';
import B2bKodyTab from './B2bKodyTab';
import UloziskoTab from '../UloziskoTab';

// Vsetky Shopify konfiguratory (dotlac na tricka, DTF metraz, vlajky/beachvlajky, vyroba dresov)
// zoskupene pod jednou kartou "PrintStudio Pro" v hlavnom ERP navigacii — namiesto samostatnych kariet.
//
// PRINTSTUDIO_BASE_URL = zivá adresa printstudio-pro na Verceli. Ak sa domena niekedy zmení
// (vlastná doména namiesto *.vercel.app), staci upravit len tento jeden riadok.
const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';

// Všetko pod jednou kartou, v piatich skupinách: Objednávky (spoločné pre všetky aplikácie), Aplikácie (dresy, buffky, čelenky, vlajky,
// beachvlajky), Knižnica (blanks ako sprostredkovateľ medzi Katalógom produktov v ERP a aplikáciami + farby/fonty/grafiky), Ceny a tlač, Nastavenia.
const SUBTABS = [
  { id: 'objednavky', label: 'Všetky objednávky', icon: Inbox },
  { id: 'dresy', label: 'Dresy', icon: Shirt, appUrl: PRINTSTUDIO_BASE_URL },
  { id: 'buffky', label: 'Buffky', icon: Wind, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=buffka` },
  { id: 'stolova', label: 'Stolové vlajky', icon: Flag, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=stolova` },
  { id: 'snurky', label: 'Šnúrky na krk', icon: Link2, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=snurka` },
  { id: 'folie', label: 'Rezané fólie', icon: Scissors, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=folie` },
  { id: 'transfer3d', label: '3D transfery', icon: Layers3, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=transfer3d` },
  { id: 'celenky', label: 'Čelenky', icon: Circle, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=celenka` },
  { id: 'vlajky', label: 'Vlajky', icon: Flag, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=zastava` },
  { id: 'beachvlajky', label: 'Beachvlajky', icon: Waves, appUrl: `${PRINTSTUDIO_BASE_URL}/?typ=beachflag` },
  { id: 'metraze', label: 'Metráže (DTF a textil)', icon: Ruler },
  { id: 'produkty', label: 'Produkty (Blanks)', icon: Box, appUrl: PRINTSTUDIO_BASE_URL },
  { id: 'kategorie', label: 'Kategórie', icon: Tag },
  { id: 'farby', label: 'Farby', icon: Palette },
  { id: 'fonty', label: 'Fonty', icon: Type },
  { id: 'grafiky', label: 'Grafiky (Design)', icon: ImageIcon },
  { id: 'mockupy', label: 'Fotky produktov', icon: Camera },
  { id: 'cenotvorba', label: 'Cenotvorba (marže)', icon: Calculator },
  { id: 'kostra-cien', label: 'Kostra cien', icon: Layers3 },
  { id: 'potlace', label: 'Potlače', icon: Banknote },
  { id: 'kalkulacka-tlace', label: 'Kalkulačka tlače (Cen. ponuky)', icon: ShoppingCart },
  { id: 'predajny-cennik', label: 'Predajný cenník (tlač A4)', icon: Printer },
  { id: 'shopify', label: 'Shopify prepojenie', icon: ShoppingBag },
  { id: 'b2b-kody', label: 'B2B kódy (agentúry)', icon: BadgePercent },
  { id: 'manualy', label: 'Manuály (tlač A4)', icon: Flag },
  { id: 'dtf-separator', label: 'DTF/DTG Separátor', icon: Grid3x3 },
  { id: 'vysivka', label: 'Výšivka (editor)', icon: Shirt },
  { id: 'ulozisko', label: 'Úložisko', icon: HardDrive },
];

const SKUPINY = [
  { id: 'objednavky', label: 'Objednávky', icon: Inbox, tabs: ['objednavky'] },
  { id: 'aplikacie', label: 'Aplikácie', icon: LayoutGrid, tabs: ['dresy', 'buffky', 'celenky', 'transfer3d', 'stolova', 'snurky', 'folie', 'vlajky', 'beachvlajky', 'metraze'] },
  { id: 'kniznica', label: 'Knižnica', icon: Library, tabs: ['produkty', 'kategorie', 'farby', 'fonty', 'grafiky', 'mockupy'] },
  { id: 'ceny', label: 'Ceny a tlač', icon: Coins, tabs: ['cenotvorba', 'kostra-cien', 'potlace', 'kalkulacka-tlace', 'predajny-cennik'] },
  { id: 'nastavenia', label: 'Nastavenia', icon: Settings2, tabs: ['shopify', 'b2b-kody', 'manualy', 'dtf-separator', 'vysivka', 'ulozisko'] },
];

export default function PrintStudioAdmin({ supabase, initialSubtab }) {
  const [subtab, setSubtab] = useState('objednavky');
  const skupina = SKUPINY.find(g => g.tabs.includes(subtab)) || SKUPINY[0];
  const activeAppUrl = SUBTABS.find(t => t.id === subtab)?.appUrl;

  // initialSubtab prichadza z globalneho vyhladavania (Ctrl+K) — meni sa nonce v tabId
  // aby sa da "skocit" aj opakovane na tu istu podzalozku.
  useEffect(() => {
    if (initialSubtab) setSubtab(initialSubtab);
  }, [initialSubtab]);

  if (!supabase) {
    return <p className="text-sm text-rose-400">Supabase klient nie je nakonfigurovaný (chýbajú VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>;
  }

  return (
    <div className="space-y-6 print:hidden animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
            {SKUPINY.map(g => {
              const Icon = g.icon;
              const aktivna = skupina.id === g.id;
              return (
                <button key={g.id} onClick={() => { if (!aktivna) setSubtab(g.tabs[0]); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${aktivna ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  <Icon className="h-4 w-4" /> {g.label}
                </button>
              );
            })}
          </div>
          {skupina.tabs.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {skupina.tabs.map(id => {
                const t = SUBTABS.find(x => x.id === id);
                const Icon = t.icon;
                const active = subtab === id;
                return (
                  <button key={id} onClick={() => setSubtab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${active ? 'bg-slate-800 text-white border-indigo-500' : 'text-slate-400 border-slate-800 hover:bg-slate-900'}`}>
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          )}
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
        {subtab === 'objednavky' && <ObjednavkyVsetkyTab supabase={supabase} onOtvor={setSubtab} />}
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
        {subtab === 'manualy' && <ManualyTab supabase={supabase} />}
        {subtab === 'shopify' && <ShopifyTab supabase={supabase} />}
        {subtab === 'vlajky' && <ZastavyAdmin supabase={supabase} />}
        {subtab === 'beachvlajky' && <VlajkyAdmin supabase={supabase} />}
        {subtab === 'dresy' && <DresAdmin supabase={supabase} />}
        {subtab === 'celenky' && <CelenkyTab supabase={supabase} />}
        {subtab === 'buffky' && <BuffkyTab supabase={supabase} />}
        {subtab === 'transfer3d' && <Transfer3dTab supabase={supabase} />}
        {subtab === 'stolova' && <StolovaTab supabase={supabase} />}
        {subtab === 'snurky' && <SnurkyTab supabase={supabase} />}
        {subtab === 'folie' && <FolieTab supabase={supabase} />}
        {subtab === 'b2b-kody' && <B2bKodyTab supabase={supabase} />}
        {subtab === 'dtf-separator' && <DtfSeparatorTab supabase={supabase} />}
        {subtab === 'vysivka' && <VysivkaModul supabase={supabase} vyska="calc(100vh - 260px)" />}
        {subtab === 'ulozisko' && <UloziskoTab supabase={supabase} />}
      </div>
    </div>
  );
}
