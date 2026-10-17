import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { nahrajFoto } from './FotoSlot';
import GrafikyTab from './GrafikyTab';

// Sprava vzorov a grafiky pre konfigurator (celenky / buffky):
//  - vstavane vzory (vypnut/zapnut, premenovat),
//  - vlastne vzory pozadia (nahraj obrazok celeho strihu),
//  - kniznica vlozitelnych grafik a log (zdielana s dresmi) — sprava je nizsie.
export default function KonfigGrafikaSprava({ supabase, typ, nazovProduktu }) {
  const [vstavane, setVstavane] = useState([]);
  const [vlastne, setVlastne] = useState([]);
  const [chyba, setChyba] = useState('');
  const [nazov, setNazov] = useState('');
  const [subor, setSubor] = useState(null);
  const [uklada, setUklada] = useState(false);

  const nacitaj = useCallback(async () => {
    const [v, c] = await Promise.all([
      supabase.from('konfig_vstavane_vzory').select('*').eq('produkt_typ', typ).order('poradie'),
      supabase.from('konfig_vzory').select('*').eq('produkt_typ', typ).order('poradie').order('id'),
    ]);
    if (v.error) { setChyba(v.error.message.includes('konfig_') ? 'Správa vzorov ešte nie je zapnutá — spusti v Supabase SQL migráciu migration_konfig_vzory.sql (priečinok printstudio-pro).' : v.error.message); return; }
    setChyba('');
    setVstavane(v.data || []);
    setVlastne(c.data || []);
  }, [supabase, typ]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const upravVstavany = async (kluc, patch) => {
    setVstavane(l => l.map(x => x.kluc === kluc ? { ...x, ...patch } : x));
    await supabase.from('konfig_vstavane_vzory').update(patch).eq('produkt_typ', typ).eq('kluc', kluc);
  };
  const upravVlastny = async (id, patch) => {
    setVlastne(l => l.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('konfig_vzory').update(patch).eq('id', id);
  };
  const pridaj = async () => {
    if (!nazov.trim() || !subor) { window.alert('Zadaj názov vzoru a vyber obrázok.'); return; }
    setUklada(true);
    try {
      const url = await nahrajFoto(supabase, subor, `konfig-vzory/${typ}`);
      const { error } = await supabase.from('konfig_vzory').insert({ produkt_typ: typ, nazov: nazov.trim(), url, poradie: vlastne.length + 1 });
      if (error) throw new Error(error.message);
      setNazov(''); setSubor(null);
      await nacitaj();
    } catch (e) { window.alert('Pridanie zlyhalo: ' + e.message); }
    setUklada(false);
  };
  const zmaz = async (v) => {
    if (!window.confirm(`Zmazať vzor "${v.nazov}"?`)) return;
    setVlastne(l => l.filter(x => x.id !== v.id));
    await supabase.from('konfig_vzory').delete().eq('id', v.id);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-white">Vzory a grafika v konfigurátore — {nazovProduktu}</h3>
          <p className="text-xs text-slate-400 mt-1">Vstavané vzory môžeš vypnúť, vlastné vzory pozadia pridáš nahratím obrázka (celý strih, ideálne s rovnakým pomerom strán ako strih). Logá a vkladateľné grafiky spravuješ v knižnici nižšie.</p>
        </div>
        {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chyba}</div>}

        {vstavane.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Vstavané vzory</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {vstavane.map(v => (
                <div key={v.kluc} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                  <input type="text" value={v.nazov} onChange={(e) => upravVstavany(v.kluc, { nazov: e.target.value })} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                  <button onClick={() => upravVstavany(v.kluc, { aktivny: !v.aktivny })} className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${v.aktivny ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{v.aktivny ? <><Eye className="w-3 h-3" /> Zobrazený</> : <><EyeOff className="w-3 h-3" /> Skrytý</>}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Vlastné vzory pozadia</p>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <input type="text" value={nazov} onChange={(e) => setNazov(e.target.value)} placeholder="Názov vzoru" className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white w-48" />
            <input type="file" accept="image/*" onChange={(e) => setSubor(e.target.files?.[0] || null)} className="text-xs text-slate-300 max-w-[14rem]" />
            <button onClick={pridaj} disabled={uklada} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5">{uklada ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Pridať vzor</button>
          </div>
          {vlastne.length === 0 ? <p className="text-xs text-slate-500">Zatiaľ žiadne vlastné vzory.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vlastne.map(v => (
                <div key={v.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  <img src={v.url} alt={v.nazov} className="w-full h-16 object-cover rounded-lg border border-slate-800" />
                  <input type="text" value={v.nazov} onChange={(e) => upravVlastny(v.id, { nazov: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white" />
                  <div className="flex items-center justify-between">
                    <button onClick={() => upravVlastny(v.id, { aktivny: !v.aktivny })} className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.aktivny ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{v.aktivny ? 'Zobrazený' : 'Skrytý'}</button>
                    <button onClick={() => zmaz(v)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-2">Skrytý vlastný vzor zákazník nevidí (vo verejnom zozname sú len zobrazené).</p>
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <GrafikyTab supabase={supabase} />
      </div>
    </div>
  );
}
