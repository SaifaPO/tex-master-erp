import React, { useEffect, useState } from 'react';
import { Link2, AlertTriangle } from 'lucide-react';
import { Pole, useNastavenia, ObchodneNastavenia, SkupinaMoznosti, ObjednavkyKarta, KalkulackaKarta, useErpProdukty } from './AdminPomocky';

// Šnúrky na krk: každý model (klasická, so sponou, spona + poistka, kľúčenka) má rozmer plátna a náklad na 1 ks.
export default function SnurkyTab({ supabase }) {
  const { nast, zmen, chyba, ulozene } = useNastavenia(supabase, 'snurka_nastavenia');
  const erp = useErpProdukty(supabase);
  const [modely, setModely] = useState([]);
  const [kalk, setKalk] = useState({ model: '', ks: 50 });

  useEffect(() => {
    if (!nast) return;
    (async () => {
      const { data } = await supabase.from('snurka_modely').select('*').order('poradie');
      setModely(data || []);
      setKalk((k) => ({ ...k, model: data?.[0]?.kod || '' }));
    })();
  }, [supabase, nast === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (!nast) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Link2 className="text-indigo-400 h-5 w-5" /> Šnúrky na krk — dizajnér s vlastnou potlačou</h2>
          <p className="text-xs text-slate-400 mt-1">Zákazník si vyberie typ šnúrky a nakreslí dizajn na líce aj rub (plocha {modely[0]?.sirka_mm || 936} × {modely[0]?.vyska_mm || 26} mm). Tlačové PNG (≈ 300 DPI) dostanete pri objednávke. Ceny sú bez DPH.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmen({ aktivny: e.target.checked })} /> Objednávanie zapnuté</label>
        </div>
      </div>

      <ObchodneNastavenia nast={nast} zmen={zmen} supabase={supabase} {...erp} />

      <SkupinaMoznosti supabase={supabase} tabulka="snurka_modely" nadpis="Typy šnúrok" popis="Rozmer potlačiteľnej plochy v mm a náklad na 1 ks (materiál, tlač, spona, šitie). Ak vyberiete produkt z Katalógu, náklad sa berie z jeho výrobnej ceny."
        riadky={modely} setRiadky={setModely} priecinok="snurky" erp={erp} novy={{ sirka_mm: 936, vyska_mm: 26, naklad_eur: 0, popis: '' }}
        polia={[{ k: 'sirka_mm', l: 'Dĺžka plochy', j: 'mm', step: '1' }, { k: 'vyska_mm', l: 'Výška plochy', j: 'mm', step: '1' }, { k: 'naklad_eur', l: 'Náklad', j: '€/ks' }]} />

      <KalkulackaKarta supabase={supabase} funkcia="snurka-create-draft-order" pred={async () => { if (!ulozene) await new Promise((r) => setTimeout(r, 1000)); }}
        telo={{ model: kalk.model, pocetKs: kalk.ks }} popisky={{ model: 'Model šnúrky' }}>
        <div><label className="block text-slate-400 mb-1 text-xs">Typ šnúrky</label>
          <select value={kalk.model} onChange={(e) => setKalk({ ...kalk, model: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{modely.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}</select></div>
        <div className="w-24"><Pole label="Počet ks" step="1" value={kalk.ks} onChange={(v) => setKalk({ ...kalk, ks: Math.max(1, Math.round(v)) })} /></div>
      </KalkulackaKarta>

      <ObjednavkyKarta supabase={supabase} tabulka="snurka_objednavky" nadpis="Prijaté objednávky šnúrok"
        popisRiadku={(o) => modely.find((x) => x.kod === o.model)?.nazov || o.model}
        subory={(o) => [{ cesta: o.subor_cesta, label: 'Líce (PNG)' }, { cesta: o.subor2_cesta, label: 'Rub (PNG)' }]} />
    </div>
  );
}
