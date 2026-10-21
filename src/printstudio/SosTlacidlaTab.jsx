import React, { useCallback, useEffect, useState } from 'react';
import { Siren, Plus, Trash2, Copy, AlertTriangle, RefreshCw } from 'lucide-react';

// SOS tlačidlá na staniciach: fyzické Wi-Fi tlačidlo pri stroji (šitie, kompletáž, balenie…) po stlačení vytvorí v ERP žiadosť o pomoc
// pre grafika, ktorý robil zákazku, čo je práve na stanici (inak pre supervízora). Tlačidlo sa overuje tajným tokenom, ktorý sa vytvára tu.
const STANICE = [['sitie', 'Šitie'], ['strihanie', 'Strihanie & Kompletáž'], ['balenie', 'Balenie'], ['grafik', 'Grafika'], ['laser', 'Laser'], ['sublimacia', 'Sublimácia'], ['transfer', 'Transfer tlač'], ['sietotlac', 'Sieťotlač']];
const nazovStanice = (k) => STANICE.find((s) => s[0] === k)?.[1] || k;
const FUNKCIA_URL = `${(import.meta.env.VITE_SUPABASE_URL || 'https://<projekt>.supabase.co').replace(/\/$/, '')}/functions/v1/sos-stanica`;
const kedy = (iso) => { if (!iso) return '—'; const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'práve teraz' : m < 60 ? `pred ${m} min` : m < 1440 ? `pred ${Math.round(m / 60)} h` : new Date(iso).toLocaleDateString('sk-SK'); };
const nahodnyToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');

export default function SosTlacidlaTab({ supabase }) {
  const [riadky, setRiadky] = useState([]);
  const [chyba, setChyba] = useState('');
  const [nazov, setNazov] = useState('');
  const [stanica, setStanica] = useState('sitie');
  const [vyslednaSprava, setVyslednaSprava] = useState('');

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('sos_tlacidla').select('*').order('created_at');
    if (error) { setChyba('Tabuľka SOS tlačidiel ešte neexistuje — spusti v Supabase SQL Editore migration_sos_stanice.sql.'); return; }
    setChyba(''); setRiadky(data || []);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const pridaj = async () => {
    if (!nazov.trim()) { window.alert('Napíš názov tlačidla, napr. „Šitie – stôl 1“.'); return; }
    const { error } = await supabase.from('sos_tlacidla').insert({ nazov: nazov.trim(), stanica, token: nahodnyToken() });
    if (error) { window.alert(error.message); return; }
    setNazov(''); nacitaj();
  };
  const zmen = async (id, patch) => { setRiadky((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x))); await supabase.from('sos_tlacidla').update(patch).eq('id', id); };
  const zmaz = async (id) => { if (!window.confirm('Zmazať toto tlačidlo? Fyzické tlačidlo prestane fungovať.')) return; await supabase.from('sos_tlacidla').delete().eq('id', id); nacitaj(); };
  const kopiruj = async (text) => { try { await navigator.clipboard.writeText(text); setVyslednaSprava('Skopírované.'); } catch { setVyslednaSprava(text); } };
  const test = async (t) => {
    setVyslednaSprava('Posielam skúšobné stlačenie…');
    try {
      const odp = await fetch(`${FUNKCIA_URL}?t=${encodeURIComponent(t.token)}&typ=pomoc`);
      const j = await odp.json();
      setVyslednaSprava(j.ok ? (j.duplicita ? 'Žiadosť už bola odoslaná pred chvíľou.' : `Funguje — upozornený: ${j.komu}${j.zakazka ? `, zákazka ${j.zakazka}` : ' (na stanici nie je rozrobená zákazka)'}. Žiadosť nájdeš v „Žiadosti o pomoc“.`) : `Chyba: ${j.error}`);
      nacitaj();
    } catch (e) { setVyslednaSprava('Funkcia sos-stanica neodpovedá (je nasadená a má vypnuté „Verify JWT“?): ' + e.message); }
  };

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Siren className="text-rose-400 h-5 w-5" /> SOS tlačidlá na staniciach</h2>
        <p className="text-xs text-slate-400 mt-1">Pracovník stlačí tlačidlo pri stroji a v ERP vznikne žiadosť o pomoc pre grafika, ktorý robil zákazku rozrobenú na tej stanici (inak pre supervízora). Jeden stisk = „potrebujem pomoc“, dva stisky = „chýba materiál“, dlhý stisk = „nefunguje stroj“. Keď grafik v ERP klikne „Idem“, tlačidlo zasvieti nazeleno. Návod na zapojenie je v priečinku <code className="text-slate-300">hardware/sos-tlacidlo</code>.</p>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-wrap items-end gap-3 text-xs">
        <label className="text-slate-400">Názov tlačidla<input type="text" value={nazov} onChange={(e) => setNazov(e.target.value)} placeholder="Šitie – stôl 1" className="mt-1 block w-56 px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white" /></label>
        <label className="text-slate-400">Stanica<select value={stanica} onChange={(e) => setStanica(e.target.value)} className="mt-1 block px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white">{STANICE.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <button onClick={pridaj} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Vytvoriť tlačidlo</button>
        <button onClick={nacitaj} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 ml-auto"><RefreshCw className="w-3.5 h-3.5" /> Obnoviť</button>
      </div>
      {vyslednaSprava && <p className="text-xs text-emerald-300 break-all">{vyslednaSprava}</p>}

      <div className="space-y-3">
        {riadky.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne tlačidlo.</p>}
        {riadky.map((t) => {
          const zije = t.posledny_ping && Date.now() - new Date(t.posledny_ping).getTime() < 10 * 60000;
          return (
            <div key={t.id} className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-white text-sm">{t.nazov}</span>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">{nazovStanice(t.stanica)}</span>
                <span className={zije ? 'text-emerald-400' : 'text-amber-400'}>{zije ? '● online' : '○ neozýva sa'} (posledný signál {kedy(t.posledny_ping)})</span>
                <span className="text-slate-400">posledné stlačenie: {kedy(t.posledne_stlacenie)}</span>
                <label className="ml-auto flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={t.aktivne} onChange={(e) => zmen(t.id, { aktivne: e.target.checked })} /> aktívne</label>
                <button onClick={() => zmaz(t.id)} className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div><span className="text-slate-500 block mb-1">Token (vloží sa do tlačidla)</span><div className="flex gap-2"><code className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 break-all">{t.token}</code><button onClick={() => kopiruj(t.token)} className="px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Copy className="w-3.5 h-3.5" /></button></div></div>
                <div><span className="text-slate-500 block mb-1">Odkaz pre jednoduché tlačidlá (napr. Shelly) — „pomoc“</span><div className="flex gap-2"><code className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 break-all">{`${FUNKCIA_URL}?t=${t.token}&typ=pomoc`}</code><button onClick={() => kopiruj(`${FUNKCIA_URL}?t=${t.token}&typ=pomoc`)} className="px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"><Copy className="w-3.5 h-3.5" /></button></div></div>
              </div>
              <button onClick={() => test(t)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">Poslať skúšobné stlačenie</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
