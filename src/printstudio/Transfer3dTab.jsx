import React, { useCallback, useEffect, useRef, useState } from 'react';
import NumberInput from '../NumberInput';
import { Layers, Download, Trash2, Calculator, Loader2, AlertTriangle } from 'lucide-react';
import FotoSlot from './FotoSlot';
import ErpProduktVyber from './ErpProduktVyber';

const BUCKET = 'print-designs';
const eur = (v, d = 2) => `${(Number(v) || 0).toFixed(d)} €`;

function Pole({ label, value, onChange, step = '0.01', jednotka, pomoc }) {
  return (
    <div>
      <label className="block text-slate-400 mb-1 text-xs">{label}{jednotka && <span className="text-slate-600"> ({jednotka})</span>}</label>
      <NumberInput step={step} value={value} onChange={onChange} fallback={0} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs" />
      {pomoc && <p className="text-[10px] text-slate-600 mt-0.5">{pomoc}</p>}
    </div>
  );
}

function Karta({ nadpis, popis, children }) {
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
      <h3 className="font-bold text-sm text-white mb-1">{nadpis}</h3>
      {popis && <p className="text-xs text-slate-400 mb-3">{popis}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

export default function Transfer3dTab({ supabase }) {
  const [nast, setNast] = useState(null);
  const [urovne, setUrovne] = useState([]);
  const [laky, setLaky] = useState([]);
  const [objednavky, setObjednavky] = useState([]);
  const [zariadenia, setZariadenia] = useState([]);
  const [cenaElektriny, setCenaElektriny] = useState(0);
  const [produkty, setProdukty] = useState([]);
  const [erpProdukty, setErpProdukty] = useState([]);
  const [chyba, setChyba] = useState('');
  const [nacitava, setNacitava] = useState(true);
  const [ulozene, setUlozene] = useState(true);
  const casovac = useRef(null);

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const [n, u, l, o, cm, p, erp] = await Promise.all([
      supabase.from('transfer3d_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('transfer3d_urovne').select('*').order('poradie'),
      supabase.from('transfer3d_laky').select('*').order('poradie'),
      supabase.from('transfer3d_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('cost_metrics').select('id, name, value, power_kw, amortizacia_hod'),
      supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny, erp_produkt_id').eq('aktivny', true).order('nazov'),
      supabase.from('products').select('id, name, custom_code, production_cost').order('name'),
    ]);
    if (n.error || !n.data) { setChyba('Tabuľky 3D transferov ešte neexistujú — spusti v Supabase SQL Editore migráciu migration_transfer3d.sql (priečinok printstudio-pro).'); setNacitava(false); return; }
    setChyba('');
    setNast(n.data); setUrovne(u.data || []); setLaky(l.data || []); setObjednavky(o.data || []);
    const metriky = cm.data || [];
    setCenaElektriny(Number(metriky.find((m) => m.name === 'Cena elektriny')?.value) || 0);
    setZariadenia(metriky.filter((m) => m.name !== 'Cena elektriny' && (Number(m.power_kw) > 0 || Number(m.amortizacia_hod) > 0)));
    setProdukty(p.data || []); setErpProdukty(erp.data || []);
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  // Hodnoty sa ukladajú automaticky ~0,7 s po poslednej zmene
  const zmenNast = (patch) => {
    setNast((prev) => {
      const next = { ...prev, ...patch };
      setUlozene(false);
      clearTimeout(casovac.current);
      casovac.current = setTimeout(async () => {
        const { error } = await supabase.from('transfer3d_nastavenia').upsert({ ...next, id: 1 });
        if (error) window.alert('Uloženie zlyhalo: ' + error.message); else setUlozene(true);
      }, 700);
      return next;
    });
  };

  const zmenRiadok = async (tabulka, setter, kod, patch) => {
    setter((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x)));
    await supabase.from(tabulka).update(patch).eq('kod', kod);
  };

  const zariadenieHod = (id) => {
    const z = zariadenia.find((x) => x.id === id);
    return z ? (Number(z.power_kw) || 0) * cenaElektriny + (Number(z.amortizacia_hod) || 0) : null;
  };

  const stiahniSubor = async (o) => {
    if (!o.subor_cesta) { window.alert('Táto objednávka nemá priložený súbor.'); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(o.subor_cesta, 300);
    if (error || !data) { window.alert('Súbor sa nepodarilo stiahnuť: ' + (error?.message || 'neznáma chyba')); return; }
    window.open(data.signedUrl, '_blank');
  };
  const zmenStav = async (id, stav) => {
    setObjednavky((o) => o.map((x) => (x.id === id ? { ...x, stav } : x)));
    await supabase.from('transfer3d_objednavky').update({ stav }).eq('id', id);
  };
  const zmazObjednavku = async (id) => {
    if (!window.confirm('Naozaj zmazať túto objednávku? Zmaže sa aj priložený súbor. Prípadnú Shopify draft objednávku treba zmazať samostatne v Shopify Admin → Orders → Drafts.')) return;
    const o = objednavky.find((x) => x.id === id);
    if (o?.subor_cesta) await supabase.storage.from(BUCKET).remove([o.subor_cesta]);
    setObjednavky((arr) => arr.filter((x) => x.id !== id));
    await supabase.from('transfer3d_objednavky').delete().eq('id', id);
  };

  // ---- Kalkulačka (volá rovnakú Edge Function ako appka; ako prihlásený admin dostane aj rozpis nákladov a maržu) ----
  const [kalk, setKalk] = useState({ sirka: 8, vyska: 8, ks: 10, uroven: 'medium', lak: 'partial' });
  const [kalkVysledok, setKalkVysledok] = useState(null);
  const [kalkChyba, setKalkChyba] = useState('');
  const [kalkBezi, setKalkBezi] = useState(false);
  const spocitaj = async () => {
    setKalkBezi(true); setKalkChyba('');
    if (!ulozene) await new Promise((r) => setTimeout(r, 1000)); // počkaj na uloženie hodnôt
    const { data, error } = await supabase.functions.invoke('transfer3d-create-draft-order', { body: { preview: true, sirkaCm: kalk.sirka, vyskaCm: kalk.vyska, pocetKs: kalk.ks, uroven: kalk.uroven, lak: kalk.lak } });
    setKalkBezi(false);
    if (error || !data?.ok) { setKalkVysledok(null); setKalkChyba(data?.error || (error?.message + ' — je funkcia transfer3d-create-draft-order nasadená v Supabase?')); return; }
    setKalkVysledok(data);
  };

  // ---- Výrobné ceny a marže podľa počtu kusov (referenčný motív; štandard 8×8 cm, stredná hrubka, pololak) ----
  const KS_UROVNE = [1, 5, 10, 25, 50, 100, 250];
  const [ref, setRef] = useState({ sirka: 8, vyska: 8, uroven: 'medium', lak: 'partial' });
  const [refRiadky, setRefRiadky] = useState([]);
  const [refBezi, setRefBezi] = useState(false);
  const [refChyba, setRefChyba] = useState('');
  useEffect(() => {
    if (!nast || !ulozene || urovne.length === 0 || laky.length === 0) return undefined;
    const t = setTimeout(async () => {
      setRefBezi(true); setRefChyba('');
      const odpovede = await Promise.all(KS_UROVNE.map((ks) => supabase.functions.invoke('transfer3d-create-draft-order', { body: { preview: true, sirkaCm: ref.sirka, vyskaCm: ref.vyska, pocetKs: ks, uroven: ref.uroven, lak: ref.lak } })));
      setRefBezi(false);
      const chybna = odpovede.find((o) => o.error || !o.data?.ok);
      if (chybna) { setRefRiadky([]); setRefChyba(chybna.data?.error || `${chybna.error?.message || 'Chyba'} — je funkcia transfer3d-create-draft-order nasadená v Supabase?`); return; }
      setRefRiadky(odpovede.map((o, i) => ({ ks: KS_UROVNE[i], ...o.data })));
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, nast, ulozene, ref.sirka, ref.vyska, ref.uroven, ref.lak, urovne.length, laky.length]);

  if (nacitava) return <p className="text-sm text-slate-500">Načítavam…</p>;
  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;

  const ad = kalkVysledok?.admin;
  const popisky = { folieEur: 'Fólia', cmykEur: 'CMYK farba', bielaEur: 'Biela farba', lakEur: 'Lak (varnish)', strojTlacEur: 'Stroj — tlač (amortizácia + prevádzka)', strojRezEur: 'Stroj — rezanie', pracaEur: 'Pracovník', rizikoEur: 'Riziko' };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Layers className="text-indigo-400 h-5 w-5" /> 3D transfery — objednávka podľa loga</h2>
          <p className="text-xs text-slate-400 mt-1">Zákazník nahrá logo, zvolí rozmer, výšku 3D efektu a lak. Cenu počíta server z hodnôt nižšie + maržový modul (Cenotvorba). Všetky ceny tu sú bez DPH.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmenNast({ aktivny: e.target.checked })} /> Objednávanie zapnuté</label>
        </div>
      </div>

      <Karta nadpis="Fólia a formát" popis="Tlačíme na fóliu danej šírky; motívy sa skladajú do riadkov (aj otočené), medzi nimi je medzera na rezanie.">
        <Pole label="Šírka fólie" jednotka="cm" step="0.1" value={nast.sirka_folie_cm} onChange={(v) => zmenNast({ sirka_folie_cm: v })} />
        <Pole label="Okraj fólie (každá strana)" jednotka="cm" value={nast.okraj_cm} onChange={(v) => zmenNast({ okraj_cm: v })} />
        <Pole label="Medzera medzi motívmi" jednotka="cm" value={nast.medzera_cm} onChange={(v) => zmenNast({ medzera_cm: v })} />
        <Pole label="Max. šírka motívu" jednotka="cm" step="0.1" value={nast.max_sirka_cm} onChange={(v) => zmenNast({ max_sirka_cm: v })} />
        <Pole label="Max. výška motívu" jednotka="cm" step="0.1" value={nast.max_vyska_cm} onChange={(v) => zmenNast({ max_vyska_cm: v })} />
        <Pole label="Pokrytie plochy farbou" jednotka="%" step="1" value={nast.pokrytie_percent} onChange={(v) => zmenNast({ pokrytie_percent: v })} pomoc="Logo nie je plný obdĺžnik — priemerne koľko % plochy sa potlačí." />
        <Pole label="Cena fólie" jednotka="€/bm" value={nast.cena_folie_bm} onChange={(v) => zmenNast({ cena_folie_bm: v })} />
      </Karta>

      <Karta nadpis="Farby (nákupné ceny)" popis="Spotreba farby pre každú úroveň 3D je v tabuľke nižšie (ml na 1 m² potlačenej plochy).">
        <Pole label="CMYK farba" jednotka="€/liter" value={nast.cena_cmyk_l} onChange={(v) => zmenNast({ cena_cmyk_l: v })} />
        <Pole label="Biela farba" jednotka="€/liter" value={nast.cena_biela_l} onChange={(v) => zmenNast({ cena_biela_l: v })} />
        <Pole label="Lak (varnish)" jednotka="€/liter" value={nast.cena_lak_l} onChange={(v) => zmenNast({ cena_lak_l: v })} />
      </Karta>

      <Karta nadpis="Stroje — amortizácia a prevádzka" popis="Buď zadaj hodinovú sadzbu ručne, alebo vyber zariadenie z Réžie firiem (zoberie sa jeho amortizácia + elektrina).">
        <Pole label="Tlačiareň — ručná sadzba" jednotka="€/hod" value={nast.stroj_tlac_hod} onChange={(v) => zmenNast({ stroj_tlac_hod: v })} />
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-slate-400 mb-1 text-xs">Tlačiareň — zariadenie z Réžie firiem (voliteľné)</label>
          <select value={nast.tlaciaren_zariadenie_id || ''} onChange={(e) => zmenNast({ tlaciaren_zariadenie_id: e.target.value || null })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
            <option value="">— nepoužiť (platí ručná sadzba) —</option>
            {zariadenia.map((z) => <option key={z.id} value={z.id}>{z.name} — {eur(zariadenieHod(z.id))}/hod</option>)}
          </select>
        </div>
        <Pole label="Rezací stroj — ručná sadzba" jednotka="€/hod" value={nast.stroj_rezanie_hod} onChange={(v) => zmenNast({ stroj_rezanie_hod: v })} />
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-slate-400 mb-1 text-xs">Rezací stroj — zariadenie z Réžie firiem (voliteľné)</label>
          <select value={nast.rezanie_zariadenie_id || ''} onChange={(e) => zmenNast({ rezanie_zariadenie_id: e.target.value || null })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
            <option value="">— nepoužiť (platí ručná sadzba) —</option>
            {zariadenia.map((z) => <option key={z.id} value={z.id}>{z.name} — {eur(zariadenieHod(z.id))}/hod</option>)}
          </select>
        </div>
      </Karta>

      <Karta nadpis="Rezanie a pracovník">
        <Pole label="Rezanie — čas na 1 motív" jednotka="min" value={nast.rezanie_min_ks} onChange={(v) => zmenNast({ rezanie_min_ks: v })} />
        <Pole label="Rezanie — čas na 1 m² fólie" jednotka="min" value={nast.rezanie_min_m2} onChange={(v) => zmenNast({ rezanie_min_m2: v })} />
        <Pole label="Cena práce pracovníka" jednotka="€/hod" value={nast.praca_hod} onChange={(v) => zmenNast({ praca_hod: v })} />
        <Pole label="Práca na objednávku (príprava, balenie)" jednotka="min" value={nast.praca_min_objednavka} onChange={(v) => zmenNast({ praca_min_objednavka: v })} />
        <Pole label="Práca na 1 motív (kontrola, obsluha)" jednotka="min" value={nast.praca_min_ks} onChange={(v) => zmenNast({ praca_min_ks: v })} />
        <Pole label="Obsluha počas tlače" jednotka="% času tlače" step="1" value={nast.obsluha_tlace_percent} onChange={(v) => zmenNast({ obsluha_tlace_percent: v })} pomoc="Pracovník pri tlači nestojí celý čas." />
      </Karta>

      <Karta nadpis="Rezervy a predaj">
        <Pole label="Odpad materiálu (fólia + farby)" jednotka="%" step="1" value={nast.odpad_percent} onChange={(v) => zmenNast({ odpad_percent: v })} />
        <Pole label="Koeficient rizika" jednotka="%" step="1" value={nast.riziko_percent} onChange={(v) => zmenNast({ riziko_percent: v })} />
        <Pole label="Minimálna cena motívov" jednotka="€ bez DPH" value={nast.minimalna_cena_eur} onChange={(v) => zmenNast({ minimalna_cena_eur: v })} />
        <Pole label="Manipulačný poplatok (1× na objednávku)" jednotka="€ bez DPH" value={nast.manipulacny_poplatok_eur} onChange={(v) => zmenNast({ manipulacny_poplatok_eur: v })} />
        <Pole label="Poštovné a balné" jednotka="€ bez DPH" value={nast.cena_doprava} onChange={(v) => zmenNast({ cena_doprava: v })} />
        <Pole label="Poštovné zdarma od" jednotka="€ bez DPH, 0 = vypnuté" value={nast.postovne_zdarma_od_eur} onChange={(v) => zmenNast({ postovne_zdarma_od_eur: v })} />
        <div className="col-span-2 sm:col-span-3">
          <label className="block text-slate-400 mb-1 text-xs">Info text pre zákazníka (voliteľné, zobrazí sa pod nadpisom)</label>
          <input type="text" value={nast.info_text || ''} onChange={(e) => zmenNast({ info_text: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
        </div>
      </Karta>

      {/* ÚROVNE 3D */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Úrovne 3D efektu (low / medium / high)</h3>
        <p className="text-xs text-slate-400 mb-3">Čím vyššia úroveň, tým viac vrstiev bielej a laku a dlhšia tlač. Spotreba je v ml na 1 m² potlačenej plochy, čas tlače v minútach na 1 m² fólie.</p>
        <div className="space-y-3">
          {urovne.map((u) => (
            <div key={u.kod} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <FotoSlot supabase={supabase} url={u.foto_url} priecinok="transfer3d" onZmena={(url) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { foto_url: url })} />
                <div className="flex-1 min-w-[180px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" value={u.nazov} onChange={(e) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { nazov: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold" />
                  <input type="text" value={u.popis || ''} onChange={(e) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { popis: e.target.value })} placeholder="Popis pre zákazníka" className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Pole label="CMYK" jednotka="ml/m²" value={u.spotreba_cmyk_ml_m2} onChange={(v) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { spotreba_cmyk_ml_m2: v })} />
                <Pole label="Biela" jednotka="ml/m²" value={u.spotreba_biela_ml_m2} onChange={(v) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { spotreba_biela_ml_m2: v })} />
                <Pole label="Lak (pri plnom nanesení)" jednotka="ml/m²" value={u.spotreba_lak_ml_m2} onChange={(v) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { spotreba_lak_ml_m2: v })} />
                <Pole label="Čas tlače" jednotka="min/m²" value={u.cas_tlace_min_m2} onChange={(v) => zmenRiadok('transfer3d_urovne', setUrovne, u.kod, { cas_tlace_min_m2: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LAK */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Lak (varnish): bez / čiastočne / na plno</h3>
        <p className="text-xs text-slate-400 mb-3">Pokrytie určuje, akú časť plochy motívu lak pokryje (násobí spotrebu laku z úrovne vyššie). Násobok času = o koľko sa predĺži tlač (lak je ďalší prechod).</p>
        <div className="space-y-3">
          {laky.map((l) => (
            <div key={l.kod} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-start gap-3">
              <FotoSlot supabase={supabase} url={l.foto_url} priecinok="transfer3d" onZmena={(url) => zmenRiadok('transfer3d_laky', setLaky, l.kod, { foto_url: url })} />
              <div className="flex-1 min-w-[180px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" value={l.nazov} onChange={(e) => zmenRiadok('transfer3d_laky', setLaky, l.kod, { nazov: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-bold" />
                <input type="text" value={l.popis || ''} onChange={(e) => zmenRiadok('transfer3d_laky', setLaky, l.kod, { popis: e.target.value })} placeholder="Popis pre zákazníka" className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3 w-full sm:w-72">
                <Pole label="Pokrytie plochy" jednotka="%" step="1" value={l.pokrytie_percent} onChange={(v) => zmenRiadok('transfer3d_laky', setLaky, l.kod, { pokrytie_percent: v })} />
                <Pole label="Násobok času tlače" jednotka="×" value={l.cas_nasobok} onChange={(v) => zmenRiadok('transfer3d_laky', setLaky, l.kod, { cas_nasobok: v })} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ERP PRODUKT */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Produkt v Katalógu produktov (pre zákazky v ERP)</h3>
        <p className="text-xs text-slate-400 mb-3">Pod týmto produktom sa bude evidovať 3D transfer. Cena sa z produktu neberie — počíta sa z výrobných hodnôt vyššie.</p>
        <ErpProduktVyber supabase={supabase} blankId={nast.produkt_id} blanky={produkty} erpProdukty={erpProdukty} onZmena={(id) => zmenNast({ produkt_id: id })} onBlankVytvoreny={(b) => setProdukty((prev) => [...prev, b])} />
      </div>

      {/* VÝROBNÉ CENY A MARŽE PODĽA POČTU KUSOV */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Výrobné ceny a marže podľa počtu kusov</h3>
        <p className="text-xs text-slate-400 mb-3">Náklad na 1 ks, predajná cena a marža pre referenčný motív pri rôznom počte kusov (rovnaký prepočet ako v ostatných aplikáciách; marža sa nastavuje v Cenotvorbe). Zmeň rozmer, hrúbku alebo lak a tabuľka sa sama prepočíta. Ceny bez DPH.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Pole label="Šírka motívu" jednotka="cm" step="0.1" value={ref.sirka} onChange={(v) => setRef({ ...ref, sirka: v })} />
          <Pole label="Výška motívu" jednotka="cm" step="0.1" value={ref.vyska} onChange={(v) => setRef({ ...ref, vyska: v })} />
          <div><label className="block text-slate-400 mb-1 text-xs">3D efekt (hrúbka)</label><select value={ref.uroven} onChange={(e) => setRef({ ...ref, uroven: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{urovne.map((u) => <option key={u.kod} value={u.kod}>{u.nazov}</option>)}</select></div>
          <div><label className="block text-slate-400 mb-1 text-xs">Lak</label><select value={ref.lak} onChange={(e) => setRef({ ...ref, lak: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{laky.map((l) => <option key={l.kod} value={l.kod}>{l.nazov}</option>)}</select></div>
        </div>
        {refChyba && <p className="text-xs text-rose-400 mb-2">{refChyba}</p>}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]">
              <tr><th className="px-3 py-2">Počet ks</th><th className="px-3 py-2 text-right">Fólia</th><th className="px-3 py-2 text-right">Náklad / ks</th><th className="px-3 py-2 text-right">Predaj / ks</th><th className="px-3 py-2 text-right">Marža / ks</th><th className="px-3 py-2 text-right">Marža %</th><th className="px-3 py-2 text-right">Náklad spolu</th><th className="px-3 py-2 text-right">Predaj spolu</th></tr>
            </thead>
            <tbody>
              {refBezi && refRiadky.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-500">Počítam…</td></tr>}
              {refRiadky.map((x) => {
                const a = x.admin;
                const margaKs = a ? x.cenaKsBezDph - a.nakladKs : null;
                return (
                  <tr key={x.ks} className="border-t border-slate-800 text-slate-200">
                    <td className="px-3 py-2 font-bold text-white">{x.ks} ks</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">{x.dlzkaBm} bm</td>
                    <td className="px-3 py-2 text-right font-mono">{a ? eur(a.nakladKs) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-white">{eur(x.cenaKsBezDph)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">{margaKs != null ? eur(margaKs) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-400">{a && a.nakladKs > 0 ? `${Math.round((x.cenaKsBezDph / a.nakladKs - 1) * 100)} %` : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">{a ? eur(a.nakladSpolu) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{eur(x.logaSpoluBezDph)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Predaj zahŕňa minimálnu cenu objednávky; manipulačný poplatok a poštovné sa pripočítavajú zvlášť (v tabuľke nie sú).</p>
      </div>

      {/* KALKULAČKA */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1 flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-400" /> Skúšobná kalkulácia (náklady a marža)</h3>
        <p className="text-xs text-slate-400 mb-3">Rovnaký výpočet ako v appke pre zákazníka, ale s rozpisom nákladov a maržou. Funguje po nasadení funkcie <code className="text-slate-300">transfer3d-create-draft-order</code>.</p>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <Pole label="Šírka" jednotka="cm" step="0.1" value={kalk.sirka} onChange={(v) => setKalk({ ...kalk, sirka: v })} />
          <Pole label="Výška" jednotka="cm" step="0.1" value={kalk.vyska} onChange={(v) => setKalk({ ...kalk, vyska: v })} />
          <Pole label="Počet ks" step="1" value={kalk.ks} onChange={(v) => setKalk({ ...kalk, ks: Math.max(1, Math.round(v)) })} />
          <div><label className="block text-slate-400 mb-1 text-xs">3D efekt</label><select value={kalk.uroven} onChange={(e) => setKalk({ ...kalk, uroven: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{urovne.map((u) => <option key={u.kod} value={u.kod}>{u.nazov}</option>)}</select></div>
          <div><label className="block text-slate-400 mb-1 text-xs">Lak</label><select value={kalk.lak} onChange={(e) => setKalk({ ...kalk, lak: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{laky.map((l) => <option key={l.kod} value={l.kod}>{l.nazov}</option>)}</select></div>
          <button onClick={spocitaj} disabled={kalkBezi} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-1.5">{kalkBezi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Prepočítať</button>
        </div>
        {kalkChyba && <p className="text-xs text-rose-400 mt-3">{kalkChyba}</p>}
        {kalkVysledok && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-1.5">
              <p className="font-bold text-slate-200 mb-1">Predajná cena</p>
              <div className="flex justify-between"><span className="text-slate-400">Fólia: {kalkVysledok.dlzkaBm} bm ({kalkVysledok.naRiadok} v riadku × {kalkVysledok.riadkov} riadkov{kalkVysledok.otoceny ? ', otočené' : ''})</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cena za 1 ks (bez DPH)</span><strong className="text-white font-mono">{eur(kalkVysledok.cenaKsBezDph)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Motívy spolu (bez DPH)</span><strong className="text-white font-mono">{eur(kalkVysledok.logaSpoluBezDph)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">+ manipulácia / poštovné</span><span className="text-slate-200 font-mono">{eur(kalkVysledok.manipulaciaBezDph)} / {eur(kalkVysledok.postovneBezDph)}</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-300">Zákazník platí s DPH</span><strong className="text-emerald-400 font-mono">{eur(kalkVysledok.spolu)}</strong></div>
            </div>
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-1.5">
              <p className="font-bold text-slate-200 mb-1">Náklady a marža {!ad && <span className="text-amber-400 font-normal">(rozpis vidí len prihlásený admin)</span>}</p>
              {ad && <>
                {Object.entries(ad.rozpis).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-400">{popisky[k] || k}</span><span className="text-slate-200 font-mono">{eur(v)}</span></div>)}
                <div className="flex justify-between border-t border-slate-800 pt-1.5"><span className="text-slate-300">Náklad spolu ({eur(ad.nakladKs)}/ks)</span><strong className="text-white font-mono">{eur(ad.nakladSpolu)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-300">Marža</span><strong className="text-emerald-400 font-mono">{eur(ad.margaEur)} ({ad.margaPercent.toFixed(0)} %)</strong></div>
                <p className="text-[10px] text-slate-500 pt-1">Spotreba: CMYK {ad.spotreba.cmykMl} ml · biela {ad.spotreba.bielaMl} ml · lak {ad.spotreba.lakMl} ml · fólia {ad.spotreba.folieM2} m² · tlač {ad.spotreba.tlacMin} min · rezanie {ad.spotreba.rezMin} min · práca {ad.spotreba.pracaMin} min</p>
              </>}
            </div>
          </div>
        )}
      </div>

      {/* OBJEDNÁVKY */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-white">Prijaté objednávky 3D transferov</h3>
          <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{objednavky.length} objednávok</span>
        </div>
        {objednavky.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">Zatiaľ nebola prijatá žiadna objednávka.</p>
        ) : (
          <div className="space-y-2">
            {objednavky.map((o) => (
              <div key={o.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white font-mono">{o.cislo_objednavky || o.id.slice(0, 8)}</span>
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px]">{o.pocet_ks} ks · {o.sirka_cm}×{o.vyska_cm} cm</span>
                    {o.osobny_odber && <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">Osobný odber</span>}
                    <span className="text-slate-500 text-[10px]">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                  </div>
                  <div className="text-slate-300">{urovne.find((u) => u.kod === o.uroven)?.nazov || o.uroven} · {laky.find((l) => l.kod === o.lak)?.nazov || o.lak} | Suma s DPH: <strong className="text-emerald-400 font-mono">{eur(o.cena_spolu)}</strong>{o.naklad_spolu != null && <span className="text-slate-500"> | náklad {eur(o.naklad_spolu)}</span>} | fólia {o.dlzka_bm} bm</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={o.stav} onChange={(e) => zmenStav(o.id, e.target.value)} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
                    <option value="nova">Nová</option><option value="v_tlaci">V tlači</option><option value="odoslana">Odoslaná</option><option value="zrusena">Zrušená</option>
                  </select>
                  {o.subor_cesta && <button onClick={() => stiahniSubor(o)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Logo / súbor</button>}
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
