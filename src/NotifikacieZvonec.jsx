import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Inbox, FileQuestion, ClipboardList, Check, X, Trash2 } from 'lucide-react';

// Zvonček s notifikáciami v hornej lište ERP: nový dopyt, nová objednávka z konfigurátora, nová zákazka. Záznamy vytvárajú databázové
// triggery (migration_erp_notifikacie.sql); tu sa zobrazia okamžite cez Realtime ako vyskakovacie okno a ostanú v zozname, kým ich
// nezmažeš — dajú sa pozrieť aj spätne. Kliknutím na notifikáciu sa otvorí presne to miesto (dopyt / objednávka / zákazka).
const IKONY = { dopyt: FileQuestion, objednavka: Inbox, zakazka: ClipboardList };
const FARBY = { dopyt: 'text-amber-300 bg-amber-500/15', objednavka: 'text-emerald-300 bg-emerald-500/15', zakazka: 'text-indigo-300 bg-indigo-500/15' };

const pred = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'práve teraz';
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function NotifikacieZvonec({ supabase, onOtvor }) {
  const [polozky, setPolozky] = useState([]);
  const [otvorene, setOtvorene] = useState(false);
  const [vyskakovacie, setVyskakovacie] = useState([]);
  const [chyba, setChyba] = useState('');
  const korenRef = useRef(null);

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('erp_notifikacie').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) { setChyba(error.message.includes('erp_notifikacie') ? 'Notifikácie ešte nie sú zapnuté (migration_erp_notifikacie.sql).' : error.message); return; }
    setChyba('');
    setPolozky(data || []);
  }, [supabase]);

  useEffect(() => {
    nacitaj();
    const kanal = supabase.channel('erp-notifikacie')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'erp_notifikacie' }, (payload) => {
        const n = payload.new;
        setPolozky((l) => (l.some((x) => x.id === n.id) ? l : [n, ...l].slice(0, 60)));
        setVyskakovacie((v) => [...v, n]);
        setTimeout(() => setVyskakovacie((v) => v.filter((x) => x.id !== n.id)), 9000);
        try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.04; o.start(); o.stop(ctx.currentTime + 0.12); } catch { /* zvuk je len bonus */ }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'erp_notifikacie' }, (payload) => setPolozky((l) => l.map((x) => (x.id === payload.new.id ? payload.new : x))))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'erp_notifikacie' }, (payload) => setPolozky((l) => l.filter((x) => x.id !== payload.old.id)))
      .subscribe();
    // poistka, keby sa Realtime spojenie na chvíľu prerušilo
    const interval = setInterval(nacitaj, 60000);
    return () => { clearInterval(interval); supabase.removeChannel(kanal); };
  }, [supabase, nacitaj]);

  // zavretie zoznamu kliknutím mimo
  useEffect(() => {
    if (!otvorene) return undefined;
    const zavri = (e) => { if (korenRef.current && !korenRef.current.contains(e.target)) setOtvorene(false); };
    document.addEventListener('mousedown', zavri);
    return () => document.removeEventListener('mousedown', zavri);
  }, [otvorene]);

  const neprecitane = polozky.filter((p) => !p.precitane).length;

  const oznacPrecitane = async (n) => {
    if (n.precitane) return;
    setPolozky((l) => l.map((x) => (x.id === n.id ? { ...x, precitane: true } : x)));
    await supabase.from('erp_notifikacie').update({ precitane: true }).eq('id', n.id);
  };
  const oznacVsetko = async () => {
    setPolozky((l) => l.map((x) => ({ ...x, precitane: true })));
    await supabase.from('erp_notifikacie').update({ precitane: true }).eq('precitane', false);
  };
  const zmazPrecitane = async () => {
    setPolozky((l) => l.filter((x) => !x.precitane));
    await supabase.from('erp_notifikacie').delete().eq('precitane', true);
  };
  const otvor = (n) => {
    oznacPrecitane(n);
    setVyskakovacie((v) => v.filter((x) => x.id !== n.id));
    setOtvorene(false);
    if (n.odkaz) onOtvor?.(n.odkaz);
  };

  return (
    <div ref={korenRef} className="relative">
      <style>{`@keyframes wiggle{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(6deg)}} @keyframes slidein{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>
      <button onClick={() => setOtvorene((o) => !o)} title="Notifikácie" className={`relative p-2.5 rounded-xl border transition-colors ${otvorene ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'}`}>
        <Bell className={`h-4 w-4 ${neprecitane > 0 ? 'animate-[wiggle_1.2s_ease-in-out_2]' : ''}`} />
        {neprecitane > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-slate-950">{neprecitane > 99 ? '99+' : neprecitane}</span>}
      </button>

      {otvorene && (
        <div className="absolute right-0 mt-2 w-[26rem] max-w-[92vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">Notifikácie{neprecitane > 0 ? ` (${neprecitane} nových)` : ''}</span>
            <div className="flex items-center gap-1">
              <button onClick={oznacVsetko} disabled={neprecitane === 0} className="text-[11px] text-indigo-300 hover:text-indigo-200 disabled:text-slate-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800"><Check className="w-3 h-3" /> Prečítať všetko</button>
              <button onClick={zmazPrecitane} className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800" title="Zmazať prečítané"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {chyba && <p className="p-4 text-xs text-amber-300">{chyba}</p>}
            {!chyba && polozky.length === 0 && <p className="p-6 text-center text-xs text-slate-500">Zatiaľ žiadne notifikácie. Sem prídu nové dopyty, objednávky a zákazky.</p>}
            {polozky.map((n) => {
              const Ikona = IKONY[n.typ] || Bell;
              return (
                <button key={n.id} onClick={() => otvor(n)} className={`w-full text-left px-4 py-3 border-b border-slate-800 flex items-start gap-3 hover:bg-slate-800/60 transition-colors ${n.precitane ? 'opacity-70' : 'bg-indigo-950/25'}`}>
                  <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${FARBY[n.typ] || 'text-slate-300 bg-slate-800'}`}><Ikona className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2"><span className={`text-xs ${n.precitane ? 'font-semibold text-slate-300' : 'font-bold text-white'} truncate`}>{n.titulok}</span>{!n.precitane && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}</span>
                    {n.text && <span className="block text-[11px] text-slate-400 mt-0.5 truncate">{n.text}</span>}
                    <span className="block text-[10px] text-slate-500 mt-1">{pred(n.created_at)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* vyskakovacie okná pri novej notifikácii (vpravo hore) */}
      <div className="fixed top-20 right-4 z-[60] space-y-2 w-80 max-w-[92vw]">
        {vyskakovacie.map((n) => {
          const Ikona = IKONY[n.typ] || Bell;
          return (
            <div key={n.id} className="bg-slate-900 border border-indigo-500/60 rounded-xl shadow-2xl p-3 flex items-start gap-3 animate-[slidein_.25s_ease-out]">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${FARBY[n.typ] || 'text-slate-300 bg-slate-800'}`}><Ikona className="w-4 h-4" /></span>
              <button onClick={() => otvor(n)} className="flex-1 min-w-0 text-left">
                <span className="block text-xs font-bold text-white truncate">{n.titulok}</span>
                {n.text && <span className="block text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.text}</span>}
                <span className="block text-[10px] text-indigo-300 mt-1">Kliknutím otvoríš →</span>
              </button>
              <button onClick={() => setVyskakovacie((v) => v.filter((x) => x.id !== n.id))} className="text-slate-500 hover:text-white p-0.5"><X className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
