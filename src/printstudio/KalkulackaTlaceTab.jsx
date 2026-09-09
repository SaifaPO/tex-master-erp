import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';

// Presunute z Cenovych ponuk (src/CenovePonukyTab.jsx) — nastavenia (materialy/velkosti) pre
// kalkulacku tlace v cenovej ponuke teraz zije tu, aby obchodnik v Cenovych ponukach uz len
// pouzival hotovu kalkulacku (vyber metody/materialu/velkosti/farieb/ks -> cena), nie aby ju
// sam nastavoval. Tabulky (quote_print_materials, quote_print_sizes) su nezmenene — ide o
// presun administracneho rozhrania, nie o novu databazovu strukturu.
// Vzorec (nemenit, rovnaky ako v Cenovych ponukach): cena riadku = cena_za_jednotku × spotreba
// × pocet_farieb (len Flex a Sietotlac) × pocet_kusov.
const PRINT_METHODS = [
  { id: 'flex', label: 'Flex fólia', colors: true },
  { id: 'dtf', label: 'DTF', colors: false },
  { id: 'sietotlac', label: 'Sieťotlač', colors: true },
  { id: 'vysivka', label: 'Výšivka', colors: false },
];

const mapPrintMaterialFromDb = (r) => ({ id: r.id, metoda: r.metoda, nazov: r.nazov, jednotka: r.jednotka || 'bm', cenaZaJednotku: r.cena_za_jednotku || 0, sortOrder: r.sort_order || 0 });
const mapPrintSizeFromDb = (r) => ({ id: r.id, metoda: r.metoda, label: r.label, spotreba: r.spotreba || 0, sortOrder: r.sort_order || 0 });

export default function KalkulackaTlaceTab({ supabase, triggerNotification }) {
  const [printMaterials, setPrintMaterials] = useState([]);
  const [printSizes, setPrintSizes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [calcAdminMethod, setCalcAdminMethod] = useState('flex');
  const [newMaterialDraft, setNewMaterialDraft] = useState({ nazov: '', jednotka: 'bm', cenaZaJednotku: '' });
  const [newSizeDraft, setNewSizeDraft] = useState({ label: '', spotreba: '' });

  const notify = triggerNotification || (() => {});

  const nacitaj = async () => {
    setIsLoading(true);
    const [materialRes, sizeRes] = await Promise.all([
      supabase.from('quote_print_materials').select('*').order('sort_order'),
      supabase.from('quote_print_sizes').select('*').order('sort_order'),
    ]);
    setPrintMaterials(materialRes.error ? [] : (materialRes.data || []).map(mapPrintMaterialFromDb));
    setPrintSizes(sizeRes.error ? [] : (sizeRes.data || []).map(mapPrintSizeFromDb));
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPrintMaterial = async () => {
    if (!newMaterialDraft.nazov.trim()) return;
    const item = { id: `pm-${Date.now()}`, metoda: calcAdminMethod, nazov: newMaterialDraft.nazov.trim(), jednotka: newMaterialDraft.jednotka || 'bm', cenaZaJednotku: parseFloat(newMaterialDraft.cenaZaJednotku) || 0, sortOrder: printMaterials.filter(m => m.metoda === calcAdminMethod).length };
    const { error } = await supabase.from('quote_print_materials').insert({ id: item.id, metoda: item.metoda, nazov: item.nazov, jednotka: item.jednotka, cena_za_jednotku: item.cenaZaJednotku, sort_order: item.sortOrder });
    if (error) { notify('error', error.message); return; }
    setPrintMaterials(prev => [...prev, item]);
    setNewMaterialDraft({ nazov: '', jednotka: newMaterialDraft.jednotka || 'bm', cenaZaJednotku: '' });
    notify('success', 'Materiál pridaný.');
  };

  const updatePrintMaterial = async (id, field, value) => {
    const parsed = field === 'cenaZaJednotku' ? (parseFloat(value) || 0) : value;
    setPrintMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: parsed } : m));
    const dbField = { nazov: 'nazov', jednotka: 'jednotka', cenaZaJednotku: 'cena_za_jednotku' }[field];
    if (!dbField) return;
    await supabase.from('quote_print_materials').update({ [dbField]: parsed }).eq('id', id);
  };

  const deletePrintMaterial = async (id) => {
    if (!window.confirm('Vymazať tento materiál z kalkulačky?')) return;
    const { error } = await supabase.from('quote_print_materials').delete().eq('id', id);
    if (error) { notify('error', error.message); return; }
    setPrintMaterials(prev => prev.filter(m => m.id !== id));
  };

  const addPrintSize = async () => {
    if (!newSizeDraft.label.trim()) return;
    const item = { id: `ps-${Date.now()}`, metoda: calcAdminMethod, label: newSizeDraft.label.trim(), spotreba: parseFloat(newSizeDraft.spotreba) || 0, sortOrder: printSizes.filter(s => s.metoda === calcAdminMethod).length };
    const { error } = await supabase.from('quote_print_sizes').insert({ id: item.id, metoda: item.metoda, label: item.label, spotreba: item.spotreba, sort_order: item.sortOrder });
    if (error) { notify('error', error.message); return; }
    setPrintSizes(prev => [...prev, item]);
    setNewSizeDraft({ label: '', spotreba: '' });
    notify('success', 'Veľkosť pridaná.');
  };

  const updatePrintSize = async (id, field, value) => {
    const parsed = field === 'spotreba' ? (parseFloat(value) || 0) : value;
    setPrintSizes(prev => prev.map(s => s.id === id ? { ...s, [field]: parsed } : s));
    const dbField = { label: 'label', spotreba: 'spotreba' }[field];
    if (!dbField) return;
    await supabase.from('quote_print_sizes').update({ [dbField]: parsed }).eq('id', id);
  };

  const deletePrintSize = async (id) => {
    if (!window.confirm('Vymazať túto veľkosť z kalkulačky?')) return;
    const { error } = await supabase.from('quote_print_sizes').delete().eq('id', id);
    if (error) { notify('error', error.message); return; }
    setPrintSizes(prev => prev.filter(s => s.id !== id));
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart className="text-indigo-400 h-5 w-5" /> Kalkulačka tlače (Cenové ponuky)</h2>
        <p className="text-xs text-slate-400 mt-1">
          Nastavenia pre kalkulačku, ktorú obchodník používa v Cenových ponukách pri rýchlom pridaní
          riadku potlače do ponuky. Pre každú metódu potlače nastav materiály (cena za jednotku —
          bm/kg/ks) a veľkosti motívu (priemerná spotreba materiálu na danú veľkosť). Cena riadku v
          ponuke = cena za jednotku × spotreba × počet farieb (len pri Flexe a Sieťotlači) × počet kusov.
          Obchodník v Cenových ponukách už len vyberá hotové možnosti, tieto nastavenia tam nevidí.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {PRINT_METHODS.map(m => (
          <button key={m.id} onClick={() => setCalcAdminMethod(m.id)} className={`px-3 py-2 rounded-lg text-xs font-bold ${calcAdminMethod === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>{m.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Materiály</h4>
          <div className="grid grid-cols-12 gap-1.5">
            <input type="text" value={newMaterialDraft.nazov} onChange={(e) => setNewMaterialDraft({ ...newMaterialDraft, nazov: e.target.value })} placeholder="Názov materiálu" className="col-span-6 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <select value={newMaterialDraft.jednotka} onChange={(e) => setNewMaterialDraft({ ...newMaterialDraft, jednotka: e.target.value })} className="col-span-2 bg-slate-900 border border-slate-800 rounded px-1 py-1.5 text-xs text-white">
              <option value="bm">bm</option>
              <option value="kg">kg</option>
              <option value="ks">ks</option>
            </select>
            <input type="number" step="0.01" value={newMaterialDraft.cenaZaJednotku} onChange={(e) => setNewMaterialDraft({ ...newMaterialDraft, cenaZaJednotku: e.target.value })} placeholder="Cena €" className="col-span-3 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <button onClick={addPrintMaterial} className="col-span-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1.5">
            {printMaterials.filter(m => m.metoda === calcAdminMethod).map(m => (
              <div key={m.id} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                <input type="text" defaultValue={m.nazov} onBlur={(e) => updatePrintMaterial(m.id, 'nazov', e.target.value)} className="flex-1 bg-transparent text-xs text-white p-1 rounded hover:bg-slate-800 focus:bg-slate-800" />
                <select defaultValue={m.jednotka} onChange={(e) => updatePrintMaterial(m.id, 'jednotka', e.target.value)} className="bg-transparent text-[11px] text-slate-400 p-1 rounded hover:bg-slate-800">
                  <option value="bm">bm</option>
                  <option value="kg">kg</option>
                  <option value="ks">ks</option>
                </select>
                <input type="number" step="0.01" defaultValue={m.cenaZaJednotku} onBlur={(e) => updatePrintMaterial(m.id, 'cenaZaJednotku', e.target.value)} className="w-20 bg-transparent text-right text-xs text-emerald-400 font-bold p-1 rounded hover:bg-slate-800 focus:bg-slate-800" />
                <button onClick={() => deletePrintMaterial(m.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {printMaterials.filter(m => m.metoda === calcAdminMethod).length === 0 && (
              <p className="text-[11px] text-slate-500 text-center py-3">Žiadne materiály pre túto metódu.</p>
            )}
          </div>
        </div>

        <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Veľkosti (priemerná spotreba)</h4>
          <div className="grid grid-cols-12 gap-1.5">
            <input type="text" value={newSizeDraft.label} onChange={(e) => setNewSizeDraft({ ...newSizeDraft, label: e.target.value })} placeholder="Označenie veľkosti" className="col-span-7 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <input type="number" step="0.001" value={newSizeDraft.spotreba} onChange={(e) => setNewSizeDraft({ ...newSizeDraft, spotreba: e.target.value })} placeholder="Spotreba" className="col-span-4 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            <button onClick={addPrintSize} className="col-span-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1.5">
            {printSizes.filter(s => s.metoda === calcAdminMethod).map(s => (
              <div key={s.id} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1.5">
                <input type="text" defaultValue={s.label} onBlur={(e) => updatePrintSize(s.id, 'label', e.target.value)} className="flex-1 bg-transparent text-xs text-white p-1 rounded hover:bg-slate-800 focus:bg-slate-800" />
                <input type="number" step="0.001" defaultValue={s.spotreba} onBlur={(e) => updatePrintSize(s.id, 'spotreba', e.target.value)} className="w-24 bg-transparent text-right text-xs text-emerald-400 font-bold p-1 rounded hover:bg-slate-800 focus:bg-slate-800" />
                <button onClick={() => deletePrintSize(s.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {printSizes.filter(s => s.metoda === calcAdminMethod).length === 0 && (
              <p className="text-[11px] text-slate-500 text-center py-3">Žiadne veľkosti pre túto metódu.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
