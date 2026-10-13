import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Copy, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

// MESACNY REPORT PRE MAJITELA: trzby, naklady, rozdiel, porovnanie s minulym mesiacom, najvacsi zakaznici a dodavatelia,
// naklady podla kategorii, pohladavky/zavazky. Cisla su z faktur v ERP (bez DPH) — NIE su uctovnictvo (bez miezd, odpisov, casoveho rozlisenia).

const SK_MESIACE = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const eur = (n) => `${r2(n).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const predosliMesiac = (m) => { const [r, mm] = m.split('-').map(Number); const d = new Date(r, mm - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const aktualnyPredosly = () => predosliMesiac(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
const mesiacNazov = (m) => { const [r, mm] = m.split('-'); return `${SK_MESIACE[Number(mm) - 1]} ${r}`; };
const zmena = (teraz, predtym) => (predtym > 0 ? ((teraz - predtym) / predtym) * 100 : null);

function Zmena({ pct, dobreAkRastie = true }) {
  if (pct == null) return <span className="text-[10px] text-slate-500">bez porovnania</span>;
  const rastie = pct >= 0;
  const dobre = rastie === dobreAkRastie;
  return <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${dobre ? 'text-emerald-400' : 'text-rose-400'}`}>{rastie ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{rastie ? '+' : ''}{pct.toFixed(0)} % oproti minulému mesiacu</span>;
}
function Karta({ nadpis, hodnota, cls = 'text-white', children }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{nadpis}</p>
      <p className={`text-lg font-bold ${cls}`}>{hodnota}</p>
      {children}
    </div>
  );
}
function Rebricek({ nadpis, polozky, farba = 'bg-indigo-500' }) {
  const max = Math.max(1, ...polozky.map((p) => p.hodnota));
  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-white">{nadpis}</p>
      {polozky.length === 0 && <p className="text-[11px] text-slate-500 italic">Žiadne údaje.</p>}
      {polozky.map((p) => (
        <div key={p.nazov}>
          <div className="flex justify-between text-[11px]"><span className="text-slate-300 truncate pr-2">{p.nazov}</span><span className="font-mono text-slate-200 shrink-0">{eur(p.hodnota)}</span></div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${farba}`} style={{ width: `${(p.hodnota / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function MesacnyReportTab({ supabase, invoices = [], triggerNotification = () => {} }) {
  const [mesiac, setMesiac] = useState(aktualnyPredosly());
  const [prijate, setPrijate] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const { data, error } = await supabase.from('prijate_faktury').select('*');
    if (error) { setChyba(error.message.includes('prijate_faktury') ? 'Tabuľka prijatých faktúr ešte neexistuje (spusti migration_prijate_faktury.sql) — náklady budú nulové.' : error.message); setPrijate([]); }
    else { setChyba(''); setPrijate(data || []); }
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const vypocet = useMemo(() => {
    const dnes = new Date().toISOString().slice(0, 10);
    const dataZa = (m) => {
      const vyd = invoices.filter((i) => String(i.issueDate || '').slice(0, 7) === m);
      const prij = prijate.filter((f) => (f.stav === 'schvalena' || f.stav === 'uhradena') && String(f.datum_vystavenia || f.datum_dodania || f.created_at || '').slice(0, 7) === m);
      const trzby = vyd.reduce((s, i) => s + (i.subtotal || 0), 0);
      const naklady = prij.reduce((s, f) => s + (Number(f.zaklad_dane ?? f.suma_celkom) || 0) * (f.druh === 'dobropis' && Number(f.zaklad_dane ?? f.suma_celkom) > 0 ? -1 : 1), 0);
      return { vyd, prij, trzby, naklady, dphVystup: vyd.reduce((s, i) => s + (i.vatTotal || 0), 0), dphVstup: prij.reduce((s, f) => s + (Number(f.dph_suma) || 0), 0) };
    };
    const teraz = dataZa(mesiac), predtym = dataZa(predosliMesiac(mesiac));
    const sumuj = (arr, kluc, hodn) => { const m = {}; arr.forEach((x) => { const k = kluc(x) || 'Neuvedené'; m[k] = (m[k] || 0) + hodn(x); }); return Object.entries(m).map(([nazov, hodnota]) => ({ nazov, hodnota: r2(hodnota) })).sort((a, b) => b.hodnota - a.hodnota); };
    const zakaznici = sumuj(teraz.vyd, (i) => i.customerName, (i) => i.subtotal || 0).slice(0, 5);
    const dodavatelia = sumuj(teraz.prij, (f) => f.dodavatel_nazov, (f) => Number(f.zaklad_dane ?? f.suma_celkom) || 0).slice(0, 5);
    const kategorie = sumuj(teraz.prij, (f) => f.kategoria, (f) => Number(f.zaklad_dane ?? f.suma_celkom) || 0).slice(0, 8);
    const pohladavkyPoSplatnosti = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.dueDate && i.dueDate < dnes);
    const pohladavkyVsetky = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
    const zavazky = prijate.filter((f) => f.stav === 'schvalena' || f.stav === 'na_schvalenie');
    const zavazkyPoSplatnosti = zavazky.filter((f) => f.datum_splatnosti && f.datum_splatnosti < dnes);
    return { teraz, predtym, zakaznici, dodavatelia, kategorie, pohladavkyPoSplatnosti, pohladavkyVsetky, zavazky, zavazkyPoSplatnosti };
  }, [invoices, prijate, mesiac]);

  const { teraz, predtym } = vypocet;
  const rozdiel = teraz.trzby - teraz.naklady;
  const rozdielPred = predtym.trzby - predtym.naklady;
  const sumaPohl = vypocet.pohladavkyVsetky.reduce((s, i) => s + (i.total || 0), 0);
  const sumaPohlPo = vypocet.pohladavkyPoSplatnosti.reduce((s, i) => s + (i.total || 0), 0);
  const sumaZav = vypocet.zavazky.reduce((s, f) => s + (Number(f.suma_celkom) || 0), 0);

  const textReportu = () => [
    `Mesačný report – ${mesiacNazov(mesiac)}`,
    '',
    `Tržby (vydané faktúry, bez DPH): ${eur(teraz.trzby)} (${teraz.vyd.length} faktúr)${predtym.trzby > 0 ? `, minulý mesiac ${eur(predtym.trzby)}` : ''}`,
    `Náklady (prijaté faktúry, bez DPH): ${eur(teraz.naklady)} (${teraz.prij.length} faktúr)${predtym.naklady > 0 ? `, minulý mesiac ${eur(predtym.naklady)}` : ''}`,
    `Rozdiel (bez miezd a odpisov): ${eur(rozdiel)}`,
    `Orientačná DPH na úhradu: ${eur(teraz.dphVystup - teraz.dphVstup)}`,
    '',
    `Pohľadávky neuhradené: ${eur(sumaPohl)} (z toho po splatnosti ${eur(sumaPohlPo)}, ${vypocet.pohladavkyPoSplatnosti.length} faktúr)`,
    `Záväzky voči dodávateľom: ${eur(sumaZav)} (po splatnosti ${vypocet.zavazkyPoSplatnosti.length} faktúr)`,
    '',
    'Najväčší zákazníci:', ...vypocet.zakaznici.map((z) => `  • ${z.nazov}: ${eur(z.hodnota)}`),
    'Najväčší dodávatelia:', ...vypocet.dodavatelia.map((z) => `  • ${z.nazov}: ${eur(z.hodnota)}`),
  ].join('\n');

  const kopiruj = async () => { try { await navigator.clipboard.writeText(textReportu()); triggerNotification('success', 'Report je skopírovaný.'); } catch { triggerNotification('error', 'Kopírovanie sa nepodarilo.'); } };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Prehľad mesiaca z faktúr v ERP (všetko bez DPH). Nie je to účtovníctvo — chýbajú mzdy, odpisy a časové rozlíšenie.</p>
      {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chyba}</div>}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Mesiac</label>
          <input type="month" value={mesiac} onChange={(e) => e.target.value && setMesiac(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={nacitaj} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Obnoviť</button>
        <div className="flex-1" />
        <button onClick={kopiruj} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Copy className="h-4 w-4" /> Skopírovať report</button>
      </div>

      {nacitava ? (
        <div className="text-slate-500 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Načítavam…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta nadpis="Tržby (bez DPH)" hodnota={eur(teraz.trzby)} cls="text-emerald-300"><p className="text-[10px] text-slate-500">{teraz.vyd.length} faktúr</p><Zmena pct={zmena(teraz.trzby, predtym.trzby)} /></Karta>
            <Karta nadpis="Náklady (bez DPH)" hodnota={eur(teraz.naklady)} cls="text-rose-300"><p className="text-[10px] text-slate-500">{teraz.prij.length} prijatých faktúr</p><Zmena pct={zmena(teraz.naklady, predtym.naklady)} dobreAkRastie={false} /></Karta>
            <Karta nadpis="Rozdiel" hodnota={eur(rozdiel)} cls={rozdiel >= 0 ? 'text-white' : 'text-rose-400'}><p className="text-[10px] text-slate-500">bez miezd a odpisov</p><Zmena pct={zmena(rozdiel, rozdielPred)} /></Karta>
            <Karta nadpis="Orientačná DPH na úhradu" hodnota={eur(teraz.dphVystup - teraz.dphVstup)} cls="text-sky-300"><p className="text-[10px] text-slate-500">výstup {eur(teraz.dphVystup)} − vstup {eur(teraz.dphVstup)}</p></Karta>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta nadpis="Neuhradené pohľadávky" hodnota={eur(sumaPohl)}><p className="text-[10px] text-slate-500">{vypocet.pohladavkyVsetky.length} faktúr</p></Karta>
            <Karta nadpis="…z toho po splatnosti" hodnota={eur(sumaPohlPo)} cls={sumaPohlPo > 0 ? 'text-amber-300' : 'text-white'}><p className="text-[10px] text-slate-500">{vypocet.pohladavkyPoSplatnosti.length} faktúr (záložka Cash flow a upomienky)</p></Karta>
            <Karta nadpis="Záväzky voči dodávateľom" hodnota={eur(sumaZav)}><p className="text-[10px] text-slate-500">{vypocet.zavazky.length} neuhradených faktúr</p></Karta>
            <Karta nadpis="…z toho po splatnosti" hodnota={`${vypocet.zavazkyPoSplatnosti.length} ks`} cls={vypocet.zavazkyPoSplatnosti.length > 0 ? 'text-amber-300' : 'text-white'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            <Rebricek nadpis="Najväčší zákazníci" polozky={vypocet.zakaznici} farba="bg-emerald-500" />
            <Rebricek nadpis="Najväčší dodávatelia" polozky={vypocet.dodavatelia} farba="bg-rose-500" />
            <Rebricek nadpis="Náklady podľa kategórie" polozky={vypocet.kategorie} farba="bg-indigo-500" />
          </div>
        </>
      )}
    </div>
  );
}
