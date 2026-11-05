// Kto je práve v ERP: avatary hore v hlavičke (hover = meno, rola, ako dlho je online) + krátka textová správa.
// Prítomnosť beží cez Supabase Realtime "Presence", okamžité doručenie cez "Broadcast". Každá správa sa ukladá aj do tabuľky erp_spravy,
// takže ju uvidí aj ten, kto nebol online — neprečítané správy sa mu zobrazia hneď po prihlásení, kým ich nezavrie.
// Každý prihlásený profil sa hlási ako online; zoznam a písanie správ vidí ten, komu to appka dovolí (mozeVidiet / mozePisat).
// Každý si môže nastaviť veľkosť písma a zvuk upozornenia (6 zvukov, generujú sa priamo v prehliadači) — uloží sa len v jeho prehliadači.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X, Send, Check, Settings, Volume2, VolumeX, Play } from 'lucide-react';

const FARBY_ROL = {
  master: 'bg-indigo-600', supervisor: 'bg-violet-600', manazer: 'bg-sky-600', majster: 'bg-teal-600', sales: 'bg-emerald-600',
  employee: 'bg-slate-600', uctovnik: 'bg-amber-600', sofer: 'bg-orange-600', predajna: 'bg-rose-600',
};

// ---- Zvuky upozornenia: [frekvencia Hz, začiatok s, dĺžka s] — syntetizované cez Web Audio, žiadne súbory ----
export const ZVUKY = [
  { id: 'zvonec', nazov: 'Zvonček', typ: 'sine', hlas: 0.22, kroky: [[1318.5, 0, 0.35], [1760, 0.16, 0.6]] },
  { id: 'ding', nazov: 'Ding', typ: 'sine', hlas: 0.25, kroky: [[988, 0, 0.9]] },
  { id: 'kvapka', nazov: 'Kvapka', typ: 'sine', hlas: 0.25, kroky: [[1400, 0, 0.12], [900, 0.09, 0.3]] },
  { id: 'melodia', nazov: 'Melódia', typ: 'triangle', hlas: 0.22, kroky: [[523.3, 0, 0.2], [659.3, 0.16, 0.2], [784, 0.32, 0.45]] },
  { id: 'naliehavy', nazov: 'Naliehavý', typ: 'square', hlas: 0.1, kroky: [[880, 0, 0.13], [880, 0.2, 0.13], [880, 0.4, 0.13]] },
  { id: 'klopanie', nazov: 'Klopanie', typ: 'triangle', hlas: 0.35, kroky: [[170, 0, 0.1], [150, 0.17, 0.12]] },
];
let audioCtx = null;
export function prehrajZvuk(id) {
  try {
    const z = ZVUKY.find((x) => x.id === id) || ZVUKY[0];
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + 0.02;
    z.kroky.forEach(([f, start, dlzka]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = z.typ; o.frequency.setValueAtTime(f, t0 + start);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(z.hlas, t0 + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dlzka);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + start); o.stop(t0 + start + dlzka + 0.05);
    });
  } catch { /* zvuk nesmie nikdy zhodiť appku */ }
}

// Veľkosť písma správ (px)
const PISMA = [{ id: 's', nazov: 'Malé', px: 13 }, { id: 'm', nazov: 'Stredné', px: 16 }, { id: 'l', nazov: 'Veľké', px: 20 }, { id: 'xl', nazov: 'Najväčšie', px: 26 }];
const PREDVOLENE = { zvuk: 'zvonec', zvukZapnuty: true, pismo: 'm' };
const kluc = (id) => `erp_sprava_nastavenia_${id}`;
function nacitajNastavenia(id) {
  try { return { ...PREDVOLENE, ...(JSON.parse(localStorage.getItem(kluc(id)) || '{}')) }; } catch { return { ...PREDVOLENE }; }
}

const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
// Čas správy; ak nie je z dnešného dňa, doplní sa dátum (správa mohla prísť večer a čítaš ju ráno)
const kedy = (iso) => {
  try {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? hhmm(iso) : `${d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric' })} ${hhmm(iso)}`;
  } catch { return ''; }
};
function trvanie(iso, now) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'práve sa prihlásil';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
const inicialky = (meno) => String(meno || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';

export default function OnlinePrezencia({ supabase, currentUser, employees = [], rolaLabely = {}, mozeVidiet = false, mozePisat = false }) {
  const [online, setOnline] = useState([]);
  const [prijate, setPrijate] = useState([]);       // správy pre mňa (čakajú na zatvorenie)
  const [komu, setKomu] = useState(null);           // komu práve píšem (online záznam)
  const [text, setText] = useState('');
  const [odoslane, setOdoslane] = useState({});     // id správy -> 'odoslana' | 'dorucena'
  const [now, setNow] = useState(Date.now());
  const [hover, setHover] = useState(null);
  const [nastOtvorene, setNastOtvorene] = useState(false);
  const [vyberOtvoreny, setVyberOtvoreny] = useState(false); // zoznam všetkých kolegov (aj offline) na napísanie správy
  const mojeId = currentUser ? String(currentUser.id) : '';
  const mojeMeno = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';
  const [nast, setNast] = useState(() => nacitajNastavenia(mojeId));
  const nastRef = useRef(nast);
  const kanalRef = useRef(null);
  const odRef = useRef(new Date().toISOString());

  useEffect(() => { setNast(nacitajNastavenia(mojeId)); }, [mojeId]);
  useEffect(() => { nastRef.current = nast; }, [nast]);
  const zmenNast = (patch) => {
    setNast((n) => {
      const novy = { ...n, ...patch };
      try { localStorage.setItem(kluc(mojeId), JSON.stringify(novy)); } catch { /* bez uloženia */ }
      return novy;
    });
  };
  const pismoPx = (PISMA.find((p) => p.id === nast.pismo) || PISMA[1]).px;

  useEffect(() => {
    if (!supabase || !mojeId) return undefined;
    const ch = supabase.channel('erp-online', { config: { presence: { key: mojeId }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      const stav = ch.presenceState();
      const zoznam = Object.entries(stav).map(([k, metas]) => {
        const najstarsi = [...metas].sort((a, b) => String(a.od).localeCompare(String(b.od)))[0];
        return { id: k, ...najstarsi };
      });
      setOnline(zoznam);
    });
    ch.on('broadcast', { event: 'sprava' }, ({ payload }) => {
      if (!payload || String(payload.komu) !== mojeId) return;
      setPrijate((p) => (p.some((x) => x.id === payload.id) ? p : [...p, payload]));
      if (nastRef.current.zvukZapnuty) prehrajZvuk(nastRef.current.zvuk);
      ch.send({ type: 'broadcast', event: 'dorucene', payload: { id: payload.id, komu: payload.od?.id } });
    });
    ch.on('broadcast', { event: 'dorucene' }, ({ payload }) => {
      if (!payload || String(payload.komu) !== mojeId) return;
      setOdoslane((o) => ({ ...o, [payload.id]: 'dorucena' }));
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ meno: mojeMeno, rola: currentUser.role, od: odRef.current });
    });
    kanalRef.current = ch;
    return () => { kanalRef.current = null; supabase.removeChannel(ch); };
  }, [supabase, mojeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  // Neprečítané správy z databázy (prišli, keď som nebol online): pri prihlásení a potom každé 2 minúty ako poistka
  useEffect(() => {
    if (!supabase || !mojeId) return undefined;
    let zrusene = false;
    let prvy = true;
    const nacitaj = async () => {
      const { data, error } = await supabase.from('erp_spravy').select('id, od_id, od_meno, text, created_at').eq('komu_id', mojeId).is('precitane_at', null).order('created_at').limit(30);
      if (zrusene || error || !data) return;
      const nove = data.map((r) => ({ id: r.id, komu: mojeId, text: r.text, od: { id: r.od_id, meno: r.od_meno }, cas: r.created_at }));
      setPrijate((p) => {
        const nove2 = nove.filter((n) => !p.some((x) => x.id === n.id));
        if (nove2.length > 0 && nastRef.current.zvukZapnuty && !prvy) prehrajZvuk(nastRef.current.zvuk);
        return nove2.length ? [...p, ...nove2] : p;
      });
      if (prvy && nove.length > 0 && nastRef.current.zvukZapnuty) prehrajZvuk(nastRef.current.zvuk);
      prvy = false;
    };
    nacitaj();
    const t = setInterval(nacitaj, 120000);
    return () => { zrusene = true; clearInterval(t); };
  }, [supabase, mojeId]);

  // Zatvorenie správy = označenie ako prečítanej (aby sa už nezobrazovala po ďalšom prihlásení)
  const zavriSpravu = (id) => {
    setPrijate((p) => p.filter((x) => x.id !== id));
    supabase.from('erp_spravy').update({ precitane_at: new Date().toISOString() }).eq('id', id).is('precitane_at', null).then(() => {}, () => {});
  };

  // Prehliadače zvuk pustia až po prvom kliknutí/stlačení klávesy na stránke — odblokujeme ho hneď pri prvej interakcii.
  useEffect(() => {
    const odomkni = () => { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { if (!audioCtx) audioCtx = new AC(); if (audioCtx.state === 'suspended') audioCtx.resume(); } } catch { /* nič */ } };
    window.addEventListener('pointerdown', odomkni, { once: true });
    window.addEventListener('keydown', odomkni, { once: true });
    return () => { window.removeEventListener('pointerdown', odomkni); window.removeEventListener('keydown', odomkni); };
  }, []);

  const avatarOd = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => { if (e.avatar) m.set(String(e.id), e.avatar); });
    return m;
  }, [employees]);

  const odosli = async () => {
    const t = text.trim();
    if (!t || !komu) return;
    const id = crypto.randomUUID();
    const cas = new Date().toISOString();
    // 1) uložiť do databázy (aby ju uvidel aj ten, kto nie je online), 2) ak je online, doručiť okamžite
    const { error } = await supabase.from('erp_spravy').insert({ id, od_id: mojeId, od_meno: mojeMeno, komu_id: String(komu.id), text: t });
    const jeOnline = online.some((o) => String(o.id) === String(komu.id));
    if (jeOnline && kanalRef.current) {
      await kanalRef.current.send({ type: 'broadcast', event: 'sprava', payload: { id, komu: String(komu.id), text: t, od: { id: mojeId, meno: mojeMeno }, cas } });
    }
    setOdoslane((o) => ({ ...o, [id]: error ? (jeOnline ? 'odoslana' : 'chyba') : (jeOnline ? 'odoslana' : 'ulozena') }));
    setKomu((k) => ({ ...k, posledna: id }));
    setText('');
  };

  const odpovedat = (sprava) => {
    zavriSpravu(sprava.id);
    const zaznam = online.find((o) => String(o.id) === String(sprava.od?.id));
    setKomu(zaznam || { id: sprava.od?.id, meno: sprava.od?.meno });
  };

  const ostatni = online.filter((o) => String(o.id) !== mojeId);
  // Všetci kolegovia (online hore, potom abecedne) pre výber adresáta
  const kolegovia = useMemo(() => {
    const onlineIds = new Set(online.map((o) => String(o.id)));
    return employees
      .filter((e) => String(e.id) !== mojeId)
      .map((e) => ({ id: String(e.id), meno: `${e.firstName || ''} ${e.lastName || ''}`.trim() || String(e.id), rola: e.role, avatar: e.avatar, online: onlineIds.has(String(e.id)) }))
      .sort((a, b) => (a.online === b.online ? a.meno.localeCompare(b.meno, 'sk') : a.online ? -1 : 1));
  }, [employees, online, mojeId]);
  const vsetci = [...online].sort((a, b) => (String(a.id) === mojeId ? -1 : String(b.id) === mojeId ? 1 : 0));

  return (
    <>
      {(mozeVidiet || mozePisat) && (
        <div className="flex items-center gap-1 shrink-0">
          {mozeVidiet && online.length > 0 && (
            <div className="flex items-center -space-x-1.5 pl-1" title="Kto je práve v ERP">
              {vsetci.slice(0, 8).map((o, idx) => {
                const ja = String(o.id) === mojeId;
                const emoji = avatarOd.get(String(o.id));
                return (
                  <div key={o.id} className={`relative ${idx >= 2 ? 'hidden sm:block' : ''}`} onMouseEnter={() => setHover(o.id)} onMouseLeave={() => setHover((h) => (h === o.id ? null : h))}>
                    <button type="button" disabled={ja || !mozePisat} onClick={() => { setKomu(o); setText(''); }}
                      className={`relative h-8 w-8 rounded-full border-2 border-slate-950 text-[11px] font-extrabold text-white flex items-center justify-center ${FARBY_ROL[o.rola] || 'bg-slate-600'} ${!ja && mozePisat ? 'hover:scale-110 hover:z-10 cursor-pointer' : 'cursor-default'} transition-transform`}>
                      {emoji ? <span className="text-base leading-none">{emoji}</span> : inicialky(o.meno)}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                    </button>
                    {hover === o.id && (
                      <div className="fixed top-20 right-3 sm:absolute sm:top-full sm:mt-2 sm:right-0 z-50 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 text-left pointer-events-none">
                        <div className="text-sm font-bold text-white">{o.meno}{ja ? ' (ty)' : ''}</div>
                        <div className="text-[11px] text-slate-400">{rolaLabely[o.rola] || o.rola}</div>
                        <div className="mt-1.5 text-[11px] text-emerald-300">● online od {hhmm(o.od)} ({trvanie(o.od, now)})</div>
                        {!ja && mozePisat && <div className="mt-1.5 text-[10px] text-indigo-300">Klikni a napíš správu</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              {vsetci.length > 2 && <div className="sm:hidden h-8 w-8 rounded-full border-2 border-slate-950 bg-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-center">+{vsetci.length - 2}</div>}
              {vsetci.length > 8 && <div className="hidden sm:flex h-8 w-8 rounded-full border-2 border-slate-950 bg-slate-800 text-[11px] font-bold text-slate-300 items-center justify-center">+{vsetci.length - 8}</div>}
            </div>
          )}

          {/* Napísať správu komukoľvek (aj keď nie je online — uvidí ju po prihlásení) */}
          {mozePisat && (
            <div className="relative">
              <button type="button" onClick={() => { setVyberOtvoreny((o) => !o); setNastOtvorene(false); }} title="Napísať správu kolegovi (aj offline)" className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center">
                <MessageSquare className="h-4 w-4" />
              </button>
              {vyberOtvoreny && (
                <div className="fixed top-20 right-3 sm:absolute sm:top-full sm:mt-2 sm:right-0 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 text-left">
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <span className="text-xs font-bold text-white">Komu napísať?</span>
                    <button type="button" onClick={() => setVyberOtvoreny(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-0.5">
                    {kolegovia.map((k) => (
                      <button key={k.id} type="button" onClick={() => { setKomu({ id: k.id, meno: k.meno, rola: k.rola }); setText(''); setVyberOtvoreny(false); }} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800 text-left">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${k.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span className="flex-1 min-w-0 truncate text-xs text-slate-100">{k.avatar ? `${k.avatar} ` : ''}{k.meno}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">{k.online ? 'online' : 'offline'}</span>
                      </button>
                    ))}
                    {kolegovia.length === 0 && <div className="text-[11px] text-slate-400 px-2 py-2">Žiadni kolegovia.</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nastavenia správ: veľkosť písma + zvuk */}
          <div className="relative">
            <button type="button" onClick={() => setNastOtvorene((o) => !o)} title="Nastavenia správ (písmo, zvuk)" className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center">
              <Settings className="h-4 w-4" />
            </button>
            {nastOtvorene && (
              <div className="absolute z-50 top-full mt-2 right-0 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Nastavenia správ</span>
                  <button type="button" onClick={() => setNastOtvorene(false)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Veľkosť písma</div>
                  <div className="grid grid-cols-4 gap-1">
                    {PISMA.map((p) => (
                      <button key={p.id} type="button" onClick={() => zmenNast({ pismo: p.id })} className={`rounded-lg border py-1 font-bold ${nast.pismo === p.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`} style={{ fontSize: Math.min(p.px, 18) }}>Aa</button>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{(PISMA.find((p) => p.id === nast.pismo) || PISMA[1]).nazov} ({pismoPx} px)</div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400">Zvonenie pri novej správe</span>
                    <button type="button" onClick={() => zmenNast({ zvukZapnuty: !nast.zvukZapnuty })} className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${nast.zvukZapnuty ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      {nast.zvukZapnuty ? <><Volume2 className="h-3 w-3" /> zapnuté</> : <><VolumeX className="h-3 w-3" /> vypnuté</>}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {ZVUKY.map((z) => (
                      <div key={z.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 cursor-pointer ${nast.zvuk === z.id ? 'border-indigo-500 bg-indigo-950/40' : 'border-slate-800 hover:bg-slate-800/60'}`} onClick={() => { zmenNast({ zvuk: z.id }); prehrajZvuk(z.id); }}>
                        <span className={`h-3 w-3 rounded-full border ${nast.zvuk === z.id ? 'bg-indigo-500 border-indigo-300' : 'border-slate-600'}`} />
                        <span className="flex-1 text-xs text-slate-200">{z.nazov}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); prehrajZvuk(z.id); }} title="Vypočuť" className="text-slate-400 hover:text-white"><Play className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Nastavenie platí len v tomto prehliadači.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Písanie správy */}
      {komu && (
        <div className="fixed bottom-5 left-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] bg-slate-900 border border-indigo-500/50 rounded-xl shadow-2xl print:hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <div className="text-xs font-bold text-white flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-indigo-400" /> Správa pre {komu.meno}</div>
            <button type="button" onClick={() => setKomu(null)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-3 space-y-2">
            {!ostatni.some((o) => String(o.id) === String(komu.id)) && <p className="text-[11px] text-amber-400">{komu.meno} nie je online — správu uvidí po prihlásení do ERP.</p>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odosli(); } }} rows={3} autoFocus placeholder="Napíš správu… (Enter = odoslať)" style={{ fontSize: pismoPx }} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                {komu.posledna && odoslane[komu.posledna] === 'dorucena' ? <><Check className="h-3 w-3 text-emerald-400" /> doručené</>
                  : komu.posledna && odoslane[komu.posledna] === 'ulozena' ? <><Check className="h-3 w-3 text-amber-400" /> uložené — prečíta si po prihlásení</>
                  : komu.posledna && odoslane[komu.posledna] === 'chyba' ? <span className="text-rose-400">nepodarilo sa uložiť (má kolega účet v ERP?)</span>
                  : komu.posledna && odoslane[komu.posledna] ? 'odoslané…' : ''}
              </span>
              <button type="button" onClick={odosli} disabled={!text.trim()} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg"><Send className="h-3.5 w-3.5" /> Odoslať</button>
            </div>
          </div>
        </div>
      )}

      {/* Prijaté správy */}
      {prijate.length > 0 && (
        <div className="fixed top-20 right-5 z-50 space-y-2 w-80 max-w-[calc(100vw-2.5rem)] print:hidden">
          {prijate.map((s) => (
            <div key={s.id} className="bg-slate-900 border border-emerald-500/60 rounded-xl shadow-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> {s.od?.meno || 'Správa'} · {kedy(s.cas)}</div>
                <button type="button" onClick={() => zavriSpravu(s.id)} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-1.5 text-white whitespace-pre-wrap break-words" style={{ fontSize: pismoPx }}>{s.text}</p>
              {mozePisat && <button type="button" onClick={() => odpovedat(s)} className="mt-2 text-[11px] font-bold text-indigo-300 hover:text-indigo-200">Odpovedať</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
