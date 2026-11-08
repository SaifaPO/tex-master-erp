import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Mail, Phone, ExternalLink, CheckCircle2, RotateCcw, Bell, BellOff } from 'lucide-react';

// Živý chat so zákazníkmi z verejných appiek (okno "Opýtať sa" vpravo dole). Kým je tu niekto prihlásený a má zapnuté "Online", zákazník vidí "Sme online"
// a odpisuje sa mu hneď. Nová správa vyskočí aj v zvončeku (erp_notifikacie) a ako upozornenie na ploche; ak nie je nikto online, ide e-mail a zákazník
// dostane odpoveď aj e-mailom. Dáta: chat_konverzacie / chat_spravy (migration_chat_zakaznici.sql), odpovede cez Edge Function chat-admin.
const pred = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'práve teraz';
  if (s < 3600) return `pred ${Math.floor(s / 60)} min`;
  if (s < 86400) return `pred ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const hm = (iso) => new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });

export function useChat(supabase, jeAdmin, currentUser) {
  const [konverzacie, setKonverzacie] = useState([]);
  const [chyba, setChyba] = useState('');
  const [online, setOnlineStav] = useState(() => { try { return localStorage.getItem('pbt_chat_online') !== '0'; } catch { return true; } });
  const mojeId = String(currentUser?.id ?? '');
  const meno = currentUser?.name || currentUser?.fullName || currentUser?.email || 'ERP';

  const nacitaj = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('chat_konverzacie').select('*').order('posledna_sprava_at', { ascending: false }).limit(200);
    if (error) { setChyba(error.message.includes('chat_konverzacie') ? 'Chat ešte nie je zapnutý (migration_chat_zakaznici.sql).' : error.message); return; }
    setChyba(''); setKonverzacie(data || []);
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !jeAdmin) return undefined;
    nacitaj();
    const kanal = supabase.channel('chat-zakaznici')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_konverzacie' }, (p) => {
        if (p.eventType === 'DELETE') { setKonverzacie((l) => l.filter((x) => x.id !== p.old.id)); return; }
        setKonverzacie((l) => [p.new, ...l.filter((x) => x.id !== p.new.id)].sort((a, b) => String(b.posledna_sprava_at).localeCompare(String(a.posledna_sprava_at))));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_spravy' }, (p) => {
        if (p.new.od !== 'zakaznik') return;
        try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification(`Chat — ${p.new.autor || 'zákazník'}`, { body: String(p.new.text).slice(0, 140) }); } catch { /* upozornenie je bonus */ }
      })
      .subscribe();
    const interval = setInterval(nacitaj, 60000); // poistka, keby Realtime spojenie na chvíľu vypadlo
    return () => { clearInterval(interval); supabase.removeChannel(kanal); };
  }, [supabase, jeAdmin, nacitaj]);

  // "prítomnosť": kým som prihlásený a mám zapnuté Online, zákazník v appke vidí "Sme online"
  useEffect(() => {
    if (!supabase || !jeAdmin || !online || !mojeId) return undefined;
    const beat = () => supabase.from('chat_admin_online').upsert({ user_id: mojeId, meno, last_seen: new Date().toISOString() });
    beat();
    const t = setInterval(beat, 30000);
    const preč = () => { supabase.from('chat_admin_online').delete().eq('user_id', mojeId); };
    window.addEventListener('beforeunload', preč);
    return () => { clearInterval(t); window.removeEventListener('beforeunload', preč); preč(); };
  }, [supabase, jeAdmin, online, mojeId, meno]);

  const setOnline = (v) => { try { localStorage.setItem('pbt_chat_online', v ? '1' : '0'); } catch { /* ignoruj */ } setOnlineStav(v); };
  const neprecitane = konverzacie.reduce((s, k) => s + (k.neprecitane_admin || 0), 0);
  return { konverzacie, neprecitane, online, setOnline, chyba, nacitaj };
}

export default function ChatTab({ supabase, chat, currentUser, fokus }) {
  const [vybranaId, setVybranaId] = useState(null);
  const [spravy, setSpravy] = useState([]);
  const [text, setText] = useState('');
  const [odosielam, setOdosielam] = useState(false);
  const [info, setInfo] = useState('');
  const [filter, setFilter] = useState('otvorene');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const koniecRef = useRef(null);
  const konv = chat.konverzacie.find((k) => k.id === vybranaId) || null;
  const meno = currentUser?.name || currentUser?.fullName || 'PBT Print';

  useEffect(() => { if (fokus?.id) setVybranaId(fokus.id); }, [fokus?.id, fokus?.nonce]);

  // načítanie správ vybranej konverzácie + živé nové správy
  useEffect(() => {
    if (!vybranaId) { setSpravy([]); return undefined; }
    let zrusene = false;
    (async () => {
      const { data } = await supabase.from('chat_spravy').select('*').eq('konverzacia_id', vybranaId).order('id', { ascending: true });
      if (!zrusene) setSpravy(data || []);
      await supabase.from('chat_konverzacie').update({ neprecitane_admin: 0 }).eq('id', vybranaId);
    })();
    const kanal = supabase.channel(`chat-konv-${vybranaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_spravy', filter: `konverzacia_id=eq.${vybranaId}` }, (p) => {
        setSpravy((l) => (l.some((x) => x.id === p.new.id) ? l : [...l, p.new]));
        if (p.new.od === 'zakaznik') supabase.from('chat_konverzacie').update({ neprecitane_admin: 0 }).eq('id', vybranaId);
      })
      .subscribe();
    return () => { zrusene = true; supabase.removeChannel(kanal); };
  }, [supabase, vybranaId]);

  useEffect(() => { koniecRef.current?.scrollIntoView({ block: 'end' }); }, [spravy.length, vybranaId]);

  const odpovedat = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || !konv) return;
    setOdosielam(true); setInfo('');
    const { data, error } = await supabase.functions.invoke('chat-admin', { body: { akcia: 'odpoved', id: konv.id, text: t, autor: meno } });
    setOdosielam(false);
    if (error || !data?.ok) { setInfo(`Odoslanie zlyhalo: ${data?.error || error?.message || 'neznáma chyba'}`); return; }
    setText('');
    if (data.sprava) setSpravy((l) => (l.some((x) => x.id === data.sprava.id) ? l : [...l, data.sprava]));
    setInfo(data.email === 'odoslany' ? 'Zákazník nemá otvorené okno — odpoveď sme mu poslali aj e-mailom.' : '');
  };

  const prepniStav = async () => {
    if (!konv) return;
    await supabase.from('chat_konverzacie').update({ stav: konv.stav === 'otvorena' ? 'uzavreta' : 'otvorena' }).eq('id', konv.id);
  };
  const zapniUpozornenia = async () => { try { setPerm(await Notification.requestPermission()); } catch { /* ignoruj */ } };

  const zoznam = chat.konverzacie.filter((k) => filter === 'vsetky' || k.stav === 'otvorena');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2"><MessageCircle className="w-5 h-5 text-indigo-400" /> Zákaznícky chat</h2>
          <p className="text-xs text-slate-400 mt-1">Otázky z okna „Opýtať sa“ v appkách. Kým máš zapnuté Online, zákazník vidí, že si tu, a odpisuješ mu hneď. Ak nie si online, príde ti e-mail a zákazník dostane odpoveď aj e-mailom.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => chat.setOnline(!chat.online)} className={`px-3 py-2 rounded-xl text-xs font-bold border-2 flex items-center gap-2 transition ${chat.online ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${chat.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} /> {chat.online ? 'Online pre zákazníkov' : 'Offline (zákazníci dostanú e-mail)'}
          </button>
          {perm !== 'unsupported' && perm !== 'granted' && <button onClick={zapniUpozornenia} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Zapnúť upozornenia na ploche</button>}
          {perm === 'granted' && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Bell className="w-3 h-3" /> upozornenia zapnuté</span>}
          {perm === 'denied' && <span className="text-[11px] text-amber-400 flex items-center gap-1"><BellOff className="w-3 h-3" /> upozornenia sú v prehliadači zablokované</span>}
        </div>
      </div>
      {chat.chyba && <p className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/50 rounded-xl p-3">{chat.chyba}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4 min-h-[60vh]">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[75vh]">
          <div className="p-2 flex gap-1 border-b border-slate-800">
            {[['otvorene', 'Otvorené'], ['vsetky', 'Všetky']].map(([k, n]) => <button key={k} onClick={() => setFilter(k)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${filter === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{n}</button>)}
          </div>
          <div className="overflow-y-auto flex-1">
            {zoznam.length === 0 && <p className="p-6 text-center text-xs text-slate-500">Zatiaľ žiadne konverzácie.</p>}
            {zoznam.map((k) => (
              <button key={k.id} onClick={() => setVybranaId(k.id)} className={`w-full text-left px-3 py-3 border-b border-slate-800 hover:bg-slate-800/60 ${vybranaId === k.id ? 'bg-indigo-950/40' : ''}`}>
                <span className="flex items-center gap-2">
                  <span className={`text-sm truncate ${k.neprecitane_admin > 0 ? 'font-black text-white' : 'font-semibold text-slate-200'}`}>{k.meno || k.email}</span>
                  {k.neprecitane_admin > 0 && <span className="bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">{k.neprecitane_admin}</span>}
                  {k.stav === 'uzavreta' && <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">{k.aplikacia || '—'} · {pred(k.posledna_sprava_at)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col max-h-[75vh]">
          {!konv ? <p className="m-auto text-sm text-slate-500 p-10 text-center">Vyber konverzáciu vľavo.</p> : (
            <>
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{konv.meno || '(bez mena)'}</p>
                  <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <a href={`mailto:${konv.email}`} className="flex items-center gap-1 hover:text-white"><Mail className="w-3 h-3" /> {konv.email}</a>
                    {konv.telefon && <a href={`tel:${konv.telefon}`} className="flex items-center gap-1 hover:text-white"><Phone className="w-3 h-3" /> {konv.telefon}</a>}
                    <span>{konv.aplikacia || '—'}</span>
                    {konv.url && <a href={konv.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white"><ExternalLink className="w-3 h-3" /> stránka zákazníka</a>}
                  </p>
                </div>
                <button onClick={prepniStav} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5">
                  {konv.stav === 'otvorena' ? <><CheckCircle2 className="w-3.5 h-3.5" /> Uzavrieť</> : <><RotateCcw className="w-3.5 h-3.5" /> Znovu otvoriť</>}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[16rem]">
                {spravy.map((s) => (
                  <div key={s.id} className={`flex ${s.od === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${s.od === 'admin' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'}`}>
                      {s.text}
                      <span className={`block text-[10px] mt-1 ${s.od === 'admin' ? 'text-indigo-200' : 'text-slate-500'}`}>{s.od === 'admin' ? (s.autor || 'PBT Print') : (s.autor || 'zákazník')} · {hm(s.created_at)}</span>
                    </div>
                  </div>
                ))}
                <div ref={koniecRef} />
              </div>
              {info && <p className="px-4 pb-1 text-[11px] text-amber-300">{info}</p>}
              <form onSubmit={odpovedat} className="p-3 border-t border-slate-800 flex items-end gap-2">
                <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odpovedat(); } }} placeholder="Napíš odpoveď… (Enter = odoslať, Shift+Enter = nový riadok)" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white resize-none" />
                <button type="submit" disabled={odosielam || !text.trim()} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-1.5"><Send className="w-4 h-4" /> Odoslať</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
