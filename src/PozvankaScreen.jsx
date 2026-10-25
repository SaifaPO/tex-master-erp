import React, { useEffect, useState } from 'react';
import { Loader2, Lock, Check, AlertTriangle } from 'lucide-react';

// Obrazovka z osobného odkazu pozvánky (?pozvanka=TOKEN): zamestnanec zadá svoj e-mail a vymyslí si heslo,
// účet sa vytvorí a prepojí s jeho profilom (Edge Function employee-invite) a hneď ho to prihlási.
export default function PozvankaScreen({ supabase, token }) {
  const [stav, setStav] = useState('over'); // over | formular | neplatne
  const [meno, setMeno] = useState('');
  const [email, setEmail] = useState('');
  const [heslo, setHeslo] = useState('');
  const [heslo2, setHeslo2] = useState('');
  const [chyba, setChyba] = useState('');
  const [zaneprazdneny, setZaneprazdneny] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke('employee-invite', { body: { akcia: 'over', token } });
      if (error || !data?.ok) { setChyba(data?.error || 'Odkaz sa nepodarilo overiť.'); setStav('neplatne'); return; }
      setMeno(data.meno || '');
      setEmail(data.email || '');
      setStav('formular');
    })();
  }, [supabase, token]);

  const odosli = async (e) => {
    e.preventDefault();
    setChyba('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setChyba('Zadaj platný e-mail.'); return; }
    if (heslo.length < 8) { setChyba('Heslo musí mať aspoň 8 znakov.'); return; }
    if (heslo !== heslo2) { setChyba('Heslá sa nezhodujú.'); return; }
    setZaneprazdneny(true);
    const { data, error } = await supabase.functions.invoke('employee-invite', { body: { akcia: 'prijmi', token, email: email.trim(), heslo } });
    if (error || !data?.ok) { setZaneprazdneny(false); setChyba(data?.error || error?.message || 'Účet sa nepodarilo vytvoriť.'); return; }
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: heslo });
    setZaneprazdneny(false);
    if (loginErr) { setChyba('Účet je vytvorený, ale prihlásenie zlyhalo. Otvor ERP a prihlás sa e-mailom a heslom.'); setStav('hotovo'); return; }
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <img src="/logo-atak-pbt.png" alt="ATAK x PBT" className="h-10 w-auto brightness-0 invert mx-auto mb-2" />
          <h1 className="text-lg font-extrabold text-white">TEX-MASTER ERP</h1>
        </div>

        {stav === 'over' && (
          <div className="flex flex-col items-center gap-3 py-4"><Loader2 className="h-7 w-7 text-indigo-400 animate-spin" /><span className="text-xs text-slate-400">Overujem odkaz…</span></div>
        )}

        {stav === 'neplatne' && (
          <div className="space-y-3 text-center">
            <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
            <p className="text-sm text-rose-300">{chyba}</p>
            <a href="/" className="text-[11px] text-slate-500 hover:text-slate-300 underline">Prejsť na prihlásenie</a>
          </div>
        )}

        {stav === 'hotovo' && (
          <div className="space-y-3 text-center">
            <Check className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-slate-300">{chyba}</p>
            <a href="/" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg">Prejsť na prihlásenie</a>
          </div>
        )}

        {stav === 'formular' && (
          <form onSubmit={odosli} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-white">Vitaj{meno ? `, ${meno}` : ''}!</p>
              <p className="text-xs text-slate-400">Aby ti prístup fungoval, zadaj svoj e-mail a vymysli si heslo. Potom ťa to rovno prihlási.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Tvoj e-mail</label>
              <input type="email" autoFocus required value={email} onChange={(e) => { setEmail(e.target.value); setChyba(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Heslo (aspoň 8 znakov)</label>
              <input type="password" required value={heslo} onChange={(e) => { setHeslo(e.target.value); setChyba(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Zopakuj heslo</label>
              <input type="password" required value={heslo2} onChange={(e) => { setHeslo2(e.target.value); setChyba(''); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white" autoComplete="new-password" />
            </div>
            {chyba && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">{chyba}</p>}
            <button type="submit" disabled={zaneprazdneny} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm py-3 rounded-lg uppercase tracking-wider flex items-center justify-center gap-2">
              {zaneprazdneny ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Vytvoriť účet a prihlásiť
            </button>
            <p className="text-center text-[10px] text-slate-600">Odkaz je osobný a funguje len raz — nikomu ho nepreposielaj.</p>
          </form>
        )}
      </div>
    </div>
  );
}
