import React, { useEffect, useState } from 'react';
import { Waves, Download, Settings, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'print-designs';
// Referencne urovne (ks) len na nahlad v tabulke nizsie — realny vypocet funguje pre lubovolny pocet.
const KS_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100];

const NAKLADY_DEFAULT = { produkt_id: null };
const NASTAVENIA_DEFAULT = {
  cena_doprava: 3.9, priplatok_expres_percent: 15, minimalna_cena_objednavky: 8, dph_percent: 23,
};

export default function CelenkyTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [objednavky, setObjednavky] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }, { data: p }] = await Promise.all([
      supabase.from('celenky_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('celenky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('celenky_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny').eq('aktivny', true).order('nazov'),
    ]);
    if (n) setNaklady(n);
    if (s) setNastavenia(s);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setObjednavky(o || []);
    setProdukty(p || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ulozNaklady = async (patch) => {
    const next = { ...naklady, ...patch };
    setNaklady(next);
    await supabase.from('celenky_naklady').upsert({ id: 1, ...next });
  };
  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('celenky_nastavenia').upsert({ id: 1, ...next });
  };

  const stiahniSubor = async (ord) => {
    if (!ord.subor_cesta) { window.alert('Táto objednávka nemá priložený súbor.'); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ord.subor_cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };

  const zmenStav = async (id, stav) => {
    setObjednavky(o => o.map(x => x.id === id ? { ...x, stav } : x));
    await supabase.from('celenky_objednavky').update({ stav }).eq('id', id);
  };

  const zmazObjednavku = async (id) => {
    if (!window.confirm('Naozaj zmazať túto objednávku? (Zmaže len záznam tu — prípadnú Shopify draft objednávku treba zmazať samostatne v Shopify Admin → Orders → Drafts.)')) return;
    setObjednavky(o => o.filter(x => x.id !== id));
    await supabase.from('celenky_objednavky').delete().eq('id', id);
  };

  const vybranyProdukt = produkty.find(p => p.id === naklady.produkt_id);
  const nakladKs = Number(vybranyProdukt?.zakladna_cena) || 0;

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Waves className="text-indigo-400 h-5 w-5" /> Čelenky — sublimačná potlač (51×9cm)</h2>
          <p className="text-xs text-slate-400 mt-1">Vlastný dizajn športovej čelenky s 3D náhľadom — pevný výrobný formát, tlač 300 DPI.</p>
        </div>
        <a href={`${PRINTSTUDIO_BASE_URL}/?typ=celenka`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">
          <ExternalLink className="h-3.5 w-3.5" /> Otvoriť appku v novej karte
        </a>
      </div>

      {/* SHOPIFY PREPOJENIE */}
      <div className="bg-slate-900/60 rounded-2xl border border-indigo-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-400" /> Prepojenie na Shopify</h3>
        <p className="text-xs text-slate-400">Platba beží cez <strong className="text-slate-200">Shopify Draft Order</strong> (Edge Function <code className="text-[11px] bg-slate-950 px-1 rounded">celenky-create-draft-order</code>) — appka vytvorí objednávku s presnou cenou a zákazníka rovno presmeruje na platbu. Zákazník nikdy nevidí ani nemôže stiahnuť tlačový súbor v plnej (300 DPI) kvalite — ten sa nahráva priamo na server pri odoslaní objednávky, zákazníkovi sa zobrazuje len nízkokvalitný náhľad v editore. Nič sa tu nenastavuje — len over, že Supabase secrets <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_STORE_DOMAIN</code>, <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_CLIENT_ID</code> a <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_CLIENT_SECRET</code> sú nastavené (rovnaké ako pri ostatných appkách).</p>
      </div>

      {/* DOPRAVA A DPH */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">Doprava a expres</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl text-xs">
          <Field label="Doprava (€)" value={nastavenia.cena_doprava} step="0.1" onChange={(v) => ulozNastavenia({ cena_doprava: v })} />
          <Field label="Príplatok expres (%)" value={nastavenia.priplatok_expres_percent} step="1" onChange={(v) => ulozNastavenia({ priplatok_expres_percent: v })} />
          <Field label="Minimálna cena objednávky (€)" value={nastavenia.minimalna_cena_objednavky} step="0.5" onChange={(v) => ulozNastavenia({ minimalna_cena_objednavky: v })} />
          <div>
            <label className="block text-slate-400 mb-1">DPH (%)</label>
            <input type="number" disabled value={pricingConfig.dphPercent} className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 font-mono opacity-70 cursor-not-allowed" />
            <p className="text-[10px] text-slate-500 mt-1">Nastavuje sa centrálne v záložke Cenotvorba pre celý PrintStudio Pro.</p>
          </div>
        </div>
      </div>

      {/* VÝROBNÉ NÁKLADY + CENOVÉ HLADINY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Vstupný výrobný náklad (na 1 ks)</h3>
          <p className="text-xs text-slate-400 mb-3">Náklad na kus sa berie priamo zo záložky <strong className="text-slate-200">Produkty</strong> — vyber tam nadefinovaný produkt čelenky (jeho "Základná cena" = nákupná cena za kus). Marža a DPH sa pripočítajú rovnakým jednotným vzorcom ako všade.</p>
          <label className="block text-slate-400 mb-1 text-xs">Produkt (čelenka)</label>
          <select value={naklady.produkt_id || ''} onChange={(e) => ulozNaklady({ produkt_id: e.target.value ? Number(e.target.value) : null })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
            <option value="">-- vyber produkt --</option>
            {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov} — {Number(p.zakladna_cena).toFixed(2)} €/ks</option>)}
          </select>
          {!vybranyProdukt && (
            <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-2"><AlertTriangle className="w-3 h-3 shrink-0" /> Nie je vybraný žiadny produkt — náklad je 0€, appka by predávala čelenky len za maržu. Vytvor produkt v záložke Produkty a vyber ho tu.</p>
          )}
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
