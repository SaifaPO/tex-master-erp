import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { supabase } from './supabaseClient';
import { aktualnyJazyk } from './i18n/prekladac';

// Živý chat v appkách (okno vpravo dole "Opýtať sa"): zákazník vyplní meno / e-mail a napíše otázku, potom pokračuje chatom. Ak je v ERP niekto online,
// odpíše okamžite; ak nie, odpoveď príde do tohto okna (kým je otvorené) aj e-mailom. Konverzácia sa pamätá v prehliadači (a v odkaze z e-mailu).
// Appky môžu nastaviť zdroj a výšku okna cez <AskQuestion zdroj="…" nadListou /> (ten len nastaví konfiguráciu tohto okna).
const KLUC = 'pbt_chat_v1';
const SHOP_KONTAKT_URL = 'https://pbtprint.sk/contact';
const nacitajUlozene = () => { try { return JSON.parse(localStorage.getItem(KLUC) || 'null'); } catch { return null; } };
const uloz = (o) => { try { if (o) localStorage.setItem(KLUC, JSON.stringify(o)); else localStorage.removeItem(KLUC); } catch { /* bez ukladania */ } };
const cas = (iso) => { try { return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const zdrojZUrl = () => {
  const t = new URLSearchParams(window.location.search).get('typ');
  const m = { beachflag: 'Plážové vlajky', zastava: 'Zástavy', celenka: 'Čelenky', buffka: 'Buffky', transfer3d: '3D transfery', stolova: 'Stolové vlajky', snurka: 'Šnúrky na krk', folie: 'Rezané fólie', ponuka: 'Ponuka dresov', sietotlac: 'Sieťotlač', potlac: 'Potlač textilu' };
  return m[t] || 'Konfigurátor';
};

export default function ChatWidget() {
  const [cfg, setCfg] = useState(() => window.__pbtChatCfg || {});
  const [otvorene, setOtvorene] = useState(false);
  const [konv, setKonv] = useState(() => nacitajUlozene()); // { id, token, meno, email }
  const [spravy, setSpravy] = useState([]);
  const [online, setOnline] = useState(false);
  const [nove, setNove] = useState(0); // neprečítané odpovede, kým je okno zavreté
  const [meno, setMeno] = useState(() => nacitajUlozene()?.meno || '');
  const [email, setEmail] = useState(() => nacitajUlozene()?.email || '');
  const [telefon, setTelefon] = useState('');
  const [text, setText] = useState('');
  const [hp, setHp] = useState('');
  const [odosielam, setOdosielam] = useState(false);
  const [chyba, setChyba] = useState('');
  const [zaloha, setZaloha] = useState(false);
  const poRef = useRef(0);
  const koniecRef = useRef(null);
  const otvoreneRef = useRef(false);
  useEffect(() => { otvoreneRef.current = otvorene; }, [otvorene]);

  useEffect(() => {
    const f = () => setCfg(window.__pbtChatCfg || {});
    window.addEventListener('pbt-chat-cfg', f);
    return () => window.removeEventListener('pbt-chat-cfg', f);
  }, []);

  const volaj = useCallback(async (body) => {
    if (!supabase) throw new Error('Chat nie je dostupný.');
    const { data, error } = await supabase.functions.invoke('chat', { body });
    if (error) throw new Error(error.message || 'Spojenie zlyhalo.');
    return data || {};
  }, []);

  // odkaz z e-mailu: ?chat=ID&t=TOKEN — pokračovanie v konverzácii
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get('chat'), token = p.get('t');
    if (id && token) { const o = { id, token, meno: nacitajUlozene()?.meno || '', email: nacitajUlozene()?.email || '' }; uloz(o); setKonv(o); setOtvorene(true); }
  }, []);

  const doplnSpravy = useCallback((nove_) => {
    if (!nove_?.length) return;
    setSpravy((s) => {
      const ids = new Set(s.map((x) => x.id));
      const pridane = nove_.filter((x) => !ids.has(x.id));
      if (!pridane.length) return s;
      poRef.current = Math.max(poRef.current, ...pridane.map((x) => x.id));
      if (!otvoreneRef.current && pridane.some((x) => x.od === 'admin')) setNove((n) => n + pridane.filter((x) => x.od === 'admin').length);
      return [...s, ...pridane];
    });
  }, []);

  // priebežné načítavanie: pri otvorenom okne každé 3 s, pri zavretom (ak konverzácia existuje) každých 20 s; stav "online" každú minútu
  useEffect(() => {
    let zrusene = false;
    const obnov = async () => {
      try {
        if (konv?.id) {
          const d = await volaj({ akcia: 'nacitaj', id: konv.id, token: konv.token, po: poRef.current });
          if (zrusene) return;
          if (d.neplatna) { uloz(null); setKonv(null); setSpravy([]); poRef.current = 0; return; }
          setOnline(!!d.online); doplnSpravy(d.spravy);
        } else {
          const d = await volaj({ akcia: 'stav' });
          if (!zrusene) setOnline(!!d.online);
        }
      } catch { /* sieť — skúsime znova */ }
    };
    obnov();
    const ms = otvorene ? 3000 : (konv?.id ? 20000 : 60000);
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') obnov(); }, ms);
    return () => { zrusene = true; clearInterval(t); };
  }, [konv?.id, konv?.token, otvorene, volaj, doplnSpravy]);

  useEffect(() => { if (otvorene) { setNove(0); setTimeout(() => koniecRef.current?.scrollIntoView({ block: 'end' }), 50); } }, [otvorene, spravy.length]);

  const odoslat = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setOdosielam(true); setChyba('');
    try {
      if (!konv) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setChyba('Zadajte platný e-mail.'); setOdosielam(false); return; }
        try {
          const d = await volaj({ akcia: 'start', meno: meno.trim(), email: email.trim(), telefon: telefon.trim(), text: t, aplikacia: cfg.zdroj || zdrojZUrl(), url: window.location.href, jazyk: aktualnyJazyk(), hp });
          if (!d.ok) { setChyba(d.error || 'Odoslanie zlyhalo.'); setOdosielam(false); return; }
          const o = { id: d.id, token: d.token, meno: meno.trim(), email: email.trim() };
          uloz(o); setKonv(o); setOnline(!!d.online); poRef.current = 0; setSpravy([]); setText('');
        } catch {
          // záloha: kontaktný formulár obchodu (e-mail)
          const data = new URLSearchParams();
          data.set('form_type', 'contact'); data.set('utf8', '✓'); data.set('contact[name]', meno.trim() || 'Zákazník z konfigurátora'); data.set('contact[email]', email.trim());
          if (telefon.trim()) data.set('contact[phone]', telefon.trim());
          data.set('contact[body]', `[${cfg.zdroj || zdrojZUrl()}]\n${t}`);
          await fetch(SHOP_KONTAKT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() });
          setZaloha(true); setText('');
        }
      } else {
        const d = await volaj({ akcia: 'posli', id: konv.id, token: konv.token, text: t });
        if (!d.ok) { setChyba(d.error || 'Odoslanie zlyhalo.'); setOdosielam(false); return; }
        setText(''); doplnSpravy([d.sprava]); setOnline(!!d.online);
      }
    } catch { setChyba('Odoslanie zlyhalo — skúste to prosím znova.'); }
    setOdosielam(false);
  };

  const novaKonverzacia = () => { uloz(null); setKonv(null); setSpravy([]); poRef.current = 0; setZaloha(false); setText(''); };
  const dole = cfg.nadListou ? 'bottom-24' : 'bottom-5';

  return (
    <div className="contents">
      <button onClick={() => setOtvorene((o) => !o)} className={`fixed ${dole} right-5 z-[9999] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-4 py-3 rounded-full shadow-xl transition`} aria-label="Chat">
        <MessageCircle className="w-5 h-5" /> <span className="hidden sm:inline">Opýtať sa</span>
        {online && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-600" title="Sme online" />}
        {nove > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold flex items-center justify-center border-2 border-white">{nove}</span>}
      </button>

      {otvorene && (
        <div className={`fixed z-[9999] right-0 sm:right-5 ${cfg.nadListou ? 'sm:bottom-40' : 'sm:bottom-20'} bottom-0 w-full sm:w-96 max-h-[85vh] sm:max-h-[34rem] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden`}>
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Chat s PBT print</p>
              <p className="text-[11px] opacity-90 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-300' : 'bg-slate-300'}`} />{online ? 'Sme online — odpíšeme hneď' : 'Momentálne nie sme online — odpovieme čo najskôr'}</p>
            </div>
            <button onClick={() => setOtvorene(false)} className="p-1 rounded hover:bg-white/15" aria-label="Zavrieť"><X className="w-5 h-5" /></button>
          </div>

          {zaloha ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-sm font-bold text-emerald-600">Otázka bola odoslaná e-mailom.</p>
              <p className="text-xs text-slate-500">Ozveme sa vám čo najskôr na uvedený kontakt.</p>
              <button onClick={() => { setZaloha(false); setOtvorene(false); }} className="mt-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Zavrieť</button>
            </div>
          ) : !konv ? (
            <form onSubmit={odoslat} className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-500">{online ? 'Napíšte nám otázku — práve sme online a odpíšeme vám hneď tu v okne.' : 'Napíšte nám otázku — odpoveď uvidíte tu v okne a dostanete ju aj e-mailom.'}</p>
              <input value={meno} onChange={(e) => setMeno(e.target.value)} placeholder="Meno" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail *" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Telefón (voliteľné)" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <textarea required rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Napíšte, čo vás zaujíma…" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              {chyba && <p className="text-xs text-rose-600">{chyba}</p>}
              <button type="submit" disabled={odosielam} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2"><Send className="w-4 h-4" /> {odosielam ? 'Odosielam…' : 'Začať chat'}</button>
              <p className="text-[11px] text-slate-400 leading-snug">Vaše údaje použijeme len na odpoveď na túto otázku. Viac v <a href="https://pbtprint.sk/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Zásadách ochrany osobných údajov</a>.</p>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 min-h-[12rem]">
                {spravy.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Načítavam konverzáciu…</p>}
                {spravy.map((s) => (
                  <div key={s.id} className={`flex ${s.od === 'zakaznik' ? 'justify-end' : 'justify-start'}`}>
                    <div translate="no" className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${s.od === 'zakaznik' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                      {s.od === 'admin' && <span className="block text-[10px] font-bold text-indigo-600 mb-0.5">{s.autor || 'PBT Print'}</span>}
                      {s.text}
                      <span className={`block text-[10px] mt-1 ${s.od === 'zakaznik' ? 'text-indigo-200' : 'text-slate-400'}`}>{cas(s.created_at)}</span>
                    </div>
                  </div>
                ))}
                {!online && spravy.length > 0 && spravy[spravy.length - 1].od === 'zakaznik' && <p className="text-[11px] text-slate-400 text-center">Momentálne nie sme online. Odpoveď sa zobrazí tu a príde aj e-mailom na {konv.email}.</p>}
                <div ref={koniecRef} />
              </div>
              <form onSubmit={odoslat} className="p-2 border-t border-slate-200 bg-white flex items-end gap-2">
                <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); odoslat(); } }} placeholder="Napíšte správu…" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none max-h-24" />
                <button type="submit" disabled={odosielam || !text.trim()} className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white" aria-label="Odoslať"><Send className="w-4 h-4" /></button>
              </form>
              {chyba && <p className="px-3 pb-1 text-xs text-rose-600">{chyba}</p>}
              <button onClick={novaKonverzacia} className="text-[11px] text-slate-400 hover:text-slate-600 py-1.5">Začať novú konverzáciu</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
