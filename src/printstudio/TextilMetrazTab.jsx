import React, { useEffect, useState } from 'react';
import { Shirt, Download, Settings, ExternalLink } from 'lucide-react';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'print-designs';
const ROLL_WIDTH_M = 1.60; // 160 cm
// Referencne urovne (bm) len na nahlad v tabulkach nizsie — realny vypocet funguje pre lubovolnu dlzku.
const BM_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100, 200, 500, 1000];

const NAKLADY_DEFAULT = {
  sublimacia: { cena_papier_bm: 0.95, cena_ochranny_papier_bm: 0.30, cena_atrament_l: 38, spotreba_atrament_ml_m2: 12, cena_prace_hod: 18, rychlost_m_hod: 15 },
  bavlna: { cena_primer_l: 22, spotreba_primer_ml_m2: 25, cena_atrament_l: 65, spotreba_atrament_ml_m2: 18, cena_prace_hod: 20, rychlost_m_hod: 8 },
};
const NASTAVENIA_DEFAULT = {
  shopify_variant_id: '', jednotka_cena_eur: 0.05, cena_doprava: 4.9, priplatok_expres_percent: 10, minimalna_cena_objednavky: 8,
  limit_expres_bm_sublimacia: 60, limit_standard_bm_sublimacia: 150,
  limit_expres_bm_bavlna: 35, limit_standard_bm_bavlna: 80,
};

// Naklad €/1bm (160cm sirka) z vyrobnych vstupov danej technologie — musi byt zosuladene
// s SQL pohladom textil_naklady_verejny (migration_textil_metraz.sql).
function vypocitajNakladBm(tech, n) {
  const inkM2 = (n.cena_atrament_l * n.spotreba_atrament_ml_m2 / 1000) * ROLL_WIDTH_M;
  const laborBm = n.cena_prace_hod / Math.max(0.01, n.rychlost_m_hod);
  if (tech === 'sublimacia') {
    return (n.cena_papier_bm || 0) + (n.cena_ochranny_papier_bm || 0) + inkM2 + laborBm;
  }
  const primerM2 = ((n.cena_primer_l || 0) * (n.spotreba_primer_ml_m2 || 0) / 1000) * ROLL_WIDTH_M;
  return primerM2 + inkM2 + laborBm;
}

export default function TextilMetrazTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [objednavky, setObjednavky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: cfg }, { data: o }] = await Promise.all([
      supabase.from('textil_naklady').select('*'),
      supabase.from('textil_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('textil_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (n && n.length > 0) {
      const bySub = n.find(r => r.technologia === 'sublimacia');
      const byCot = n.find(r => r.technologia === 'bavlna');
      setNaklady({
        sublimacia: bySub ? { ...NAKLADY_DEFAULT.sublimacia, ...bySub } : NAKLADY_DEFAULT.sublimacia,
        bavlna: byCot ? { ...NAKLADY_DEFAULT.bavlna, ...byCot } : NAKLADY_DEFAULT.bavlna,
      });
    }
    if (s) setNastavenia(s);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setObjednavky(o || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ulozNaklady = async (tech, patch) => {
    const next = { ...naklady[tech], ...patch };
    setNaklady(prev => ({ ...prev, [tech]: next }));
    await supabase.from('textil_naklady').upsert({ technologia: tech, ...next });
  };
  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('textil_nastavenia').upsert({ id: 1, ...next });
  };

  const stiahniSubor = async (ord) => {
    if (!ord.subor_cesta) { window.alert('Táto objednávka nemá priložený súbor.'); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ord.subor_cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };

  const zmenStav = async (id, stav) => {
    setObjednavky(o => o.map(x => x.id === id ? { ...x, stav } : x));
    await supabase.from('textil_objednavky').update({ stav }).eq('id', id);
  };

  const nakladBmSub = vypocitajNakladBm('sublimacia', naklady.sublimacia);
  const nakladBmCot = vypocitajNakladBm('bavlna', naklady.bavlna);

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="text-indigo-400 h-5 w-5" /> Textilná metráž — sublimácia & digitálna bavlna</h2>
          <p className="text-xs text-slate-400 mt-1">Samostatný predaj potlačenej textilnej metráže na rolke (160 cm) — dve nezávislé technológie, nezávislé od konfigurátora potlače oblečenia.</p>
        </div>
        <a href={`${PRINTSTUDIO_BASE_URL}/?textil=1`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0">
          <ExternalLink className="h-3.5 w-3.5" /> Otvoriť appku v novej karte
        </a>
      </div>

      {/* SHOPIFY PREPOJENIE */}
      <div className="bg-slate-900/60 rounded-2xl border border-indigo-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-400" /> Prepojenie na Shopify</h3>
        <p className="text-xs text-slate-400 mb-3">Rovnaký princíp ako pri DTF metráži — vytvor v Shopify Admin produkt <strong className="text-slate-200">"Textilná metráž — jednotka"</strong> s <strong className="text-slate-200">jedným</strong> variantom, ktorého cena zodpovedá poľu "Cena za jednotku" nižšie. Do košíka sa pridá taký počet kusov tohto variantu, aby súčet dal presnú vypočítanú cenu objednávky.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <label className="text-xs text-slate-400 font-medium">Shopify Variant ID</label>
            <input type="text" value={nastavenia.shopify_variant_id || ''} onChange={(e) => ulozNastavenia({ shopify_variant_id: e.target.value })} placeholder="44123456789" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium">Cena za jednotku (€)</label>
            <input type="number" step="0.01" min="0.01" value={nastavenia.jednotka_cena_eur} onChange={(e) => ulozNastavenia({ jednotka_cena_eur: parseFloat(e.target.value) || 0.05 })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
        </div>
        {!nastavenia.shopify_variant_id && <p className="text-xs text-amber-400 mt-2">⚠ Variant ID zatiaľ nie je nastavené — zákaznícky konfigurátor nebude vedieť pridať objednávku do košíka.</p>}
      </div>

      {/* DOPRAVA A KAPACITA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-3">Doprava, expres a kapacitné limity</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mb-4">
          <Field label="Doprava (€)" value={nastavenia.cena_doprava} step="0.1" onChange={(v) => ulozNastavenia({ cena_doprava: v })} />
          <Field label="Príplatok expres (%)" value={nastavenia.priplatok_expres_percent} step="1" onChange={(v) => ulozNastavenia({ priplatok_expres_percent: v })} />
          <Field label="Minimálna cena objednávky (€)" value={nastavenia.minimalna_cena_objednavky} step="0.5" onChange={(v) => ulozNastavenia({ minimalna_cena_objednavky: v })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-950 rounded-xl border border-teal-900/40">
            <span className="text-xs font-bold text-teal-400 block mb-2">Kapacita — Sublimácia</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Limit expres (bm/deň)" value={nastavenia.limit_expres_bm_sublimacia} step="1" onChange={(v) => ulozNastavenia({ limit_expres_bm_sublimacia: v })} />
              <Field label="Limit štandard (bm)" value={nastavenia.limit_standard_bm_sublimacia} step="1" onChange={(v) => ulozNastavenia({ limit_standard_bm_sublimacia: v })} />
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-amber-900/40">
            <span className="text-xs font-bold text-amber-400 block mb-2">Kapacita — Digitálna bavlna</span>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Limit expres (bm/deň)" value={nastavenia.limit_expres_bm_bavlna} step="1" onChange={(v) => ulozNastavenia({ limit_expres_bm_bavlna: v })} />
              <Field label="Limit štandard (bm)" value={nastavenia.limit_standard_bm_bavlna} step="1" onChange={(v) => ulozNastavenia({ limit_standard_bm_bavlna: v })} />
            </div>
          </div>
        </div>
      </div>

      {/* VÝROBNÉ NÁKLADY — SUBLIMÁCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-teal-900/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">1. Sublimácia — vstupné náklady</h3>
            <span className="text-xs font-mono text-teal-400">Náklad: <strong>{nakladBmSub.toFixed(2)} €/bm</strong></span>
          </div>
          <p className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2 mb-3">Vstupné náklady sa teraz zadávajú v karte <strong>Kostra cien → Sublimácia</strong> (spoločné so sublimáciou na tričká, aby sa nezadávali dvakrát). Tu je len prehľad aktuálnych hodnôt.</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Sublimačný papier</span><span className="text-white font-mono">{Number(naklady.sublimacia.cena_papier_bm).toFixed(2)} €/bm</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Ochranný kalandr. papier</span><span className="text-white font-mono">{Number(naklady.sublimacia.cena_ochranny_papier_bm).toFixed(2)} €/bm</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Sublimačný atrament CMYK</span><span className="text-white font-mono">{Number(naklady.sublimacia.cena_atrament_l).toFixed(2)} €/l • {Number(naklady.sublimacia.spotreba_atrament_ml_m2).toFixed(1)} ml/m²</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800"><span>Operátor + kalander</span><span className="text-white font-mono">{Number(naklady.sublimacia.cena_prace_hod).toFixed(2)} €/hod</span></div>
            <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-teal-900/40">
              <span>Rýchlosť tlače+fixácie (len metráž)</span>
              <span className="text-white font-mono">{Number(naklady.sublimacia.rychlost_m_hod).toFixed(1)} bm/hod</span>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-800 space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block mb-1">Predajná cena (jednotný maržový vzorec z Cenotvorby):</span>
            {BM_PREVIEW_LEVELS.map(level => {
              const rate = priceAt(nakladBmSub, level, pricingConfig);
              const marginPct = rate > 0 ? Math.round(((rate - nakladBmSub) / rate) * 100) : 0;
              return (
                <div key={level} className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400 w-16">od {level} bm</span>
                  <span className="text-white font-mono font-bold">{rate.toFixed(2)} €/bm</span>
                  <span className={`font-mono font-bold ${marginPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{marginPct}% marža</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* VÝROBNÉ NÁKLADY — BAVLNA */}
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-amber-900/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">2. Digitálna bavlna — vstupné náklady</h3>
            <span className="text-xs font-mono text-amber-400">Náklad: <strong>{nakladBmCot.toFixed(2)} €/bm</strong></span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Primer / penetrácia (€/l)" value={naklady.bavlna.cena_primer_l} step="1" onChange={(v) => ulozNaklady('bavlna', { cena_primer_l: v })} />
              <Field label="Spotreba primeru (ml/m²)" value={naklady.bavlna.spotreba_primer_ml_m2} step="1" onChange={(v) => ulozNaklady('bavlna', { spotreba_primer_ml_m2: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Pigmentový atrament CMYK (€/l)" value={naklady.bavlna.cena_atrament_l} step="1" onChange={(v) => ulozNaklady('bavlna', { cena_atrament_l: v })} />
              <Field label="Spotreba pigmentu (ml/m²)" value={naklady.bavlna.spotreba_atrament_ml_m2} step="1" onChange={(v) => ulozNaklady('bavlna', { spotreba_atrament_ml_m2: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Operátor + sušiaci tunel (€/hod)" value={naklady.bavlna.cena_prace_hod} step="1" onChange={(v) => ulozNaklady('bavlna', { cena_prace_hod: v })} />
              <Field label="Rýchlosť priamej tlače (bm/hod)" value={naklady.bavlna.rychlost_m_hod} step="0.5" onChange={(v) => ulozNaklady('bavlna', { rychlost_m_hod: v })} />
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-800 space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 block mb-1">Predajná cena (jednotný maržový vzorec z Cenotvorby):</span>
            {BM_PREVIEW_LEVELS.map(level => {
              const rate = priceAt(nakladBmCot, level, pricingConfig);
              const marginPct = rate > 0 ? Math.round(((rate - nakladBmCot) / rate) * 100) : 0;
              return (
                <div key={level} className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400 w-16">od {level} bm</span>
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
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${o.technologia === 'sublimacia' ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                      {o.technologia === 'sublimacia' ? 'Sublimácia' : 'Digitálna bavlna'}
                    </span>
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">{o.rezim === 'auto' ? `${o.sirka_cm}×${o.vyska_cm}cm` : 'Hotová rolka'}</span>
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
      <input type="number" step={step} value={value ?? ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" />
    </div>
  );
}
