import React, { useEffect, useState } from 'react';
import { Wind, Download, Settings, ExternalLink, Trash2 } from 'lucide-react';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'print-designs';
// Referencne urovne (ks) len na nahlad v tabulke nizsie — realny vypocet funguje pre lubovolny pocet.
const KS_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100];

const NAKLADY_DEFAULT = {
  cena_material_m2: 8.5, cena_transfer_papier_m2: 3.2, cena_farba_m2: 1.8, cena_sitia_ks: 1.2,
};
const NASTAVENIA_DEFAULT = {
  cena_doprava: 3.9, priplatok_expres_percent: 15, minimalna_cena_objednavky: 8, dph_percent: 23,
};
// Pevny vyrobny format rozlozeneho strihu buffky — 50x50cm (300 DPI) — nemeni sa podla objednavky.
const PLOCHA_M2 = 0.5 * 0.5;

export default function BuffkyTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [objednavky, setObjednavky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }] = await Promise.all([
      supabase.from('buffky_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('buffky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('buffky_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (n) setNaklady(n);
    if (s) setNastavenia(s);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setObjednavky(o || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ulozNaklady = async (patch) => {
    const next = { ...naklady, ...patch };
    setNaklady(next);
    await supabase.from('buffky_naklady').upsert({ id: 1, ...next });
  };
  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('buffky_nastavenia').upsert({ id: 1, ...next });
  };

  const stiahniSubor = async (ord) => {
    if (!ord.subor_cesta) { window.alert('Táto objednávka nemá priložený súbor.'); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ord.subor_cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };

  const zmenStav = async (id, stav) => {
    setObjednavky(o => o.map(x => x.id === id ? { ...x, stav } : x));
    await supabase.from('buffky_objednavky').update({ stav }).eq('id', id);
  };

  const zmazObjednavku = async (id) => {
    if (!window.confirm('Naozaj zmazať túto objednávku? (Zmaže len záznam tu — prípadnú Shopify draft objednávku treba zmazať samostatne v Shopify Admin → Orders → Drafts.)')) return;
    setObjednavky(o => o.filter(x => x.id !== id));
    await supabase.from('buffky_objednavky').delete().eq('id', id);
  };

  const nakladKs = (Number(naklady.cena_material_m2) + Number(naklady.cena_transfer_papier_m2) + Number(naklady.cena_farba_m2)) * PLOCHA_M2 + Number(naklady.cena_sitia_ks);

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wind className="text-indigo-400 h-5 w-5" /> Buffky — multifunkčné šatky (50×50cm)</h2>
          <p className="text-xs text-slate-400 mt-1">Vlastný obojstranný dizajn tunelovej šatky s 3D náhľadom — pevný výrobný formát, tlač 300 DPI.</p>
        </div>
        <a href={`${PRINTSTUDIO_BASE_URL}/?typ=buffka`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">
          <ExternalLink className="h-3.5 w-3.5" /> Otvoriť appku v novej karte
        </a>
      </div>

      {/* SHOPIFY PREPOJENIE */}
      <div className="bg-slate-900/60 rounded-2xl border border-indigo-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-400" /> Prepojenie na Shopify</h3>
        <p className="text-xs text-slate-400">Platba beží cez <strong className="text-slate-200">Shopify Draft Order</strong> (Edge Function <code className="text-[11px] bg-slate-950 px-1 rounded">buffky-create-draft-order</code>) — appka vytvorí objednávku s presnou cenou a zákazníka rovno presmeruje na platbu. Zákazník nikdy nevidí ani nemôže stiahnuť tlačový súbor v plnej (300 DPI) kvalite — ten sa nahráva priamo na server pri odoslaní objednávky, zákazníkovi sa zobrazuje len nízkokvalitný náhľad v editore. Nič sa tu nenastavuje — len over, že Supabase secrets <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_STORE_DOMAIN</code>, <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_CLIENT_ID</code> a <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_CLIENT_SECRET</code> sú nastavené (rovnaké ako pri ostatných appkách).</p>
      </div>

      {/* DOPRAVA A DPH */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">Doprava, expres a DPH</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl text-xs">
          <Field label="Doprava (€)" value={nastavenia.cena_doprava} step="0.1" onChange={(v) => ulozNastavenia({ cena_doprava: v })} />
          <Field label="Príplatok expres (%)" value={nastavenia.priplatok_expres_percent} step="1" onChange={(v) => ulozNastavenia({ priplatok_expres_percent: v })} />
          <Field label="Minimálna cena objednávky (€)" value={nastavenia.minimalna_cena_objednavky} step="0.5" onChange={(v) => ulozNastavenia({ minimalna_cena_objednavky: v })} />
          <Field label="DPH (%)" value={nastavenia.dph_percent} step="0.5" onChange={(v) => ulozNastavenia({ dph_percent: v })} />
        </div>
      </div>

      {/* VÝROBNÉ NÁKLADY + CENOVÉ HLADINY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Vstupné výrobné náklady (na 1 ks, formát 50×50cm)</h3>
          <div className="space-y-2.5 text-xs">
            <Field label="Sublimačný mikrovláknový úplet (€/m²)" value={naklady.cena_material_m2} step="0.1" onChange={(v) => ulozNaklady({ cena_material_m2: v })} />
            <Field label="Sublimačný transferový papier (€/m²)" value={naklady.cena_transfer_papier_m2} step="0.1" onChange={(v) => ulozNaklady({ cena_transfer_papier_m2: v })} />
            <Field label="Spotreba sublimačnej farby (€/m²)" value={naklady.cena_farba_m2} step="0.1" onChange={(v) => ulozNaklady({ cena_farba_m2: v })} />
            <Field label="Zošitie do tunela (€/ks)" value={naklady.cena_sitia_ks} step="0.1" onChange={(v) => ulozNaklady({ cena_sitia_ks: v })} />
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Predajná cena (podľa jednotného maržového modulu)</h3>
            <span className="text-xs text-slate-400 font-mono">Náklad/1ks: <strong className="text-emerald-400">{nakladKs.toFixed(2)} €</strong></span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Marža sa nenastavuje tu — počíta sa rovnakým vzorcom ako v celom PrintStudio Pro, nastavíš ju v záložke <strong className="text-slate-200">Cenotvorba</strong>. Nižšie je len náhľad výslednej ceny pri rôznom počte kusov.</p>
          <div className="space-y-1.5 mb-3">
            {KS_PREVIEW_LEVELS.map(level => {
              const rate = priceAt(nakladKs, level, pricingConfig);
              const marginPct = Math.round(marginAt(nakladKs, level, pricingConfig));
              return (
                <div key={level} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400 w-20">od {level} ks</span>
                  <span className="text-white font-mono font-bold">{rate.toFixed(2)} €/ks</span>
                  <span className={`font-mono font-bold ${marginPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{marginPct}% marža</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PRIJATÉ OBJEDNÁVKY */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-white">Prijaté objednávky</h3>
          <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{objednavky.length} objednávok</span>
        </div>
        {objednavky.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">Zatiaľ nebola prijatá žiadna objednávka.</p>
        ) : (
          <div className="space-y-2">
            {objednavky.map(o => (
              <div key={o.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white font-mono">{o.id.slice(0, 8)}</span>
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">{o.pocet_ks} ks</span>
                    <span className="text-slate-500 text-[10px]">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                  </div>
                  <div className="text-slate-300">Cena/ks: <strong className="text-indigo-400 font-mono">{o.cena_kus} €</strong> | Suma: <strong className="text-emerald-400 font-mono">{o.cena_spolu} €</strong> | {o.doprava_rychlost === 'express' ? 'Expres' : 'Štandard'}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={o.stav} onChange={(e) => zmenStav(o.id, e.target.value)} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
                    <option value="nova">Nová</option>
                    <option value="v_tlaci">V tlači</option>
                    <option value="odoslana">Odoslaná</option>
                    <option value="zrusena">Zrušená</option>
                  </select>
                  {o.subor_cesta && (
                    <button onClick={() => stiahniSubor(o)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Tlačový súbor</button>
                  )}
                  <button onClick={() => zmazObjednavku(o.id)} title="Zmazať" className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, step, onChange }) {
  return (
    <div>
      <label className="block text-slate-400 mb-1">{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" />
    </div>
  );
}
