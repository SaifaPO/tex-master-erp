import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Shirt, Calculator, Settings2, AlertTriangle } from 'lucide-react';
import NumberInput from '../NumberInput';
import { priceAt, marginAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// VÝŠIVKA — KALKULÁCIA CENY (rovnako ako sublimácia, DTF, laser…): náklad výšivky = čas stroja (amortizácia + elektrina z Réžie firiem; 3-hlavový stroj
// vyšíva 3 kusy naraz) + niť (vrchná + spodná) + podkladový materiál + práca zamestnanca (príprava, upnutie kusov, dozor), × rezerva na zmetky.
// Predajná cena = náklad cez maržový modul (Cenotvorba) podľa množstva. Údaje (stehy, minúty, spotreba nite) sa berú z uloženého dizajnu v editore výšivky
// alebo sa zadajú ručne (čas sa vtedy dopočíta zo stehov rovnako ako v editore).
const eur = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toLocaleString('sk-SK', { minimumFractionDigits: d, maximumFractionDigits: d })} €`);
const cislo = (v, d = 1) => (Number(v) || 0).toLocaleString('sk-SK', { maximumFractionDigits: d });

export function vypocitajVysivku(n, hodStroj, d, ks) {
  const hlavy = Math.max(1, Math.floor(Number(n.hlavy)) || 1);
  const q = Math.max(1, Math.floor(Number(ks)) || 1);
  const stehov = Number(d.stehov) || 0;
  // čas jedného kusu na jednej hlave: stehy ÷ rýchlosť + strihy nite + výmeny farieb (rovnako ako v editore výšivky)
  const minSteh = stehov / (Number(n.rychlost_spm) || 1);
  const minStrih = ((Number(d.strihov) || 0) * Number(n.strih_s)) / 60;
  const minVymen = ((Number(d.vymen) || 0) * Number(n.zmena_farby_s)) / 60;
  const minKus = minSteh + minStrih + minVymen;
  // 3-hlavový stroj vyšíva 3 kusy naraz → priemerne na 1 kus pripadne čas ÷ počet hláv
  const minNaKusStroj = minKus / hlavy;
  const strojMin = q * minNaKusStroj;
  const strojEur = (strojMin / 60) * hodStroj;
  const nitM = (stehov / 1000) * Number(n.nit_m_na_1000_stehov);
  const nitEur = q * nitM * (1 + Number(n.spodna_nit_percent) / 100) * (Number(n.nit_cena_kus_eur) / (Number(n.nit_dlzka_kus_m) || 1));
  const stabEur = q * Number(n.stabilizator_eur_ks);
  const pracaMin = Number(n.priprava_min) + q * Number(n.vkladanie_min_ks) + (strojMin * Number(n.obsluha_percent)) / 100;
  const pracaEur = (pracaMin / 60) * Number(n.praca_hod);
  const zaklad = strojEur + nitEur + stabEur + pracaEur;
  const naklad = zaklad * (1 + Number(n.riziko_percent) / 100);
  return { hlavy, q, stehov, minSteh, minStrih, minVymen, minKus, minNaKusStroj, strojMin, strojEur, nitM, nitEur, stabEur, pracaMin, pracaEur, zaklad, naklad, rizikoEur: naklad - zaklad };
}

function Pole({ label, hodnota, onChange, jednotka, step = '0.1', pomoc }) {
  return (
    <label className="block text-xs text-slate-400" title={pomoc}>
      <span className="block mb-1">{label}{jednotka ? <span className="text-slate-600"> ({jednotka})</span> : null}</span>
      <NumberInput step={step} value={hodnota} onChange={onChange} fallback={0} className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs" />
    </label>
  );
}

export default function VysivkaKalkTab({ supabase }) {
  const [nast, setNast] = useState(null);
  const [zariadenia, setZariadenia] = useState([]);
  const [cenaEl, setCenaEl] = useState(0);
  const [dizajny, setDizajny] = useState([]);
  const [pricingCfg, setPricingCfg] = useState(DEFAULT_PRICING_CONFIG);
  const [chyba, setChyba] = useState('');
  const [ulozene, setUlozene] = useState(true);
  const casovac = useRef(null);
  // kalkulačka
  const [zdroj, setZdroj] = useState('rucne');       // rucne | dizajn
  const [dizajnId, setDizajnId] = useState('');
  const [d, setD] = useState({ stehov: 8000, vymen: 3, strihov: 10 });
  const [ks, setKs] = useState(30);

  const nacitaj = useCallback(async () => {
    const [n, cm, dz, pc] = await Promise.all([
      supabase.from('vysivka_kalk_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('cost_metrics').select('id, name, value, power_kw, hours_per_month, amortizacia_hod, category'),
      supabase.from('vysivky').select('id, nazov, zakazka_id, stehov, minut, vymen_niti, strihov, spotreba_nite_m, sirka_mm, vyska_mm, farieb, created_at').order('created_at', { ascending: false }).limit(60),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (n.error || !n.data) { setChyba('Kalkulácia výšivky ešte nie je zapnutá — spusti migráciu migration_vysivka_kalk.sql (priečinok printstudio-pro).'); return; }
    setChyba('');
    setNast(n.data);
    const m = cm.data || [];
    setCenaEl(Number(m.find((x) => x.name === 'Cena elektriny')?.value) || 0);
    setZariadenia(m.filter((x) => x.category === 'zariadenie'));
    setDizajny(dz.data || []);
    if (pc.data) setPricingCfg(mapConfigFromDb(pc.data));
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const zmenNast = (patch) => {
    setNast((prev) => {
      const next = { ...prev, ...patch };
      setUlozene(false);
      clearTimeout(casovac.current);
      casovac.current = setTimeout(async () => {
        const { error } = await supabase.from('vysivka_kalk_nastavenia').upsert({ ...next, id: 1 });
        if (error) window.alert('Uloženie zlyhalo: ' + error.message); else setUlozene(true);
      }, 700);
      return next;
    });
  };

  const stroj = zariadenia.find((z) => z.id === nast?.stroj_zariadenie_id);
  const hodStroj = stroj ? (Number(stroj.power_kw) || 0) * cenaEl + (Number(stroj.amortizacia_hod) || 0) : 0;

  const vyberDizajn = (id) => {
    setDizajnId(id);
    const r = dizajny.find((x) => x.id === id);
    if (r) setD({ stehov: Number(r.stehov) || 0, vymen: Number(r.vymen_niti) || 0, strihov: Number(r.strihov) || 0 });
  };

  const v = useMemo(() => (nast ? vypocitajVysivku(nast, hodStroj, d, ks) : null), [nast, hodStroj, d, ks]);
  const nakladKs = v ? v.naklad / v.q : 0;
  const marzaKrivka = v ? marginAt(nakladKs, v.q, pricingCfg) : 0;
  const cenaKs = v ? priceAt(nakladKs, v.q, pricingCfg) : 0;
  const spoluBezDph = v ? Math.max(cenaKs * v.q, Number(nast.min_cena_eur) || 0) : 0;
  const platiMinimum = v ? cenaKs * v.q < (Number(nast.min_cena_eur) || 0) : false;
  const dph = Number(pricingCfg.dphPercent) || 23;
  const tabulka = useMemo(() => (nast ? [1, 3, 6, 10, 30, 60, 100, 250].map((q) => {
    const x = vypocitajVysivku(nast, hodStroj, d, q);
    const nk = x.naklad / x.q;
    const c = Math.max(priceAt(nk, x.q, pricingCfg) * x.q, Number(nast.min_cena_eur) || 0);
    return { q, nakladKs: nk, marza: nk > 0 ? (c / x.q / nk - 1) * 100 : 0, cenaKs: c / x.q, spolu: c };
  }) : []), [nast, hodStroj, d, pricingCfg]);

  if (chyba) return <p className="text-sm text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (!nast || !v) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="w-5 h-5 text-indigo-400" /> Výšivka — kalkulácia ceny <span className={`text-[11px] font-normal ml-2 ${ulozene ? 'text-slate-600' : 'text-amber-400'}`}>{ulozene ? 'uložené' : 'ukladám…'}</span></h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">Cena výšivky sa počíta z toho, koľko stehov dizajn má a ako dlho stroj vyšíva — rovnako ako pri sublimácii a DTF z nákladov a marže. Čas jedného kusu sa dopočíta zo stehov a rýchlosti stroja; 3-hlavový stroj vyšíva 3 kusy naraz, takže priemerný čas stroja na kus je tretina.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2"><Settings2 className="w-4 h-4 text-slate-400" /> Výrobné hodnoty</h3>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Vyšívací stroj (z Réžie firiem)</label>
            <select value={nast.stroj_zariadenie_id || ''} onChange={(e) => zmenNast({ stroj_zariadenie_id: e.target.value })} className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs">
              <option value="">— vyber zariadenie —</option>
              {zariadenia.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            {stroj ? (
              <p className="text-[11px] text-slate-500 mt-1.5">Príkon {cislo(stroj.power_kw, 2)} kW × {cislo(cenaEl, 3)} €/kWh + amortizácia a servis {cislo(stroj.amortizacia_hod, 2)} €/h = <b className="text-slate-300">{eur(hodStroj)} / hod celého stroja</b> ({cislo(stroj.hours_per_month, 0)} h/mes). Zmeníš to v Réžii firiem.</p>
            ) : <p className="text-[11px] text-amber-400 mt-1.5">Vyber zariadenie, inak sa čas stroja počíta za 0 €.</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Pole label="Počet hláv" hodnota={nast.hlavy} step="1" onChange={(x) => zmenNast({ hlavy: Math.max(1, Math.round(x)) })} pomoc="Koľko kusov stroj vyšíva naraz" />
            <Pole label="Rýchlosť" jednotka="stehov/min" step="10" hodnota={nast.rychlost_spm} onChange={(x) => zmenNast({ rychlost_spm: x })} pomoc="Používa sa pri ručnom zadaní stehov" />
            <Pole label="Strih nite" jednotka="s" hodnota={nast.strih_s} onChange={(x) => zmenNast({ strih_s: x })} />
            <Pole label="Výmena farby" jednotka="s" hodnota={nast.zmena_farby_s} onChange={(x) => zmenNast({ zmena_farby_s: x })} />
            <Pole label="Cena cievky nite" jednotka="€" step="0.05" hodnota={nast.nit_cena_kus_eur} onChange={(x) => zmenNast({ nit_cena_kus_eur: x })} />
            <Pole label="Dĺžka nite na cievke" jednotka="m" step="100" hodnota={nast.nit_dlzka_kus_m} onChange={(x) => zmenNast({ nit_dlzka_kus_m: x })} />
            <Pole label="Vrchná niť na 1000 stehov" jednotka="m" hodnota={nast.nit_m_na_1000_stehov} onChange={(x) => zmenNast({ nit_m_na_1000_stehov: x })} pomoc="Použije sa, ak editor nedal presnú spotrebu" />
            <Pole label="Spodná niť" jednotka="% vrchnej" step="1" hodnota={nast.spodna_nit_percent} onChange={(x) => zmenNast({ spodna_nit_percent: x })} />
            <Pole label="Podkladový materiál / kus" jednotka="€" step="0.01" hodnota={nast.stabilizator_eur_ks} onChange={(x) => zmenNast({ stabilizator_eur_ks: x })} />
            <Pole label="Práca zamestnanca" jednotka="€/hod" step="0.5" hodnota={nast.praca_hod} onChange={(x) => zmenNast({ praca_hod: x })} />
            <Pole label="Príprava objednávky" jednotka="min" step="1" hodnota={nast.priprava_min} onChange={(x) => zmenNast({ priprava_min: x })} />
            <Pole label="Upnutie 1 kusu" jednotka="min" hodnota={nast.vkladanie_min_ks} onChange={(x) => zmenNast({ vkladanie_min_ks: x })} />
            <Pole label="Dozor počas behu" jednotka="% času stroja" step="1" hodnota={nast.obsluha_percent} onChange={(x) => zmenNast({ obsluha_percent: x })} />
            <Pole label="Zmetky a rezerva" jednotka="%" step="1" hodnota={nast.riziko_percent} onChange={(x) => zmenNast({ riziko_percent: x })} />
            <Pole label="Minimálna cena výšivky" jednotka="€ bez DPH" step="0.5" hodnota={nast.min_cena_eur} onChange={(x) => zmenNast({ min_cena_eur: x })} />
          </div>
          <p className="text-[11px] text-slate-500">Hodnoty sú odhady (príkon stroja, cena nite, časy upnutia) — uprav ich podľa skúseností z výroby.</p>
        </section>

        <section className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2"><Calculator className="w-4 h-4 text-slate-400" /> Kalkulačka</h3>
          <div className="inline-flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            {[['rucne', 'Ručne zadať'], ['dizajn', 'Z uloženého dizajnu']].map(([k, n]) => <button key={k} onClick={() => setZdroj(k)} className={`px-3 py-1.5 rounded-md font-bold ${zdroj === k ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{n}</button>)}
          </div>
          {zdroj === 'dizajn' && (
            <select value={dizajnId} onChange={(e) => vyberDizajn(e.target.value)} className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs">
              <option value="">— vyber dizajn z editora výšivky —</option>
              {dizajny.map((r) => <option key={r.id} value={r.id}>{r.nazov} · {Number(r.stehov).toLocaleString('sk-SK')} stehov · {Math.round(r.minut)} min · zákazka {r.zakazka_id}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Pole label="Stehov na kus" step="100" hodnota={d.stehov} onChange={(x) => setD({ ...d, stehov: x })} />
            <Pole label="Výmen farieb" step="1" hodnota={d.vymen} onChange={(x) => setD({ ...d, vymen: x })} />
            <Pole label="Strihov nite" step="1" hodnota={d.strihov} onChange={(x) => setD({ ...d, strihov: x })} />
            <Pole label="Počet kusov" step="1" hodnota={ks} onChange={(x) => setKs(Math.max(1, Math.round(x)))} />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1.5 text-xs">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">1. Čas výšivky (automaticky zo stehov)</p>
            {[
              [`Stehy: ${v.stehov.toLocaleString('sk-SK')} ÷ ${cislo(nast.rychlost_spm, 0)} stehov/min`, `${cislo(v.minSteh, 1)} min`],
              [`Strihy nite: ${cislo(d.strihov, 0)} × ${cislo(nast.strih_s, 1)} s`, `${cislo(v.minStrih, 1)} min`],
              [`Výmeny farieb: ${cislo(d.vymen, 0)} × ${cislo(nast.zmena_farby_s, 1)} s`, `${cislo(v.minVymen, 1)} min`],
            ].map(([a, b]) => <div key={a} className="flex justify-between gap-3"><span className="text-slate-400">{a}</span><span className="text-slate-100 font-mono text-right">{b}</span></div>)}
            <div className="flex justify-between gap-3 border-t border-slate-800 pt-1.5"><span className="text-slate-300">Čas jedného kusu na jednej hlave</span><span className="text-white font-mono">{cislo(v.minKus, 1)} min</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-300 font-bold">Priemerný čas stroja na kus (÷ {v.hlavy} {v.hlavy === 1 ? 'hlava' : v.hlavy < 5 ? 'hlavy' : 'hláv'})</span><span className="text-white font-mono font-bold">{cislo(v.minNaKusStroj, 1)} min</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Čas stroja na {v.q} ks</span><span className="text-slate-100 font-mono">{cislo(v.strojMin, 0)} min ({cislo(v.strojMin / 60, 1)} h)</span></div>

            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold pt-3">2. Náklad (výrobná cena, bez DPH)</p>
            {[
              ['Stroj (amortizácia + elektrina)', v.strojEur],
              [`Niť (${cislo(v.nitM, 1)} m vrchnej na kus + spodná)`, v.nitEur],
              ['Podkladový materiál', v.stabEur],
              [`Práca (${cislo(v.pracaMin, 0)} min spolu — príprava sa rozloží na všetky kusy)`, v.pracaEur],
              [`Rezerva ${cislo(nast.riziko_percent, 0)} %`, v.rizikoEur],
            ].map(([a, b]) => <div key={a} className="flex justify-between gap-3"><span className="text-slate-400">{a}</span><span className="text-slate-100 font-mono text-right">{eur(b / v.q, 3)} / ks <span className="text-slate-600">· {eur(b)}</span></span></div>)}
            <div className="flex justify-between gap-3 border-t border-slate-800 pt-1.5"><span className="text-slate-300 font-bold">Náklad na kus (VC)</span><span className="text-white font-mono font-bold">{eur(nakladKs, 3)} <span className="text-slate-600 font-normal">· spolu {eur(v.naklad)}</span></span></div>

            <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold pt-3">3. Marža a predajná cena</p>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Marža z Cenotvorby pri {v.q} ks</span><span className="text-slate-100 font-mono">{cislo(marzaKrivka, 0)} % (+ {eur(cenaKs - nakladKs)} / ks)</span></div>
            <div className="flex justify-between gap-3"><span className="text-emerald-300 font-bold">Predajná cena za kus (bez DPH)</span><span className="text-emerald-300 font-mono font-bold">{eur(spoluBezDph / v.q)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-emerald-300">Spolu (bez DPH / s DPH {dph} %)</span><span className="text-emerald-300 font-mono">{eur(spoluBezDph)} / {eur(spoluBezDph * (1 + dph / 100))}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Zisk na zákazke</span><span className="text-slate-200 font-mono">{eur(spoluBezDph - v.naklad)}</span></div>
            {platiMinimum && <p className="text-[11px] text-amber-300 pt-1">Platí minimálna cena výšivky {eur(nast.min_cena_eur)} — marža je preto vyššia než z krivky.</p>}
          </div>
        </section>
      </div>

      <section className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
        <h3 className="font-bold text-sm text-white mb-1">Cena za kus podľa množstva (pre tento dizajn)</h3>
        <p className="text-[11px] text-slate-500 mb-3">Náklad na kus s množstvom klesá (príprava objednávky sa rozloží na viac kusov) a marža podľa krivky z Cenotvorby tiež klesá, takže cena za kus je pri väčšom odbere nižšia.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase text-[10px]"><tr><th className="text-left py-1.5">Kusov</th><th className="text-right">Náklad / kus</th><th className="text-right">Marža</th><th className="text-right">Predaj / kus (bez DPH)</th><th className="text-right">Spolu (bez DPH)</th></tr></thead>
            <tbody>
              {tabulka.map((r) => (
                <tr key={r.q} className={`border-t border-slate-800 ${r.q === v.q ? 'bg-indigo-950/40' : ''}`}>
                  <td className="py-1.5 text-slate-200 font-semibold">{r.q} ks</td>
                  <td className="text-right font-mono text-slate-400">{eur(r.nakladKs, 3)}</td>
                  <td className="text-right font-mono text-slate-400">{cislo(r.marza, 0)} %</td>
                  <td className="text-right font-mono text-white font-bold">{eur(r.cenaKs)}</td>
                  <td className="text-right font-mono text-slate-300">{eur(r.spolu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
