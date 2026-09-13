import React, { useEffect, useState } from 'react';
import { Wind, Download, Settings, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'print-designs';
// Referencne urovne (ks) len na nahlad v tabulke nizsie — realny vypocet funguje pre lubovolny pocet.
const KS_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100];

const NAKLADY_DEFAULT = { cena_buffka_ks: 0.5, cena_sitia_bok_ks: 0.9 };
const NASTAVENIA_DEFAULT = {
  cena_doprava: 3.9, priplatok_expres_percent: 15, minimalna_cena_objednavky: 8, dph_percent: 23,
};
// Vyrobny vytazok sublimacnej potlace: 5 buffiek na 1 bm potlace (viz Kostra cien nizsie).
const BUFFIEK_NA_BM = 5;

export default function BuffkyTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [objednavky, setObjednavky] = useState([]);
  const [nakladBmSublimacia, setNakladBmSublimacia] = useState(0);
  const [premiumMaterialy, setPremiumMaterialy] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }, { data: tn }, { data: pm }, { data: p }] = await Promise.all([
      supabase.from('buffky_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('buffky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('buffky_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('textil_naklady_verejny').select('naklad_bm').eq('technologia', 'sublimacia').maybeSingle(),
      supabase.from('buffky_premium_materialy').select('*').order('poradie').order('kod'),
      supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny').eq('aktivny', true).order('nazov'),
    ]);
    if (n) setNaklady(n);
    if (s) setNastavenia(s);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setObjednavky(o || []);
    setNakladBmSublimacia(tn ? Number(tn.naklad_bm) : 0);
    setPremiumMaterialy(pm || []);
    setProdukty(p || []);
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
  const pripojProduktPremium = async (kod, produktId) => {
    setPremiumMaterialy(pm => pm.map(m => m.kod === kod ? { ...m, produkt_id: produktId } : m));
    await supabase.from('buffky_premium_materialy').update({ produkt_id: produktId }).eq('kod', kod);
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

  const nakladPotlacKs = nakladBmSublimacia / BUFFIEK_NA_BM;
  const nakladKsBasic = Number(naklady.cena_buffka_ks) + nakladPotlacKs;
  const nakladKsPremium = (materialNakladKs) => Number(materialNakladKs || 0) + nakladPotlacKs + Number(naklady.cena_sitia_bok_ks || 0);

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wind className="text-indigo-400 h-5 w-5" /> Buffky — multifunkčné šatky (50×50cm)</h2>
          <p className="text-xs text-slate-400 mt-1">Vlastný dizajn tunelovej šatky s 3D náhľadom — 2 typy (Tubular Basic / Premium), pevný výrobný formát, tlač 300 DPI.</p>
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

      {/* TUBULAR BASIC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-1">Tubular Basic — vstupné náklady (na 1 ks)</h3>
          <p className="text-[11px] text-slate-500 mb-3">Bez švov, bez obšívania — potlač priamo na bezšvovú tubulárnu pletenú látku.</p>
          <div className="space-y-2.5 text-xs">
            <Field label="Nákup čistej (nepotlačenej) buffky (€/ks, bez DPH)" value={naklady.cena_buffka_ks} step="0.05" onChange={(v) => ulozNaklady({ cena_buffka_ks: v })} />
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Potlač — 5 buffiek/1bm sublimácie (živo z Kostra cien)</span>
              <span className="text-white font-mono font-bold">{nakladBmSublimacia.toFixed(2)} € / bm ÷ {BUFFIEK_NA_BM} = {nakladPotlacKs.toFixed(2)} €/ks</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Náklad na potlač sa počíta automaticky z ceny sublimačnej potlače v Kostra cien (rovnaká hodnota, akú používa aj Textilná metráž) — nič sa tu ručne nezadáva.</p>
        </div>

        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Tubular Basic — predajná cena</h3>
            <span className="text-xs text-slate-400 font-mono">Náklad/1ks: <strong className="text-emerald-400">{nakladKsBasic.toFixed(2)} €</strong></span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Marža sa nenastavuje tu — počíta sa rovnakým vzorcom ako v celom PrintStudio Pro, nastavíš ju v záložke <strong className="text-slate-200">Cenotvorba</strong>.</p>
          <div className="space-y-1.5 mb-3">
            {KS_PREVIEW_LEVELS.map(level => {
              const rate = priceAt(nakladKsBasic, level, pricingConfig);
              const marginPct = Math.round(marginAt(nakladKsBasic, level, pricingConfig));
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

      {/* PREMIUM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-1">Premium — vstupné náklady</h3>
          <p className="text-[11px] text-slate-500 mb-3">Jeden bočný šev (zošité ako rukáv trička), obšitý horný aj spodný okraj — výber z materiálov nižšie, každý linknutý na produkt zo záložky Produkty (jeho "Základná cena" = nákupná cena za ks).</p>
          <Field label="Cena šitia bočného švu (€/ks, bez DPH)" value={naklady.cena_sitia_bok_ks} step="0.05" onChange={(v) => ulozNaklady({ cena_sitia_bok_ks: v })} />
          <div className="space-y-2 mt-3">
            {premiumMaterialy.map(m => {
              const produkt = produkty.find(p => p.id === m.produkt_id);
              return (
                <div key={m.kod} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{m.nazov}</span>
                    {produkt && <span className="text-emerald-400 font-mono">{Number(produkt.zakladna_cena).toFixed(2)} €/ks</span>}
                  </div>
                  <select value={m.produkt_id || ''} onChange={(e) => pripojProduktPremium(m.kod, e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
                    <option value="">-- vyber produkt --</option>
                    {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov} — {Number(p.zakladna_cena).toFixed(2)} €/ks</option>)}
                  </select>
                  {!produkt && (
                    <p className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Nie je vybraný produkt — náklad materiálu je 0€.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Premium — predajná cena podľa materiálu</h3>
          <div className="space-y-3">
            {premiumMaterialy.map(m => {
              const produkt = produkty.find(p => p.id === m.produkt_id);
              const nakladKs = nakladKsPremium(produkt?.zakladna_cena);
              return (
                <div key={m.kod}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-slate-200">{m.nazov}</span>
                    <span className="text-slate-400 font-mono">Náklad/1ks: <strong className="text-emerald-400">{nakladKs.toFixed(2)} €</strong></span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[1, 10, 50].map(level => {
                      const rate = priceAt(nakladKs, level, pricingConfig);
                      return (
                        <div key={level} className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between gap-1.5">
                          <span className="text-slate-400">od {level}ks</span>
                          <span className="text-white font-mono font-bold">{rate.toFixed(2)} €</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {premiumMaterialy.length === 0 && <p className="text-xs text-slate-500">Spusti migráciu `migration_buffky_premium.sql`.</p>}
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
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${o.typ === 'premium' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/40 text-slate-300 border-slate-600/40'}`}>{o.typ === 'premium' ? `Premium${o.material_kod ? ' — ' + o.material_kod : ''}` : 'Tubular Basic'}</span>
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
