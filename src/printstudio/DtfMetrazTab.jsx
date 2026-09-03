import React, { useEffect, useState } from 'react';
import { Scroll, Plus, Trash2, Download, Settings } from 'lucide-react';

const BUCKET = 'print-designs';

const NAKLADY_DEFAULT = {
  cena_folie_bm: 1.8, cena_lepidlo_kg: 18, spotreba_lepidlo_m2: 0.02,
  cena_cmyk_kg: 45, spotreba_cmyk_m2: 0.015, cena_biela_kg: 55, spotreba_biela_m2: 0.03,
  cena_prace_hod: 15, rychlost_tlace_m_hod: 6,
};
const NASTAVENIA_DEFAULT = {
  shopify_variant_id: '', jednotka_cena_eur: 0.05, cena_doprava: 4.9,
  priplatok_expres_percent: 10, limit_expres_bm: 40, limit_standard_bm: 100, minimalna_cena_objednavky: 3,
};

export default function DtfMetrazTab({ supabase }) {
  const [naklady, setNaklady] = useState(NAKLADY_DEFAULT);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [hladiny, setHladiny] = useState([]);
  const [objednavky, setObjednavky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: n }, { data: s }, { data: h }, { data: o }] = await Promise.all([
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_cenove_hladiny').select('*').order('poradie'),
      supabase.from('dtf_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (n) setNaklady(n);
    if (s) setNastavenia(s);
    setHladiny(h || []);
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

  const pridajHladinu = async () => {
    const { data, error } = await supabase.from('dtf_cenove_hladiny').insert({ label: 'Nová hladina', min_bm: 0, max_bm: 9999, cena_bm: 10, poradie: hladiny.length + 1 }).select().single();
    if (!error && data) setHladiny(h => [...h, data]);
  };
  const upravHladinu = async (id, patch) => {
    setHladiny(h => h.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('dtf_cenove_hladiny').update(patch).eq('id', id);
  };
  const zmazHladinu = async (id) => {
    if (!window.confirm('Zmazať túto cenovú hladinu?')) return;
    setHladiny(h => h.filter(x => x.id !== id));
    await supabase.from('dtf_cenove_hladiny').delete().eq('id', id);
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
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Scroll className="text-indigo-400 h-5 w-5" /> DTF transfery — metráž (predaj na meter)</h2>
        <p className="text-xs text-slate-400 mt-1">Samostatný predaj hotových DTF transferov na rolke (56 cm) — nezávislé od konfigurátora potlače oblečenia.</p>
      </div>

      {/* SHOPIFY PREPOJENIE */}
      <div className="bg-slate-900/60 rounded-2xl border border-indigo-900/40 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-400" /> Prepojenie na Shopify</h3>
        <p className="text-xs text-slate-400 mb-3">Bežný Shopify plán nedovolí meniť cenu položky pri pridaní do košíka. Preto vytvor v Shopify Admin produkt <strong className="text-slate-200">"DTF tlač — jednotka"</strong> s <strong className="text-slate-200">jedným</strong> variantom, ktorého cena presne zodpovedá poľu "Cena za jednotku" nižšie (napr. 0,05 €). Do košíka sa potom pridá taký počet kusov tohto variantu, aby súčet dal presnú vypočítanú cenu objednávky (napr. 296,40 € pri jednotke 0,05 € = 5928 ks).</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl">
          <Field label="Doprava (€)" value={nastavenia.cena_doprava} step="0.1" onChange={(v) => ulozNastavenia({ cena_doprava: v })} />
          <Field label="Príplatok expres (%)" value={nastavenia.priplatok_expres_percent} step="1" onChange={(v) => ulozNastavenia({ priplatok_expres_percent: v })} />
          <Field label="Minimálna cena objednávky (€)" value={nastavenia.minimalna_cena_objednavky} step="0.5" onChange={(v) => ulozNastavenia({ minimalna_cena_objednavky: v })} />
          <Field label="Limit expres (bm/deň)" value={nastavenia.limit_expres_bm} step="1" onChange={(v) => ulozNastavenia({ limit_expres_bm: v })} />
          <Field label="Limit štandard (bm)" value={nastavenia.limit_standard_bm} step="1" onChange={(v) => ulozNastavenia({ limit_standard_bm: v })} />
        </div>
      </div>

      {/* VÝROBNÉ NÁKLADY + CENOVÉ HLADINY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <h3 className="font-bold text-sm text-white mb-3">Vstupné výrobné náklady</h3>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Cena PET fólie (56cm/1bm) €" value={naklady.cena_folie_bm} step="0.1" onChange={(v) => ulozNaklady({ cena_folie_bm: v })} />
              <div><label className="block text-slate-400 mb-1">Prepočet na 1 m²</label><div className="px-2 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-500 font-mono">{filmCostM2.toFixed(2)} €</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Cena lepidla (1kg) €" value={naklady.cena_lepidlo_kg} step="0.5" onChange={(v) => ulozNaklady({ cena_lepidlo_kg: v })} />
              <Field label="Spotreba na 1m² (kg)" value={naklady.spotreba_lepidlo_m2} step="0.005" onChange={(v) => ulozNaklady({ spotreba_lepidlo_m2: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Cena CMYK (1kg) €" value={naklady.cena_cmyk_kg} step="1" onChange={(v) => ulozNaklady({ cena_cmyk_kg: v })} />
              <Field label="Spotreba na 1m² (kg)" value={naklady.spotreba_cmyk_m2} step="0.001" onChange={(v) => ulozNaklady({ spotreba_cmyk_m2: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Cena bielej (1kg) €" value={naklady.cena_biela_kg} step="1" onChange={(v) => ulozNaklady({ cena_biela_kg: v })} />
              <Field label="Spotreba na 1m² (kg)" value={naklady.spotreba_biela_m2} step="0.001" onChange={(v) => ulozNaklady({ spotreba_biela_m2: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <Field label="Práca + energie (€/hod)" value={naklady.cena_prace_hod} step="1" onChange={(v) => ulozNaklady({ cena_prace_hod: v })} />
              <Field label="Rýchlosť tlače (m/hod)" value={naklady.rychlost_tlace_m_hod} step="0.5" onChange={(v) => ulozNaklady({ rychlost_tlace_m_hod: v })} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-white">Cenové hladiny (predajná cena)</h3>
            <span className="text-xs text-slate-400 font-mono">Náklad/1bm: <strong className="text-emerald-400">{nakladBm.toFixed(2)} €</strong></span>
          </div>
          <div className="space-y-2 mb-3">
            {hladiny.map(t => {
              const marginEur = Number(t.cena_bm) - nakladBm;
              const marginPct = Math.round((marginEur / Number(t.cena_bm)) * 100);
              return (
                <div key={t.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                  <input type="text" value={t.label} onChange={(e) => upravHladinu(t.id, { label: e.target.value })} className="flex-1 min-w-[120px] px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white" />
                  <div className="flex items-center gap-1 text-slate-400">od <input type="number" step="0.5" value={t.min_bm} onChange={(e) => upravHladinu(t.id, { min_bm: parseFloat(e.target.value) || 0 })} className="w-16 px-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /> bm</div>
                  <div className="flex items-center gap-1 text-slate-400">cena <input type="number" step="0.1" value={t.cena_bm} onChange={(e) => upravHladinu(t.id, { cena_bm: parseFloat(e.target.value) || 0 })} className="w-16 px-1.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold" /> €</div>
                  <span className={`font-mono font-bold ${marginPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{marginPct}%</span>
                  <button onClick={() => zmazHladinu(t.id)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
          <button onClick={pridajHladinu} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať cenovú hladinu</button>
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
