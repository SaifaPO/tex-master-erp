import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2 } from 'lucide-react';

// VÝKAZY DPH — PODKLAD PRE ÚČTOVNÍČKU: prehľad DPH na výstupe a vstupe za mesiac / štvrťrok, podklad ku kontrolnému výkazu (KV DPH)
// a súhrnnému výkazu (dodania tovaru do EÚ). Z vydaných faktúr (bez zálohových) a schválených prijatých faktúr.
// Toto NIE JE elektronické podanie na finančnú správu — účtovníčka údaje skontroluje a podá výkazy vo svojom programe / cez portál FS.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const eur = (n) => `${r2(n).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const skDatum = (s) => (s ? `${String(s).slice(8, 10)}.${String(s).slice(5, 7)}.${String(s).slice(0, 4)}` : '');
const NAZVY_MESIACOV = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];

// DPH po sadzbách z položiek faktúry
function rozpadPoSadzbach(inv) {
  const m = new Map();
  (inv.items || []).forEach((it) => {
    const sadzba = Number(it.vatRate) || 0;
    const zaklad = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
    const g = m.get(sadzba) || { sadzba, zaklad: 0, dph: 0 };
    g.zaklad += zaklad; g.dph += zaklad * sadzba / 100; m.set(sadzba, g);
  });
  return [...m.values()].map((g) => ({ ...g, zaklad: r2(g.zaklad), dph: r2(g.dph) }));
}

const datumPlnenia = (inv) => inv.deliveryDate || inv.issueDate || '';

export default function VykazyDphTab({ supabase, invoices = [], companySettings = {}, triggerNotification = () => {} }) {
  const dnes = new Date();
  const [rok, setRok] = useState(dnes.getFullYear());
  const [typ, setTyp] = useState('mesiac'); // mesiac | stvrtrok
  const [cislo, setCislo] = useState(dnes.getMonth() === 0 ? 12 : dnes.getMonth()); // predchádzajúci mesiac
  const [prijate, setPrijate] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');

  useEffect(() => { if (dnes.getMonth() === 0) setRok(dnes.getFullYear() - 1); /* eslint-disable-next-line */ }, []);

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const { data, error } = await supabase.from('prijate_faktury').select('*').order('datum_vystavenia', { ascending: true });
    if (error) { setChyba(error.message.includes('prijate_faktury') ? 'Tabuľka prijatých faktúr ešte neexistuje — DPH na vstupe sa nezapočíta.' : error.message); setPrijate([]); }
    else { setChyba(''); setPrijate(data || []); }
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const rozsah = useMemo(() => {
    const od = typ === 'mesiac' ? cislo : (cislo - 1) * 3 + 1;
    const doM = typ === 'mesiac' ? cislo : cislo * 3;
    const pad = (n) => String(n).padStart(2, '0');
    const posledny = new Date(rok, doM, 0).getDate();
    return { od: `${rok}-${pad(od)}-01`, do: `${rok}-${pad(doM)}-${pad(posledny)}`, popis: typ === 'mesiac' ? `${NAZVY_MESIACOV[cislo - 1]} ${rok}` : `${cislo}. štvrťrok ${rok}` };
  }, [rok, typ, cislo]);

  const dat = useMemo(() => {
    const vObdobi = (d) => !!d && d >= rozsah.od && d <= rozsah.do;
    const vydane = invoices.filter((i) => vObdobi(datumPlnenia(i)));
    const tuzemsko = []; // všetky doklady s DPH v tuzemsku (SK platca, SK neplatca, EÚ neplatca)
    const kvA1 = [], kvC1 = [], kvD = [], eu = [], vyvoz = [];
    vydane.forEach((inv) => {
      const t = inv.customerType || 'sk_platca';
      const poSadzbach = rozpadPoSadzbach(inv);
      const dobropis = inv.docType === 'dobropis';
      const riadok = { inv, poSadzbach };
      if (t === 'eu_platca') { eu.push(riadok); return; }
      if (t === 'tretia_krajina') { vyvoz.push(riadok); return; }
      tuzemsko.push(riadok);
      if (t === 'sk_platca') (dobropis ? kvC1 : kvA1).push(riadok); else kvD.push(riadok);
    });
    // DPH na výstupe po sadzbách
    const vystup = new Map();
    tuzemsko.forEach(({ poSadzbach }) => poSadzbach.forEach((g) => { const x = vystup.get(g.sadzba) || { sadzba: g.sadzba, zaklad: 0, dph: 0 }; x.zaklad += g.zaklad; x.dph += g.dph; vystup.set(g.sadzba, x); }));
    const vystupPole = [...vystup.values()].sort((a, b) => b.sadzba - a.sadzba).map((x) => ({ ...x, zaklad: r2(x.zaklad), dph: r2(x.dph) }));

    // Prijaté faktúry (schválené / uhradené) s DPH — podľa dátumu dodania, inak vystavenia
    const prijateObdobie = prijate.filter((f) => (f.stav === 'schvalena' || f.stav === 'uhradena') && vObdobi(f.datum_dodania || f.datum_vystavenia));
    const vstup = new Map();
    const prijateRiadky = prijateObdobie.map((f) => {
      let sadzby = Array.isArray(f.dph_sadzby) ? f.dph_sadzby.map((s) => ({ sadzba: Number(s.sadzba) || 0, zaklad: Number(s.zaklad) || 0, dph: Number(s.dph) || 0 })) : [];
      if (sadzby.length === 0 && (f.zaklad_dane != null || f.dph_suma != null)) sadzby = [{ sadzba: f.zaklad_dane ? Math.round((Number(f.dph_suma) || 0) / Number(f.zaklad_dane) * 100) : 0, zaklad: Number(f.zaklad_dane) || 0, dph: Number(f.dph_suma) || 0 }];
      const standard = (f.rezim_dph || 'standard') === 'standard';
      if (standard) sadzby.forEach((s) => { const x = vstup.get(s.sadzba) || { sadzba: s.sadzba, zaklad: 0, dph: 0 }; x.zaklad += s.zaklad; x.dph += s.dph; vstup.set(s.sadzba, x); });
      return { f, sadzby, standard };
    });
    const vstupPole = [...vstup.values()].sort((a, b) => b.sadzba - a.sadzba).map((x) => ({ ...x, zaklad: r2(x.zaklad), dph: r2(x.dph) }));

    // Súhrnný výkaz: dodanie tovaru do EÚ po odberateľoch (IČ DPH)
    const sv = new Map();
    eu.forEach(({ inv }) => {
      const kluc = String(inv.customerIcDph || inv.customerName).replace(/\s/g, '').toUpperCase();
      const x = sv.get(kluc) || { icDph: kluc, nazov: inv.customerName, krajina: kluc.slice(0, 2), cislo: kluc.slice(2), hodnota: 0 };
      x.hodnota += inv.subtotal; sv.set(kluc, x);
    });
    const svPole = [...sv.values()].map((x) => ({ ...x, hodnota: r2(x.hodnota) }));
    return { vydane, tuzemsko, kvA1, kvC1, kvD, eu, vyvoz, vystupPole, prijateRiadky, vstupPole, svPole };
  }, [invoices, prijate, rozsah]);

  const sucVystup = r2(dat.vystupPole.reduce((s, x) => s + x.dph, 0));
  const sucVstup = r2(dat.vstupPole.reduce((s, x) => s + x.dph, 0));
  const vysledok = r2(sucVystup - sucVstup);

  const exportuj = () => {
    const wb = XLSX.utils.book_new();
    const pridaj = (nazov, riadky) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riadky.length ? riadky : [{ Poznámka: 'Žiadne záznamy za toto obdobie.' }]), nazov);
    pridaj('Prehľad DPH', [
      ...dat.vystupPole.map((x) => ({ Oddiel: 'DPH na výstupe (tuzemsko)', Sadzba: `${x.sadzba} %`, 'Základ dane': x.zaklad, 'Daň': x.dph })),
      ...dat.vstupPole.map((x) => ({ Oddiel: 'DPH na vstupe (prijaté faktúry)', Sadzba: `${x.sadzba} %`, 'Základ dane': x.zaklad, 'Daň': x.dph })),
      { Oddiel: 'Dodanie tovaru do EÚ (oslobodené)', Sadzba: '0 %', 'Základ dane': r2(dat.eu.reduce((s, x) => s + x.inv.subtotal, 0)), 'Daň': 0 },
      { Oddiel: 'Vývoz tovaru (oslobodené)', Sadzba: '0 %', 'Základ dane': r2(dat.vyvoz.reduce((s, x) => s + x.inv.subtotal, 0)), 'Daň': 0 },
      { Oddiel: 'Daň na výstupe spolu', Sadzba: '', 'Základ dane': '', 'Daň': sucVystup },
      { Oddiel: 'Odpočítateľná daň spolu', Sadzba: '', 'Základ dane': '', 'Daň': sucVstup },
      { Oddiel: vysledok >= 0 ? 'Daňová povinnosť (orientačne)' : 'Nadmerný odpočet (orientačne)', Sadzba: '', 'Základ dane': '', 'Daň': vysledok },
    ]);
    const kvRiadok = (x) => {
      const o = { 'IČ DPH odberateľa': x.inv.customerIcDph, 'Odberateľ': x.inv.customerName, 'Číslo dokladu': x.inv.invoiceNumber, 'K faktúre': x.inv.relatedInvoiceNumber || '', 'Dátum dodania': skDatum(datumPlnenia(x.inv)) };
      x.poSadzbach.forEach((g) => { o[`Základ ${g.sadzba} %`] = g.zaklad; o[`Daň ${g.sadzba} %`] = g.dph; });
      return o;
    };
    pridaj('KV A.1 (odberateľ platiteľ)', dat.kvA1.map(kvRiadok));
    pridaj('KV C.1 (dobropisy k A.1)', dat.kvC1.map(kvRiadok));
    pridaj('KV D (neplatitelia, súhrn)', dat.kvD.map(kvRiadok));
    pridaj('KV B.2 (prijaté faktúry)', dat.prijateRiadky.map(({ f, sadzby, standard }) => ({
      'IČ DPH dodávateľa': f.dodavatel_ic_dph, Dodávateľ: f.dodavatel_nazov, 'Číslo faktúry': f.cislo_faktury, 'Dátum dodania': skDatum(f.datum_dodania || f.datum_vystavenia), Druh: f.druh, 'Režim DPH': f.rezim_dph,
      'Základ': r2(sadzby.reduce((s, x) => s + x.zaklad, 0)), 'Daň': r2(sadzby.reduce((s, x) => s + x.dph, 0)), 'Do odpočtu': standard ? 'áno' : 'nie — skontroluj režim',
    })));
    pridaj('Súhrnný výkaz (EÚ)', dat.svPole.map((x) => ({ 'Kód štátu': x.krajina, 'IČ DPH (bez kódu)': x.cislo, Odberateľ: x.nazov, 'Kód plnenia': 0, 'Hodnota dodania tovaru (EUR)': x.hodnota })));
    XLSX.writeFile(wb, `vykazy_dph_${rozsah.od.slice(0, 7)}_${typ === 'mesiac' ? 'M' : 'Q'}.xlsx`);
    triggerNotification('success', 'Podklady k výkazom DPH boli stiahnuté.');
  };

  const rokyMoznosti = [dnes.getFullYear() + 1, dnes.getFullYear(), dnes.getFullYear() - 1, dnes.getFullYear() - 2];
  const kvTabulka = (nadpis, polozky) => (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-slate-300">{nadpis} <span className="text-slate-500 font-normal">({polozky.length})</span></h4>
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
        <table className="w-full text-left text-[11px] text-slate-300">
          <thead className="bg-slate-900 text-slate-500 uppercase"><tr><th className="px-2 py-1.5">Doklad</th><th className="px-2 py-1.5">Odberateľ</th><th className="px-2 py-1.5">IČ DPH</th><th className="px-2 py-1.5">Dodanie</th><th className="px-2 py-1.5 text-right">Základ</th><th className="px-2 py-1.5 text-right">DPH</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {polozky.length === 0 && <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-600 italic">Žiadne záznamy.</td></tr>}
            {polozky.map((x) => (
              <tr key={x.inv.id}><td className="px-2 py-1.5 font-mono text-indigo-400">{x.inv.invoiceNumber}</td><td className="px-2 py-1.5">{x.inv.customerName}</td><td className="px-2 py-1.5">{x.inv.customerIcDph || '—'}</td><td className="px-2 py-1.5">{skDatum(datumPlnenia(x.inv))}</td><td className="px-2 py-1.5 text-right">{eur(x.inv.subtotal)}</td><td className="px-2 py-1.5 text-right">{eur(x.inv.vatTotal)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Obdobie</label>
          <div className="flex gap-1.5">
            <select value={typ} onChange={(e) => { setTyp(e.target.value); setCislo(1); }} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"><option value="mesiac">Mesiac</option><option value="stvrtrok">Štvrťrok</option></select>
            <select value={cislo} onChange={(e) => setCislo(Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">
              {typ === 'mesiac' ? NAZVY_MESIACOV.map((n, i) => <option key={i} value={i + 1}>{n}</option>) : [1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}. štvrťrok</option>)}
            </select>
            <select value={rok} onChange={(e) => setRok(Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white">{rokyMoznosti.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </div>
        </div>
        <button onClick={exportuj} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Download className="h-4 w-4" /> Stiahnuť podklady (Excel)</button>
        {nacitava && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        <p className="text-[11px] text-slate-500 basis-full">{rozsah.popis}: {dat.vydane.length} vydaných dokladov, {dat.prijateRiadky.length} prijatých faktúr. Podklad pre účtovníčku — nejde o podanie na finančnú správu.</p>
        {companySettings.icDph ? null : <p className="text-[11px] text-amber-400 basis-full">Firma nemá v Nastaveniach vyplnené IČ DPH — ak ste platiteľ DPH, doplňte ho.</p>}
        {chyba && <p className="text-[11px] text-amber-400 basis-full">{chyba}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><p className="text-[11px] text-slate-500 uppercase">Daň na výstupe</p><p className="text-xl font-extrabold text-white">{eur(sucVystup)}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4"><p className="text-[11px] text-slate-500 uppercase">Odpočítateľná daň (vstup)</p><p className="text-xl font-extrabold text-white">{eur(sucVstup)}</p></div>
        <div className={`border rounded-xl p-4 ${vysledok >= 0 ? 'bg-amber-950/30 border-amber-800/50' : 'bg-emerald-950/30 border-emerald-800/50'}`}><p className="text-[11px] text-slate-400 uppercase">{vysledok >= 0 ? 'Daňová povinnosť (orientačne)' : 'Nadmerný odpočet (orientačne)'}</p><p className="text-xl font-extrabold text-white">{eur(Math.abs(vysledok))}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-300">DPH na výstupe (tuzemsko) po sadzbách</h4>
          {dat.vystupPole.length === 0 ? <p className="text-[11px] text-slate-600 italic">Žiadne tuzemské dodania.</p> : dat.vystupPole.map((x) => <div key={x.sadzba} className="flex justify-between text-xs text-slate-300"><span>{x.sadzba} % — základ {eur(x.zaklad)}</span><strong>{eur(x.dph)}</strong></div>)}
          <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800 pt-2"><span>Dodanie tovaru do EÚ (oslobodené)</span><strong>{eur(dat.eu.reduce((s, x) => s + x.inv.subtotal, 0))}</strong></div>
          <div className="flex justify-between text-xs text-slate-400"><span>Vývoz tovaru (oslobodené)</span><strong>{eur(dat.vyvoz.reduce((s, x) => s + x.inv.subtotal, 0))}</strong></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-300">DPH na vstupe (schválené prijaté faktúry) po sadzbách</h4>
          {dat.vstupPole.length === 0 ? <p className="text-[11px] text-slate-600 italic">Žiadne prijaté faktúry s DPH v tomto období.</p> : dat.vstupPole.map((x) => <div key={x.sadzba} className="flex justify-between text-xs text-slate-300"><span>{x.sadzba} % — základ {eur(x.zaklad)}</span><strong>{eur(x.dph)}</strong></div>)}
          {dat.prijateRiadky.some((x) => !x.standard) && <p className="text-[11px] text-amber-400">Niektoré prijaté faktúry majú iný režim DPH (prenos daňovej povinnosti, zahraničie…) — do odpočtu sa nezapočítali, skontroluj ich s účtovníčkou.</p>}
        </div>
      </div>

      <div className="space-y-4">
        {kvTabulka('Kontrolný výkaz — A.1 (dodania odberateľom, ktorí sú platitelia DPH)', dat.kvA1)}
        {kvTabulka('Kontrolný výkaz — C.1 (dobropisy k A.1)', dat.kvC1)}
        {kvTabulka('Kontrolný výkaz — oddiel D (dodania neplatiteľom — súhrnne)', dat.kvD)}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-slate-300">Súhrnný výkaz — dodanie tovaru do iného členského štátu <span className="text-slate-500 font-normal">({dat.svPole.length})</span></h4>
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-[11px] text-slate-300">
              <thead className="bg-slate-900 text-slate-500 uppercase"><tr><th className="px-2 py-1.5">Štát</th><th className="px-2 py-1.5">IČ DPH</th><th className="px-2 py-1.5">Odberateľ</th><th className="px-2 py-1.5">Kód plnenia</th><th className="px-2 py-1.5 text-right">Hodnota</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {dat.svPole.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-600 italic">Žiadne dodania do EÚ.</td></tr>}
                {dat.svPole.map((x) => <tr key={x.icDph}><td className="px-2 py-1.5">{x.krajina}</td><td className="px-2 py-1.5">{x.cislo}</td><td className="px-2 py-1.5">{x.nazov}</td><td className="px-2 py-1.5">0 (tovar)</td><td className="px-2 py-1.5 text-right">{eur(x.hodnota)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
