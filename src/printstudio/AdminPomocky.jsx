import React, { useEffect, useRef, useState } from 'react';
import NumberInput from '../NumberInput';
import { Download, Trash2, Plus, Loader2, Calculator } from 'lucide-react';
import FotoSlot from './FotoSlot';
import ErpProduktVyber from './ErpProduktVyber';

// Spoločné stavebné kocky pre admin karty nových aplikácií (Stolové vlajky, Šnúrky, Rezané fólie): polia, karty, riadky možností
// s fotkou a nákladom (ručne alebo z produktu v Katalógu), zoznam objednávok a výsledok kalkulácie.
export const eur = (v, d = 2) => `${(Number(v) || 0).toFixed(d)} €`;
const BUCKET = 'print-designs';

export function Pole({ label, value, onChange, step = '0.01', jednotka, pomoc }) {
  return (
    <div>
      <label className="block text-slate-400 mb-1 text-xs">{label}{jednotka && <span className="text-slate-600"> ({jednotka})</span>}</label>
      <NumberInput step={step} value={value} onChange={onChange} fallback={0} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs" />
      {pomoc && <p className="text-[10px] text-slate-600 mt-0.5">{pomoc}</p>}
    </div>
  );
}

export function Karta({ nadpis, popis, children, stlpce = 'grid-cols-2 sm:grid-cols-3' }) {
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
      <h3 className="font-bold text-sm text-white mb-1">{nadpis}</h3>
      {popis && <p className="text-xs text-slate-400 mb-3">{popis}</p>}
      <div className={`grid ${stlpce} gap-3`}>{children}</div>
    </div>
  );
}

// Jednoriadkové nastavenia (tabuľka *_nastavenia, id = 1) s automatickým ukladaním ~0,7 s po poslednej zmene
export function useNastavenia(supabase, tabulka) {
  const [nast, setNast] = useState(null);
  const [chyba, setChyba] = useState('');
  const [ulozene, setUlozene] = useState(true);
  const casovac = useRef(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from(tabulka).select('*').eq('id', 1).maybeSingle();
      if (error || !data) setChyba('Tabuľky ešte neexistujú — spusti v Supabase SQL Editore migráciu migration_stolove_snurky_folie.sql (priečinok printstudio-pro).');
      else setNast(data);
    })();
  }, [supabase, tabulka]);
  const zmen = (patch) => {
    setNast((prev) => {
      const next = { ...prev, ...patch };
      setUlozene(false);
      clearTimeout(casovac.current);
      casovac.current = setTimeout(async () => {
        const { error } = await supabase.from(tabulka).upsert({ ...next, id: 1 });
        if (error) window.alert('Uloženie zlyhalo: ' + error.message); else setUlozene(true);
      }, 700);
      return next;
    });
  };
  return { nast, zmen, chyba, ulozene };
}

// Spoločné polia obchodných nastavení (poplatky, doprava, minimálna cena, info text, zapnutie, produkt pre zákazky v ERP)
export function ObchodneNastavenia({ nast, zmen, produkty, erpProdukty, onBlankVytvoreny, supabase, bezManipulacie = false }) {
  return (
    <>
      <Karta nadpis="Poplatky, doprava a minimálna cena" popis="Všetky ceny sú bez DPH. Cena samotných výrobkov sa počíta z nákladov nižšie + maržový modul (Cenotvorba).">
        {!bezManipulacie && <Pole label="Manipulačný poplatok (1× na objednávku)" jednotka="€" value={nast.manipulacny_poplatok_eur} onChange={(v) => zmen({ manipulacny_poplatok_eur: v })} />}
        <Pole label="Poštovné a balné" jednotka="€" value={nast.cena_doprava} onChange={(v) => zmen({ cena_doprava: v })} />
        <Pole label="Poštovné zdarma od" jednotka="€, 0 = vypnuté" value={nast.postovne_zdarma_od_eur} onChange={(v) => zmen({ postovne_zdarma_od_eur: v })} />
        <Pole label="Minimálna cena výrobkov v objednávke" jednotka="€" value={nast.minimalna_cena_eur} onChange={(v) => zmen({ minimalna_cena_eur: v })} />
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-slate-400 mb-1 text-xs">Info text pre zákazníka (voliteľné)</label>
          <input type="text" value={nast.info_text || ''} onChange={(e) => zmen({ info_text: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
        </div>
      </Karta>
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Produkt v Katalógu produktov (pre zákazky v ERP)</h3>
        <p className="text-xs text-slate-400 mb-3">Pod týmto produktom sa bude evidovať zákazka z e-shopu (ak položka nemá vlastný produkt). Cena sa z neho nebere.</p>
        <ErpProduktVyber supabase={supabase} blankId={nast.produkt_id} blanky={produkty} erpProdukty={erpProdukty} onZmena={(id) => zmen({ produkt_id: id })} onBlankVytvoreny={onBlankVytvoreny} />
      </div>
    </>
  );
}

// Zoznam možností (veľkosti, okraje, podstavce, modely, druhy…): fotka, názov, popis, číselné polia a voliteľne produkt z Katalógu.
// Ak je vybraný produkt z Katalógu, náklad sa berie z jeho výrobnej ceny a ručný náklad sa ignoruje.
export function SkupinaMoznosti({ supabase, tabulka, nadpis, popis, riadky, setRiadky, polia = [], textovePolia = [], foto = true, priecinok, erp = null, novy = null, mozeMazat = true, extra = null }) {
  const zmen = async (kod, patch) => {
    setRiadky((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x)));
    await supabase.from(tabulka).update(patch).eq('kod', kod);
  };
  const pridaj = async () => {
    const nazov = window.prompt('Názov novej možnosti:');
    if (!nazov?.trim()) return;
    const kod = nazov.trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) + '_' + Math.random().toString(36).slice(2, 5);
    const riadok = { kod, nazov: nazov.trim(), poradie: (riadky.reduce((m, x) => Math.max(m, x.poradie || 0), 0)) + 1, ...(novy || {}) };
    const { error } = await supabase.from(tabulka).insert(riadok);
    if (error) { window.alert('Pridanie zlyhalo: ' + error.message); return; }
    setRiadky((rows) => [...rows, riadok]);
  };
  const zmaz = async (kod) => {
    if (!window.confirm('Naozaj zmazať túto možnosť? Staré objednávky ostanú, ale možnosť už nebude na výber.')) return;
    const { error } = await supabase.from(tabulka).delete().eq('kod', kod);
    if (error) { window.alert('Zmazanie zlyhalo: ' + error.message); return; }
    setRiadky((rows) => rows.filter((x) => x.kod !== kod));
  };
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-bold text-sm text-white">{nadpis}</h3>
        {novy && <button type="button" onClick={pridaj} className="flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200"><Plus className="w-3.5 h-3.5" /> Pridať</button>}
      </div>
      {popis && <p className="text-xs text-slate-400 mb-3">{popis}</p>}
      <div className="space-y-3">
        {riadky.map((r) => (
          <div key={r.kod} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              {foto && <FotoSlot supabase={supabase} url={r.foto_url} priecinok={priecinok} onZmena={(url) => zmen(r.kod, { foto_url: url })} />}
              <div className="flex-1 min-w-[180px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" value={r.nazov || ''} onChange={(e) => zmen(r.kod, { nazov: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold" />
                {'popis' in r && <input type="text" value={r.popis || ''} onChange={(e) => zmen(r.kod, { popis: e.target.value })} placeholder="Popis pre zákazníka" className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs" />}
                {textovePolia.map((t) => (
                  <input key={t.k} type="text" value={r[t.k] || ''} onChange={(e) => zmen(r.kod, { [t.k]: e.target.value })} placeholder={t.l} title={t.l} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs" />
                ))}
              </div>
              {mozeMazat && <button type="button" onClick={() => zmaz(r.kod)} title="Zmazať" className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
            {polia.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {polia.map((p) => <Pole key={p.k} label={p.l} jednotka={p.j} step={p.step} value={r[p.k]} onChange={(v) => zmen(r.kod, { [p.k]: v })} />)}
              </div>
            )}
            {erp && 'produkt_id' in r && (
              <div>
                <label className="block text-slate-500 mb-1 text-[11px]">Produkt z Katalógu (voliteľné — ak je vybraný, náklad sa berie z jeho výrobnej ceny)</label>
                <ErpProduktVyber supabase={supabase} blankId={r.produkt_id} blanky={erp.produkty} erpProdukty={erp.erpProdukty} onZmena={(id) => zmen(r.kod, { produkt_id: id })} onBlankVytvoreny={erp.onBlankVytvoreny} />
              </div>
            )}
            {extra && extra(r, zmen)}
          </div>
        ))}
        {riadky.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne možnosti.</p>}
      </div>
    </div>
  );
}

// Zoznam objednávok z tabuľky s prepínaním stavu, stiahnutím súborov a zmazaním
export function ObjednavkyKarta({ supabase, tabulka, nadpis, popisRiadku, subory }) {
  const [objednavky, setObjednavky] = useState([]);
  useEffect(() => { (async () => { const { data } = await supabase.from(tabulka).select('*').order('created_at', { ascending: false }).limit(50); setObjednavky(data || []); })(); }, [supabase, tabulka]);
  const stiahni = async (cesta) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };
  const stav = async (id, s) => { setObjednavky((o) => o.map((x) => (x.id === id ? { ...x, stav: s } : x))); await supabase.from(tabulka).update({ stav: s }).eq('id', id); };
  const zmaz = async (id) => {
    if (!window.confirm('Naozaj zmazať túto objednávku? Zmažú sa aj priložené súbory. Prípadnú Shopify draft objednávku treba zmazať samostatne v Shopify Admin → Orders → Drafts.')) return;
    const o = objednavky.find((x) => x.id === id);
    const cesty = subory(o).map((s) => s.cesta).filter(Boolean);
    if (cesty.length) await supabase.storage.from(BUCKET).remove(cesty);
    setObjednavky((arr) => arr.filter((x) => x.id !== id));
    await supabase.from(tabulka).delete().eq('id', id);
  };
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-white">{nadpis}</h3>
        <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{objednavky.length} objednávok</span>
      </div>
      {objednavky.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">Zatiaľ nebola prijatá žiadna objednávka.</p>
      ) : (
        <div className="space-y-2">
          {objednavky.map((o) => (
            <div key={o.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white font-mono">{o.cislo_objednavky || o.id.slice(0, 8)}</span>
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">{o.pocet_ks} ks</span>
                  {o.osobny_odber && <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">Osobný odber</span>}
                  {o.erp_cislo && <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono">{o.erp_cislo}</span>}
                  <span className="text-slate-500 text-[10px]">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                </div>
                <div className="text-slate-300">{popisRiadku(o)} | Suma s DPH: <strong className="text-emerald-400 font-mono">{eur(o.cena_spolu)}</strong>{o.naklad_spolu != null && <span className="text-slate-500"> | náklad {eur(o.naklad_spolu)}</span>}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <select value={o.stav} onChange={(e) => stav(o.id, e.target.value)} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
                  <option value="nova">Nová</option><option value="v_tlaci">V tlači</option><option value="odoslana">Odoslaná</option><option value="zrusena">Zrušená</option>
                </select>
                {subory(o).filter((s) => s.cesta).map((s) => (
                  <button key={s.label} onClick={() => stiahni(s.cesta)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> {s.label}</button>
                ))}
                <button onClick={() => zmaz(o.id)} title="Zmazať" className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Skúšobná kalkulácia: zavolá Edge Function (preview) ako prihlásený admin a ukáže cenu, rozpis nákladov a maržu.
export function KalkulackaKarta({ supabase, funkcia, telo, children, popisky = {}, pred = null }) {
  const [v, setV] = useState(null);
  const [chyba, setChyba] = useState('');
  const [bezi, setBezi] = useState(false);
  const spocitaj = async () => {
    setBezi(true); setChyba('');
    if (pred) await pred();
    const { data, error } = await supabase.functions.invoke(funkcia, { body: { ...telo, preview: true } });
    setBezi(false);
    if (error || !data?.ok) { setV(null); setChyba(data?.error || `${error?.message || 'Chyba'} — je funkcia ${funkcia} nasadená v Supabase?`); return; }
    setV(data);
  };
  const ad = v?.admin;
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
      <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-400" /> Skúšobná kalkulácia (náklady a marža)</h3>
      <p className="text-xs text-slate-400 mb-3">Rovnaký výpočet ako v appke pre zákazníka, ale s rozpisom nákladov a maržou. Funguje po nasadení funkcie <code className="text-slate-300">{funkcia}</code>.</p>
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <button onClick={spocitaj} disabled={bezi} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5">{bezi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Prepočítať</button>
      </div>
      {chyba && <p className="text-xs text-rose-400 mt-3">{chyba}</p>}
      {v && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-1.5">
            <p className="font-bold text-slate-200 mb-1">Predajná cena</p>
            <div className="flex justify-between"><span className="text-slate-400">Cena za 1 ks (bez DPH)</span><strong className="text-white font-mono">{eur(v.cenaKsBezDph)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-400">Spolu za výrobu (bez DPH)</span><strong className="text-white font-mono">{eur(v.logaSpoluBezDph)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-400">+ manipulácia / poštovné</span><span className="text-slate-200 font-mono">{eur(v.manipulaciaBezDph)} / {eur(v.postovneBezDph)}</span></div>
            {v.dlzkaBm != null && <div className="flex justify-between"><span className="text-slate-400">Spotreba materiálu</span><span className="text-slate-200 font-mono">{v.dlzkaBm} bm ({v.cols} v rade × {v.rows} radov{v.otoceny ? ', otočené' : ''})</span></div>}
            <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-300">Zákazník platí s DPH</span><strong className="text-emerald-400 font-mono">{eur(v.spolu)}</strong></div>
          </div>
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-1.5">
            <p className="font-bold text-slate-200 mb-1">Náklady a marža {!ad && <span className="text-amber-400 font-normal">(rozpis vidí len prihlásený admin)</span>}</p>
            {ad && <>
              {Object.entries(ad.rozpis).map(([k, x]) => <div key={k} className="flex justify-between"><span className="text-slate-400">{popisky[k] || k}</span><span className="text-slate-200 font-mono">{eur(x)}</span></div>)}
              <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-300">Náklad spolu ({eur(ad.nakladKs)}/ks)</span><strong className="text-white font-mono">{eur(ad.nakladSpolu)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-300">Marža</span><strong className="text-emerald-400 font-mono">{eur(ad.margaEur)} ({Number(ad.margaPercent).toFixed(0)} %)</strong></div>
              {ad.spotreba && <p className="text-[10px] text-slate-500 pt-1">{Object.entries(ad.spotreba).map(([k, x]) => `${k}: ${x}`).join(' · ')}</p>}
            </>}
          </div>
        </div>
      )}
    </div>
  );
}

// Načítanie blankov (produkty) a produktov z Katalógu pre výber produktu pri možnostiach
export function useErpProdukty(supabase) {
  const [produkty, setProdukty] = useState([]);
  const [erpProdukty, setErpProdukty] = useState([]);
  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([
        supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny, erp_produkt_id').eq('aktivny', true).order('nazov'),
        supabase.from('products').select('id, name, custom_code, production_cost').order('name'),
      ]);
      setProdukty(p.data || []); setErpProdukty(e.data || []);
    })();
  }, [supabase]);
  return { produkty, erpProdukty, onBlankVytvoreny: (b) => setProdukty((prev) => [...prev, b]) };
}
