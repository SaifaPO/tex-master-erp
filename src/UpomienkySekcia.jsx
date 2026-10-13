import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, Save, Eye } from 'lucide-react';

// NASTAVENIE AUTOMATICKYCH UPOMIENOK (Edge Function send-payment-reminders): zapnutie, odosielatel, dni, pokuta,
// skusobny beh (nic neodosle) a zoznam odoslanych upomienok. Zakaznikov mozno vynat z upomienok.

const DEFAULTY = { zapnute: false, odosielatel_meno: 'Fakturácia', odosielatel_email: 'fakturacia@example.sk', kopia_email: '', dni_1: 3, dni_2: 14, dni_3: 30, uctovat_pokutu: false, pokuta_percent_denne: 0.05, pausal_eur: 40 };
const skDatumCas = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const STUPNE = { 1: 'Pripomienka', 2: 'Upomienka', 3: 'Posledná výzva' };

export default function UpomienkySekcia({ supabase, nazvyZakaznikovPoSplatnosti = [], triggerNotification = () => {} }) {
  const [nast, setNast] = useState(DEFAULTY);
  const [log, setLog] = useState([]);
  const [vynati, setVynati] = useState(new Set());
  const [chyba, setChyba] = useState('');
  const [uklada, setUklada] = useState(false);
  const [beh, setBeh] = useState(false);
  const [vysledok, setVysledok] = useState(null);
  const [otvorenyNahlad, setOtvorenyNahlad] = useState(null);

  const nacitaj = useCallback(async () => {
    const [n, l, c] = await Promise.all([
      supabase.from('upomienky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('upomienky_log').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('customers').select('name,nevysielat_upomienky'),
    ]);
    if (n.error) { setChyba(n.error.message.includes('upomienky_nastavenia') ? 'Tabuľky pre upomienky ešte neexistujú — spusti v Supabase SQL migráciu migration_upomienky.sql.' : n.error.message); return; }
    setChyba('');
    if (n.data) setNast({ ...DEFAULTY, ...n.data, kopia_email: n.data.kopia_email || '' });
    setLog(l.data || []);
    setVynati(new Set((c.data || []).filter((x) => x.nevysielat_upomienky).map((x) => String(x.name))));
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const uloz = async () => {
    setUklada(true);
    const { error } = await supabase.from('upomienky_nastavenia').upsert({
      id: 1, zapnute: !!nast.zapnute, odosielatel_meno: nast.odosielatel_meno, odosielatel_email: nast.odosielatel_email, kopia_email: nast.kopia_email || null,
      dni_1: Number(nast.dni_1) || 3, dni_2: Number(nast.dni_2) || 14, dni_3: Number(nast.dni_3) || 30,
      uctovat_pokutu: !!nast.uctovat_pokutu, pokuta_percent_denne: Number(nast.pokuta_percent_denne) || 0, pausal_eur: Number(nast.pausal_eur) || 0,
      updated_at: new Date().toISOString(),
    });
    setUklada(false);
    if (error) triggerNotification('error', 'Uloženie zlyhalo: ' + error.message); else triggerNotification('success', 'Nastavenie upomienok uložené.');
  };

  const skusobnyBeh = async () => {
    setBeh(true); setVysledok(null);
    const { data, error } = await supabase.functions.invoke('send-payment-reminders', { body: { dryRun: true } });
    setBeh(false);
    if (error || data?.error) { triggerNotification('error', 'Skúšobný beh zlyhal: ' + (data?.error || error.message) + ' (je funkcia send-payment-reminders nasadená?)'); return; }
    setVysledok(data);
  };

  const prepniVynatie = async (meno) => {
    const nove = new Set(vynati);
    const hodnota = !nove.has(meno);
    hodnota ? nove.add(meno) : nove.delete(meno);
    setVynati(nove);
    const { error } = await supabase.from('customers').update({ nevysielat_upomienky: hodnota }).eq('name', meno);
    if (error) { triggerNotification('error', error.message); nacitaj(); }
  };

  const inp = 'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white';
  const lab = 'block text-[10px] text-slate-400 font-semibold mb-0.5';
  const zakaznici = [...new Set(nazvyZakaznikovPoSplatnosti)];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Send className="h-4 w-4 text-indigo-400" /> Automatické upomienky</h3>
      <p className="text-xs text-slate-400">Každé ráno ERP skontroluje faktúry po splatnosti a pošle zákazníkovi e-mail (každý stupeň najviac raz). Neposiela sa, ak zákazník nemá e-mail, je vyňatý, alebo v banke leží nespárovaná platba s rovnakým variabilným symbolom a sumou.</p>
      {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chyba}</div>}

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-3">
        <label className="flex items-center gap-2 text-xs font-bold text-white"><input type="checkbox" checked={!!nast.zapnute} onChange={(e) => setNast({ ...nast, zapnute: e.target.checked })} /> Automatické odosielanie je zapnuté</label>
        {nast.zapnute && /example\.sk$/i.test(nast.odosielatel_email) && <p className="text-[11px] text-amber-300">Odosielateľ je zatiaľ fiktívny (example.sk) — e-maily sa nedoručia, kým nezadáš skutočnú adresu na overenej doméne.</p>}
        <div className="flex flex-wrap gap-3">
          <div><label className={lab}>Meno odosielateľa</label><input value={nast.odosielatel_meno} onChange={(e) => setNast({ ...nast, odosielatel_meno: e.target.value })} className={`${inp} w-44`} /></div>
          <div><label className={lab}>E-mail odosielateľa</label><input value={nast.odosielatel_email} onChange={(e) => setNast({ ...nast, odosielatel_email: e.target.value })} className={`${inp} w-56`} /></div>
          <div><label className={lab}>Kópia každej upomienky na (voliteľné)</label><input value={nast.kopia_email} onChange={(e) => setNast({ ...nast, kopia_email: e.target.value })} className={`${inp} w-56`} placeholder="napr. tvoj e-mail" /></div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className={lab}>Pripomienka po (dní)</label><input type="number" min="1" value={nast.dni_1} onChange={(e) => setNast({ ...nast, dni_1: e.target.value })} className={`${inp} w-20`} /></div>
          <div><label className={lab}>Upomienka po (dní)</label><input type="number" min="1" value={nast.dni_2} onChange={(e) => setNast({ ...nast, dni_2: e.target.value })} className={`${inp} w-20`} /></div>
          <div><label className={lab}>Posledná výzva po (dní)</label><input type="number" min="1" value={nast.dni_3} onChange={(e) => setNast({ ...nast, dni_3: e.target.value })} className={`${inp} w-20`} /></div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex items-center gap-2 text-xs text-slate-300 pb-1.5"><input type="checkbox" checked={!!nast.uctovat_pokutu} onChange={(e) => setNast({ ...nast, uctovat_pokutu: e.target.checked })} /> V poslednej výzve uviesť zmluvnú pokutu a paušál</label>
          <div><label className={lab}>Pokuta % za deň</label><input type="number" step="0.01" min="0" value={nast.pokuta_percent_denne} onChange={(e) => setNast({ ...nast, pokuta_percent_denne: e.target.value })} className={`${inp} w-20`} /></div>
          <div><label className={lab}>Paušál (€)</label><input type="number" step="1" min="0" value={nast.pausal_eur} onChange={(e) => setNast({ ...nast, pausal_eur: e.target.value })} className={`${inp} w-20`} /></div>
        </div>
        {nast.uctovat_pokutu && <p className="text-[11px] text-amber-300">Pokutu zapni až keď majú zákazníci odsúhlasené VOP s pokutou za omeškanie (pozri návrh VOP). Inak ju nemáš nárok vymáhať.</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={uloz} disabled={uklada} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">{uklada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Uložiť nastavenie</button>
          <button onClick={skusobnyBeh} disabled={beh} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">{beh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Skúšobný beh (nič sa neodošle)</button>
        </div>

        {vysledok && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
            <p className="font-bold text-white">Skúšobný beh: dnes by sa poslalo {vysledok.naOdoslanie?.length || 0} e-mailov, preskočených {vysledok.preskocene?.length || 0}.</p>
            {(vysledok.naOdoslanie || []).map((p) => (
              <div key={`${p.invoice_id}-${p.stupen}`} className="border-t border-slate-800 pt-1.5">
                <button onClick={() => setOtvorenyNahlad(otvorenyNahlad === p.invoice_id ? null : p.invoice_id)} className="text-left text-slate-200"><b>{p.faktura}</b> · {p.zakaznik} · {p.email} · {STUPNE[p.stupen]} ({p.dni} dní) <span className="text-indigo-400">{otvorenyNahlad === p.invoice_id ? '▲' : '▼ náhľad'}</span></button>
                {otvorenyNahlad === p.invoice_id && <pre className="whitespace-pre-wrap text-[11px] text-slate-400 font-sans mt-1">{`Predmet: ${p.predmet}\n\n${p.text}`}</pre>}
              </div>
            ))}
            {(vysledok.preskocene || []).map((p, i) => (<p key={i} className="text-slate-500 border-t border-slate-800 pt-1.5">Preskočené {p.faktura}: {p.dovod}</p>))}
          </div>
        )}
      </div>

      {zakaznici.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-bold text-white">Zákazníci s faktúrou po splatnosti — vyňať z automatických upomienok</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {zakaznici.map((m) => (<label key={m} className="flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={vynati.has(m)} onChange={() => prepniVynatie(m)} /> {m}</label>))}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]"><tr><th className="px-3 py-2">Kedy</th><th className="px-3 py-2">Faktúra</th><th className="px-3 py-2">Zákazník</th><th className="px-3 py-2">Stupeň</th><th className="px-3 py-2">Stav</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {log.map((l) => (
                <tr key={l.id}><td className="px-3 py-1.5">{skDatumCas(l.created_at)}</td><td className="px-3 py-1.5 font-mono text-indigo-400">{l.invoice_number}</td><td className="px-3 py-1.5">{l.customer_name}</td><td className="px-3 py-1.5">{STUPNE[l.stupen]}</td><td className={`px-3 py-1.5 font-bold ${l.stav === 'odoslane' ? 'text-emerald-400' : 'text-rose-400'}`} title={l.chyba || ''}>{l.stav === 'odoslane' ? 'Odoslané' : 'Chyba'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
