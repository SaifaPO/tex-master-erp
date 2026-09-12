import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Plus, Trash2, X, Tag, Wand2, Hash, Image as ImageIcon, Shirt, Sparkles, Scissors, Palette } from 'lucide-react';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// Rovnaky vzor ako printWithFilename v hlavnom ERP (src/App.jsx) — dočasne premenuje kartu
// prehliadača, aby "Uložiť ako PDF" navrhlo rozumný názov súboru, potom ho vráti späť.
function printWithFilename(suggestedName) {
  const originalTitle = document.title;
  const safeName = (suggestedName || 'dokument').replace(/[\\/:*?"<>|]/g, '-');
  document.title = safeName;
  const restoreTitle = () => { document.title = originalTitle; window.removeEventListener('afterprint', restoreTitle); };
  window.addEventListener('afterprint', restoreTitle);
  window.print();
  setTimeout(restoreTitle, 3000);
}

const NASTAVENIA_DEFAULT = {
  nazov_cennika: 'Cenník dotlače na textil', marza_percent: 40, dph_percent: 23, referencny_pocet_ks: 1,
  standard_dni: 5, expres2_priplatok_percent: 20, expres2_min_eur: 10,
  expresny_den_priplatok_percent: 50, expresny_den_min_eur: 10, expresny_den_cutoff_hodina: 12,
  kontakt_riadok: '', poznamka: 'Presné cenové ponuky Vám vypracujeme na predajni. Termíny závisia od aktuálnej vyťaženosti výroby.',
};

// Predtym: VC × marza predajne × DPH — uplne obchadzalo standardnu marzovu krivku (priceAt), takze
// lacne male polozky (napr. male cislo) vysli smiesne nizko. Teraz 3 vrstvy: (1) VC, (2) standardna
// marza podla krivky pri referencnom pocte kusov (rovnaky vzorec ako v celom zvysku PrintStudio Pro),
// (3) az na to marza predajne + DPH.
function zakladnaCenaPoMarzi(vyrobnaCena, nastavenia, pricingConfig) {
  return priceAt(vyrobnaCena, nastavenia.referencny_pocet_ks || 1, pricingConfig);
}
// Zaokruhlenie NAHOR na najblizsich 0,50€ — pekne "okruhle" ceny na tlacenom cenniku (2,34€ -> 2,50€).
function zaokruhlitNahor50c(cena) {
  return Math.ceil(cena / 0.5) * 0.5;
}
function retailPrice(vyrobnaCena, nastavenia, pricingConfig) {
  const poMarziKrivky = zakladnaCenaPoMarzi(vyrobnaCena, nastavenia, pricingConfig);
  const cena = poMarziKrivky * (1 + nastavenia.marza_percent / 100) * (1 + nastavenia.dph_percent / 100);
  return zaokruhlitNahor50c(cena);
}

// Ikonka podla kategorie — cisto vizualne spestrenie tlaceneho cennika pre zakaznikov.
function kategoriaIcon(kategoria) {
  const k = (kategoria || '').toLowerCase();
  if (k.includes('číslo') || k.includes('cislo') || k.includes('meno') || k.includes('men')) return Hash;
  if (k.includes('potlač') || k.includes('potlac')) return ImageIcon;
  if (k.includes('tričk') || k.includes('tric') || k.includes('odev')) return Shirt;
  if (k.includes('fólia') || k.includes('folia') || k.includes('rezan')) return Scissors;
  if (k.includes('farb')) return Palette;
  return Sparkles;
}

// Orientačná výrobná cena z reálnych výrobných nákladov DTF (materiál CMYK/biela/lepidlo
// podľa plochy + fixná práca/manipulácia za úkon) — rovnaký vzorec ako nákladová kalkulačka
// v Cenníku potlače (CennikTab.jsx → vcDtf). Zámerne NEpoužívame predajnú sadzbu DTF
// (cennik_technologie.dtf) — tá už má v sebe maržu aj minimálnu cenu úkonu pre bežnú zákazku,
// čo pri malej položke (napr. 4×10cm číslo) dá výrazne nadhodnotenú "výrobnú" cenu.
function cenaZDtf(sirkaCm, vyskaCm, dtfNaklady) {
  if (!dtfNaklady || !sirkaCm || !vyskaCm) return null;
  const n = dtfNaklady;
  const plochaM2 = (Number(sirkaCm) * Number(vyskaCm)) / 10000;
  const material = plochaM2 * (
    (parseFloat(n.cena_cmyk_kg) || 0) * (parseFloat(n.spotreba_cmyk_m2) || 0) +
    (parseFloat(n.cena_biela_kg) || 0) * (parseFloat(n.spotreba_biela_m2) || 0) +
    (parseFloat(n.cena_lepidlo_kg) || 0) * (parseFloat(n.spotreba_lepidlo_m2) || 0)
  );
  const praca = ((parseFloat(n.cas_nazehlovania_min) || 0) / 60) * (parseFloat(n.cena_prace_hod) || 0);
  return material + (parseFloat(n.naklady_manipulacia) || 0) + praca;
}

function fmtCm(n) {
  const v = Number(n);
  if (!v) return '';
  return Number(v.toFixed(1)).toString();
}

const FORMATY = [
  { label: 'Formát…', w: '', h: '' },
  { label: 'A5 (14,8×21)', w: 14.8, h: 21 },
  { label: 'A4 (21×29,7)', w: 21, h: 29.7 },
  { label: 'A3 (29,7×42)', w: 29.7, h: 42 },
];

export default function PredajnyCennikTab({ supabase }) {
  const [polozky, setPolozky] = useState([]);
  const [nastavenia, setNastavenia] = useState(NASTAVENIA_DEFAULT);
  const [companySettings, setCompanySettings] = useState(null);
  const [dtfNaklady, setDtfNaklady] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);

  const nacitaj = async () => {
    setIsLoading(true);
    const [{ data: p }, { data: n }, { data: c }, { data: dtfNak }, { data: cfg }] = await Promise.all([
      supabase.from('predajny_cennik_polozky').select('*').order('poradie').order('id'),
      supabase.from('predajny_cennik_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('dtf_naklady').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    setPolozky(p || []);
    if (n) setNastavenia({ ...NASTAVENIA_DEFAULT, ...n });
    setCompanySettings(c || null);
    setDtfNaklady(dtfNak || null);
    if (cfg) setPricingConfig(mapConfigFromDb(cfg));
    setIsLoading(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ulozNastavenia = async (patch) => {
    const next = { ...nastavenia, ...patch };
    setNastavenia(next);
    await supabase.from('predajny_cennik_nastavenia').upsert({ id: 1, ...next });
  };

  const upravPolozku = async (id, patch) => {
    setPolozky(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('predajny_cennik_polozky').update(patch).eq('id', id);
  };

  const pridajPolozku = async () => {
    const { data, error } = await supabase.from('predajny_cennik_polozky').insert({ nazov: 'Nová položka', kategoria: 'Ostatné', vyrobna_cena: 0, poradie: polozky.length }).select().single();
    if (!error && data) setPolozky(prev => [...prev, data]);
  };

  const zmazPolozku = async (id) => {
    if (!window.confirm('Zmazať túto položku z cenníka?')) return;
    setPolozky(prev => prev.filter(p => p.id !== id));
    await supabase.from('predajny_cennik_polozky').delete().eq('id', id);
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  const kategorie = [...new Set(polozky.map(p => p.kategoria || 'Ostatné'))];
  const aktivnePolozky = polozky.filter(p => p.aktivny);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Printer className="text-indigo-400 h-5 w-5" /> Predajný cenník (tlač A4)</h2>
          <p className="text-xs text-slate-400 mt-1">Prehľadná cenová tabuľa pre predajňu — cena sa vždy dopočíta z výrobnej ceny + marže + DPH, takže zmena ceny fólie/farby/materiálu (výrobná cena nižšie) sa hneď premietne do vytlačeného cenníka.</p>
        </div>
        <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0">
          <Printer className="w-4 h-4" /> Generovať / Tlačiť A4
        </button>
      </div>

      {/* NASTAVENIA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="font-bold text-sm text-white">Nastavenia cenníka</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="text-xs text-slate-400 font-medium">Názov cenníka (nadpis na tlačenom liste)</label>
            <input type="text" value={nastavenia.nazov_cennika} onChange={(e) => ulozNastavenia({ nazov_cennika: e.target.value })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
          <Field label="Obchodná marža (%)" value={nastavenia.marza_percent} step="1" onChange={(v) => ulozNastavenia({ marza_percent: v })} />
          <Field label="DPH (%)" value={nastavenia.dph_percent} step="0.5" onChange={(v) => ulozNastavenia({ dph_percent: v })} />
          <Field label="Referenčný počet ks (pre maržovú krivku)" value={nastavenia.referencny_pocet_ks} step="1" onChange={(v) => ulozNastavenia({ referencny_pocet_ks: Math.max(1, Math.round(v)) })} />
          <div className="sm:col-span-3">
            <label className="text-xs text-slate-400 font-medium">Kontaktný riadok (telefón/email, voliteľné)</label>
            <input type="text" value={nastavenia.kontakt_riadok || ''} onChange={(e) => ulozNastavenia({ kontakt_riadok: e.target.value })} placeholder="napr. 0900 123 456 • info@firma.sk" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Cena položky = VC → štandardná marža podľa krivky (Cenotvorba) pri referenčnom počte kusov → + obchodná marža predajne → + DPH. Predajňa zvyčajne predáva po 1 kuse, preto je referenčný počet ks predvolene 1 — čím vyšší, tým nižšia marža z krivky (rovnaký princíp ako v celom PrintStudio Pro).</p>

        <div className="pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Doba dodania a príplatky</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="Štandard (prac. dní)" value={nastavenia.standard_dni} step="1" onChange={(v) => ulozNastavenia({ standard_dni: v })} />
            <Field label="Expres do 2. dňa (%)" value={nastavenia.expres2_priplatok_percent} step="1" onChange={(v) => ulozNastavenia({ expres2_priplatok_percent: v })} />
            <Field label="Expres do 2. dňa min. (€)" value={nastavenia.expres2_min_eur} step="1" onChange={(v) => ulozNastavenia({ expres2_min_eur: v })} />
            <Field label="Expres v deň objedn. (%)" value={nastavenia.expresny_den_priplatok_percent} step="1" onChange={(v) => ulozNastavenia({ expresny_den_priplatok_percent: v })} />
            <Field label="Expres v deň, min. (€)" value={nastavenia.expresny_den_min_eur} step="1" onChange={(v) => ulozNastavenia({ expresny_den_min_eur: v })} />
          </div>
          <div className="mt-3 max-w-xs">
            <Field label="Uzávierka expresu v deň objedn. (hod.)" value={nastavenia.expresny_den_cutoff_hodina} step="1" onChange={(v) => ulozNastavenia({ expresny_den_cutoff_hodina: v })} />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium">Poznámka na spodku cenníka</label>
          <textarea rows={2} value={nastavenia.poznamka} onChange={(e) => ulozNastavenia({ poznamka: e.target.value })} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </div>
      </div>

      {/* POLOZKY */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Položky cenníka</h3>
          <button onClick={pridajPolozku} className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold hover:text-indigo-300"><Plus className="w-3.5 h-3.5" /> Pridať položku</button>
        </div>
        {dtfNaklady ? (
          <p className="text-[11px] text-slate-500">Orientačná výrobná cena sa vie dopočítať zo skutočných výrobných nákladov DTF (materiál CMYK/biela/lepidlo podľa plochy + práca a manipulácia za úkon, záložka Kostra cien → DTF) podľa rozmeru položky — vyplň šírku a výšku a klikni na prepočet. Je to len orientačný odhad, cenu si vieš kedykoľvek prepísať ručne.</p>
        ) : (
          <p className="text-[11px] text-amber-400">Výrobné náklady DTF nie sú vyplnené (záložka Kostra cien → DTF) — prepočet z rozmeru nebude fungovať, výrobné ceny nastav ručne.</p>
        )}
        <div className="space-y-2">
          {polozky.map(p => {
            const vc = Number(p.vyrobna_cena) || 0;
            const poMarziKrivky = zakladnaCenaPoMarzi(vc, nastavenia, pricingConfig);
            const cena = retailPrice(vc, nastavenia, pricingConfig);
            const navrh = cenaZDtf(p.sirka_cm, p.vyska_cm, dtfNaklady);
            return (
              <div key={p.id} className={`p-3 rounded-xl border ${p.aktivny ? 'bg-slate-950 border-slate-800' : 'bg-slate-950/40 border-slate-800/50 opacity-60'} space-y-2`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="text" value={p.nazov} onChange={(e) => upravPolozku(p.id, { nazov: e.target.value })} placeholder="Názov" className="flex-1 min-w-[160px] px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" />
                  <input type="text" list="predajny-cennik-kategorie" value={p.kategoria} onChange={(e) => upravPolozku(p.id, { kategoria: e.target.value })} placeholder="Kategória" className="w-40 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white" />
                  <div className="text-xs font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1.5 rounded-lg whitespace-nowrap">{cena.toFixed(2)} € s DPH</div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                    <input type="checkbox" checked={p.aktivny} onChange={(e) => upravPolozku(p.id, { aktivny: e.target.checked })} /> aktívna
                  </label>
                  <button onClick={() => zmazPolozku(p.id)} className="text-slate-400 hover:text-rose-400 p-1.5 shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  VC {vc.toFixed(2)}€ → po marži krivky ({nastavenia.referencny_pocet_ks || 1}ks) {poMarziKrivky.toFixed(2)}€ → +marža predajne {nastavenia.marza_percent}% {(poMarziKrivky * (1 + nastavenia.marza_percent / 100)).toFixed(2)}€ → +DPH {nastavenia.dph_percent}% {(poMarziKrivky * (1 + nastavenia.marza_percent / 100) * (1 + nastavenia.dph_percent / 100)).toFixed(2)}€ → zaokrúhlené nahor = <span className="text-emerald-400 font-bold">{cena.toFixed(2)}€</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const f = FORMATY.find(x => x.label === e.target.value);
                      if (f && f.w) upravPolozku(p.id, { sirka_cm: f.w, vyska_cm: f.h });
                    }}
                    className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300"
                  >
                    {FORMATY.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <input type="number" step="0.1" value={p.sirka_cm || ''} onChange={(e) => upravPolozku(p.id, { sirka_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="šírka" className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" />
                    <span>×</span>
                    <input type="number" step="0.1" value={p.vyska_cm || ''} onChange={(e) => upravPolozku(p.id, { vyska_cm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="výška" className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" />
                    <span>cm</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                    <input type="number" step="0.1" value={p.vyrobna_cena} onChange={(e) => upravPolozku(p.id, { vyrobna_cena: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white" /> € výrobná
                  </div>
                  {navrh !== null && (
                    <button onClick={() => upravPolozku(p.id, { vyrobna_cena: Number(navrh.toFixed(2)) })} title="Prepočítať výrobnú cenu z DTF sadzby podľa rozmeru" className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold bg-indigo-950/30 border border-indigo-900/40 px-2 py-1.5 rounded-lg whitespace-nowrap">
                      <Wand2 className="w-3.5 h-3.5" /> z DTF: {navrh.toFixed(2)} €
                    </button>
                  )}
                </div>
                <input type="text" value={p.popis || ''} onChange={(e) => upravPolozku(p.id, { popis: e.target.value })} placeholder="Popis (zobrazí sa na cenníku, voliteľné)" className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300" />
              </div>
            );
          })}
          {polozky.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Zatiaľ žiadne položky.</p>}
        </div>
        <datalist id="predajny-cennik-kategorie">
          {kategorie.map(k => <option key={k} value={k} />)}
        </datalist>
      </div>

      {/* TLACOVY NAHLAD — createPortal do document.body, lebo tento tab je zanoreny vo viacerych
          "print:hidden" obaloch (PrintStudioAdmin.jsx aj hlavny ERP tab) — bez portalu by sa
          cely nahlad pri tlaci schoval spolu s nadradenym obalom, ktory ho skryva na obrazovke. */}
      {showPrint && createPortal(
        <div className="fixed inset-0 bg-slate-950/95 z-50 overflow-y-auto print:relative print:inset-auto print:bg-white">
          <div className="max-w-4xl mx-auto bg-white text-black p-8 my-6 rounded-xl print:my-0 print:rounded-none print:shadow-none shadow-2xl">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <button onClick={() => printWithFilename(nastavenia.nazov_cennika)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť / Uložiť ako PDF</button>
              <button onClick={() => setShowPrint(false)} className="p-1.5 rounded bg-slate-200 text-slate-600 hover:text-slate-900"><X className="h-5 w-5" /></button>
            </div>

            <div className="text-center border-b-4 border-slate-800 pb-4 mb-6">
              <h1 className="text-2xl font-extrabold uppercase tracking-tight">{nastavenia.nazov_cennika}</h1>
              {companySettings?.company_name && <p className="text-sm text-slate-600 mt-1">{companySettings.company_name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide border-b-2 border-slate-800 pb-1.5 mb-3 flex items-center gap-1.5"><Tag className="w-4 h-4" /> Druhy dotlače</h2>
                <div className="space-y-4">
                  {kategorie.map(kat => {
                    const KatIcon = kategoriaIcon(kat);
                    return (
                    <div key={kat}>
                      <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5"><KatIcon className="w-3.5 h-3.5 text-indigo-500" /> {kat}</h3>
                      <div className="space-y-2">
                        {aktivnePolozky.filter(p => (p.kategoria || 'Ostatné') === kat).map(p => (
                          <div key={p.id} className="flex items-start justify-between gap-3 border-b border-dotted border-slate-300 pb-1.5">
                            <div className="flex items-start gap-1.5">
                              <KatIcon className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-bold text-sm block">
                                  {p.nazov}
                                  {p.sirka_cm && p.vyska_cm ? <span className="font-normal text-slate-500"> ({fmtCm(p.sirka_cm)}×{fmtCm(p.vyska_cm)} cm)</span> : ''}
                                </span>
                                {p.popis && <span className="text-[11px] text-slate-500">{p.popis}</span>}
                              </div>
                            </div>
                            <span className="font-extrabold text-base whitespace-nowrap">{retailPrice(Number(p.vyrobna_cena) || 0, nastavenia, pricingConfig).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                  {aktivnePolozky.length === 0 && <p className="text-xs text-slate-400">Žiadne aktívne položky.</p>}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wide border-b-2 border-slate-800 pb-1.5 mb-3">Doba dodania a príplatky</h2>
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Štandardné dodanie</span>
                    <p className="text-sm font-bold mt-1.5">Do {nastavenia.standard_dni} pracovných dní</p>
                    <p className="text-xs text-slate-500">Bez príplatku</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Expres do 2. dňa</span>
                    <p className="text-sm font-bold mt-1.5">Do druhého pracovného dňa</p>
                    <p className="text-xs text-slate-500">+{nastavenia.expres2_priplatok_percent}% z ceny dotlače (alebo min. +{Number(nastavenia.expres2_min_eur).toFixed(2)} € k objednávke, platí vyššia suma)</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">Expres v deň objednávky</span>
                    <p className="text-sm font-bold mt-1.5">V deň objednávky (rýchly dotlač)</p>
                    <p className="text-xs text-slate-500">+{nastavenia.expresny_den_priplatok_percent}% z ceny dotlače (alebo min. +{Number(nastavenia.expresny_den_min_eur).toFixed(2)} € k objednávke, platí vyššia suma) — objednávka musí byť podaná do {nastavenia.expresny_den_cutoff_hodina}:00.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-300 text-[11px] text-slate-500 space-y-1">
              <p className="font-bold uppercase">Dôležité informácie</p>
              <p>{nastavenia.poznamka}</p>
              {(companySettings?.address || nastavenia.kontakt_riadok) && (
                <p className="mt-2">{companySettings?.address}{companySettings?.address && nastavenia.kontakt_riadok ? ' • ' : ''}{nastavenia.kontakt_riadok}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Field({ label, value, step, onChange }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm" />
    </div>
  );
}
