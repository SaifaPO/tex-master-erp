import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Loader2, FileText, Check, X, Trash2, AlertTriangle, ExternalLink, Banknote, Search, Camera, Sparkles, Link2 } from 'lucide-react';

// PRIJATE FAKTURY (od dodavatelov): nahraj PDF/foto -> AI (Edge Function parse-received-invoice) vycita udaje -> majitel skontroluje
// a schvali -> evidencia uhrad (rucne alebo parovanim s odchadzajucou platbou z banky). Uctovnicka tak dostane hotove,
// skontrolovane doklady. AI nic nezauctuje ani neplati — iba navrhuje, rozhoduje clovek.

const BUCKET = 'prijate-faktury';
const FIRMY = ['PBT', 'ATAK', 'ADY'];
const KATEGORIE = [
  'Materiál (látky, fólie, papier, atrament)', 'Tovar na predaj', 'Energie', 'Nájom', 'Služby (externé)', 'Doprava a kuriér',
  'Marketing a reklama', 'Softvér a IT', 'Telekomunikácie', 'Kancelária a drobný materiál', 'Údržba a opravy', 'Poistenie',
  'Pohonné hmoty a vozidlá', 'Leasing a splátky', 'Účtovné a právne služby', 'Dlhodobý majetok (stroj, zariadenie)', 'Ostatné',
];
const REZIMY_DPH = [
  { id: 'standard', label: 'Bežná faktúra s DPH' },
  { id: 'prenos_danovej_povinnosti', label: 'Prenos daňovej povinnosti (reverse charge)' },
  { id: 'oslobodene', label: 'Oslobodené od DPH' },
  { id: 'mimo_sk_bez_dph', label: 'Zahraničná / bez DPH' },
  { id: 'nejasne', label: 'Nejasné — overí účtovníčka' },
];
const STAVY = {
  spracovava: { label: 'Spracúva sa…', cls: 'bg-slate-800 text-slate-300' },
  na_schvalenie: { label: 'Na schválenie', cls: 'bg-amber-950/50 text-amber-300' },
  schvalena: { label: 'Schválená', cls: 'bg-sky-950/50 text-sky-300' },
  uhradena: { label: 'Uhradená', cls: 'bg-emerald-950/50 text-emerald-300' },
  zamietnuta: { label: 'Zamietnutá', cls: 'bg-rose-950/50 text-rose-300' },
};

const eur = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n).toFixed(2)} €`);
const dnes = () => new Date().toISOString().slice(0, 10);
const cislo = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isNaN(n) ? null : n; };
const normalizuj = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const dniDo = (datum) => (datum ? Math.round((new Date(datum + 'T00:00:00') - new Date(dnes() + 'T00:00:00')) / 86400000) : null);

// Kontrola pravidlami (okrem upozorneni z AI): co ma pred schvalenim este raz pozriet clovek / uctovnicka.
function vyhodnotKontrolu(f, ostatne) {
  const dovody = [];
  const rovnaky = (x) => (f.dodavatel_ico && x.dodavatel_ico === f.dodavatel_ico) || (f.dodavatel_nazov && normalizuj(x.dodavatel_nazov) === normalizuj(f.dodavatel_nazov));
  const odDodavatela = ostatne.filter((x) => x.id !== f.id && rovnaky(x) && x.stav !== 'zamietnuta');
  if (f.dodavatel_nazov && odDodavatela.length === 0) dovody.push('Nový dodávateľ (ešte sme od neho nemali doklad).');
  const duplikat = ostatne.find((x) => x.id !== f.id && x.stav !== 'zamietnuta' && rovnaky(x) && (
    (f.cislo_faktury && normalizuj(x.cislo_faktury) === normalizuj(f.cislo_faktury)) ||
    (f.suma_celkom != null && x.suma_celkom != null && Math.abs(x.suma_celkom - f.suma_celkom) < 0.005 && f.datum_vystavenia && x.datum_vystavenia === f.datum_vystavenia)
  ));
  if (duplikat) dovody.push(`Možná duplicita — podobný doklad už existuje (č. ${duplikat.cislo_faktury || '—'}, ${eur(duplikat.suma_celkom)}).`);
  if (f.dodavatel_krajina && f.dodavatel_krajina.toUpperCase() !== 'SK') dovody.push(`Zahraničný dodávateľ (${f.dodavatel_krajina.toUpperCase()}) — treba overiť režim DPH.`);
  if (f.druh === 'dobropis') dovody.push('Dobropis — skontroluje účtovníčka.');
  if (f.rezim_dph && f.rezim_dph !== 'standard') dovody.push('Neštandardný režim DPH.');
  if (f.suma_celkom == null) dovody.push('Chýba celková suma.');
  if (!f.datum_splatnosti) dovody.push('Chýba dátum splatnosti.');
  if (f.kategoria && f.kategoria.startsWith('Dlhodobý majetok')) dovody.push('Možný dlhodobý majetok — účtovníčka rozhodne o odpisoch.');
  const sumy = odDodavatela.map((x) => Math.abs(x.suma_celkom || 0)).filter((v) => v > 0);
  if (sumy.length >= 3 && Math.abs(f.suma_celkom || 0) > 3 * (sumy.reduce((a, b) => a + b, 0) / sumy.length)) dovody.push('Suma je neobvykle vysoká oproti predošlým dokladom od tohto dodávateľa.');
  return dovody;
}

// Mimo hlavného komponentu — inak by sa pri každom prekreslení vytvoril nový typ komponentu a polia by pri písaní strácali kurzor.
const labelCls = 'block text-[10px] text-slate-400 font-semibold mb-0.5';
function Pole({ label, children, sirka = '' }) { return (<div className={sirka}><label className={labelCls}>{label}</label>{children}</div>); }

export default function PrijateFakturyTab({ supabase, currentUser, canEdit = true, triggerNotification = () => {}, bankTransactions = [] }) {
  const [faktury, setFaktury] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');
  const [filter, setFilter] = useState('aktivne');
  const [hladaj, setHladaj] = useState('');
  const [nahravam, setNahravam] = useState([]); // [{ nazov, stav }]
  const [vybrana, setVybrana] = useState(null); // upravovana faktura (kopia)
  const [odkaz, setOdkaz] = useState('');
  const [uhradaForm, setUhradaForm] = useState(null); // { datum, sposob }
  const [parujem, setParujem] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('prijate_faktury').select('*').order('created_at', { ascending: false });
    if (error) { setChyba(error.message.includes('prijate_faktury') ? 'Tabuľka prijatých faktúr ešte neexistuje — spusti v Supabase SQL migráciu migration_prijate_faktury.sql.' : error.message); setFaktury([]); }
    else { setChyba(''); setFaktury(data || []); }
    setNacitava(false);
  }, [supabase]);

  useEffect(() => { nacitaj(); }, [nacitaj]);
  useEffect(() => {
    const ch = supabase.channel('prijate_faktury_zmeny').on('postgres_changes', { event: '*', schema: 'public', table: 'prijate_faktury' }, () => nacitaj()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, nacitaj]);

  // --- nahravanie + AI vycitanie ---
  const spracujSubor = async (file) => {
    const id = crypto.randomUUID();
    const dnesnyDatum = new Date();
    const bezpecnyNazov = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cesta = `${dnesnyDatum.getFullYear()}/${String(dnesnyDatum.getMonth() + 1).padStart(2, '0')}/${id}-${bezpecnyNazov}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(cesta, file, { contentType: file.type || 'application/octet-stream' });
    if (upErr) throw new Error(`Nahratie súboru zlyhalo: ${upErr.message}`);
    const zaklad = { id, stav: 'spracovava', firma: 'PBT', subor_cesta: cesta, subor_nazov: file.name, subor_typ: file.type || null, created_by: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : null };
    const { error: insErr } = await supabase.from('prijate_faktury').insert(zaklad);
    if (insErr) throw new Error(insErr.message);

    let patch = { stav: 'na_schvalenie', vyzaduje_kontrolu: true, dovod_kontroly: 'AI doklad neprečítala — doplň údaje ručne.' };
    try {
      const { data, error } = await supabase.functions.invoke('parse-received-invoice', { body: { storagePath: cesta, mimeType: file.type } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const u = data.udaje || {};
      // Kategoria: ak uz od dodavatela mame doklad, vezmi jeho poslednu kategoriu, inak navrh AI.
      const predosle = faktury.filter((x) => x.kategoria && ((u.dodavatel_ico && x.dodavatel_ico === u.dodavatel_ico) || (u.dodavatel_nazov && normalizuj(x.dodavatel_nazov) === normalizuj(u.dodavatel_nazov))));
      const kategoria = predosle[0]?.kategoria || u.navrh_kategorie || null;
      const nova = {
        druh: ['faktura', 'dobropis', 'zalohova', 'ina'].includes(u.druh) ? u.druh : 'faktura',
        dodavatel_nazov: u.dodavatel_nazov || null, dodavatel_ico: u.dodavatel_ico ? String(u.dodavatel_ico).replace(/\D/g, '') : null,
        dodavatel_dic: u.dodavatel_dic || null, dodavatel_ic_dph: u.dodavatel_ic_dph || null, dodavatel_krajina: u.dodavatel_krajina || null,
        cislo_faktury: u.cislo_faktury || null, variabilny_symbol: u.variabilny_symbol ? String(u.variabilny_symbol).replace(/\D/g, '') : null,
        iban: u.iban ? String(u.iban).replace(/\s/g, '') : null,
        datum_vystavenia: u.datum_vystavenia || null, datum_dodania: u.datum_dodania || null, datum_splatnosti: u.datum_splatnosti || null,
        mena: u.mena || 'EUR', zaklad_dane: cislo(u.zaklad_dane), dph_suma: cislo(u.dph_suma), suma_celkom: cislo(u.suma_celkom),
        dph_sadzby: Array.isArray(u.dph_sadzby) ? u.dph_sadzby : [],
        rezim_dph: REZIMY_DPH.some((r) => r.id === u.rezim_dph) ? u.rezim_dph : 'standard',
        kategoria, popis: u.popis || null, ai_data: u, ai_istota: cislo(u.istota),
      };
      const dovody = [...(Array.isArray(u.upozornenia) ? u.upozornenia : []), ...vyhodnotKontrolu({ id, ...nova }, faktury)];
      if ((cislo(u.istota) ?? 1) < 0.8) dovody.push('AI si nie je istá správnosťou údajov — skontroluj sumy.');
      patch = { ...nova, stav: 'na_schvalenie', vyzaduje_kontrolu: dovody.length > 0, dovod_kontroly: dovody.length ? dovody.join(' ') : null };
    } catch (e) {
      patch.dovod_kontroly = `AI doklad neprečítala (${e.message}). Doplň údaje ručne.`;
    }
    await supabase.from('prijate_faktury').update(patch).eq('id', id);
  };

  const nahrajSubory = async (fileList) => {
    const subory = [...fileList].filter((f) => /pdf|image\//i.test(f.type) || /\.(pdf|jpe?g|png|webp)$/i.test(f.name));
    if (subory.length === 0) { triggerNotification('error', 'Nahraj PDF alebo fotku (JPG/PNG).'); return; }
    setNahravam(subory.map((f) => ({ nazov: f.name, stav: 'caka' })));
    for (let i = 0; i < subory.length; i++) {
      setNahravam((p) => p.map((x, j) => (j === i ? { ...x, stav: 'spracuva' } : x)));
      try { await spracujSubor(subory[i]); setNahravam((p) => p.map((x, j) => (j === i ? { ...x, stav: 'hotovo' } : x))); }
      catch (e) { setNahravam((p) => p.map((x, j) => (j === i ? { ...x, stav: 'chyba', chyba: e.message } : x))); }
      await nacitaj();
    }
    setTimeout(() => setNahravam([]), 6000);
  };

  // --- detail ---
  const otvor = async (f) => {
    setVybrana({ ...f }); setUhradaForm(null); setOdkaz('');
    if (f.subor_cesta) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.subor_cesta, 3600);
      setOdkaz(data?.signedUrl || '');
    }
  };
  const zmen = (patch) => setVybrana((v) => ({ ...v, ...patch }));

  const uloz = async (extra = {}, ticho = false) => {
    const v = { ...vybrana, ...extra };
    const upd = {
      firma: v.firma, druh: v.druh, dodavatel_nazov: v.dodavatel_nazov || null, dodavatel_ico: v.dodavatel_ico || null, dodavatel_dic: v.dodavatel_dic || null,
      dodavatel_ic_dph: v.dodavatel_ic_dph || null, dodavatel_krajina: v.dodavatel_krajina || null, cislo_faktury: v.cislo_faktury || null,
      variabilny_symbol: v.variabilny_symbol || null, iban: v.iban || null, datum_vystavenia: v.datum_vystavenia || null, datum_dodania: v.datum_dodania || null,
      datum_splatnosti: v.datum_splatnosti || null, mena: v.mena || 'EUR', zaklad_dane: cislo(v.zaklad_dane), dph_suma: cislo(v.dph_suma), suma_celkom: cislo(v.suma_celkom),
      rezim_dph: v.rezim_dph, kategoria: v.kategoria || null, popis: v.popis || null, poznamka: v.poznamka || null, stav: v.stav,
      uhradena_datum: v.uhradena_datum || null, sposob_uhrady: v.sposob_uhrady || null,
      vyzaduje_kontrolu: v.vyzaduje_kontrolu, dovod_kontroly: v.dovod_kontroly || null,
    };
    const { error } = await supabase.from('prijate_faktury').update(upd).eq('id', v.id);
    if (error) { triggerNotification('error', error.message); return false; }
    if (!ticho) triggerNotification('success', 'Uložené.');
    setVybrana(v);
    await nacitaj();
    return true;
  };

  const schval = async () => {
    if (!vybrana.dodavatel_nazov || cislo(vybrana.suma_celkom) == null) { triggerNotification('error', 'Pred schválením doplň aspoň dodávateľa a celkovú sumu.'); return; }
    if (await uloz({ stav: 'schvalena', vyzaduje_kontrolu: false }, true)) { triggerNotification('success', 'Faktúra schválená.'); setVybrana(null); }
  };
  const zamietni = async () => { if (window.confirm('Zamietnuť tento doklad? (zostane v zozname ako zamietnutý)') && await uloz({ stav: 'zamietnuta' }, true)) setVybrana(null); };
  const oznacUhradenu = async () => {
    if (await uloz({ stav: 'uhradena', uhradena_datum: uhradaForm.datum, sposob_uhrady: uhradaForm.sposob }, true)) { triggerNotification('success', 'Označené ako uhradené.'); setVybrana(null); }
  };
  const zmaz = async () => {
    if (!window.confirm('Natrvalo zmazať tento doklad aj s nahraným súborom?')) return;
    if (vybrana.subor_cesta) await supabase.storage.from(BUCKET).remove([vybrana.subor_cesta]);
    const { error } = await supabase.from('prijate_faktury').delete().eq('id', vybrana.id);
    if (error) { triggerNotification('error', error.message); return; }
    setVybrana(null); await nacitaj();
  };

  // --- parovanie odchadzajucich platieb z banky ---
  const navrhyPlatieb = useMemo(() => {
    const volne = bankTransactions.filter((t) => t.amount < 0 && !t.matched);
    const out = {};
    faktury.filter((f) => ['schvalena', 'na_schvalenie'].includes(f.stav) && f.suma_celkom != null).forEach((f) => {
      const nasiel = volne.find((t) => Math.abs(Math.abs(t.amount) - Math.abs(f.suma_celkom)) < 0.005 && (
        (f.variabilny_symbol && t.variableSymbol && t.variableSymbol.replace(/\D/g, '').endsWith(f.variabilny_symbol)) ||
        (f.dodavatel_nazov && normalizuj(t.sender).includes(normalizuj(f.dodavatel_nazov).slice(0, 8)) && normalizuj(f.dodavatel_nazov).length >= 4)
      ));
      if (nasiel) out[f.id] = nasiel;
    });
    return out;
  }, [faktury, bankTransactions]);

  const sparuj = async (f, tx) => {
    const { error } = await supabase.from('prijate_faktury').update({ stav: 'uhradena', uhradena_datum: tx.date || dnes(), sposob_uhrady: 'banka' }).eq('id', f.id);
    if (error) { triggerNotification('error', error.message); return false; }
    await supabase.from('bank_transactions').update({ matched: true, prijata_faktura_id: f.id }).eq('id', tx.id);
    return true;
  };
  const sparujVsetky = async () => {
    setParujem(true);
    let n = 0;
    for (const f of faktury) { const tx = navrhyPlatieb[f.id]; if (tx && f.stav === 'schvalena' && await sparuj(f, tx)) n++; }
    await nacitaj(); setParujem(false);
    triggerNotification(n ? 'success' : 'error', n ? `Spárovaných ${n} úhrad s bankou.` : 'Nenašli sa žiadne jednoznačné platby na spárovanie (schválené faktúry).');
  };

  // --- zobrazenie ---
  const prehlad = useMemo(() => {
    const otvorene = faktury.filter((f) => f.stav === 'schvalena');
    const poSplatnosti = otvorene.filter((f) => dniDo(f.datum_splatnosti) != null && dniDo(f.datum_splatnosti) < 0);
    const blizkoSplatnosti = otvorene.filter((f) => dniDo(f.datum_splatnosti) != null && dniDo(f.datum_splatnosti) >= 0 && dniDo(f.datum_splatnosti) <= 7);
    const sucet = (a) => a.reduce((s, f) => s + (f.suma_celkom || 0), 0);
    return {
      naSchvalenie: faktury.filter((f) => f.stav === 'na_schvalenie' || f.stav === 'spracovava').length,
      kUhrade: { n: otvorene.length, suma: sucet(otvorene) },
      po: { n: poSplatnosti.length, suma: sucet(poSplatnosti) },
      blizko: { n: blizkoSplatnosti.length, suma: sucet(blizkoSplatnosti) },
    };
  }, [faktury]);

  const zobrazene = useMemo(() => {
    const q = normalizuj(hladaj);
    return faktury.filter((f) => {
      if (filter === 'aktivne' && ['uhradena', 'zamietnuta'].includes(f.stav)) return false;
      if (!['aktivne', 'vsetky'].includes(filter) && f.stav !== filter) return false;
      if (q && !normalizuj(`${f.dodavatel_nazov} ${f.cislo_faktury} ${f.variabilny_symbol} ${f.popis}`).includes(q)) return false;
      return true;
    }).sort((a, b) => (a.stav === 'na_schvalenie' ? -1 : 0) - (b.stav === 'na_schvalenie' ? -1 : 0));
  }, [faktury, filter, hladaj]);

  const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-400" /> Prijaté faktúry od dodávateľov</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">Nahraj PDF alebo odfoť faktúru — AI vyčíta dodávateľa, sumy, DPH a splatnosť, ty len skontroluješ a schváliš. Účtovníčka už nič nepreklepáva. AI iba navrhuje, o ničom nerozhoduje.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => fileRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Nahrať PDF / fotky</button>
            <button onClick={() => cameraRef.current?.click()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 md:hidden"><Camera className="h-3.5 w-3.5" /> Odfotiť</button>
            <input ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => { nahrajSubory(e.target.files); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { nahrajSubory(e.target.files); e.target.value = ''; }} />
          </div>
        )}
      </div>

      {chyba && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">{chyba}</p>}

      {canEdit && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); nahrajSubory(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl py-5 text-center text-xs text-slate-500 cursor-pointer hidden md:block"
        >
          Potiahni sem faktúry (PDF, JPG, PNG) — môžeš naraz aj viac súborov
        </div>
      )}

      {nahravam.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
          {nahravam.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {n.stav === 'spracuva' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" /> : n.stav === 'hotovo' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : n.stav === 'chyba' ? <X className="h-3.5 w-3.5 text-rose-400" /> : <span className="h-3.5 w-3.5 rounded-full bg-slate-700" />}
              <span className="text-slate-300 truncate">{n.nazov}</span>
              <span className="text-slate-500">{n.stav === 'spracuva' ? 'AI číta doklad…' : n.stav === 'hotovo' ? 'hotovo' : n.stav === 'chyba' ? n.chyba : 'čaká'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-3"><div className="text-[10px] text-slate-400 uppercase font-bold">Na schválenie</div><div className="text-xl font-extrabold text-amber-300">{prehlad.naSchvalenie}</div></div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><div className="text-[10px] text-slate-400 uppercase font-bold">Na úhradu</div><div className="text-xl font-extrabold text-white">{eur(prehlad.kUhrade.suma)}</div><div className="text-[10px] text-slate-500">{prehlad.kUhrade.n} faktúr</div></div>
        <div className="bg-slate-950 border border-rose-900/40 rounded-xl p-3"><div className="text-[10px] text-slate-400 uppercase font-bold">Po splatnosti</div><div className="text-xl font-extrabold text-rose-300">{eur(prehlad.po.suma)}</div><div className="text-[10px] text-slate-500">{prehlad.po.n} faktúr</div></div>
        <div className="bg-slate-950 border border-sky-900/40 rounded-xl p-3"><div className="text-[10px] text-slate-400 uppercase font-bold">Splatné do 7 dní</div><div className="text-xl font-extrabold text-sky-300">{eur(prehlad.blizko.suma)}</div><div className="text-[10px] text-slate-500">{prehlad.blizko.n} faktúr</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[['aktivne', 'Aktívne'], ['na_schvalenie', 'Na schválenie'], ['schvalena', 'Schválené (neuhradené)'], ['uhradena', 'Uhradené'], ['zamietnuta', 'Zamietnuté'], ['vsetky', 'Všetky']].map(([id, lab]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>{lab}</button>
        ))}
        <div className="relative ml-auto">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
          <input value={hladaj} onChange={(e) => setHladaj(e.target.value)} placeholder="Hľadať dodávateľa, číslo, VS…" className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-56" />
        </div>
        {canEdit && Object.keys(navrhyPlatieb).length > 0 && (
          <button onClick={sparujVsetky} disabled={parujem} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Spárovať platby z banky ({Object.keys(navrhyPlatieb).length})</button>
        )}
      </div>

      {nacitava ? <p className="text-sm text-slate-500">Načítavam…</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
              <tr><th className="px-3 py-3">Dodávateľ</th><th className="px-3 py-3">Č. faktúry</th><th className="px-3 py-3 text-center">Vystavená</th><th className="px-3 py-3 text-center">Splatnosť</th><th className="px-3 py-3 text-right">Suma</th><th className="px-3 py-3">Kategória</th><th className="px-3 py-3 text-center">Stav</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {zobrazene.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">Žiadne doklady. Nahraj prvú faktúru tlačidlom vyššie.</td></tr>}
              {zobrazene.map((f) => {
                const dni = dniDo(f.datum_splatnosti);
                const poSpl = f.stav === 'schvalena' && dni != null && dni < 0;
                const st = STAVY[f.stav] || STAVY.na_schvalenie;
                return (
                  <tr key={f.id} onClick={() => otvor(f)} className="hover:bg-slate-800/50 cursor-pointer">
                    <td className="px-3 py-2.5"><div className="font-bold text-white flex items-center gap-1.5">{f.vyzaduje_kontrolu && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" title={f.dovod_kontroly || ''} />}{f.dodavatel_nazov || <span className="text-slate-500 italic">bez názvu</span>}</div><div className="text-[10px] text-slate-500">{f.firma}{f.druh === 'dobropis' ? ' · dobropis' : ''}</div></td>
                    <td className="px-3 py-2.5 font-mono">{f.cislo_faktury || '—'}</td>
                    <td className="px-3 py-2.5 text-center">{f.datum_vystavenia || '—'}</td>
                    <td className={`px-3 py-2.5 text-center ${poSpl ? 'text-rose-300 font-bold' : ''}`}>{f.datum_splatnosti || '—'}{poSpl ? ` (${-dni} d po)` : ''}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">{eur(f.suma_celkom)}{f.mena && f.mena !== 'EUR' ? ` ${f.mena}` : ''}</td>
                    <td className="px-3 py-2.5 text-slate-400 max-w-[200px] truncate">{f.kategoria || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {navrhyPlatieb[f.id] && <div className="text-[9px] text-emerald-400 mt-0.5">💡 nájdená platba v banke</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {vybrana && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setVybrana(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-400" /><h3 className="font-bold text-sm text-white">{vybrana.dodavatel_nazov || 'Prijatý doklad'} {vybrana.cislo_faktury ? `· ${vybrana.cislo_faktury}` : ''}</h3><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(STAVY[vybrana.stav] || STAVY.na_schvalenie).cls}`}>{(STAVY[vybrana.stav] || STAVY.na_schvalenie).label}</span></div>
              <button onClick={() => setVybrana(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
              <div className="min-h-[300px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                {odkaz ? (
                  /pdf/i.test(vybrana.subor_typ || '') || /\.pdf$/i.test(vybrana.subor_nazov || '')
                    ? <iframe src={odkaz} title="Doklad" className="w-full h-[60vh] lg:h-full min-h-[420px]" />
                    : <img src={odkaz} alt="Doklad" className="w-full h-auto" />
                ) : <div className="p-6 text-xs text-slate-500">Náhľad dokladu sa načítava…</div>}
                {odkaz && <a href={odkaz} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-indigo-400 p-2"><ExternalLink className="h-3 w-3" /> Otvoriť doklad v novom okne</a>}
              </div>
              <div className="space-y-3">
                {vybrana.vyzaduje_kontrolu && (
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2.5 text-[11px] text-amber-200 flex gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" /><span>{vybrana.dovod_kontroly || 'Doklad treba skontrolovať.'}</span></div>
                )}
                {navrhyPlatieb[vybrana.id] && vybrana.stav !== 'uhradena' && (
                  <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2.5 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                    <span>💡 V banke je odchádzajúca platba {navrhyPlatieb[vybrana.id].date} · {eur(Math.abs(navrhyPlatieb[vybrana.id].amount))} · {navrhyPlatieb[vybrana.id].sender}</span>
                    {canEdit && <button onClick={async () => { if (await sparuj(vybrana, navrhyPlatieb[vybrana.id])) { triggerNotification('success', 'Spárované s platbou z banky.'); setVybrana(null); nacitaj(); } }} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2.5 py-1 rounded shrink-0">Spárovať</button>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Pole label="Dodávateľ" sirka="col-span-2"><input className={inputCls} value={vybrana.dodavatel_nazov || ''} onChange={(e) => zmen({ dodavatel_nazov: e.target.value })} /></Pole>
                  <Pole label="IČO"><input className={inputCls} value={vybrana.dodavatel_ico || ''} onChange={(e) => zmen({ dodavatel_ico: e.target.value })} /></Pole>
                  <Pole label="IČ DPH"><input className={inputCls} value={vybrana.dodavatel_ic_dph || ''} onChange={(e) => zmen({ dodavatel_ic_dph: e.target.value })} /></Pole>
                  <Pole label="Číslo faktúry"><input className={inputCls} value={vybrana.cislo_faktury || ''} onChange={(e) => zmen({ cislo_faktury: e.target.value })} /></Pole>
                  <Pole label="Variabilný symbol"><input className={inputCls} value={vybrana.variabilny_symbol || ''} onChange={(e) => zmen({ variabilny_symbol: e.target.value })} /></Pole>
                  <Pole label="IBAN" sirka="col-span-2"><input className={inputCls} value={vybrana.iban || ''} onChange={(e) => zmen({ iban: e.target.value })} /></Pole>
                  <Pole label="Vystavená"><input type="date" className={inputCls} value={vybrana.datum_vystavenia || ''} onChange={(e) => zmen({ datum_vystavenia: e.target.value })} /></Pole>
                  <Pole label="Dátum dodania"><input type="date" className={inputCls} value={vybrana.datum_dodania || ''} onChange={(e) => zmen({ datum_dodania: e.target.value })} /></Pole>
                  <Pole label="Splatnosť"><input type="date" className={inputCls} value={vybrana.datum_splatnosti || ''} onChange={(e) => zmen({ datum_splatnosti: e.target.value })} /></Pole>
                  <Pole label="Mena"><input className={inputCls} value={vybrana.mena || 'EUR'} onChange={(e) => zmen({ mena: e.target.value.toUpperCase() })} /></Pole>
                  <Pole label="Základ dane"><input className={inputCls} value={vybrana.zaklad_dane ?? ''} onChange={(e) => zmen({ zaklad_dane: e.target.value })} /></Pole>
                  <Pole label="DPH"><input className={inputCls} value={vybrana.dph_suma ?? ''} onChange={(e) => zmen({ dph_suma: e.target.value })} /></Pole>
                  <Pole label="Celkom na úhradu" sirka="col-span-2"><input className={`${inputCls} font-bold`} value={vybrana.suma_celkom ?? ''} onChange={(e) => zmen({ suma_celkom: e.target.value })} /></Pole>
                  <Pole label="Firma (kto doklad prijal)"><select className={inputCls} value={vybrana.firma} onChange={(e) => zmen({ firma: e.target.value })}>{FIRMY.map((x) => <option key={x}>{x}</option>)}</select></Pole>
                  <Pole label="Druh"><select className={inputCls} value={vybrana.druh} onChange={(e) => zmen({ druh: e.target.value })}><option value="faktura">Faktúra</option><option value="dobropis">Dobropis</option><option value="zalohova">Zálohová</option><option value="ina">Iný doklad</option></select></Pole>
                  <Pole label="Kategória" sirka="col-span-2"><select className={inputCls} value={vybrana.kategoria || ''} onChange={(e) => zmen({ kategoria: e.target.value })}><option value="">— vyber —</option>{KATEGORIE.map((k) => <option key={k}>{k}</option>)}</select></Pole>
                  <Pole label="Režim DPH" sirka="col-span-2"><select className={inputCls} value={vybrana.rezim_dph} onChange={(e) => zmen({ rezim_dph: e.target.value })}>{REZIMY_DPH.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Pole>
                  <Pole label="Popis (čo sa nakupuje)" sirka="col-span-2"><input className={inputCls} value={vybrana.popis || ''} onChange={(e) => zmen({ popis: e.target.value })} /></Pole>
                  <Pole label="Poznámka pre účtovníčku" sirka="col-span-2"><textarea rows={2} className={inputCls} value={vybrana.poznamka || ''} onChange={(e) => zmen({ poznamka: e.target.value })} /></Pole>
                </div>
                {vybrana.stav === 'uhradena' && <p className="text-xs text-emerald-300">Uhradená {vybrana.uhradena_datum || ''} ({vybrana.sposob_uhrady || '—'}).</p>}
                {uhradaForm && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-end gap-2">
                    <Pole label="Dátum úhrady"><input type="date" className={inputCls} value={uhradaForm.datum} onChange={(e) => setUhradaForm({ ...uhradaForm, datum: e.target.value })} /></Pole>
                    <Pole label="Spôsob"><select className={inputCls} value={uhradaForm.sposob} onChange={(e) => setUhradaForm({ ...uhradaForm, sposob: e.target.value })}><option value="banka">Banka</option><option value="hotovost">Hotovosť</option><option value="karta">Karta</option><option value="ine">Iné</option></select></Pole>
                    <button onClick={oznacUhradenu} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg">Potvrdiť úhradu</button>
                  </div>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
                <button onClick={zmaz} className="text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Zmazať</button>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => uloz()} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-lg">Uložiť zmeny</button>
                  {['na_schvalenie', 'spracovava'].includes(vybrana.stav) && <button onClick={zamietni} className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-bold text-xs px-3 py-2 rounded-lg">Zamietnuť</button>}
                  {['na_schvalenie', 'spracovava'].includes(vybrana.stav) && <button onClick={schval} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Schváliť</button>}
                  {['schvalena', 'na_schvalenie'].includes(vybrana.stav) && !uhradaForm && <button onClick={() => setUhradaForm({ datum: dnes(), sposob: 'banka' })} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5" /> Označiť ako uhradenú</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
