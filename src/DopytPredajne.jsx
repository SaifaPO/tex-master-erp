import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Store, Plus, UserCheck, PackageCheck, FileText, CircleCheck, History, Undo2, Ban, Settings, X, Send, Clock, Siren } from 'lucide-react';

// Dopyt predajne: predajňa nahlási, že jej niečo chýba (mikiny, tričká...) — netreba presne, stačí text. Dopyt vyskočí všetkým určeným
// ľuďom (zvonček + zvuk), prvý, kto ho prevezme, sa zapíše ako riešiteľ a ostatní to hneď vidia. Potom sa odškrtáva "textil objednaný"
// a "vypísaná zákazka" (s číslom), na konci "Hotové" — zelené a presunie sa do histórie. Všetko sa ukladá do tabuliek dopyty_predajne
// a dopyt_predajne_nastavenia (migration_dopyt_predajne.sql); upozornenia idú cez existujúci zvonček (erp_notifikacie).

const menoUzivatela = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || 'Neznámy';
const cisloDopytu = (d) => `DP-${String(d.cislo ?? '').padStart(4, '0')}`;
const kedy = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'práve teraz';
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const datumCas = (iso) => (iso ? new Date(iso).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// ---------------------------------------------------------------------------------------------------------------------
// Dáta + Realtime + akcie (volá sa raz v App, výsledok sa pošle do karty aj do menu so značkou)
// ---------------------------------------------------------------------------------------------------------------------
export function useDopytyPredajne({ supabase, currentUser, employees = [], upozorni }) {
  const [dopyty, setDopyty] = useState([]);
  const [nastavenia, setNastavenia] = useState({ ucastnici: [] });
  const [chyba, setChyba] = useState('');
  const userRef = useRef(currentUser);
  const ucastniciRef = useRef([]);
  const upozorniRef = useRef(upozorni);
  useEffect(() => { userRef.current = currentUser; }, [currentUser]);
  useEffect(() => { upozorniRef.current = upozorni; }, [upozorni]);

  // Príjemcovia: vybraní ľudia, a ak nie je vybraný nikto, tak Master a Obchodníci
  const ucastniciIds = useMemo(() => {
    const vybrani = (nastavenia.ucastnici || []).map(String);
    if (vybrani.length > 0) return vybrani;
    return employees.filter((e) => e.role === 'master' || e.role === 'sales').map((e) => String(e.id));
  }, [nastavenia, employees]);
  useEffect(() => { ucastniciRef.current = ucastniciIds; }, [ucastniciIds]);
  const mojeId = currentUser?.id != null ? String(currentUser.id) : '';
  const jeUcastnik = !!mojeId && ucastniciIds.includes(mojeId);
  const smieRiesit = jeUcastnik || currentUser?.role === 'master' || currentUser?.role === 'supervisor';

  const nacitaj = useCallback(async () => {
    const [dRes, nRes] = await Promise.all([
      supabase.from('dopyty_predajne').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('dopyt_predajne_nastavenia').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (dRes.error) { setChyba(dRes.error.message.includes('dopyty_predajne') ? 'Dopyt predajne ešte nie je zapnutý v databáze (migration_dopyt_predajne.sql).' : dRes.error.message); return; }
    setChyba('');
    setDopyty(dRes.data || []);
    if (nRes.data) setNastavenia({ ucastnici: nRes.data.ucastnici || [] });
  }, [supabase]);

  useEffect(() => {
    if (!mojeId) return undefined;
    nacitaj();
    const kanal = supabase.channel('dopyty-predajne')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dopyty_predajne' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const n = payload.new;
          setDopyty((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l]));
          const ja = userRef.current;
          if (ja && String(n.created_by_id) !== String(ja.id) && ucastniciRef.current.includes(String(ja.id))) {
            upozorniRef.current?.(n);
          }
        } else if (payload.eventType === 'UPDATE') {
          setDopyty((l) => l.map((x) => (x.id === payload.new.id ? payload.new : x)));
        } else if (payload.eventType === 'DELETE') {
          setDopyty((l) => l.filter((x) => x.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dopyt_predajne_nastavenia' }, (payload) => {
        if (payload.new) setNastavenia({ ucastnici: payload.new.ucastnici || [] });
      })
      .subscribe();
    const interval = setInterval(nacitaj, 90000); // poistka, keby sa Realtime spojenie na chvíľu prerušilo
    return () => { clearInterval(interval); supabase.removeChannel(kanal); };
  }, [supabase, mojeId, nacitaj]);

  // Upozornenie v zvončeku pre konkrétnych ľudí (okrem toho, kto akciu spravil)
  const posliNotif = useCallback(async (komuIds, titulok, text, dopytId) => {
    const ja = String(userRef.current?.id ?? '');
    const ciele = [...new Set((komuIds || []).filter(Boolean).map(String))].filter((id) => id !== ja);
    if (ciele.length === 0) return;
    try {
      await supabase.from('erp_notifikacie').insert(ciele.map((id) => ({
        typ: 'predajna', zdroj: 'dopyt_predajne', titulok, text,
        odkaz: { tab: 'dopyt-predajne', id: dopytId },
        pre_employee_id: id,
      })));
    } catch { /* upozornenie je bonus, nesmie zhodiť akciu */ }
  }, [supabase]);

  const udalost = (typ, text) => ({ at: new Date().toISOString(), kto: menoUzivatela(userRef.current), typ, text: text || '' });

  const vytvor = async ({ polozky, predajna, urgentne }) => {
    const ja = userRef.current;
    const ud = udalost('vytvorene', 'Dopyt zadaný');
    const { data, error } = await supabase.from('dopyty_predajne').insert({
      created_by_id: String(ja.id), created_by_name: menoUzivatela(ja), predajna: predajna || null,
      polozky: polozky.trim(), priorita: urgentne ? 'urgent' : 'normal', udalosti: [ud],
    }).select().single();
    if (error) throw error;
    setDopyty((l) => (l.some((x) => x.id === data.id) ? l : [data, ...l]));
    await posliNotif(ucastniciRef.current, `${urgentne ? '🔥 URGENTNÉ — ' : ''}Predajňa hlási: ${cisloDopytu(data)}`, `${data.predajna ? data.predajna + ': ' : ''}${data.polozky}`.slice(0, 160), data.id);
    return data;
  };

  // Spoločná zmena: zapíše sa do DB, lokálne sa hneď prekreslí, ostatným príde upozornenie
  const uprav = async (d, zmeny, ud, notif) => {
    const nove = { ...zmeny, udalosti: [...(d.udalosti || []), ud], updated_at: new Date().toISOString() };
    const { error } = await supabase.from('dopyty_predajne').update(nove).eq('id', d.id);
    if (error) throw error;
    setDopyty((l) => l.map((x) => (x.id === d.id ? { ...x, ...nove } : x)));
    if (notif) await posliNotif([...ucastniciRef.current, d.created_by_id], notif.titulok, notif.text, d.id);
  };

  // Prevzatie: atómovo — uspeje len tomu, kto bol prvý (podmienka status = novy)
  const prevezmi = async (d) => {
    const ja = userRef.current;
    const ud = udalost('prevzate', 'Prevzal na riešenie');
    const nove = { status: 'riesi', prevzal_id: String(ja.id), prevzal_meno: menoUzivatela(ja), prevzal_at: new Date().toISOString(), udalosti: [...(d.udalosti || []), ud], updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('dopyty_predajne').update(nove).eq('id', d.id).eq('status', 'novy').is('prevzal_id', null).select();
    if (error) throw error;
    if (!data || data.length === 0) { await nacitaj(); return false; }
    setDopyty((l) => l.map((x) => (x.id === d.id ? data[0] : x)));
    await posliNotif([...ucastniciRef.current, d.created_by_id], `${cisloDopytu(d)} rieši ${menoUzivatela(ja)}`, d.polozky.slice(0, 140), d.id);
    return true;
  };
  const uvolni = (d) => uprav(d, { status: 'novy', prevzal_id: null, prevzal_meno: null, prevzal_at: null }, udalost('uvolnene', 'Uvoľnil dopyt — znova čaká na prevzatie'),
    { titulok: `${cisloDopytu(d)} čaká na nového riešiteľa`, text: d.polozky.slice(0, 140) });
  const prepniObjednane = (d) => d.objednane
    ? uprav(d, { objednane: false, objednane_at: null }, udalost('objednane', 'Zrušil označenie „textil objednaný“'))
    : uprav(d, { objednane: true, objednane_at: new Date().toISOString() }, udalost('objednane', 'Textil objednaný'),
      { titulok: `${cisloDopytu(d)}: textil objednaný`, text: `${menoUzivatela(userRef.current)} objednal textil` });
  const nastavZakazku = (d, cislo) => {
    const c = (cislo || '').trim();
    return uprav(d, { cislo_zakazky: c || null }, udalost('zakazka', c ? `Vypísaná zákazka ${c}` : 'Zrušil číslo zákazky'),
      c ? { titulok: `${cisloDopytu(d)}: vypísaná zákazka ${c}`, text: `${menoUzivatela(userRef.current)} vypísal zákazku` } : null);
  };
  const hotove = (d) => uprav(d, { status: 'hotove', hotove_at: new Date().toISOString() }, udalost('hotove', 'Označil ako hotové'),
    { titulok: `✅ ${cisloDopytu(d)} je hotové`, text: d.polozky.slice(0, 140) });
  const znovuOtvor = (d) => uprav(d, { status: d.prevzal_id ? 'riesi' : 'novy', hotove_at: null }, udalost('znovu', 'Znova otvorené'),
    { titulok: `${cisloDopytu(d)} znova otvorené`, text: d.polozky.slice(0, 140) });
  const zrusit = (d) => uprav(d, { status: 'zrusene', hotove_at: new Date().toISOString() }, udalost('zrusene', 'Zrušené'),
    { titulok: `${cisloDopytu(d)} zrušené`, text: d.polozky.slice(0, 140) });
  const poznamka = (d, text) => uprav(d, {}, udalost('poznamka', text), null);
  const ulozUcastnikov = async (ids) => {
    const { error } = await supabase.from('dopyt_predajne_nastavenia').upsert({ id: 1, ucastnici: ids.map(String) });
    if (error) throw error;
    setNastavenia({ ucastnici: ids.map(String) });
  };

  const aktivne = dopyty.filter((d) => d.status === 'novy' || d.status === 'riesi');
  return {
    dopyty, nastavenia, ucastniciIds, jeUcastnik, smieRiesit, chyba,
    pocetNovych: aktivne.filter((d) => d.status === 'novy').length, pocetAktivnych: aktivne.length,
    vytvor, prevezmi, uvolni, prepniObjednane, nastavZakazku, hotove, znovuOtvor, zrusit, poznamka, ulozUcastnikov,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Karta
// ---------------------------------------------------------------------------------------------------------------------
const TlacidloAkcie = ({ onClick, ikona: Ikona, farba = 'indigo', children, disabled }) => {
  const f = {
    indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    sky: 'bg-sky-600/90 hover:bg-sky-500 text-white',
    violet: 'bg-violet-600/90 hover:bg-violet-500 text-white',
    siva: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    rose: 'bg-rose-900/60 hover:bg-rose-800 text-rose-100 border border-rose-800',
  }[farba];
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${f}`}>
      {Ikona && <Ikona className="h-3.5 w-3.5" />}{children}
    </button>
  );
};

function KartaDopytu({ d, akcie, smieRiesit, jeMoj, jeAutor, orders, otvoreny, onToggle, zvyraznit }) {
  const [poznamkaText, setPoznamkaText] = useState('');
  const [zakazkaEdit, setZakazkaEdit] = useState(null); // null = zatvorené, inak text
  const [bezi, setBezi] = useState(false);
  const hotovy = d.status === 'hotove';
  const zruseny = d.status === 'zrusene';
  const novy = d.status === 'novy';
  const urgent = d.priorita === 'urgent';

  const spusti = async (fn) => {
    setBezi(true);
    try { await fn(); } catch (e) { akcie.chyba(e.message || String(e)); } finally { setBezi(false); }
  };

  const okraj = hotovy ? 'border-emerald-600/60 bg-emerald-950/30' : zruseny ? 'border-slate-700 bg-slate-900/40 opacity-70'
    : novy ? 'border-rose-500/70 bg-rose-950/30 shadow-lg shadow-rose-950/40' : 'border-amber-500/50 bg-amber-950/15';
  const cislaZakaziek = useMemo(() => [...new Set((orders || []).map((o) => o.orderNumber).filter(Boolean))].slice(0, 400), [orders]);

  return (
    <div id={`dopyt-${d.id}`} className={`rounded-2xl border p-4 transition-all ${okraj} ${zvyraznit ? 'ring-2 ring-indigo-400' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-extrabold text-slate-300">{cisloDopytu(d)}</span>
        {novy && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse"><Siren className="h-3 w-3" /> Nový — čaká na prevzatie</span>}
        {d.status === 'riesi' && <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">Rieši sa</span>}
        {hotovy && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white"><CircleCheck className="h-3 w-3" /> Hotové</span>}
        {zruseny && <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">Zrušené</span>}
        {urgent && !hotovy && !zruseny && <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-600 text-white">🔥 Urgentné</span>}
        <span className="text-[11px] text-slate-400 ml-auto">{kedy(d.created_at)}</span>
      </div>

      <p className="mt-2 text-sm sm:text-base font-semibold text-white whitespace-pre-wrap break-words">{d.polozky}</p>
      <p className="mt-1 text-[11px] text-slate-400">
        Zadal: <span className="text-slate-300 font-semibold">{d.created_by_name || '—'}</span>{d.predajna ? <> · predajňa <span className="text-slate-300 font-semibold">{d.predajna}</span></> : null}
      </p>

      {/* kto to rieši + priebeh */}
      {d.status !== 'novy' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {d.prevzal_meno && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${hotovy ? 'bg-emerald-900/50 text-emerald-200' : 'bg-amber-900/40 text-amber-200'}`}>
              <UserCheck className="h-3.5 w-3.5" /> Rieši: {d.prevzal_meno}{d.prevzal_at ? ` · od ${datumCas(d.prevzal_at)}` : ''}
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${d.objednane ? 'bg-sky-700/60 text-sky-100' : 'bg-slate-800 text-slate-500'}`}>
            <PackageCheck className="h-3.5 w-3.5" /> {d.objednane ? `Textil objednaný${d.objednane_at ? ` (${datumCas(d.objednane_at)})` : ''}` : 'Textil zatiaľ neobjednaný'}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${d.cislo_zakazky ? 'bg-violet-700/60 text-violet-100' : 'bg-slate-800 text-slate-500'}`}>
            <FileText className="h-3.5 w-3.5" /> {d.cislo_zakazky ? `Zákazka ${d.cislo_zakazky}` : 'Zákazka zatiaľ nevypísaná'}
          </span>
          {hotovy && d.hotove_at && <span className="text-[11px] text-emerald-300">Dokončené {datumCas(d.hotove_at)}</span>}
        </div>
      )}

      {/* akcie */}
      {smieRiesit && !zruseny && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {novy && <TlacidloAkcie ikona={UserCheck} farba="indigo" disabled={bezi} onClick={() => spusti(async () => { const ok = await akcie.prevezmi(d); if (!ok) akcie.chyba('Tento dopyt už medzitým prevzal niekto iný.'); })}>Prevziať — idem to riešiť</TlacidloAkcie>}
          {d.status === 'riesi' && (
            <>
              <TlacidloAkcie ikona={PackageCheck} farba={d.objednane ? 'siva' : 'sky'} disabled={bezi} onClick={() => spusti(() => akcie.prepniObjednane(d))}>{d.objednane ? 'Zrušiť „objednané“' : 'Textil objednaný'}</TlacidloAkcie>
              <TlacidloAkcie ikona={FileText} farba={d.cislo_zakazky ? 'siva' : 'violet'} disabled={bezi} onClick={() => setZakazkaEdit(d.cislo_zakazky || '')}>{d.cislo_zakazky ? 'Zmeniť číslo zákazky' : 'Vypísaná zákazka'}</TlacidloAkcie>
              <TlacidloAkcie ikona={CircleCheck} farba="emerald" disabled={bezi} onClick={() => spusti(() => akcie.hotove(d))}>Hotové</TlacidloAkcie>
              {(jeMoj || smieRiesit) && <TlacidloAkcie ikona={Undo2} farba="siva" disabled={bezi} onClick={() => spusti(() => akcie.uvolni(d))}>Uvoľniť</TlacidloAkcie>}
            </>
          )}
          {hotovy && <TlacidloAkcie ikona={Undo2} farba="siva" disabled={bezi} onClick={() => spusti(() => akcie.znovuOtvor(d))}>Znova otvoriť</TlacidloAkcie>}
          {!hotovy && <TlacidloAkcie ikona={Ban} farba="rose" disabled={bezi} onClick={() => { if (window.confirm(`Zrušiť dopyt ${cisloDopytu(d)}?`)) spusti(() => akcie.zrusit(d)); }}>Zrušiť</TlacidloAkcie>}
        </div>
      )}
      {!smieRiesit && novy && jeAutor && (
        <div className="mt-3"><TlacidloAkcie ikona={Ban} farba="rose" disabled={bezi} onClick={() => { if (window.confirm(`Zrušiť dopyt ${cisloDopytu(d)}?`)) spusti(() => akcie.zrusit(d)); }}>Zrušiť môj dopyt</TlacidloAkcie></div>
      )}
      {!smieRiesit && !hotovy && !zruseny && <p className="mt-3 text-[11px] text-slate-500">Obchodné oddelenie už o dopyte vie. Tu uvidíš, kto to rieši a ako to pokračuje.</p>}

      {zakazkaEdit !== null && (
        <form className="mt-3 flex flex-wrap gap-2 items-center" onSubmit={(e) => { e.preventDefault(); spusti(async () => { await akcie.nastavZakazku(d, zakazkaEdit); setZakazkaEdit(null); }); }}>
          <input list={`zakazky-${d.id}`} autoFocus value={zakazkaEdit} onChange={(e) => setZakazkaEdit(e.target.value)} placeholder="Číslo zákazky (napr. 2611-045)" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-64 max-w-full" />
          <datalist id={`zakazky-${d.id}`}>{cislaZakaziek.map((c) => <option key={c} value={c} />)}</datalist>
          <button type="submit" disabled={bezi} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold">Uložiť</button>
          <button type="button" onClick={() => setZakazkaEdit(null)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Zavrieť</button>
        </form>
      )}

      {/* priebeh */}
      <button type="button" onClick={onToggle} className="mt-3 text-[11px] font-bold text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> {otvoreny ? 'Skryť priebeh' : `Priebeh (${(d.udalosti || []).length})`}
      </button>
      {otvoreny && (
        <div className="mt-2 border-l-2 border-slate-700 pl-3 space-y-1.5">
          {(d.udalosti || []).map((u, i) => (
            <p key={i} className="text-[11px] text-slate-300"><span className="text-slate-500">{datumCas(u.at)}</span> · <span className="font-bold">{u.kto}</span> — {u.text}</p>
          ))}
          {!zruseny && (
            <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const t = poznamkaText.trim(); if (!t) return; spusti(async () => { await akcie.poznamka(d, t); setPoznamkaText(''); }); }}>
              <input value={poznamkaText} onChange={(e) => setPoznamkaText(e.target.value)} placeholder="Pridať poznámku (napr. dodanie do piatku)" className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
              <button type="submit" disabled={bezi || !poznamkaText.trim()} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Celá karta (tab)
// ---------------------------------------------------------------------------------------------------------------------
export default function DopytPredajneTab({ d: dp, currentUser, employees = [], orders = [], rolaLabely = {}, fokusId = null, triggerNotification = () => {} }) {
  const [pohlad, setPohlad] = useState('aktivne'); // aktivne | historia
  const [formOtvoreny, setFormOtvoreny] = useState(false);
  const [text, setText] = useState('');
  const [predajna, setPredajna] = useState(() => { try { return localStorage.getItem('dopyt_predajna_nazov') || ''; } catch { return ''; } });
  const [urgentne, setUrgentne] = useState(false);
  const [odosiela, setOdosiela] = useState(false);
  const [hladaj, setHladaj] = useState('');
  const [rozbalene, setRozbalene] = useState({});
  const [nastavenieOtvorene, setNastavenieOtvorene] = useState(false);
  const [vybrani, setVybrani] = useState([]);
  const [zvyrazneny, setZvyrazneny] = useState(null);
  const jeMaster = currentUser?.role === 'master' || currentUser?.role === 'supervisor';
  const mojeId = String(currentUser?.id ?? '');

  const akcie = useMemo(() => ({
    prevezmi: dp.prevezmi, uvolni: dp.uvolni, prepniObjednane: dp.prepniObjednane, nastavZakazku: dp.nastavZakazku,
    hotove: dp.hotove, znovuOtvor: dp.znovuOtvor, zrusit: dp.zrusit, poznamka: dp.poznamka,
    chyba: (m) => triggerNotification('error', m),
  }), [dp, triggerNotification]);

  const aktivne = useMemo(() => dp.dopyty
    .filter((x) => x.status === 'novy' || x.status === 'riesi')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'novy' ? -1 : 1) || (a.priorita === 'urgent' ? -1 : 0) - (b.priorita === 'urgent' ? -1 : 0) || new Date(a.created_at) - new Date(b.created_at)), [dp.dopyty]);
  const historia = useMemo(() => {
    const q = hladaj.trim().toLowerCase();
    return dp.dopyty.filter((x) => x.status === 'hotove' || x.status === 'zrusene')
      .filter((x) => !q || [x.polozky, x.created_by_name, x.predajna, x.prevzal_meno, x.cislo_zakazky, cisloDopytu(x)].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.hotove_at || b.created_at) - new Date(a.hotove_at || a.created_at));
  }, [dp.dopyty, hladaj]);

  // Prekliknutie zo zvončeka: prepni na správny zoznam, odroluj na dopyt a krátko ho zvýrazni
  useEffect(() => {
    if (!fokusId) return;
    const x = dp.dopyty.find((y) => y.id === fokusId.id);
    if (!x) return;
    setPohlad(x.status === 'hotove' || x.status === 'zrusene' ? 'historia' : 'aktivne');
    setHladaj('');
    setZvyrazneny(x.id);
    const t1 = setTimeout(() => document.getElementById(`dopyt-${x.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    const t2 = setTimeout(() => setZvyrazneny(null), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [fokusId?.nonce, dp.dopyty.length]);

  useEffect(() => { setVybrani(dp.nastavenia.ucastnici || []); }, [dp.nastavenia]);

  const odosli = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setOdosiela(true);
    try {
      await dp.vytvor({ polozky: text, predajna: predajna.trim(), urgentne });
      try { localStorage.setItem('dopyt_predajna_nazov', predajna.trim()); } catch { /* nevadí */ }
      setText(''); setUrgentne(false); setFormOtvoreny(false); setPohlad('aktivne');
      triggerNotification('success', 'Dopyt odoslaný — obchodné oddelenie ho dostalo.');
    } catch (err) { triggerNotification('error', err.message || String(err)); } finally { setOdosiela(false); }
  };

  const ulozNastavenie = async () => {
    try { await dp.ulozUcastnikov(vybrani); triggerNotification('success', 'Zoznam príjemcov uložený.'); setNastavenieOtvorene(false); }
    catch (err) { triggerNotification('error', err.message || String(err)); }
  };

  const zoznamLudi = useMemo(() => [...employees].sort((a, b) => (a.role === b.role ? 0 : a.role < b.role ? -1 : 1) || String(a.firstName).localeCompare(String(b.firstName), 'sk')), [employees]);
  const zoznam = pohlad === 'aktivne' ? aktivne : historia;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[16rem]">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2"><Store className="h-5 w-5 text-indigo-400" /> Dopyt predajne</h2>
          <p className="text-xs text-slate-400 mt-1">Chýba v predajni tovar? Napíš čo — netreba presne. Obchodné oddelenie to dostane hneď, prvý, kto to prevezme, to začne riešiť.</p>
        </div>
        <button type="button" onClick={() => setFormOtvoreny((o) => !o)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">
          {formOtvoreny ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {formOtvoreny ? 'Zavrieť' : 'Nový dopyt'}
        </button>
      </div>

      {dp.chyba && <div className="rounded-xl border border-amber-700 bg-amber-950/40 text-amber-200 text-xs p-3">{dp.chyba}</div>}

      {formOtvoreny && (
        <form onSubmit={odosli} className="rounded-2xl border border-indigo-500/40 bg-slate-900 p-4 space-y-3">
          <label className="block text-xs font-bold text-slate-300">Čo chýba?
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="napr. mikiny FCT čierne M ×5, L ×8; tričká biele XL ×10"
              className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-xs font-bold text-slate-300">Predajňa (nepovinné)
              <input value={predajna} onChange={(e) => setPredajna(e.target.value)} placeholder="napr. Bratislava" className="mt-1 block w-56 max-w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-orange-300 pb-2.5 cursor-pointer"><input type="checkbox" checked={urgentne} onChange={(e) => setUrgentne(e.target.checked)} className="h-4 w-4" /> 🔥 Urgentné</label>
            <button type="submit" disabled={odosiela || !text.trim()} className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold"><Send className="h-4 w-4" /> Odoslať</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setPohlad('aktivne')} className={`px-4 py-2 rounded-xl text-sm font-bold border ${pohlad === 'aktivne' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}>
          Aktívne{aktivne.length > 0 && <span className={`ml-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${dp.pocetNovych > 0 ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'}`}>{aktivne.length}</span>}
        </button>
        <button type="button" onClick={() => setPohlad('historia')} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border ${pohlad === 'historia' ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'}`}>
          <History className="h-4 w-4" /> História
        </button>
        {pohlad === 'historia' && <input value={hladaj} onChange={(e) => setHladaj(e.target.value)} placeholder="Hľadať v histórii (tovar, meno, číslo zákazky)…" className="flex-1 min-w-[14rem] bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white" />}
        {jeMaster && (
          <button type="button" onClick={() => setNastavenieOtvorene((o) => !o)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">
            <Settings className="h-3.5 w-3.5" /> Kto dostáva upozornenia
          </button>
        )}
      </div>

      {jeMaster && nastavenieOtvorene && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <p className="text-xs text-slate-300">Vyber ľudí, ktorým dopyt vyskočí a ktorí ho môžu riešiť. <span className="text-slate-500">Ak nevyberieš nikoho, dostanú ho všetci Master a Obchodníci.</span></p>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
            {zoznamLudi.map((e) => {
              const id = String(e.id);
              const on = vybrani.map(String).includes(id);
              return (
                <label key={id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${on ? 'bg-indigo-950/50 border-indigo-500/60 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'}`}>
                  <input type="checkbox" checked={on} onChange={() => setVybrani((v) => (on ? v.filter((x) => String(x) !== id) : [...v, id]))} className="h-4 w-4" />
                  <span className="font-bold">{e.firstName} {e.lastName}</span><span className="text-slate-500 ml-auto">{rolaLabely[e.role] || e.role}</span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={ulozNastavenie} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Uložiť</button>
            <button type="button" onClick={() => setNastavenieOtvorene(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Zavrieť</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {zoznam.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
            {pohlad === 'aktivne' ? 'Žiadne aktívne dopyty. Keď predajni niečo chýba, objaví sa to tu.' : 'V histórii zatiaľ nič nie je.'}
          </div>
        )}
        {zoznam.map((x) => (
          <KartaDopytu key={x.id} d={x} akcie={akcie} smieRiesit={dp.smieRiesit} jeMoj={String(x.prevzal_id) === mojeId} jeAutor={String(x.created_by_id) === mojeId}
            orders={orders} otvoreny={!!rozbalene[x.id]} onToggle={() => setRozbalene((r) => ({ ...r, [x.id]: !r[x.id] }))} zvyraznit={zvyrazneny === x.id} />
        ))}
      </div>
    </div>
  );
}
