import React, { useEffect, useState } from 'react';
import { Plus, Trash2, BadgePercent, Copy, Check } from 'lucide-react';
import NumberInput from '../NumberInput';

const ODKAZ_ZAKLAD = 'https://shop.pbtprint.sk/apps/dtf-metraz';
// Znaky bez zameniteľných (0/O, 1/I) — kód sa často diktuje alebo prepisuje.
const ZNAKY = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nahodnyKod = () => 'PBT-' + Array.from({ length: 6 }, () => ZNAKY[Math.floor(Math.random() * ZNAKY.length)]).join('');

export default function B2bKodyTab({ supabase }) {
  const [kody, setKody] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chyba, setChyba] = useState('');
  const [skopirovane, setSkopirovane] = useState('');

  const nacitaj = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('b2b_kody').select('*').order('id');
    if (error) setChyba('Tabuľka B2B kódov sa nenačítala — spusti migráciu migration_b2b_kody.sql v Supabase. (' + error.message + ')');
    setKody(data || []);
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const { data, error } = await supabase.from('b2b_kody').insert({ kod: nahodnyKod(), agentura: 'Nová agentúra', zlava_percent: 15 }).select().single();
    if (error) { window.alert('Pridanie zlyhalo: ' + error.message); return; }
    setKody(k => [...k, data]);
  };
  const uprav = async (id, patch) => {
    if (patch.kod != null) patch.kod = patch.kod.toUpperCase().replace(/\s+/g, '');
    setKody(k => k.map(x => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('b2b_kody').update(patch).eq('id', id);
    if (error) { window.alert('Uloženie zlyhalo (kód musí byť jedinečný): ' + error.message); nacitaj(); }
  };
  const zmaz = async (id) => {
    if (!window.confirm('Zmazať tento kód? Agentúra ním už nezíska zľavu.')) return;
    setKody(k => k.filter(x => x.id !== id));
    await supabase.from('b2b_kody').delete().eq('id', id);
  };
  const kopiruj = async (text, znacka) => {
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Skopíruj:', text); }
    setSkopirovane(znacka);
    setTimeout(() => setSkopirovane(''), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><BadgePercent className="text-indigo-400 h-5 w-5" /> B2B kódy (reklamné agentúry a firmy)</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">Agentúra zadá svoj kód v konfigurátore (alebo otvorí odkaz s kódom) a všetky ceny sa jej znížia o dohodnuté %. Zľava sa odpočíta z ceny tovaru (bez dopravy), počíta sa na serveri. Kód vypneš tlačidlom „Aktívny“ alebo zmažeš, bez zásahu do ostatných.</p>
        </div>
        <button onClick={pridaj} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať kód</button>
      </div>

      {chyba && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">{chyba}</p>}

      {isLoading ? <p className="text-sm text-slate-500">Načítavam…</p> : (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Kód</th>
                <th className="text-left px-4 py-2.5">Agentúra / firma</th>
                <th className="text-left px-4 py-2.5">Zľava (%)</th>
                <th className="text-left px-4 py-2.5">Poznámka</th>
                <th className="text-left px-4 py-2.5">Stav</th>
                <th className="text-left px-4 py-2.5">Odkazy</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {kody.map(k => (
                <tr key={k.id} className="border-t border-slate-800">
                  <td className="px-4 py-2"><input type="text" value={k.kod} onChange={(e) => setKody(l => l.map(x => x.id === k.id ? { ...x, kod: e.target.value.toUpperCase() } : x))} onBlur={(e) => uprav(k.id, { kod: e.target.value })} className="w-40 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" /></td>
                  <td className="px-4 py-2"><input type="text" value={k.agentura} onChange={(e) => uprav(k.id, { agentura: e.target.value })} className="w-44 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2"><NumberInput step="0.5" min="0" max="90" value={k.zlava_percent} onChange={(v) => uprav(k.id, { zlava_percent: Math.min(90, Math.max(0, v)) })} fallback={0} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
                  <td className="px-4 py-2"><input type="text" value={k.poznamka || ''} onChange={(e) => uprav(k.id, { poznamka: e.target.value })} className="w-44 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white" /></td>
                  <td className="px-4 py-2"><button onClick={() => uprav(k.id, { aktivny: !k.aktivny })} className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${k.aktivny ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{k.aktivny ? 'Aktívny' : 'Vypnutý'}</button></td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button onClick={() => kopiruj(k.kod, 'k' + k.id)} className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">{skopirovane === 'k' + k.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Kód</button>
                    <button onClick={() => kopiruj(`${ODKAZ_ZAKLAD}?typ=beachflag&b2b=${k.kod}`, 'o' + k.id)} className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5">{skopirovane === 'o' + k.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Odkaz (Beachvlajky)</button>
                  </td>
                  <td className="px-4 py-2 text-right"><button onClick={() => zmaz(k.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {kody.length === 0 && !chyba && <tr><td colSpan={7} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne kódy. Klikni na „Pridať kód“.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">Odkaz s kódom funguje pre ktorúkoľvek appku, stačí zmeniť časť <code className="bg-slate-950 px-1 rounded">typ=beachflag</code> (zastava, buffka, celenka) alebo pripojiť <code className="bg-slate-950 px-1 rounded">&amp;b2b=KÓD</code> k odkazu na DTF či textilnú metráž (<code className="bg-slate-950 px-1 rounded">?dtf=1</code>, <code className="bg-slate-950 px-1 rounded">?textil=1</code>).</p>
    </div>
  );
}
