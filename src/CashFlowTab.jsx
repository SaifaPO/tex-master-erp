import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Copy, Mail, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import UpomienkySekcia from './UpomienkySekcia';

// CASH FLOW + UPOMIENKY: predpoved penazi na 2/4/8 tyzdnov z neuhradenych vydanych faktur (prijmy) a prijatych faktur (vydavky)
// + pravidelne vydavky, ktore nie su na faktúrach (mzdy, odvody, najom). A zoznam faktur po splatnosti s hotovym textom upomienky.
// Je to ODHAD podla splatnosti — skutocne platby sa mozu oneskorit.

const eur = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dnesStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const pridajDni = (str, n) => { const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dniMedzi = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const skDatum = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '—');
const skKratko = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch { return def; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ignoruj */ } };
const cislo = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };

function textUpomienky(inv, dni, firma) {
  const stupen = dni > 30 ? 3 : dni > 14 ? 2 : 1;
  const udaje = `Údaje na úhradu:\n• Suma: ${eur(inv.total)}\n• Variabilný symbol: ${inv.variableSymbol || inv.invoiceNumber}\n${firma.iban ? `• IBAN: ${firma.iban}\n` : ''}`;
  const podpis = `\nS pozdravom\n${firma.companyName || ''}`;
  if (stupen === 1) return `Dobrý deň,\n\ndovoľujeme si Vás priateľsky upozorniť, že faktúra č. ${inv.invoiceNumber} zo dňa ${skDatum(inv.issueDate)} so splatnosťou ${skDatum(inv.dueDate)} nám zatiaľ nebola uhradená (${dni} ${dni === 1 ? 'deň' : dni < 5 ? 'dni' : 'dní'} po splatnosti). Ak ste platbu už zadali, tento e-mail prosím ignorujte.\n\n${udaje}${podpis}`;
  if (stupen === 2) return `Dobrý deň,\n\nv našej evidencii vedieme neuhradenú faktúru č. ${inv.invoiceNumber} so splatnosťou ${skDatum(inv.dueDate)}, ktorá je už ${dni} dní po splatnosti. Žiadame Vás o jej úhradu v čo najkratšom čase, najneskôr do 7 dní. Ak ste platbu už zadali, pošlite nám prosím potvrdenie.\n\n${udaje}${podpis}`;
  return `Dobrý deň,\n\nfaktúra č. ${inv.invoiceNumber} so splatnosťou ${skDatum(inv.dueDate)} stále nie je uhradená (${dni} dní po splatnosti), napriek predchádzajúcim pripomienkam. Žiadame Vás o okamžitú úhradu najneskôr do 5 dní. V opačnom prípade budeme nútení riešiť pohľadávku ďalšími krokmi vrátane vymáhania.\n\n${udaje}${podpis}`;
}

export default function CashFlowTab({ supabase, invoices = [], customers = [], companySettings = {}, employees = [], triggerNotification = () => {} }) {
  const [prijate, setPrijate] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');
  const [zostatok, setZostatok] = useState(lsGet('cf_zostatok', ''));
  const [pravidelne, setPravidelne] = useState(lsGet('cf_pravidelne', ''));
  const [horizont, setHorizont] = useState(Number(lsGet('cf_horizont', 4)) || 4);
  const [poSplatnostiDoPrvehoTyzdna, setPoSplatnosti] = useState(true);
  const [otvorena, setOtvorena] = useState(null);

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('prijate_faktury').select('*');
    if (error) { setChyba(error.message.includes('prijate_faktury') ? 'Tabuľka prijatých faktúr ešte neexistuje (spusti migration_prijate_faktury.sql) — výdavky z prijatých faktúr sa do predpovede nezapočítajú.' : error.message); setPrijate([]); }
    else { setChyba(''); setPrijate(data || []); }
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const dnes = dnesStr();
  const navrhPravidelnych = useMemo(() => Math.round(employees.reduce((s, e) => s + (Number(e.mzdaHruba) || 0), 0)), [employees]);

  const neuhradeneVydane = useMemo(() => invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate), [invoices]);
  const poSplatnosti = useMemo(() => neuhradeneVydane.filter((i) => i.dueDate < dnes).map((i) => ({ ...i, dni: dniMedzi(i.dueDate, dnes) })).sort((a, b) => b.dni - a.dni), [neuhradeneVydane, dnes]);
  const neuhradenePrijate = useMemo(() => prijate.filter((f) => (f.stav === 'schvalena' || f.stav === 'na_schvalenie') && f.suma_celkom != null), [prijate]);

  const predpoved = useMemo(() => {
    const tyzdne = [];
    const start0 = cislo(zostatok);
    const mesacne = cislo(pravidelne);
    let stav = start0;
    for (let t = 0; t < horizont; t++) {
      const od = pridajDni(dnes, t * 7), do_ = pridajDni(dnes, t * 7 + 6);
      const vTyzdni = (d) => (t === 0 ? d <= do_ : d >= od && d <= do_); // v 1. tyzdni aj to, co je po splatnosti
      const prijmy = neuhradeneVydane.filter((i) => (i.dueDate < dnes ? (poSplatnostiDoPrvehoTyzdna && t === 0) : vTyzdni(i.dueDate))).reduce((s, i) => s + i.total, 0);
      const vydavky = neuhradenePrijate.reduce((s, f) => {
        const spl = f.datum_splatnosti || dnes;
        return s + (vTyzdni(spl) ? Number(f.suma_celkom) : 0);
      }, 0);
      const pravidelneTyzden = mesacne / 4.345;
      stav = stav + prijmy - vydavky - pravidelneTyzden;
      tyzdne.push({ cislo: t + 1, od, do: do_, prijmy, vydavky, pravidelne: pravidelneTyzden, stav });
    }
    return tyzdne;
  }, [neuhradeneVydane, neuhradenePrijate, zostatok, pravidelne, horizont, dnes, poSplatnostiDoPrvehoTyzdna]);

  const minimum = predpoved.length ? predpoved.reduce((m, t) => (t.stav < m.stav ? t : m), predpoved[0]) : null;
  const zadanyZostatok = zostatok !== '';
  const spoluPrijmy = predpoved.reduce((s, t) => s + t.prijmy, 0);
  const spoluVydavky = predpoved.reduce((s, t) => s + t.vydavky + t.pravidelne, 0);

  const emailZakaznika = (meno) => (customers.find((c) => String(c.name || '').trim().toLowerCase() === String(meno || '').trim().toLowerCase())?.email || '');
  const kopiruj = async (txt) => { try { await navigator.clipboard.writeText(txt); triggerNotification('success', 'Text upomienky je skopírovaný.'); } catch { triggerNotification('error', 'Kopírovanie sa nepodarilo.'); } };

  const sumaPoSplatnosti = poSplatnosti.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">Odhad, koľko peňazí príde a odíde v najbližších týždňoch podľa splatností. Zadaj aktuálny stav účtu a pravidelné výdavky, ktoré nie sú na faktúrach.</p>
      {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chyba}</div>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Aktuálny stav účtu (€)</label>
            <input value={zostatok} onChange={(e) => { setZostatok(e.target.value); lsSet('cf_zostatok', e.target.value); }} inputMode="decimal" placeholder="napr. 12000" className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Pravidelné výdavky mesačne (€) — mzdy, odvody, nájom…</label>
            <input value={pravidelne} onChange={(e) => { setPravidelne(e.target.value); lsSet('cf_pravidelne', e.target.value); }} inputMode="decimal" placeholder={navrhPravidelnych ? `napr. ${navrhPravidelnych}` : 'napr. 8000'} className="w-44 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Výhľad</label>
            <div className="flex gap-1">
              {[2, 4, 8].map((h) => (
                <button key={h} onClick={() => { setHorizont(h); lsSet('cf_horizont', h); }} className={`px-3 py-2 rounded-lg text-xs font-bold ${horizont === h ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{h} {h === 8 ? 'týždňov' : 'týždne'}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 pb-2.5"><input type="checkbox" checked={poSplatnostiDoPrvehoTyzdna} onChange={(e) => setPoSplatnosti(e.target.checked)} /> Počítať faktúry po splatnosti ako príjem v 1. týždni</label>
        </div>
        {navrhPravidelnych > 0 && <p className="text-[10px] text-slate-500">Tip: súčet hrubých miezd z profilov zamestnancov je {eur(navrhPravidelnych)} (bez odvodov zamestnávateľa — pre pravidelné výdavky pripočítaj odvody a nájom).</p>}

        {nacitava ? (
          <div className="text-slate-500 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Načítavam…</div>
        ) : (
          <>
            {zadanyZostatok && minimum && (
              <div className={`rounded-xl border p-3 text-xs font-bold flex items-center gap-2 ${minimum.stav < 0 ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'}`}>
                {minimum.stav < 0 ? <><TrendingDown className="h-4 w-4" /> Pozor: v {minimum.cislo}. týždni ({skKratko(minimum.od)}–{skKratko(minimum.do)}) môže zostatok klesnúť na {eur(minimum.stav)}.</> : <><TrendingUp className="h-4 w-4" /> Zostatok by mal zostať kladný, najnižší bod {eur(minimum.stav)} (týždeň {minimum.cislo}).</>}
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr><th className="px-3 py-3">Týždeň</th><th className="px-3 py-3 text-right">Príjmy (faktúry)</th><th className="px-3 py-3 text-right">Výdavky (faktúry)</th><th className="px-3 py-3 text-right">Pravidelné</th><th className="px-3 py-3 text-right">{zadanyZostatok ? 'Zostatok na konci' : 'Priebežný rozdiel'}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {predpoved.map((t) => (
                    <tr key={t.cislo}>
                      <td className="px-3 py-2 font-bold text-white">{t.cislo}. <span className="text-slate-500 font-normal">{skKratko(t.od)}–{skKratko(t.do)}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-300">{t.prijmy ? `+${eur(t.prijmy)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-300">{t.vydavky ? `−${eur(t.vydavky)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-rose-300/80">{t.pravidelne ? `−${eur(t.pravidelne)}` : '—'}</td>
                      <td className={`px-3 py-2 text-right font-mono font-bold ${t.stav < 0 ? 'text-rose-400' : 'text-white'}`}>{eur(t.stav)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900/70 font-bold text-slate-200">
                  <tr><td className="px-3 py-2">Spolu</td><td className="px-3 py-2 text-right font-mono text-emerald-300">+{eur(spoluPrijmy)}</td><td className="px-3 py-2 text-right font-mono text-rose-300" colSpan={2}>−{eur(spoluVydavky)}</td><td className="px-3 py-2 text-right font-mono">{eur(spoluPrijmy - spoluVydavky)}</td></tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] text-slate-500">Neuhradené vydané faktúry: {neuhradeneVydane.length} ({eur(neuhradeneVydane.reduce((s, i) => s + i.total, 0))}) · Neuhradené prijaté faktúry: {neuhradenePrijate.length} ({eur(neuhradenePrijate.reduce((s, f) => s + Number(f.suma_celkom), 0))}). Prijaté faktúry bez dátumu splatnosti sa počítajú v 1. týždni.</p>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Faktúry po splatnosti ({poSplatnosti.length}{poSplatnosti.length > 0 && ` · ${eur(sumaPoSplatnosti)}`})</h3>
        </div>
        {poSplatnosti.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs font-bold rounded-xl p-3">Žiadne vydané faktúry po splatnosti.</div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
            {poSplatnosti.map((inv) => {
              const email = emailZakaznika(inv.customerName);
              const text = textUpomienky(inv, inv.dni, companySettings);
              const stupen = inv.dni > 30 ? 3 : inv.dni > 14 ? 2 : 1;
              const predmet = `${stupen === 3 ? 'Posledná výzva na úhradu' : stupen === 2 ? 'Upomienka' : 'Pripomienka'} – faktúra ${inv.invoiceNumber}`;
              return (
                <div key={inv.id} className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-indigo-400">{inv.invoiceNumber}</span>
                    <span className="font-bold text-white">{inv.customerName}</span>
                    <span className="text-slate-400">splatnosť {skDatum(inv.dueDate)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stupen === 3 ? 'bg-rose-950/60 text-rose-300' : stupen === 2 ? 'bg-amber-950/60 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>{inv.dni} {inv.dni === 1 ? 'deň' : inv.dni < 5 ? 'dni' : 'dní'} po splatnosti</span>
                    <span className="ml-auto font-mono font-bold text-white">{eur(inv.total)}</span>
                    <button onClick={() => setOtvorena(otvorena === inv.id ? null : inv.id)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg">{otvorena === inv.id ? 'Skryť text' : 'Upomienka'}</button>
                  </div>
                  {otvorena === inv.id && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] text-slate-500">Predmet: <b className="text-slate-300">{predmet}</b>{email ? <> · E-mail zákazníka: <b className="text-slate-300">{email}</b></> : ' · E-mail zákazníka nie je v evidencii'}</p>
                      <pre className="whitespace-pre-wrap text-[11px] text-slate-300 font-sans leading-relaxed">{text}</pre>
                      <div className="flex gap-2">
                        <button onClick={() => kopiruj(text)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Skopírovať text</button>
                        {email && <a href={`mailto:${email}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(text)}`} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Otvoriť e-mail</a>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <UpomienkySekcia supabase={supabase} nazvyZakaznikovPoSplatnosti={poSplatnosti.map((i) => i.customerName).filter(Boolean)} triggerNotification={triggerNotification} />
    </div>
  );
}
