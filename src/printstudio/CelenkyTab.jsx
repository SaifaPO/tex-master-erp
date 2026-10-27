import React, { useEffect, useState } from 'react';
import NumberInput from '../NumberInput';
import { Waves, Download, Settings, Trash2, AlertTriangle } from 'lucide-react';
import FotoSlot from './FotoSlot';
import ErpProduktVyber from './ErpProduktVyber';
import KonfigGrafikaSprava from './KonfigGrafikaSprava';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const BUCKET = 'print-designs';
// Referencne urovne (ks) len na nahlad v tabulke nizsie — realny vypocet funguje pre lubovolny pocet.
const KS_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

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
  const [erpProdukty, setErpProdukty] = useState([]);
  const [materialy, setMaterialy] = useState([]);
  const [varianty, setVarianty] = useState([]);
  const [variantyChyba, setVariantyChyba] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }, { data: p }, { data: mat, error: matErr }, { data: vr }, { data: erp }] = await Promise.all([
      supabase.from('celenky_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('celenky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('celenky_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny, erp_produkt_id').eq('aktivny', true).order('nazov'),
      supabase.from('celenky_materialy').select('*').order('poradie'),
      supabase.from('celenky_varianty').select('*').order('poradie').order('material_kod'),
      supabase.from('products').select('id, name, custom_code, production_cost').order('name'),
    ]);
    setErpProdukty(erp || []);
    setVariantyChyba(matErr ? 'Varianty a fotky materiálov ešte nie sú k dispozícii — spusti v Supabase SQL migráciu migration_celenky_varianty_a_fotky.sql (priečinok printstudio-pro).' : '');
    setMaterialy(mat || []);
    setVarianty(vr || []);
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
    if (!window.confirm('Naozaj zmazať túto objednávku? Zmaže sa aj priložený súbor v Storage (ak nejaký je). Prípadnú Shopify draft objednávku treba zmazať samostatne v Shopify Admin → Orders → Drafts.')) return;
    const ord = objednavky.find(x => x.id === id);
    if (ord?.subor_cesta) await supabase.storage.from(BUCKET).remove([ord.subor_cesta]);
    setObjednavky(o => o.filter(x => x.id !== id));
    await supabase.from('celenky_objednavky').delete().eq('id', id);
  };

  const ulozMaterial = async (kod, patch) => {
    setMaterialy(m => m.map(x => x.kod === kod ? { ...x, ...patch } : x));
    await supabase.from('celenky_materialy').update(patch).eq('kod', kod);
  };
  const ulozVariant = async (velkostKod, materialKod, patch) => {
    setVarianty(v => v.map(x => (x.velkost_kod === velkostKod && x.material_kod === materialKod) ? { ...x, ...patch } : x));
    await supabase.from('celenky_varianty').update(patch).eq('velkost_kod', velkostKod).eq('material_kod', materialKod);
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

      {/* MATERIÁLY (FOTKY) A VARIANTY (VEĽKOSŤ × MATERIÁL) */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-5">
        <div>
          <h3 className="font-bold text-sm text-white mb-1">Materiály a veľkosti</h3>
          <p className="text-xs text-slate-400">Zákazník si vyberá veľkosť (dospelý štandard / vysoká, detská) a materiál (hladký / počesaný). Rozmer strihu závisí od materiálu. Každý variant má vlastný produkt zo záložky Produkty — jeho "Základná cena" je nákupná cena a z nej sa počíta predajná cena. Variant bez produktu použije pôvodný jednotný náklad nižšie.</p>
        </div>
        {variantyChyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{variantyChyba}</div>}
        {materialy.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {materialy.map(m => (
              <div key={m.kod} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-start gap-3">
                  <FotoSlot supabase={supabase} url={m.foto_url} priecinok="celenky-materialy" onZmena={(url) => ulozMaterial(m.kod, { foto_url: url })} />
                  <div className="flex-1 space-y-1.5">
                    <input type="text" value={m.nazov} onChange={(e) => ulozMaterial(m.kod, { nazov: e.target.value })} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold" />
                    <input type="text" value={m.popis || ''} onChange={(e) => ulozMaterial(m.kod, { popis: e.target.value })} placeholder="Krátky popis materiálu pre zákazníka" className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-[11px]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {varianty.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead><tr className="text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Veľkosť</th><th className="py-2 pr-3">Materiál</th><th className="py-2 pr-3">Šírka (cm)</th><th className="py-2 pr-3">Výška (cm)</th><th className="py-2">Produkt (nákupná cena)</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {varianty.map(v => {
                  const p = produkty.find(x => x.id === v.produkt_id);
                  return (
                    <tr key={`${v.velkost_kod}-${v.material_kod}`}>
                      <td className="py-2 pr-3 text-white font-semibold">{v.velkost_nazov}</td>
                      <td className="py-2 pr-3 text-slate-300">{materialy.find(m => m.kod === v.material_kod)?.nazov || v.material_kod}</td>
                      <td className="py-2 pr-3"><NumberInput step="0.5" value={v.sirka_cm} onChange={(val) => ulozVariant(v.velkost_kod, v.material_kod, { sirka_cm: val })} fallback={0} className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /></td>
                      <td className="py-2 pr-3"><NumberInput step="0.5" value={v.vyska_cm} onChange={(val) => ulozVariant(v.velkost_kod, v.material_kod, { vyska_cm: val })} fallback={0} className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /></td>
                      <td className="py-2">
                        <ErpProduktVyber supabase={supabase} blankId={v.produkt_id} blanky={produkty} erpProdukty={erpProdukty} trieda="min-w-[16rem]" onZmena={(id) => ulozVariant(v.velkost_kod, v.material_kod, { produkt_id: id })} onBlankVytvoreny={(b) => setProdukty(prev => [...prev, b])} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VÝROBNÉ NÁKLADY + CENOVÉ HLADINY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Vstupný výrobný náklad (na 1 ks)</h3>
          <p className="text-xs text-slate-400 mb-3">Cena čelenky sa berie z <strong className="text-slate-200">výrobnej ceny produktu v Katalógu produktov</strong> (zahŕňa materiál, potlač aj šitie). Produkt vyberiete tu pri každom variante; cenu upravujete len v katalógu. Pridáva sa len marža a DPH.</p>
          <label className="block text-slate-400 mb-1 text-xs">Produkt z Katalógu produktov (záložný pre varianty bez vlastného produktu)</label>
          <ErpProduktVyber supabase={supabase} blankId={naklady.produkt_id} blanky={produkty} erpProdukty={erpProdukty} onZmena={(id) => ulozNaklady({ produkt_id: id })} onBlankVytvoreny={(b) => setProdukty(prev => [...prev, b])} />
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
                    {o.osobny_odber && <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">Osobný odber</span>}
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
      <KonfigGrafikaSprava supabase={supabase} typ="celenka" nazovProduktu="Čelenky" />
    </div>
  );
}

function Field({ label, value, step, onChange }) {
  return (
    <div>
      <label className="block text-slate-400 mb-1">{label}</label>
      <NumberInput step={step} value={value} onChange={onChange} fallback={0} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" />
    </div>
  );
}
