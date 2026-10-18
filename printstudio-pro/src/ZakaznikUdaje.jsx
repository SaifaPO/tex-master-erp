import React, { useState } from 'react';

// Kontaktné a fakturačné údaje zákazníka pred objednávkou (spoločné pre všetky konfigurátory).
// E-mail aj telefón sú povinné (kuriér vyžaduje obe). "Objednávam na firmu" zobrazí pole firmy (IČO, DIČ, IČ DPH) a fakturačnú
// adresu; dodacia adresa môže byť iná. Údaje idú do Edge Function (zakaznik) a z nej do Shopify draft objednávky.

const KLUC = 'tex_zakaznik_udaje_v1';
const PRAZDNA_ADRESA = { ulica: '', mesto: '', psc: '', krajina: 'SK' };
const PRAZDNE = { email: '', telefon: '', meno: '', firma: false, nazovFirmy: '', ico: '', dic: '', icDph: '', fakturacna: { ...PRAZDNA_ADRESA }, inaDodacia: false, dodacia: { ...PRAZDNA_ADRESA } };

// Údaje sa pamätajú v prehliadači (len pohodlie, aby ich zákazník nemusel písať znova) — chyba úložiska nič nerozbije.
const nacitaj = () => {
  try { const v = JSON.parse(localStorage.getItem(KLUC) || 'null'); if (v && typeof v === 'object') return { ...PRAZDNE, ...v, fakturacna: { ...PRAZDNA_ADRESA, ...(v.fakturacna || {}) }, dodacia: { ...PRAZDNA_ADRESA, ...(v.dodacia || {}) } }; } catch { /* nič */ }
  return PRAZDNE;
};

export function useZakaznikUdaje() {
  const [z, setZ] = useState(nacitaj);
  const nastav = (patch) => setZ((prev) => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem(KLUC, JSON.stringify(next)); } catch { /* nič */ }
    return next;
  });
  const chyba = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(z.email.trim())) return 'Zadaj platný e-mail (potrebný na potvrdenie a doručenie).';
    if (z.telefon.replace(/\D/g, '').length < 8) return 'Zadaj telefónne číslo — kuriér ho vyžaduje spolu s e-mailom.';
    if (z.firma) {
      if (!z.nazovFirmy.trim()) return 'Zadaj názov firmy.';
      if (z.ico.replace(/\D/g, '').length < 6) return 'Zadaj IČO firmy.';
      if (!z.fakturacna.ulica.trim() || !z.fakturacna.mesto.trim() || !z.fakturacna.psc.trim()) return 'Vyplň fakturačnú adresu firmy (ulica, mesto, PSČ).';
      if (z.inaDodacia && (!z.dodacia.ulica.trim() || !z.dodacia.mesto.trim() || !z.dodacia.psc.trim())) return 'Vyplň dodaciu adresu (ulica, mesto, PSČ).';
    }
    return '';
  };
  const payload = () => ({ ...z, email: z.email.trim(), telefon: z.telefon.trim() });
  return { z, nastav, chyba, payload };
}

export default function ZakaznikUdaje({ zak, tmava = false }) {
  const { z, nastav } = zak;
  const box = tmava ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800';
  const pole = tmava ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';
  const label = tmava ? 'text-slate-400' : 'text-slate-500';
  const input = `w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 ${pole}`;
  const adresa = (kluc, nadpis) => (
    <div className="space-y-1.5">
      <span className={`text-[11px] font-bold block ${label}`}>{nadpis}</span>
      <input className={input} placeholder="Ulica a číslo" value={z[kluc].ulica} onChange={(e) => nastav({ [kluc]: { ...z[kluc], ulica: e.target.value } })} autoComplete={kluc === 'fakturacna' ? 'billing street-address' : 'shipping street-address'} />
      <div className="grid grid-cols-[1fr_2fr] gap-1.5">
        <input className={input} placeholder="PSČ" value={z[kluc].psc} onChange={(e) => nastav({ [kluc]: { ...z[kluc], psc: e.target.value } })} autoComplete="postal-code" />
        <input className={input} placeholder="Mesto" value={z[kluc].mesto} onChange={(e) => nastav({ [kluc]: { ...z[kluc], mesto: e.target.value } })} autoComplete="address-level2" />
      </div>
      <select className={input} value={z[kluc].krajina} onChange={(e) => nastav({ [kluc]: { ...z[kluc], krajina: e.target.value } })}>
        <option value="SK">Slovensko</option><option value="CZ">Česko</option><option value="PL">Poľsko</option><option value="HU">Maďarsko</option><option value="AT">Rakúsko</option>
      </select>
    </div>
  );
  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 ${box}`}>
      <span className="text-xs font-bold block">Kontakt a fakturácia</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={input} type="email" placeholder="E-mail *" value={z.email} onChange={(e) => nastav({ email: e.target.value })} autoComplete="email" />
        <input className={input} type="tel" placeholder="Telefón * (pre kuriéra)" value={z.telefon} onChange={(e) => nastav({ telefon: e.target.value })} autoComplete="tel" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
        <input type="checkbox" checked={z.firma} onChange={(e) => nastav({ firma: e.target.checked })} className="w-4 h-4 accent-indigo-600" /> Objednávam na firmu (IČO, DIČ, fakturačná adresa)
      </label>
      {z.firma && (
        <div className="space-y-2 pt-1">
          <input className={input} placeholder="Názov firmy *" value={z.nazovFirmy} onChange={(e) => nastav({ nazovFirmy: e.target.value })} autoComplete="organization" />
          <input className={input} placeholder="Meno a priezvisko kontaktnej osoby" value={z.meno} onChange={(e) => nastav({ meno: e.target.value })} autoComplete="name" />
          <div className="grid grid-cols-3 gap-1.5">
            <input className={input} placeholder="IČO *" value={z.ico} onChange={(e) => nastav({ ico: e.target.value })} inputMode="numeric" />
            <input className={input} placeholder="DIČ" value={z.dic} onChange={(e) => nastav({ dic: e.target.value })} />
            <input className={input} placeholder="IČ DPH" value={z.icDph} onChange={(e) => nastav({ icDph: e.target.value })} />
          </div>
          {adresa('fakturacna', 'Fakturačná adresa')}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input type="checkbox" checked={z.inaDodacia} onChange={(e) => nastav({ inaDodacia: e.target.checked })} className="w-4 h-4 accent-indigo-600" /> Dodacia adresa je iná ako fakturačná
          </label>
          {z.inaDodacia && adresa('dodacia', 'Dodacia adresa')}
        </div>
      )}
      {!z.firma && <p className={`text-[10px] ${label}`}>Adresu doručenia doplníte v ďalšom kroku pri platbe.</p>}
    </div>
  );
}
