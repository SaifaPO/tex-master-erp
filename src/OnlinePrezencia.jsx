// Kto je práve v ERP: avatary hore v hlavičke (hover = meno, rola, ako dlho je online) + krátka textová správa.
// Beží cez Supabase Realtime "Presence" a "Broadcast" (žiadna tabuľka, nič sa neukladá) — správa sa doručí len tomu, kto je práve online.
// Každý prihlásený profil sa hlási ako online (aby ho bolo vidieť); zoznam a písanie správ vidí len ten, komu to appka dovolí (mozeVidiet / mozePisat).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X, Send, Check } from 'lucide-react';

const FARBY_ROL = {
  master: 'bg-indigo-600', supervisor: 'bg-violet-600', manazer: 'bg-sky-600', majster: 'bg-teal-600', sales: 'bg-emerald-600',
  employee: 'bg-slate-600', uctovnik: 'bg-amber-600', sofer: 'bg-orange-600', predajna: 'bg-rose-600',
};

const hhmm = (iso) => { try { return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
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
  const kanalRef = useRef(null);
  const odRef = useRef(new Date().toISOString());
  const mojeId = currentUser ? String(currentUser.id) : '';
  const mojeMeno = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';

  useEffect(() => {
    if (!supabase || !mojeId) return undefined;
    const ch = supabase.channel('erp-online', { config: { presence: { key: mojeId }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      const stav = ch.presenceState();
      const zoznam = Object.entries(stav).map(([kluc, metas]) => {
        const najstarsi = [...metas].sort((a, b) => String(a.od).localeCompare(String(b.od)))[0];
        return { id: kluc, ...najstarsi };
      });
      setOnline(zoznam);
    });
    ch.on('broadcast', { event: 'sprava' }, ({ payload }) => {
      if (!payload || String(payload.komu) !== mojeId) return;
      setPrijate((p) => (p.some((x) => x.id === payload.id) ? p : [...p, payload]));
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

  const avatarOd = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => { if (e.avatar) m.set(String(e.id), e.avatar); });
    return m;
  }, [employees]);

  const odosli = async () => {
    const t = text.trim();
    if (!t || !komu || !kanalRef.current) return;
    const id = crypto.randomUUID();
    await kanalRef.current.send({ type: 'broadcast', event: 'sprava', payload: { id, komu: String(komu.id), text: t, od: { id: mojeId, meno: mojeMeno }, cas: new Date().toISOString() } });
    setOdoslane((o) => ({ ...o, [id]: 'odoslana' }));
    setKomu((k) => ({ ...k, posledna: id }));
    setText('');
  };

  const odpovedat = (sprava) => {
    setPrijate((p) => p.filter((x) => x.id !== sprava.id));
    const zaznam = online.find((o) => String(o.id) === String(sprava.od?.id));
    setKomu(zaznam || { id: sprava.od?.id, meno: sprava.od?.meno });
  };

  const ostatni = online.filter((o) => String(o.id) !== mojeId);
  const vsetci = [...online].sort((a, b) => (String(a.id) === mojeId ? -1 : String(b.id) === mojeId ? 1 : 0));

  return (
    <>
      {mozeVidiet && online.length > 0 && (
        <div className="flex items-center -space-x-1.5 pl-1 shrink-0" title="Kto je práve v ERP">
          {vsetci.slice(0, 8).map((o) => {
            const ja = String(o.id) === mojeId;
            const emoji = avatarOd.get(String(o.id));
            return (
              <div key={o.id} className="relative" onMouseEnter={() => setHover(o.id)} onMouseLeave={() => setHover((h) => (h === o.id ? null : h))}>
                <button type="button" disabled={ja || !mozePisat} onClick={() => { setKomu(o); setText(''); }}
                  className={`relative h-8 w-8 rounded-full border-2 border-slate-950 text-[11px] font-extrabold text-white flex items-center justify-center ${FARBY_ROL[o.rola] || 'bg-slate-600'} ${!ja && mozePisat ? 'hover:scale-110 hover:z-10 cursor-pointer' : 'cursor-default'} transition-transform`}>
                  {emoji ? <span className="text-base leading-none">{emoji}</span> : inicialky(o.meno)}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
                </button>
                {hover === o.id && (
                  <div className="absolute z-50 top-full mt-2 right-0 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 text-left pointer-events-none">
                    <div className="text-sm font-bold text-white">{o.meno}{ja ? ' (ty)' : ''}</div>
                    <div className="text-[11px] text-slate-400">{rolaLabely[o.rola] || o.rola}</div>
                    <div className="mt-1.5 text-[11px] text-emerald-300">● online od {hhmm(o.od)} ({trvanie(o.od, now)})</div>
                    {!ja && mozePisat && <div className="mt-1.5 text-[10px] text-indigo-300">Klikni a napíš správu</div>}
                  </div>
                )}
              </div>
            );
          })}
          {vsetci.length > 8 && <div className="h-8 w-8 rounded-full border-2 border-slate-950 bg-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-center">+{vsetci.length - 8}</div>}
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
            {!ostatni.some((o) => String(o.id) === String(komu.id)) && <p className="text-[11px] text-amber-400">{komu.meno} už nie je online — správa sa nedoručí.</p>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odosli(); } }} rows={3} autoFocus placeholder="Napíš správu… (Enter = odoslať)" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                {komu.posledna && odoslane[komu.posledna] === 'dorucena' ? <><Check className="h-3 w-3 text-emerald-400" /> doručené</> : komu.posledna && odoslane[komu.posledna] ? 'odoslané…' : ''}
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
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> {s.od?.meno || 'Správa'} · {hhmm(s.cas)}</div>
                <button type="button" onClick={() => setPrijate((p) => p.filter((x) => x.id !== s.id))} className="text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-1.5 text-sm text-white whitespace-pre-wrap break-words">{s.text}</p>
              {mozePisat && <button type="button" onClick={() => odpovedat(s)} className="mt-2 text-[11px] font-bold text-indigo-300 hover:text-indigo-200">Odpovedať</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
