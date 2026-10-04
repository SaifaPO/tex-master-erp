import React, { useState } from 'react';
import { MessageCircleQuestion, X, Send } from 'lucide-react';

// Posiela otazku cez ESTE Shopify kontaktny formular (rovnaky mechanizmus ako stranka
// pbtprint.sk/pages/contact — Shopify to uz automaticky posiela mailom majitelovi obchodu,
// takze tu nepotrebujeme ziadnu vlastnu emailovu sluzbu ani Edge Function). Appky bezia mimo
// domeny obchodu (Vercel), preto request ide s mode: 'no-cors' — je to teda "fire and forget":
// browser request odosle, ale JS nevie precitat odpoved (CORS to blokuje). Pri realnom teste
// treba naozaj skontrolovat dorucenie mailu, appka sama uspech potvrdit nevie.
const SHOP_KONTAKT_URL = 'https://pbtprint.sk/contact';

export default function AskQuestion({ zdroj, nadListou = false }) {
  const [otvorene, setOtvorene] = useState(false);
  const [meno, setMeno] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [sprava, setSprava] = useState('');
  const [odosielam, setOdosielam] = useState(false);
  const [odoslane, setOdoslane] = useState(false);
  const [chyba, setChyba] = useState('');

  const zavriet = () => {
    setOtvorene(false);
    setOdoslane(false);
    setChyba('');
  };

  const odoslat = async (e) => {
    e.preventDefault();
    if (!email.trim() || !sprava.trim()) { setChyba('Vyplňte aspoň e-mail a otázku.'); return; }
    setOdosielam(true);
    setChyba('');
    try {
      const data = new URLSearchParams();
      data.set('form_type', 'contact');
      data.set('utf8', '✓');
      data.set('contact[name]', meno.trim() || 'Zákazník z konfigurátora');
      data.set('contact[email]', email.trim());
      if (telefon.trim()) data.set('contact[phone]', telefon.trim());
      data.set('contact[body]', `[${zdroj}]\n${sprava.trim()}`);

      await fetch(SHOP_KONTAKT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      setOdoslane(true);
      setMeno(''); setEmail(''); setTelefon(''); setSprava('');
    } catch (err) {
      setChyba('Odoslanie zlyhalo — skúste to prosím znova, alebo napíšte cez stránku Kontakt.');
    } finally {
      setOdosielam(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOtvorene(true)}
        className={`fixed ${nadListou ? 'bottom-24' : 'bottom-5'} right-5 z-[9999] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-4 py-3 rounded-full shadow-xl transition`}
      >
        <MessageCircleQuestion className="w-5 h-5" /> <span className="hidden sm:inline">Opýtať sa</span>
      </button>

      {otvorene && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4 text-indigo-600" /> Máte otázku?</h3>
              <button onClick={zavriet} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            {odoslane ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm font-bold text-emerald-600">Otázka bola odoslaná.</p>
                <p className="text-xs text-slate-500">Ozveme sa vám čo najskôr na uvedený kontakt.</p>
                <button onClick={zavriet} className="mt-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Zavrieť</button>
              </div>
            ) : (
              <form onSubmit={odoslat} className="space-y-3">
                <p className="text-xs text-slate-500">Napíšte nám otázku priamo tu — príde nám rovnako ako správa cez stránku Kontakt.</p>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Meno</label>
                  <input value={meno} onChange={(e) => setMeno(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Voliteľné" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">E-mail *</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="vas@email.sk" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Telefón</label>
                  <input value={telefon} onChange={(e) => setTelefon(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Voliteľné" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Otázka *</label>
                  <textarea required rows={3} value={sprava} onChange={(e) => setSprava(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Napíšte, čo vás zaujíma…" />
                </div>
                {chyba && <p className="text-xs text-rose-600">{chyba}</p>}
                <button type="submit" disabled={odosielam} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                  <Send className="w-4 h-4" /> {odosielam ? 'Odosielam…' : 'Odoslať otázku'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
