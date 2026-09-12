import React, { useEffect, useState } from 'react';
import { Scroll, Download, Settings, ExternalLink } from 'lucide-react';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'print-designs';
// Referencne urovne (bm) len na nahlad v tabulke nizsie — realny vypocet funguje pre lubovolnu dlzku.
const BM_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100, 200, 500];

const NAKLADY_DEFAULT = {
  cena_folie_bm: 1.8, cena_lepidlo_kg: 18, spotreba_lepidlo_m2: 0.02,
  cena_cmyk_kg: 45, spotreba_cmyk_m2: 0.015, cena_biela_kg: 55, spotreba_biela_m2: 0.03,
  cena_prace_hod: 15, rychlost_tlace_m_hod: 6,
};
const NASTAVENIA_DEFAULT = {
  shopify_variant_id: '', jednotka_cena_eur: 0.05, cena_doprava: 4.9,
  priplatok_expres_percent: 10, limit_expres_bm: 40, limit_standard_bm: 100, minimalna_cena_objednavky: 3,
  dph_percent: 23,
};

export default function DtfMetrazTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [objednavky, setObjednavky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }] = await Promise.all([
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
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
    await supabase.from('dtf_naklady').upsert({ id: 1, ...next });
  };
  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('dtf_nastavenia').upsert({ id: 1, ...next });
  };

  const stiahniSubor = async (ord) => {
    if (!ord.subor_cesta) { window.alert('Táto objednávka nemá priložený súbor.'); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ord.subor_cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };

  const zmenStav = async (id, stav) => {
    setObjednavky(o => o.map(x => x.id === id ? { ...x, stav } : x));
    await supabase.from('dtf_objednavky').update({ stav }).eq('id', id);
  };

  // Náklad na 1 bm z výrobných vstupov
  const filmCostM2 = naklady.cena_folie_bm / 0.56;
  const glueM2 = naklady.cena_lepidlo_kg * naklady.spotreba_lepidlo_m2;
  const cmykM2 = naklady.cena_cmyk_kg * naklady.spotreba_cmyk_m2;
  const whiteM2 = naklady.cena_biela_kg * naklady.spotreba_biela_m2;
  const laborM2 = naklady.cena_prace_hod / (naklady.rychlost_tlace_m_hod * 0.56);
  const totalM2Cost = filmCostM2 + glueM2 + cmykM2 + whiteM2 + laborM2;
  const nakladBm = totalM2Cost * 0.56;

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Scroll className="text-indigo-400 h-5 w-5" /> DTF transfery — metráž (predaj na meter)</h2>
          <p className="text-xs text-slate-400 mt-1">Samostatný predaj hotových DTF transferov na rolke (56 cm) — nezávislé od konfigurátora potlače oblečenia.</p>
        </div>
        <a href={`${PRINTSTUDIO_BASE_URL}/?dtf=1`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">
          <ExternalLink className="h-3.5 w-3.5" /> Otvoriť appku v novej karte
        </a>
      </div>

      {/* SHOPIFY PREPOJENIE */}
      <div className="bg-slate-900/60 rounded-2xl border border-indigo-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-400" /> Prepojenie na Shopify</h3>
        <p className="text-xs text-slate-400">Platba beží cez <strong className="text-slate-200">Shopify Draft Order</strong> (Edge Function <code className="text-[11px] bg-slate-950 px-1 rounded">dtf-metraz-create-draft-order</code>) — appka vytvorí objednávku s presnou cenou a zákazníka rovno presmeruje na platbu, žiadny trik s počtom kusov. Nič sa tu nenastavuje — len over, že Supabase secrets <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_STORE_DOMAIN</code> a <code className="text-[11px] bg-slate-950 px-1 rounded">SHOPIFY_ADMIN_TOKEN</code> sú nastavené (rovnaké ako pre Beachvlajky).</p>
      </div>

      {/* DOPRAVA A KAPACITA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">Doprava, expres a kapacitné limity</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl">
          <Field label="Doprava (€)" value={nastavenia.cena_doprava} step="0.1" onChange={(v) => ulozNastavenia({ cena_doprava: v })} />
          <Field label="Príplatok expres (%)" value={nastavenia.priplatok_expres_percent} step="1" onChange={(v) => ulozNastavenia({ priplatok_expres_percent: v })} />
          <Field label="Minimálna cena objednávky (€)" value={nastavenia.minimalna_cena_objednavky} step="0.5" onChange={(v) => ulozNastavenia({ minimalna_cena_objednavky: v })} />
          <Field label="Limit expres (bm/deň)" value={nastavenia.limit_expres_bm} step="1" onChange={(v) => ulozNastavenia({ limit_expres_bm: v })} />
          <Field label="Limit štandard (bm)" value={nastavenia.limit_standard_bm} step="1" onChange={(v) => ulozNastavenia({ limit_standard_bm: v })} />
          <Field label="DPH (%)" value={nastavenia.dph_percent} step="0.5" onChange={(v) => ulozNastavenia({ dph_percent: v })} />
        </div>
      </div>

      {/* VÝROBNÉ NÁKLADY + CENOVÉ HLADINY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Vstupné výrobné náklady</h3>
          <p className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 mb-3">Vstupné náklady sa teraz zadávajú v karte <strong>Kostra cien → DTF</strong> (spoločné s DTF potlačou textilu, aby sa nezadávali dvakrát). Tu je len prehľad aktuálnych hodnôt.</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>PET fólia (56cm)</span><span className="text-white font-mono">{Number(naklady.cena_folie_bm).toFixed(2)} €/bm • {filmCostM2.toFixed(2)} €/m²</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Lepidlo</span><span className="text-white font-mono">{Number(naklady.cena_lepidlo_kg).toFixed(2)} €/kg • {Number(naklady.spotreba_lepidlo_m2).toFixed(3)} kg/m²</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>CMYK</span><span className="text-white font-mono">{Number(naklady.cena_cmyk_kg).toFixed(2)} €/kg • {Number(naklady.spotreba_cmyk_m2).toFixed(3)} kg/m²</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Biela</span><span className="text-white font-mono">{Number(naklady.cena_biela_kg).toFixed(2)} €/kg • {Number(naklady.spotreba_biela_m2).toFixed(3)} kg/m²</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-teal-900/40"><span>Práca + energie (len metráž)</span><span className="text-white font-mono">{Number(naklady.cena_prace_hod).toFixed(2)} €/hod • {Number(naklady.rychlost_tlace_m_hod).toFixed(1)} m/hod</span></div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Predajná cena (podľa jednotného maržového modulu)</h3>
            <span className="text-xs text-slate-400 font-mono">Náklad/1bm: <strong className="text-emerald-400">{nakladBm.toFixed(2)} €</strong></span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Marža sa už nenastavuje tu — počíta sa rovnakým vzorcom ako v celom PrintStudio Pro, nastavíš ju v záložke <strong className="text-slate-200">Cenotvorba</strong>. Nižšie je len náhľad výslednej ceny pri rôznej metráži.</p>
          <div className="space-y-1.5 mb-3">
            {BM_PREVIEW_LEVELS.map(level => {
              const rate = priceAt(nakladBm, level, pricingConfig);
              const marginPct = Math.round(marginAt(nakladBm, level, pricingConfig));
              return (
                <div key={level} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400 w-20">od {level} bm</span>
                  <span className="text-white font-mono font-bold">{rate.toFixed(2)} €/bm</span>
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
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">{o.rezim === 'auto' ? `${o.pocet_ks}ks ${o.sirka_cm}×${o.vyska_cm}cm` : 'Hotová rolka'}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                  </div>
                  <div className="text-slate-300">Metráž: <strong className="text-indigo-400 font-mono">{o.dlzka_bm} bm</strong> | Suma: <strong className="text-emerald-400 font-mono">{o.cena_spolu} €</strong> | {o.harmonogram}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={o.stav} onChange={(e) => zmenStav(o.id, e.target.value)} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
                    <option value="nova">Nová</option>
                    <option value="v_tlaci">V tlači</option>
                    <option value="odoslana">Odoslaná</option>
                    <option value="zrusena">Zrušená</option>
                  </select>
                  {o.subor_cesta && (
                    <button onClick={() => stiahniSubor(o)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Súbor</button>
                  )}
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
