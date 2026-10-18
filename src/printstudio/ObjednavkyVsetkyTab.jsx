import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

// Jedna spoločná karta s objednávkami zo VŠETKÝCH Shopify konfigurátorov (dresy, buffky, čelenky, vlajky, beachvlajky, DTF, textil),
// farebne rozlíšená podľa typu. Detail a schvaľovanie sa robí v karte príslušnej aplikácie (kliknutím na riadok sa tam prepne).
const TYPY = {
  dres:    { nazov: 'Dresy',       farba: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', bodka: 'bg-indigo-400', karta: 'dresy' },
  buffka:  { nazov: 'Buffky',      farba: 'bg-amber-500/20 text-amber-300 border-amber-500/40',   bodka: 'bg-amber-400',  karta: 'buffky' },
  celenka: { nazov: 'Čelenky',     farba: 'bg-pink-500/20 text-pink-300 border-pink-500/40',      bodka: 'bg-pink-400',   karta: 'celenky' },
  transfer3d: { nazov: '3D transfery', farba: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40', bodka: 'bg-fuchsia-400', karta: 'transfer3d' },
  zastava: { nazov: 'Vlajky',      farba: 'bg-sky-500/20 text-sky-300 border-sky-500/40',         bodka: 'bg-sky-400',    karta: 'vlajky' },
  beach:   { nazov: 'Beachvlajky', farba: 'bg-teal-500/20 text-teal-300 border-teal-500/40',      bodka: 'bg-teal-400',   karta: 'beachvlajky' },
  dtf:     { nazov: 'DTF metráž',  farba: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', bodka: 'bg-emerald-400', karta: 'metraze' },
  textil:  { nazov: 'Textil metráž', farba: 'bg-violet-500/20 text-violet-300 border-violet-500/40', bodka: 'bg-violet-400', karta: 'metraze' },
};

const STAV = {
  na_schvalenie: 'Na schválenie', schvalene: 'Schválené', zamietnute: 'Zamietnuté',
  nova: 'Nová', v_tlaci: 'V tlači', odoslana: 'Odoslaná', zrusena: 'Zrušená',
};
const STAV_FARBA = { na_schvalenie: 'text-amber-300', schvalene: 'text-emerald-300', zamietnute: 'text-rose-300', nova: 'text-amber-300', v_tlaci: 'text-sky-300', odoslana: 'text-emerald-300', zrusena: 'text-rose-300' };

const eur = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)} €`);
const datum = (d) => { try { return new Date(d).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function ObjednavkyVsetkyTab({ supabase, onOtvor }) {
  const [riadky, setRiadky] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [filter, setFilter] = useState('vsetko');
  const [hladaj, setHladaj] = useState('');

  const nacitaj = async () => {
    setNacitava(true);
    const vyber = (tabulka) => supabase.from(tabulka).select('*').order('created_at', { ascending: false }).limit(60);
    const [dres, buffka, celenka, zastava, beach, dtf, textil, t3d] = await Promise.all([
      vyber('dres_objednavky'), vyber('buffky_objednavky'), vyber('celenky_objednavky'), vyber('zastava_objednavky'),
      vyber('vlajka_objednavky'), vyber('dtf_objednavky'), vyber('textil_objednavky'), vyber('transfer3d_objednavky'),
    ]);
    const r = [];
    (dres.data || []).forEach(o => r.push({ typ: 'dres', id: o.id, cas: o.created_at, cislo: o.shopify_order_number || '', zakaznik: o.zakaznik_meno || '', popis: `${o.produkt_nazov || 'Dres'}${o.tim_text ? ` · ${o.tim_text}` : ''}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.status }));
    (buffka.data || []).forEach(o => r.push({ typ: 'buffka', id: o.id, cas: o.created_at, cislo: o.shopify_order_id ? `Shopify ${o.shopify_order_id}` : '', zakaznik: '', popis: o.typ === 'premium' ? `Premium${o.material_kod ? ` · ${o.material_kod}` : ''}` : 'Tubular Basic (bezšvová)', ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo }));
    (celenka.data || []).forEach(o => r.push({ typ: 'celenka', id: o.id, cas: o.created_at, cislo: o.shopify_order_id ? `Shopify ${o.shopify_order_id}` : '', zakaznik: '', popis: [o.velkost, o.material].filter(Boolean).join(' · ') || 'Čelenka', ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo }));
    (zastava.data || []).forEach(o => r.push({ typ: 'zastava', id: o.id, cas: o.created_at, cislo: o.shopify_order_number || '', zakaznik: o.zakaznik_meno || '', popis: `${o.sirka_cm}×${o.vyska_cm} cm · ${o.material_kod || ''}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.status }));
    (beach.data || []).forEach(o => r.push({ typ: 'beach', id: o.id, cas: o.created_at, cislo: o.shopify_order_number || '', zakaznik: o.zakaznik_meno || '', popis: `${o.tvar_kod || ''} · ${o.velkost_kod || ''}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.status }));
    (dtf.data || []).forEach(o => r.push({ typ: 'dtf', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: `${o.dlzka_bm} bm${o.rezim === 'auto' ? '' : ' (vlastný súbor)'}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav }));
    (textil.data || []).forEach(o => r.push({ typ: 'textil', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: `${o.technologia === 'bavlna' ? 'Bavlna' : 'Sublimácia'} · ${o.dlzka_bm} bm`, ks: null, cena: o.cena_spolu, stav: o.stav }));
    (t3d.data || []).forEach(o => r.push({ typ: 'transfer3d', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: `${o.sirka_cm}×${o.vyska_cm} cm · ${o.uroven || ''} · lak ${o.lak || ''}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo || '' }));
    r.sort((a, b) => new Date(b.cas || 0) - new Date(a.cas || 0));
    setRiadky(r);
    setNacitava(false);
  };
  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pocty = useMemo(() => {
    const p = { vsetko: riadky.length };
    riadky.forEach(r => { p[r.typ] = (p[r.typ] || 0) + 1; });
    return p;
  }, [riadky]);

  const zobrazene = riadky.filter(r => (filter === 'vsetko' || r.typ === filter) && (!hladaj.trim() || `${r.cislo} ${r.zakaznik} ${r.popis} ${r.erp || ''}`.toLowerCase().includes(hladaj.trim().toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Objednávky zo všetkých aplikácií</h2>
          <p className="text-xs text-slate-400 mt-1">Dresy, buffky, čelenky, vlajky, beachvlajky, DTF aj textil na jednom mieste, farebne rozlíšené. Kliknutím na riadok sa otvorí karta danej aplikácie.</p>
        </div>
        <button onClick={nacitaj} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg"><RefreshCw className={`w-3.5 h-3.5 ${nacitava ? 'animate-spin' : ''}`} /> Obnoviť</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter('vsetko')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter === 'vsetko' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'text-slate-300 border-slate-700 hover:bg-slate-800'}`}>Všetko ({pocty.vsetko || 0})</button>
        {Object.entries(TYPY).map(([id, t]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${filter === id ? t.farba : 'text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
            <span className={`w-2 h-2 rounded-full ${t.bodka}`} /> {t.nazov} ({pocty[id] || 0})
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input value={hladaj} onChange={(e) => setHladaj(e.target.value)} placeholder="Hľadať…" className="pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white w-48" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-950/60 text-slate-500 uppercase tracking-wide text-[10px]">
            <tr><th className="text-left px-3 py-2.5">Dátum</th><th className="text-left px-3 py-2.5">Typ</th><th className="text-left px-3 py-2.5">Číslo</th><th className="text-left px-3 py-2.5">Zákazník</th><th className="text-left px-3 py-2.5">Čo</th><th className="text-right px-3 py-2.5">Ks</th><th className="text-right px-3 py-2.5">Cena</th><th className="text-left px-3 py-2.5">Stav</th><th className="text-left px-3 py-2.5">ERP zákazka</th></tr>
          </thead>
          <tbody>
            {nacitava ? <tr><td colSpan={9} className="text-center text-slate-500 py-8">Načítavam…</td></tr>
              : zobrazene.length === 0 ? <tr><td colSpan={9} className="text-center text-slate-500 py-8">Žiadne objednávky.</td></tr>
              : zobrazene.map(r => {
                const t = TYPY[r.typ];
                return (
                  <tr key={`${r.typ}-${r.id}`} onClick={() => t.karta && onOtvor?.(t.karta)} className={`border-t border-slate-800 hover:bg-slate-800/40 ${t.karta ? 'cursor-pointer' : ''}`}>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{datum(r.cas)}</td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${t.farba}`}><span className={`w-1.5 h-1.5 rounded-full ${t.bodka}`} />{t.nazov}</span></td>
                    <td className="px-3 py-2 text-slate-200 font-semibold whitespace-nowrap">{r.cislo || '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{r.zakaznik || '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{r.popis}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{r.ks ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-white font-semibold whitespace-nowrap">{eur(r.cena)}</td>
                    <td className={`px-3 py-2 font-semibold ${STAV_FARBA[r.stav] || 'text-slate-300'}`}>{STAV[r.stav] || r.stav || '—'}</td>
                    <td className="px-3 py-2 text-emerald-300 font-mono">{r.erp || '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500">Zobrazuje sa posledných 60 objednávok z každej aplikácie. Čelenky, buffky, DTF a textil sa zapíšu hneď po vytvorení platobného odkazu (aj keď zákazník ešte nezaplatil) — zaplatené čelenky a buffky majú vyplnené číslo ERP zákazky.</p>
    </div>
  );
}
