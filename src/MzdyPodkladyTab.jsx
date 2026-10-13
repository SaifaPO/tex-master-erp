import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

// PODKLADY PRE MZDY: z dochadzky (attendance_records) spocita za mesiac odpracovane dni a hodiny, dovolenku, PN, OCR, navstevy lekara.
// Majitel doplni odmeny / zrazky / zalohy / poznamku (ukladaju sa do mzdy_podklady) a stiahne jeden Excel pre mzdovu uctovnicku.
// Ide o PODKLAD — vyuctovanie mzdy, odvody a dane robi mzdova uctovnicka.

const SK_MESIACE = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const ABSENCIE = { dovolenka: 'Dovolenka', pn: 'PN', ocr: 'OČR', lekar: 'Lekár' };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const eur = (n) => (n == null ? '—' : `${Number(n).toFixed(2)} €`);
const cislo = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isNaN(n) ? 0 : n; };

const predosliMesiac = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const mesiacNazov = (m) => { const [r, mm] = m.split('-'); return `${SK_MESIACE[Number(mm) - 1]} ${r}`; };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Velka noc (anonymny gregorianský algoritmus) — kvoli Velkemu piatku a Velkonocnemu pondelku
function velkaNoc(rok) {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesiac = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(rok, mesiac - 1, den);
}
function sviatkySK(rok) {
  const pevne = ['01-01', '01-06', '05-01', '05-08', '07-05', '08-29', '09-01', '09-15', '11-01', '11-17', '12-24', '12-25', '12-26'].map((x) => `${rok}-${x}`);
  const vn = velkaNoc(rok);
  const piatok = new Date(vn); piatok.setDate(vn.getDate() - 2);
  const pondelok = new Date(vn); pondelok.setDate(vn.getDate() + 1);
  return new Set([...pevne, ymd(piatok), ymd(pondelok)]);
}
function pracovneDni(mesiac) {
  const [r, m] = mesiac.split('-').map(Number);
  const sviatky = sviatkySK(r);
  let pocet = 0; const sviatkyVMesiaci = [];
  for (let d = new Date(r, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    const den = d.getDay();
    if (den === 0 || den === 6) continue;
    if (sviatky.has(ymd(d))) { sviatkyVMesiaci.push(ymd(d)); continue; }
    pocet++;
  }
  return { pocet, sviatkyVMesiaci };
}
const naMinuty = (t) => { const m = /(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hodiny = (zaciatok, koniec) => {
  const a = naMinuty(zaciatok), b = naMinuty(koniec);
  if (a == null || b == null || b < a) return null;
  return (b - a) / 60;
};
const dalsiMesiac = (m) => { const [r, mm] = m.split('-').map(Number); const d = new Date(r, mm, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function MzdyPodkladyTab({ supabase, employees = [], currentUser, triggerNotification = () => {} }) {
  const [mesiac, setMesiac] = useState(predosliMesiac());
  const [zaznamy, setZaznamy] = useState([]);
  const [rucne, setRucne] = useState({}); // employee_id -> { odmena, zrazka, zaloha, poznamka }
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');
  const [chybaRucne, setChybaRucne] = useState('');

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const od = `${mesiac}-01`, doExkl = dalsiMesiac(mesiac);
    const vsetky = [];
    let chybaDochadzky = '';
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('attendance_records').select('*').gte('record_date', od).lt('record_date', doExkl).order('record_date', { ascending: true }).range(from, from + 999);
      if (error) { chybaDochadzky = error.message; break; }
      vsetky.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setChyba(chybaDochadzky);
    setZaznamy(chybaDochadzky ? [] : vsetky);

    const { data: r, error: e2 } = await supabase.from('mzdy_podklady').select('*').eq('mesiac', mesiac);
    if (e2) { setChybaRucne(e2.message.includes('mzdy_podklady') ? 'Tabuľka na ručné údaje (odmeny, zrážky…) ešte neexistuje — spusti v Supabase SQL migráciu migration_mzdy_podklady.sql. Dochádzka funguje aj bez nej.' : e2.message); setRucne({}); }
    else { setChybaRucne(''); setRucne(Object.fromEntries((r || []).map((x) => [String(x.employee_id), { odmena: x.odmena || 0, zrazka: x.zrazka || 0, zaloha: x.zaloha || 0, poznamka: x.poznamka || '' }]))); }
    setNacitava(false);
  }, [supabase, mesiac]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const kalendar = useMemo(() => pracovneDni(mesiac), [mesiac]);

  const riadky = useMemo(() => {
    const poZam = {};
    const nepriradene = [];
    zaznamy.forEach((z) => {
      const id = z.employee_id == null ? null : String(z.employee_id);
      if (!id || !employees.some((e) => String(e.id) === id)) { nepriradene.push(z); return; }
      (poZam[id] = poZam[id] || []).push(z);
    });
    const list = employees.map((e) => {
      const rec = poZam[String(e.id)] || [];
      const pritomneDni = new Set(), absDni = { dovolenka: new Set(), pn: new Set(), ocr: new Set(), lekar: new Set() };
      let hod = 0, bezOdchodu = 0, hodLekar = 0;
      rec.forEach((z) => {
        const st = String(z.status || '').toLowerCase();
        if (absDni[st]) {
          absDni[st].add(z.record_date);
          const h = hodiny(z.time_in, z.time_out); if (st === 'lekar' && h != null) hodLekar += h;
          return;
        }
        pritomneDni.add(z.record_date);
        const h = hodiny(z.time_in, z.time_out);
        if (h != null) hod += h; else bezOdchodu++;
      });
      const novy = !!e.entryDate && String(e.entryDate).slice(0, 7) === mesiac;
      return {
        id: String(e.id), meno: `${e.firstName} ${e.lastName}`.trim(), firma: e.company || '', pozicia: e.position || '',
        mzdaHruba: e.mzdaHruba, socialne: e.socialnePoistenie, zdravotne: e.zdravotnePoistenie,
        nastup: e.entryDate || '', novy,
        dni: pritomneDni.size, hodiny: r2(hod), dovolenka: absDni.dovolenka.size, pn: absDni.pn.size, ocr: absDni.ocr.size, lekar: absDni.lekar.size, hodLekar: r2(hodLekar),
        bezOdchodu, pocetZaznamov: rec.length,
        zaznamy: rec,
      };
    });
    return { list, nepriradene };
  }, [zaznamy, employees, mesiac]);

  const ulozRucne = async (id, zmena) => {
    const nove = { ...(rucne[id] || { odmena: 0, zrazka: 0, zaloha: 0, poznamka: '' }), ...zmena };
    setRucne((p) => ({ ...p, [id]: nove }));
    const { error } = await supabase.from('mzdy_podklady').upsert({
      mesiac, employee_id: id, odmena: cislo(nove.odmena), zrazka: cislo(nove.zrazka), zaloha: cislo(nove.zaloha), poznamka: nove.poznamka || null,
      updated_at: new Date().toISOString(), updated_by: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : null,
    }, { onConflict: 'mesiac,employee_id' });
    if (error) triggerNotification('error', 'Uloženie zlyhalo: ' + error.message);
  };

  const upozornenia = useMemo(() => {
    const u = [];
    const bez = riadky.list.filter((r) => r.pocetZaznamov === 0 && !r.novy);
    if (bez.length) u.push(`Bez dochádzky za celý mesiac: ${bez.map((r) => r.meno).join(', ')} — skontroluj, či naozaj nepracovali (alebo chýba zápis).`);
    const bezOd = riadky.list.filter((r) => r.bezOdchodu > 0);
    if (bezOd.length) u.push(`Chýba čas odchodu: ${bezOd.map((r) => `${r.meno} (${r.bezOdchodu}×)`).join(', ')} — hodiny sa im za tie dni nepočítajú.`);
    if (riadky.nepriradene.length) u.push(`${riadky.nepriradene.length} záznamov dochádzky nie je priradených k zamestnancovi (${[...new Set(riadky.nepriradene.map((z) => z.employee_name_raw).filter(Boolean))].slice(0, 5).join(', ') || 'bez mena'}).`);
    const bezMzdy = riadky.list.filter((r) => r.pocetZaznamov > 0 && r.mzdaHruba == null);
    if (bezMzdy.length) u.push(`Bez zadanej hrubej mzdy v profile: ${bezMzdy.map((r) => r.meno).join(', ')}.`);
    return u;
  }, [riadky]);

  const stiahniExcel = () => {
    const wb = XLSX.utils.book_new();
    const sum = XLSX.utils.json_to_sheet([
      { Položka: 'Obdobie', Hodnota: mesiacNazov(mesiac) },
      { Položka: 'Pracovné dni v mesiaci (bez sviatkov)', Hodnota: kalendar.pocet },
      { Položka: 'Sviatky v mesiaci', Hodnota: kalendar.sviatkyVMesiaci.join(', ') || '—' },
      { Položka: 'Vygenerované', Hodnota: new Date().toLocaleString('sk-SK') },
      { Položka: 'Poznámka', Hodnota: 'Podklad z dochádzky ERP + ručne zadané odmeny/zrážky/zálohy. Vyúčtovanie mzdy, odvody a dane robí mzdová účtovníčka. Hodiny sa počítajú len z dní, kde je príchod aj odchod.' },
      ...upozornenia.map((t, i) => ({ Položka: `Upozornenie ${i + 1}`, Hodnota: t })),
    ]);
    XLSX.utils.book_append_sheet(wb, sum, 'Súhrn');
    const hlavny = riadky.list.map((r) => {
      const m = rucne[r.id] || {};
      return {
        Zamestnanec: r.meno, Firma: r.firma, Pozícia: r.pozicia, 'Dátum nástupu': r.nastup, 'Nový v mesiaci': r.novy ? 'ÁNO' : '',
        'Hrubá mzda (profil) €': r.mzdaHruba ?? '', 'Sociálne poistenie (profil)': r.socialne ?? '', 'Zdravotné poistenie (profil)': r.zdravotne ?? '',
        'Odpracované dni': r.dni, 'Odpracované hodiny': r.hodiny, 'Dovolenka (dni)': r.dovolenka, 'PN (dni)': r.pn, 'OČR (dni)': r.ocr, 'Lekár (dni)': r.lekar,
        'Pracovné dni v mesiaci': kalendar.pocet,
        'Odmena €': cislo(m.odmena), 'Zrážka €': cislo(m.zrazka), 'Záloha €': cislo(m.zaloha), Poznámka: m.poznamka || '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hlavny.length ? hlavny : [{ Poznámka: 'Žiadni zamestnanci.' }]), 'Mzdy – podklad');
    const detail = riadky.list.flatMap((r) => r.zaznamy.map((z) => ({
      Zamestnanec: r.meno, Dátum: z.record_date, Stav: ABSENCIE[String(z.status || '').toLowerCase()] || (z.status === 'odchod' ? 'Odišiel' : 'Prítomný'),
      Príchod: z.time_in || '', Odchod: z.time_out || '', 'Hodiny': hodiny(z.time_in, z.time_out) != null ? r2(hodiny(z.time_in, z.time_out)) : '',
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail.length ? detail : [{ Poznámka: 'Žiadna dochádzka.' }]), 'Dochádzka – detail');
    XLSX.writeFile(wb, `mzdy_podklady_${mesiac}.xlsx`);
  };

  const sumaHodin = riadky.list.reduce((s, r) => s + r.hodiny, 0);
  const inpCls = 'w-20 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-right';

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Dochádzka za mesiac sa spočíta automaticky. Doplň odmeny, zrážky alebo zálohy a stiahni jeden Excel pre mzdovú účtovníčku. Výpočet mzdy a odvodov robí ona.</p>

      {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">Dochádzku sa nepodarilo načítať: {chyba}</div>}
      {chybaRucne && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chybaRucne}</div>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Mesiac</label>
          <input type="month" value={mesiac} onChange={(e) => e.target.value && setMesiac(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={nacitaj} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Obnoviť</button>
        <div className="text-[11px] text-slate-400 pb-2">Pracovné dni v mesiaci: <b className="text-white">{kalendar.pocet}</b>{kalendar.sviatkyVMesiaci.length > 0 && <> · sviatky: {kalendar.sviatkyVMesiaci.map((d) => d.slice(8) + '.').join(', ')}</>}</div>
        <div className="flex-1" />
        <button onClick={stiahniExcel} disabled={nacitava} className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Download className="h-4 w-4" /> Stiahnuť Excel pre mzdy</button>
      </div>

      {nacitava ? (
        <div className="text-slate-500 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Načítavam…</div>
      ) : (
        <>
          <div className={`rounded-xl border p-3 text-xs ${upozornenia.length === 0 ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300 font-bold' : 'bg-amber-950/30 border-amber-800/50 text-amber-200'}`}>
            {upozornenia.length === 0 ? (<span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Dochádzka za {mesiacNazov(mesiac)} vyzerá kompletná.</span>) : (
              <ul className="space-y-1">{upozornenia.map((t, i) => (<li key={i} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" /> <span>{t}</span></li>))}</ul>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-3">Zamestnanec</th><th className="px-2 py-3 text-right">Dni</th><th className="px-2 py-3 text-right">Hodiny</th>
                  <th className="px-2 py-3 text-right">Dovolenka</th><th className="px-2 py-3 text-right">PN</th><th className="px-2 py-3 text-right">OČR</th><th className="px-2 py-3 text-right">Lekár</th>
                  <th className="px-2 py-3 text-right">Hrubá mzda</th><th className="px-2 py-3 text-right">Odmena €</th><th className="px-2 py-3 text-right">Zrážka €</th><th className="px-2 py-3 text-right">Záloha €</th><th className="px-2 py-3">Poznámka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {riadky.list.length === 0 && (<tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500 italic">Žiadni zamestnanci.</td></tr>)}
                {riadky.list.map((r) => {
                  const m = rucne[r.id] || {};
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-2"><span className="font-bold text-white">{r.meno}</span>{r.novy && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-950/60 text-sky-300">nový</span>}<div className="text-[10px] text-slate-500">{r.firma || r.pozicia}</div></td>
                      <td className="px-2 py-2 text-right font-mono">{r.dni}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.hodiny.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.dovolenka || '—'}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.pn || '—'}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.ocr || '—'}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.lekar || '—'}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-400">{eur(r.mzdaHruba)}</td>
                      <td className="px-2 py-2 text-right"><input defaultValue={m.odmena || ''} key={`o${mesiac}${r.id}${m.odmena}`} onBlur={(e) => cislo(e.target.value) !== cislo(m.odmena) && ulozRucne(r.id, { odmena: cislo(e.target.value) })} className={inpCls} inputMode="decimal" placeholder="0" /></td>
                      <td className="px-2 py-2 text-right"><input defaultValue={m.zrazka || ''} key={`z${mesiac}${r.id}${m.zrazka}`} onBlur={(e) => cislo(e.target.value) !== cislo(m.zrazka) && ulozRucne(r.id, { zrazka: cislo(e.target.value) })} className={inpCls} inputMode="decimal" placeholder="0" /></td>
                      <td className="px-2 py-2 text-right"><input defaultValue={m.zaloha || ''} key={`a${mesiac}${r.id}${m.zaloha}`} onBlur={(e) => cislo(e.target.value) !== cislo(m.zaloha) && ulozRucne(r.id, { zaloha: cislo(e.target.value) })} className={inpCls} inputMode="decimal" placeholder="0" /></td>
                      <td className="px-2 py-2"><input defaultValue={m.poznamka || ''} key={`p${mesiac}${r.id}${m.poznamka}`} onBlur={(e) => e.target.value !== (m.poznamka || '') && ulozRucne(r.id, { poznamka: e.target.value })} className="w-40 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-white" placeholder="napr. nový nástup 15.9." /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-900/70 text-slate-300 font-bold">
                <tr><td className="px-3 py-2">Spolu</td><td className="px-2 py-2 text-right font-mono">{riadky.list.reduce((s, r) => s + r.dni, 0)}</td><td className="px-2 py-2 text-right font-mono">{sumaHodin.toFixed(1)}</td><td colSpan={9} /></tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
