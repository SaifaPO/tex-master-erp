import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Výber produktu priamo z Katalógu produktov (ERP) pre appky (buffky, čelenky…). Za scénou sa vytvorí/použije „blank" (sprostredkovateľ,
// ktorý aplikácie čítajú) — admin vidí a vyberá len produkt z katalógu a cena sa berie z jeho výrobnej ceny. Ručná cena sa nezadáva.
export default function ErpProduktVyber({ supabase, blankId, blanky, erpProdukty, onZmena, onBlankVytvoreny, trieda = '' }) {
  const [uklada, setUklada] = useState(false);
  const blank = blanky.find(b => b.id === blankId);
  const hodnota = blank ? (blank.erp_produkt_id || 'starý') : '';
  const erp = blank?.erp_produkt_id ? erpProdukty.find(x => x.id === blank.erp_produkt_id) : null;

  const zmen = async (erpId) => {
    if (!erpId) { onZmena(null); return; }
    if (erpId === 'starý') return;
    const existujuci = blanky.find(b => b.erp_produkt_id === erpId);
    if (existujuci) { onZmena(existujuci.id); return; }
    const ep = erpProdukty.find(x => x.id === erpId);
    if (!ep) return;
    setUklada(true);
    const { data: kat } = await supabase.from('kategorie').select('id').order('poradie').order('id').limit(1).maybeSingle();
    if (!kat) { setUklada(false); window.alert('Najprv vytvor aspoň jednu kategóriu (PrintStudio → Knižnica → Kategórie).'); return; }
    const { data: novy, error } = await supabase.from('produkty').insert({
      kategoria_id: kat.id, nazov: ep.name, pohlavie: 'unisex', zakladna_cena: Number(ep.production_cost) || 0,
      technologia: 'sublimacia', aktivny: true, erp_produkt_id: ep.id,
    }).select('id, nazov, zakladna_cena, aktivny, erp_produkt_id').single();
    setUklada(false);
    if (error) { window.alert('Produkt sa nepodarilo prepojiť (bola spustená migrácia migration_produkty_z_erp_katalogu.sql?): ' + error.message); return; }
    onBlankVytvoreny?.(novy);
    onZmena(novy.id);
  };

  return (
    <div className={trieda}>
      <select value={hodnota} onChange={(e) => zmen(e.target.value)} disabled={uklada} className={`w-full px-2 py-2 bg-slate-900 border rounded-lg text-white text-xs ${blank ? 'border-slate-700' : 'border-amber-700/60'}`}>
        <option value="">— vyber produkt z Katalógu produktov —</option>
        {blank && !blank.erp_produkt_id && <option value="starý">{blank.nazov} (starý blank bez prepojenia na katalóg)</option>}
        {erpProdukty.map(x => <option key={x.id} value={x.id}>{x.custom_code ? `${x.custom_code} · ` : ''}{x.name}{x.production_cost != null ? ` — ${Number(x.production_cost).toFixed(2)} €` : ''}</option>)}
      </select>
      {erp && <p className="text-[10px] text-emerald-400 mt-1">Výrobná cena z katalógu: {erp.production_cost != null ? `${Number(erp.production_cost).toFixed(2)} €/ks` : 'zatiaľ nevyplnená'} — upravuje sa v Katalógu produktov.</p>}
      {blank && !blank.erp_produkt_id && <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Starý ručne zadaný produkt ({Number(blank.zakladna_cena).toFixed(2)} €) — vyber produkt z katalógu, aby sa cena brala odtiaľ.</p>}
      {!blank && <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Nie je vybraný produkt — cena sa nedá spočítať z katalógu.</p>}
    </div>
  );
}
