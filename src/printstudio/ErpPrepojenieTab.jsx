import React, { useEffect, useState } from 'react';
import { Link2, AlertTriangle } from 'lucide-react';

// Prepojenie variantov z konfiguratorov (Celenky, Buffky) na produkty v Katalogu produktov ERP. Po zaplateni objednavky v Shopify sa
// podla tohto mapovania zalozi zakazka v ERP (cislo PBT-RR-XXXX) so spravnym produktom. Bez prepojenia sa zakazka zalozi bez produktu.
export default function ErpPrepojenieTab({ supabase }) {
  const [erpProdukty, setErpProdukty] = useState([]);
  const [riadky, setRiadky] = useState([]); // { konfigurator, kod, popis }
  const [mapovanie, setMapovanie] = useState({}); // `${konfigurator}::${kod}` -> erp_produkt_id
  const [chyba, setChyba] = useState('');
  const [uklada, setUklada] = useState('');
  const [nacitava, setNacitava] = useState(true);

  const nacitaj = async () => {
    setNacitava(true);
    const [{ data: prod }, { data: var1 }, { data: mat1 }, { data: mat2 }, { data: map, error: mapErr }] = await Promise.all([
      supabase.from('products').select('id, name, custom_code').order('name'),
      supabase.from('celenky_varianty').select('velkost_kod, velkost_nazov, material_kod, poradie').order('poradie').order('material_kod'),
      supabase.from('celenky_materialy').select('kod, nazov'),
      supabase.from('buffky_premium_materialy').select('kod, nazov, aktivny').order('poradie'),
      supabase.from('erp_mapovanie_produktov').select('*'),
    ]);
    setChyba(mapErr ? 'Tabuľka prepojenia ešte neexistuje — spusti v Supabase SQL migráciu migration_erp_zakazky_z_konfiguratorov.sql (priečinok printstudio-pro).' : '');
    setErpProdukty(prod || []);
    const matNazov = Object.fromEntries((mat1 || []).map(m => [m.kod, m.nazov]));
    const r = [];
    (var1 || []).forEach(v => r.push({ konfigurator: 'celenky', kod: `${v.velkost_kod}|${v.material_kod}`, popis: `${v.velkost_nazov} — ${matNazov[v.material_kod] || v.material_kod}` }));
    r.push({ konfigurator: 'buffky', kod: 'basic', popis: 'Tubular Basic (bezšvová)' });
    (mat2 || []).filter(m => m.aktivny !== false).forEach(m => r.push({ konfigurator: 'buffky', kod: `premium|${m.kod}`, popis: `Premium — ${m.nazov}` }));
    setRiadky(r);
    setMapovanie(Object.fromEntries((map || []).map(m => [`${m.konfigurator}::${m.variant_kod}`, m.erp_produkt_id || ''])));
    setNacitava(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uloz = async (r, erpId) => {
    const kluc = `${r.konfigurator}::${r.kod}`;
    setMapovanie(prev => ({ ...prev, [kluc]: erpId }));
    setUklada(kluc);
    const { error } = await supabase.from('erp_mapovanie_produktov').upsert({ konfigurator: r.konfigurator, variant_kod: r.kod, erp_produkt_id: erpId || null }, { onConflict: 'konfigurator,variant_kod' });
    setUklada('');
    if (error) window.alert('Prepojenie sa nepodarilo uložiť: ' + error.message);
  };

  const sekcia = (konfigurator, nadpis) => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
      <h3 className="text-sm font-bold text-white">{nadpis}</h3>
      {riadky.filter(r => r.konfigurator === konfigurator).map(r => {
        const kluc = `${r.konfigurator}::${r.kod}`;
        const hodnota = mapovanie[kluc] || '';
        return (
          <div key={kluc} className="grid sm:grid-cols-[1fr_1.4fr] gap-2 items-center">
            <span className="text-xs text-slate-300 font-semibold">{r.popis}</span>
            <div className="flex items-center gap-2">
              <select value={hodnota} onChange={(e) => uloz(r, e.target.value)} className={`flex-1 px-2 py-1.5 bg-slate-950 border rounded-lg text-xs text-white ${hodnota ? 'border-slate-700' : 'border-amber-700/60'}`}>
                <option value="">— nevybraný (zákazka vznikne bez produktu) —</option>
                {erpProdukty.map(p => <option key={p.id} value={p.id}>{p.custom_code ? `${p.custom_code} · ` : ''}{p.name}</option>)}
              </select>
              {uklada === kluc && <span className="text-[10px] text-slate-500">ukladám…</span>}
              {!hodnota && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Link2 className="text-indigo-400 h-5 w-5" /> Prepojenie na ERP produkty</h2>
        <p className="text-xs text-slate-400 mt-1">
          Po zaplatení objednávky čelenky alebo buffky v e-shope sa v ERP automaticky založí zákazka s číslom PBT-RR-XXXX. Tu vyberiete, na ktorý produkt
          z Katalógu produktov sa má ktorá varianta (veľkosť × materiál) premietnuť — podľa neho sa nastavia výrobné stanice a uvidíte výrobnú cenu.
        </p>
      </div>
      {chyba && <p className="text-xs text-amber-400">{chyba}</p>}
      {nacitava ? <p className="text-sm text-slate-500">Načítavam…</p> : (
        <>
          {sekcia('celenky', 'Čelenky — veľkosť × materiál')}
          {sekcia('buffky', 'Buffky')}
        </>
      )}
    </div>
  );
}
