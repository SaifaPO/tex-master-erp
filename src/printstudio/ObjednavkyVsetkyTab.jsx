import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, X, Copy, Check, Download } from 'lucide-react';

// Jedna spoločná karta s objednávkami zo VŠETKÝCH Shopify konfigurátorov (dresy, buffky, čelenky, vlajky, beachvlajky, DTF, textil),
// farebne rozlíšená podľa typu. Detail a schvaľovanie sa robí v karte príslušnej aplikácie (kliknutím na riadok sa tam prepne).
const TYPY = {
  dopyt:   { nazov: 'Dopyty',      farba: 'bg-amber-500/20 text-amber-300 border-amber-500/40',   bodka: 'bg-amber-400',  karta: null },
  dres:    { nazov: 'Dresy',       farba: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', bodka: 'bg-indigo-400', karta: 'dresy' },
  buffka:  { nazov: 'Buffky',      farba: 'bg-amber-500/20 text-amber-300 border-amber-500/40',   bodka: 'bg-amber-400',  karta: 'buffky' },
  celenka: { nazov: 'Čelenky',     farba: 'bg-pink-500/20 text-pink-300 border-pink-500/40',      bodka: 'bg-pink-400',   karta: 'celenky' },
  transfer3d: { nazov: '3D transfery', farba: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40', bodka: 'bg-fuchsia-400', karta: 'transfer3d' },
  stolova: { nazov: 'Stolové vlajky', farba: 'bg-orange-500/20 text-orange-300 border-orange-500/40', bodka: 'bg-orange-400', karta: 'stolova' },
  snurka: { nazov: 'Šnúrky', farba: 'bg-lime-500/20 text-lime-300 border-lime-500/40', bodka: 'bg-lime-400', karta: 'snurky' },
  folie: { nazov: 'Rezané fólie', farba: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', bodka: 'bg-cyan-400', karta: 'folie' },
  zastava: { nazov: 'Vlajky',      farba: 'bg-sky-500/20 text-sky-300 border-sky-500/40',         bodka: 'bg-sky-400',    karta: 'vlajky' },
  beach:   { nazov: 'Beachvlajky', farba: 'bg-teal-500/20 text-teal-300 border-teal-500/40',      bodka: 'bg-teal-400',   karta: 'beachvlajky' },
  dtf:     { nazov: 'DTF metráž',  farba: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', bodka: 'bg-emerald-400', karta: 'metraze' },
  textil:  { nazov: 'Textil metráž', farba: 'bg-violet-500/20 text-violet-300 border-violet-500/40', bodka: 'bg-violet-400', karta: 'metraze' },
};

const STAV = {
  na_schvalenie: 'Na schválenie', schvalene: 'Schválené', zamietnute: 'Zamietnuté',
  novy: 'Nový dopyt', importovany: 'Zadaný do zákaziek', zrusene: 'Zrušený', nova: 'Nová', v_tlaci: 'V tlači', odoslana: 'Odoslaná', zrusena: 'Zrušená',
};
const STAV_FARBA = { novy: 'text-amber-300', importovany: 'text-emerald-300', zrusene: 'text-rose-300', na_schvalenie: 'text-amber-300', schvalene: 'text-emerald-300', zamietnute: 'text-rose-300', nova: 'text-amber-300', v_tlaci: 'text-sky-300', odoslana: 'text-emerald-300', zrusena: 'text-rose-300' };

const eur = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)} €`);
const datum = (d) => { try { return new Date(d).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function ObjednavkyVsetkyTab({ supabase, onOtvor, fokus = null }) {
  const [riadky, setRiadky] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [filter, setFilter] = useState('vsetko');
  const [hladaj, setHladaj] = useState('');
  const [dopyty, setDopyty] = useState([]);
  const [detailDopytu, setDetailDopytu] = useState(null);
  const [zvyraznene, setZvyraznene] = useState(null); // { typ, id } po prekliku z notifikácie
  const [skopirovane, setSkopirovane] = useState(false);
  const riadkyRef = useRef({});

  const nacitaj = async () => {
    setNacitava(true);
    const vyber = (tabulka) => supabase.from(tabulka).select('*').order('created_at', { ascending: false }).limit(60);
    const [dres, buffka, celenka, zastava, beach, dtf, textil, t3d, stolova, snurka, folie] = await Promise.all([
      vyber('dres_objednavky'), vyber('buffky_objednavky'), vyber('celenky_objednavky'), vyber('zastava_objednavky'),
      vyber('vlajka_objednavky'), vyber('dtf_objednavky'), vyber('textil_objednavky'), vyber('transfer3d_objednavky'), vyber('stolova_objednavky'), vyber('snurka_objednavky'), vyber('folie_objednavky'),
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
    (stolova.data || []).forEach(o => r.push({ typ: 'stolova', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: `${o.velkost || ''} · ${o.tvar || ''} · ${o.okraj || ''} · ${o.podstavec || ''}`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo || '' }));
    (snurka.data || []).forEach(o => r.push({ typ: 'snurka', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: o.model || 'Šnúrka', ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo || '' }));
    (folie.data || []).forEach(o => r.push({ typ: 'folie', id: o.id, cas: o.created_at, cislo: o.cislo_objednavky || '', zakaznik: '', popis: `${o.druh || ''} · ${o.sirka_mm}×${o.vyska_mm} mm · ${o.dlzka_bm} bm`, ks: o.pocet_ks, cena: o.cena_spolu, stav: o.stav, erp: o.erp_cislo || '' }));
    const { data: dp } = await supabase.from('b2b_dopyty').select('*').order('created_at', { ascending: false }).limit(100);
    setDopyty(dp || []);
    (dp || []).forEach(d => r.push({ typ: 'dopyt', id: d.id, cas: d.created_at, cislo: `DOPYT-${d.kod}`, zakaznik: d.agentura || d.b2b_kod || '', popis: `${d.produkt_nazov}${d.popis_varianty ? ` — ${d.popis_varianty}` : ''} (cena bez DPH)`, ks: d.pocet_ks, cena: d.cena_spolu_bez_dph, stav: d.stav }));
    r.sort((a, b) => new Date(b.cas || 0) - new Date(a.cas || 0));
    setRiadky(r);
    setNacitava(false);
  };

  // Návrh z dopytu je v súkromnom úložisku — vygeneruje sa dočasný odkaz na stiahnutie
  const stiahniNavrh = async (d) => {
    const { data, error } = await supabase.storage.from('print-designs').createSignedUrl(d.subor_cesta, 600);
    if (error || !data?.signedUrl) { window.alert('Návrh sa nepodarilo otvoriť: ' + (error?.message || 'chýba súbor')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const zmenStavDopytu = async (d, stav) => {
    setDopyty(l => l.map(x => (x.id === d.id ? { ...x, stav } : x)));
    setDetailDopytu(x => (x && x.id === d.id ? { ...x, stav } : x));
    setRiadky(l => l.map(x => (x.typ === 'dopyt' && x.id === d.id ? { ...x, stav } : x)));
    await supabase.from('b2b_dopyty').update({ stav }).eq('id', d.id);
  };
  const kopirujCislo = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Skopíruj:', text); }
    setSkopirovane(true); setTimeout(() => setSkopirovane(false), 1500);
  };

  // Prekliknutie z notifikácie (zvonček): filter na daný typ, zvýraznenie riadku a pri dopyte otvorenie detailu
  useEffect(() => {
    if (!fokus?.typ) return undefined;
    setFilter(fokus.typ);
    setHladaj('');
    setZvyraznene({ typ: fokus.typ, id: fokus.id });
    const t = setTimeout(() => setZvyraznene(null), 6000);
    return () => clearTimeout(t);
  }, [fokus]);
  useEffect(() => {
    if (!zvyraznene || nacitava) return;
    if (zvyraznene.typ === 'dopyt') { const d = dopyty.find(x => x.id === zvyraznene.id); if (d) setDetailDopytu(d); }
    const el = riadkyRef.current[`${zvyraznene.typ}-${zvyraznene.id}`];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [zvyraznene, nacitava, dopyty]);
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
          <h2 className="text-xl font-bold text-white">Objednávky a dopyty zo všetkých aplikácií</h2>
          <p className="text-xs text-slate-400 mt-1">Objednávky aj dopyty e-mailom na jednom mieste, farebne rozlíšené. Kliknutím na objednávku sa otvorí karta danej aplikácie, kliknutím na dopyt jeho detail aj s návrhom.</p>
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
                  <tr key={`${r.typ}-${r.id}`} ref={(el) => { riadkyRef.current[`${r.typ}-${r.id}`] = el; }} onClick={() => { if (r.typ === 'dopyt') setDetailDopytu(dopyty.find(x => x.id === r.id) || null); else if (t.karta) onOtvor?.(t.karta); }} className={`border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer ${zvyraznene && zvyraznene.typ === r.typ && zvyraznene.id === r.id ? 'bg-indigo-500/20 ring-1 ring-indigo-400' : ''}`}>
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
      {detailDopytu && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetailDopytu(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-lg space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">DOPYT-{detailDopytu.kod}
                  <button onClick={() => kopirujCislo('DOPYT-' + detailDopytu.kod)} title="Kopírovať číslo" className="text-slate-400 hover:text-white">{skopirovane ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
                </h3>
                <p className="text-[11px] text-slate-500">{datum(detailDopytu.created_at)}</p>
              </div>
              <button onClick={() => setDetailDopytu(null)} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-xs">
              <dt className="text-slate-500">Produkt</dt><dd className="text-slate-100 font-semibold">{detailDopytu.produkt_nazov}{detailDopytu.popis_varianty ? ` — ${detailDopytu.popis_varianty}` : ''}</dd>
              <dt className="text-slate-500">Počet kusov</dt><dd className="text-slate-100">{detailDopytu.pocet_ks} ks</dd>
              <dt className="text-slate-500">Cena</dt><dd className="text-slate-100">{eur(detailDopytu.cena_kus_bez_dph)}/ks · spolu {eur(detailDopytu.cena_spolu_bez_dph)} bez DPH</dd>
              <dt className="text-slate-500">Agentúra / B2B kód</dt><dd className="text-slate-100">{detailDopytu.agentura || '—'} {detailDopytu.b2b_kod ? <span className="font-mono text-slate-400">({detailDopytu.b2b_kod})</span> : null}</dd>
              <dt className="text-slate-500">Expres / odber</dt><dd className="text-slate-100">{detailDopytu.expres ? 'expres' : 'štandard'} · {detailDopytu.osobny_odber ? 'osobný odber' : 'doručenie'}</dd>
              <dt className="text-slate-500">Stav</dt>
              <dd><select value={detailDopytu.stav} onChange={(e) => zmenStavDopytu(detailDopytu, e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"><option value="novy">Nový dopyt</option><option value="importovany">Zadaný do zákaziek</option><option value="zrusene">Zrušený</option></select></dd>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              {detailDopytu.subor_cesta && <button onClick={() => stiahniNavrh(detailDopytu)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg"><Download className="w-3.5 h-3.5" /> Otvoriť návrh (tlačový súbor)</button>}
            </div>
            <p className="text-[11px] text-slate-500">Zákazku z dopytu vytvoríš v Zákazkách cez <strong className="text-slate-300">AI zadanie zákazky</strong>: prilep text e-mailu od zákazníka (obsahuje číslo DOPYT-{detailDopytu.kod}) — načíta sa presne, aj s návrhom.</p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-slate-500">Zobrazuje sa posledných 60 objednávok z každej aplikácie. Čelenky, buffky, DTF a textil sa zapíšu hneď po vytvorení platobného odkazu (aj keď zákazník ešte nezaplatil) — zaplatené čelenky a buffky majú vyplnené číslo ERP zákazky.</p>
    </div>
  );
}
