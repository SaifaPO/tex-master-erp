import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, AlertTriangle, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import NumberInput from '../NumberInput';
import { Pole, Karta, ObchodneNastavenia, useErpProdukty } from './AdminPomocky';

// SIEŤOTLAČ (verejná stránka ?typ=sietotlac): kalkulačka + dopyt. Cena sa počíta z Kostry cien (Potlače) a maržového modulu,
// tu sa nastavuje len minimum kusov, príplatky (efekty farieb, polyester), e-mail pre upozornenia a vybavujú sa prijaté dopyty.
const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const STAVY = { novy: 'Nový', spracovany: 'Spracovaný', ponuka: 'Ponuka poslaná', objednavka: 'Objednávka', zrusene: 'Zrušený' };
const eur = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(2)} €`);

export default function SietotlacTab({ supabase }) {
  const [nast, setNast] = useState(null);
  const [efekty, setEfekty] = useState([]);
  const [dopyty, setDopyty] = useState([]);
  const [chyba, setChyba] = useState('');
  const [ulozene, setUlozene] = useState(true);
  const [otvoreny, setOtvoreny] = useState(null);
  const casovac = useRef(null);
  const erp = useErpProdukty(supabase);
  const [umiestnenia, setUmiestnenia] = useState([]);
  const [objednavky, setObjednavky] = useState([]);

  const nacitaj = useCallback(async () => {
    const [n, e, d, um, ob] = await Promise.all([
      supabase.from('sietotlac_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('sietotlac_efekty').select('*').order('poradie'),
      supabase.from('sietotlac_dopyty').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('sietotlac_umiestnenia').select('*').order('poradie'),
      supabase.from('sietotlac_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (n.error || !n.data) { setChyba('Tabuľky ešte neexistujú — migrácia migration_sietotlac_appka.sql (priečinok printstudio-pro) nebola spustená.'); return; }
    setChyba(''); setNast(n.data); setEfekty(e.data || []); setDopyty(d.data || []); setUmiestnenia(um.data || []); setObjednavky(ob.data || []);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const zmen = (patch) => {
    setNast((prev) => {
      const next = { ...prev, ...patch };
      setUlozene(false);
      clearTimeout(casovac.current);
      casovac.current = setTimeout(async () => {
        const { error } = await supabase.from('sietotlac_nastavenia').upsert({ ...next, id: 1, updated_at: new Date().toISOString() });
        if (error) window.alert('Uloženie zlyhalo: ' + error.message); else setUlozene(true);
      }, 700);
      return next;
    });
  };

  const zmenEfekt = async (kod, patch) => {
    setEfekty((p) => p.map((x) => (x.kod === kod ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('sietotlac_efekty').update(patch).eq('kod', kod);
    if (error) window.alert('Uloženie zlyhalo: ' + error.message);
  };
  const pridajEfekt = async () => {
    const nazov = window.prompt('Názov nového efektu (napr. Glitter):');
    if (!nazov) return;
    const kod = nazov.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `efekt_${Date.now()}`;
    const novy = { kod, nazov, popis: '', priplatok_percent: 0, aktivny: true, poradie: (efekty.reduce((m, x) => Math.max(m, x.poradie || 0), 0)) + 1 };
    const { error } = await supabase.from('sietotlac_efekty').insert(novy);
    if (error) { window.alert('Pridanie zlyhalo: ' + error.message); return; }
    setEfekty((p) => [...p, novy]);
  };
  const zmazEfekt = async (kod) => {
    if (!window.confirm('Naozaj zmazať tento efekt? (Radšej ho len vypnite zaškrtnutím „Zobraziť“.)')) return;
    const { error } = await supabase.from('sietotlac_efekty').delete().eq('kod', kod);
    if (error) { window.alert('Zmazanie zlyhalo: ' + error.message); return; }
    setEfekty((p) => p.filter((x) => x.kod !== kod));
  };

  const zmenUmiestnenie = async (kod, patch) => {
    setUmiestnenia((p) => p.map((x) => (x.kod === kod ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('sietotlac_umiestnenia').update(patch).eq('kod', kod);
    if (error) window.alert('Uloženie zlyhalo: ' + error.message);
  };
  const zmenObjednavku = async (id, patch) => {
    setObjednavky((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('sietotlac_objednavky').update(patch).eq('id', id);
    if (error) window.alert('Uloženie zlyhalo: ' + error.message);
  };
  const otvorSubor = async (cesta) => {
    const { data, error } = await supabase.storage.from('print-designs').createSignedUrl(cesta, 600);
    if (error || !data?.signedUrl) { window.alert('Súbor sa nepodarilo otvoriť: ' + (error?.message || 'chýba')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const zmenDopyt = async (id, patch) => {
    setDopyty((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('sietotlac_dopyty').update(patch).eq('id', id);
    if (error) window.alert('Uloženie zlyhalo: ' + error.message);
  };

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (!nast) return <p className="text-sm text-slate-500">Načítavam…</p>;
  const novych = dopyty.filter((d) => d.stav === 'novy').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="text-indigo-400 h-5 w-5" /> Sieťotlač — kalkulačka a dopyt</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">Zákazník si zvolí textil, veľkosť motívu, počet farieb, efekt a počet kusov. Cenu vypočíta server z <strong>Kostry cien (Potlače)</strong> a maržového modulu — rovnako ako v Dizajnéri. Dopyt príde sem a e-mailom; nič sa neplatí.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href={`${PRINTSTUDIO_BASE_URL}/?typ=sietotlac`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Otvoriť appku</a>
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmen({ aktivny: e.target.checked })} /> Appka zapnutá</label>
        </div>
      </div>

      <Karta nadpis="Nastavenia appky" popis="Minimum kusov kryje prípravu sít. Príplatok za polyester je ODHAD — upravte podľa skúseností.">
        <Pole label="Minimálny odber" jednotka="ks" step="1" value={nast.min_ks} onChange={(v) => zmen({ min_ks: Math.max(1, Math.round(v)) })} />
        <Pole label="Maximálny počet" jednotka="ks" step="1" value={nast.max_ks} onChange={(v) => zmen({ max_ks: Math.max(1, Math.round(v)) })} pomoc="Nad toto číslo appka vyzve zákazníka, aby napísal." />
        <Pole label="Max. šírka motívu" jednotka="cm" step="1" value={nast.max_sirka_cm} onChange={(v) => zmen({ max_sirka_cm: v })} />
        <Pole label="Max. výška motívu" jednotka="cm" step="1" value={nast.max_vyska_cm} onChange={(v) => zmen({ max_vyska_cm: v })} />
        <Pole label="Príplatok polyester" jednotka="%" step="1" value={nast.polyester_priplatok_percent} onChange={(v) => zmen({ polyester_priplatok_percent: v })} />
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-slate-400 mb-1 text-xs">E-mail pre upozornenie na nový dopyt</label>
          <input type="email" value={nast.email_notifikacie || ''} onChange={(e) => zmen({ email_notifikacie: e.target.value })} placeholder="napr. objednavky@pbtprint.sk" className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
          <p className="text-[10px] text-slate-600 mt-0.5">Prázdne = e-mail obchodníkovi sa neposiela (dopyt sa vždy uloží sem). Zaplatené objednávky chodia do zákaziek automaticky.</p>
        </div>
      </Karta>

      <ObchodneNastavenia nast={nast} zmen={zmen} supabase={supabase} {...erp} />

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">Umiestnenia potlače</h3>
          <p className="text-[11px] text-slate-500">Zákazník môže mať na jednom kuse viac potlačí (srdce, chrbát, rukávy…). Tu nastavíte, aké umiestnenia ponúkate a aký najväčší rozmer na nich ide. Rozmery sú ODHAD — skontrolujte ich podľa výroby.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead><tr className="text-slate-500 border-b border-slate-800"><th className="p-2">Názov</th><th className="p-2 w-24">Max. šírka (cm)</th><th className="p-2 w-24">Max. výška (cm)</th><th className="p-2 w-24">Predvolená šírka</th><th className="p-2 w-24">Predvolená výška</th><th className="p-2">Zobraziť</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {umiestnenia.map((u) => (
                <tr key={u.kod}>
                  <td className="p-2"><input value={u.nazov} onChange={(e) => setUmiestnenia((p) => p.map((y) => (y.kod === u.kod ? { ...y, nazov: e.target.value } : y)))} onBlur={(e) => zmenUmiestnenie(u.kod, { nazov: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></td>
                  {['max_sirka_cm', 'max_vyska_cm', 'vychodzia_sirka_cm', 'vychodzia_vyska_cm'].map((pole) => (
                    <td key={pole} className="p-2"><NumberInput step="0.5" value={u[pole]} onChange={(v) => zmenUmiestnenie(u.kod, { [pole]: v })} fallback={1} className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-right" /></td>
                  ))}
                  <td className="p-2"><input type="checkbox" checked={u.aktivny !== false} onChange={(e) => zmenUmiestnenie(u.kod, { aktivny: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Efekty farieb</h3>
            <p className="text-[11px] text-slate-500">Príplatok sa pripočíta k cene potlače v %. Hodnoty 15 / 25 / 35 % sú ODHAD — skontrolujte ich.</p>
          </div>
          <button onClick={pridajEfekt} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Pridať efekt</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead><tr className="text-slate-500 border-b border-slate-800"><th className="p-2">Názov</th><th className="p-2">Popis pre zákazníka</th><th className="p-2 w-28">Príplatok (%)</th><th className="p-2">Zobraziť</th><th className="p-2" /></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {efekty.map((x) => (
                <tr key={x.kod}>
                  <td className="p-2"><input value={x.nazov} onChange={(e) => setEfekty((p) => p.map((y) => (y.kod === x.kod ? { ...y, nazov: e.target.value } : y)))} onBlur={(e) => zmenEfekt(x.kod, { nazov: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></td>
                  <td className="p-2"><input value={x.popis || ''} onChange={(e) => setEfekty((p) => p.map((y) => (y.kod === x.kod ? { ...y, popis: e.target.value } : y)))} onBlur={(e) => zmenEfekt(x.kod, { popis: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></td>
                  <td className="p-2"><NumberInput step="1" value={x.priplatok_percent} onChange={(v) => zmenEfekt(x.kod, { priplatok_percent: v })} fallback={0} className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-right" /></td>
                  <td className="p-2"><input type="checkbox" checked={x.aktivny !== false} onChange={(e) => zmenEfekt(x.kod, { aktivny: e.target.checked })} /></td>
                  <td className="p-2 text-right">{x.kod !== 'klasicka' && <button onClick={() => zmazEfekt(x.kod)} className="text-slate-500 hover:text-rose-400" aria-label="Zmazať efekt"><Trash2 className="w-4 h-4" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white">Zaplatené a vytvorené objednávky</h3>
        {objednavky.length === 0 ? <p className="text-xs text-slate-500">Zatiaľ žiadne objednávky. Zákazky v ERP vzniknú automaticky po zaplatení v Shopify.</p> : (
          <div className="space-y-2">
            {objednavky.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-indigo-300">{o.cislo_objednavky}</span>
                  <span>{o.pocet_ks} ks · {o.material === 'polyester' ? 'polyester' : 'bavlna'}, {o.tmavy ? 'tmavý' : 'svetlý'}{o.dve_velkosti ? ' · 2 veľkosti' : ''}</span>
                  <span>{eur(o.cena_spolu)} s DPH{o.b2b_kod ? ` · B2B ${o.b2b_kod}` : ''}</span>
                  {o.erp_cislo ? <span className="text-emerald-300">zákazka {o.erp_cislo}</span> : <span className="text-amber-300">čaká na zaplatenie</span>}
                  <span className="text-slate-500 ml-auto">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                  <select value={o.stav} onChange={(e) => zmenObjednavku(o.id, { stav: e.target.value })} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white">
                    {[['nova', 'Nová'], ['v_tlaci', 'V tlači'], ['odoslana', 'Odoslaná'], ['zrusena', 'Zrušená']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(o.polozky || []).map((p, i) => (
                    <button key={i} onClick={() => p.suborCesta && otvorSubor(p.suborCesta)} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-left">
                      <span className="text-white font-medium">{p.nazov}</span> · {p.sirkaCm}×{p.vyskaCm} cm · {p.farby} f. · {efekty.find((x) => x.kod === p.efekt)?.nazov || p.efekt}{p.suborCesta ? ' · ⬇ grafika' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Prijaté dopyty {novych > 0 && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{novych} nových</span>}</h3>
          <button onClick={nacitaj} className="text-slate-400 hover:text-white text-xs flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Obnoviť</button>
        </div>
        {dopyty.length === 0 ? <p className="text-xs text-slate-500">Zatiaľ žiadne dopyty.</p> : (
          <div className="space-y-2">
            {dopyty.map((d) => {
              const k = d.konfig || {};
              const otv = otvoreny === d.id;
              return (
                <div key={d.id} className={`rounded-xl border ${d.stav === 'novy' ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-900/40'}`}>
                  <button onClick={() => setOtvoreny(otv ? null : d.id)} className="w-full text-left p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-mono text-xs text-indigo-300">{d.cislo}</span>
                    <span className="text-sm text-white font-medium">{d.meno || d.email}</span>
                    <span className="text-xs text-slate-400">{d.pocet_ks} ks · {eur(d.cena_spolu_bez_dph)} bez DPH</span>
                    <span className="text-[11px] text-slate-500 ml-auto">{new Date(d.created_at).toLocaleString('sk-SK')}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{STAVY[d.stav] || d.stav}</span>
                  </button>
                  {otv && (
                    <div className="px-3 pb-3 space-y-3 text-xs text-slate-300 border-t border-slate-800 pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        <div>Kontakt: <a className="text-indigo-300" href={`mailto:${d.email}`}>{d.email}</a>{d.telefon ? `, ${d.telefon}` : ''}</div>
                        <div>Textil: {k.material === 'polyester' ? 'polyester' : 'bavlna'}, {k.tmavy ? 'tmavý' : 'svetlý'}{k.dveVelkosti ? ' · dve veľkosti (2 sady sít)' : ''}</div>
                        <div>Cena: {eur(d.cena_kus_bez_dph)}/ks bez DPH, spolu {eur(d.cena_spolu_bez_dph)}{d.b2b_kod ? ` · B2B ${d.b2b_kod}` : ''}</div>
                        {(k.tlace || []).map((t, i) => (
                          <div key={i} className="sm:col-span-2">Potlač {i + 1}: <span className="text-white">{umiestnenia.find((u) => u.kod === t.umiestnenie)?.nazov || t.umiestnenie}</span> · {t.sirkaCm} × {t.vyskaCm} cm · {t.farby} farieb · {efekty.find((x) => x.kod === t.efekt)?.nazov || t.efekt}{t.suborCesta && <button onClick={() => otvorSubor(t.suborCesta)} className="ml-2 text-indigo-300 hover:text-indigo-200 underline">⬇ grafika</button>}</div>
                        ))}
                        {!k.tlace && k.sirkaCm && <div className="sm:col-span-2">Motív: {k.sirkaCm} × {k.vyskaCm} cm, {k.farby} farieb, efekt {efekty.find((x) => x.kod === k.efekt)?.nazov || k.efekt}</div>}
                      </div>
                      {d.poznamka && <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 whitespace-pre-wrap">Poznámka / grafika: {d.poznamka}</div>}
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2">Stav
                          <select value={d.stav} onChange={(e) => zmenDopyt(d.id, { stav: e.target.value })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white">
                            {Object.entries(STAVY).map(([kod, n]) => <option key={kod} value={kod}>{n}</option>)}
                          </select>
                        </label>
                        <input defaultValue={d.interna_poznamka || ''} onBlur={(e) => e.target.value !== (d.interna_poznamka || '') && zmenDopyt(d.id, { interna_poznamka: e.target.value })} placeholder="Interná poznámka (zákazník ju nevidí)" className="flex-1 min-w-[14rem] px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
