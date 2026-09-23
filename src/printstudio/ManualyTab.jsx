import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Flag, Waves, HelpCircle } from 'lucide-react';

// Rovnaky vzor ako v PredajnyCennikTab.jsx — docasne premenuje kartu prehliadaca, aby "Ulozit ako
// PDF" navrhlo rozumny nazov suboru, potom ho vrati spat.
function printWithFilename(suggestedName) {
  const originalTitle = document.title;
  const safeName = (suggestedName || 'dokument').replace(/[\\/:*?"<>|]/g, '-');
  document.title = safeName;
  const restoreTitle = () => { document.title = originalTitle; window.removeEventListener('afterprint', restoreTitle); };
  window.addEventListener('afterprint', restoreTitle);
  window.print();
  setTimeout(restoreTitle, 3000);
}

// Zdielany set jednoduchych ciarovych ikon (rovnaky vizualny jazyk pre oba plagaty aj manual).
const ic = 'w-full h-full';
const I = {
  tape: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><circle cx="24" cy="24" r="15" /><circle cx="24" cy="24" r="5" /><path d="M35 35 L54 54" /><path d="M46 46 h8 v8" /></svg>,
  warn: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 8 L59 54 H5 Z" /><path d="M32 25 v14" /><circle cx="32" cy="45" r="2.2" fill="currentColor" stroke="none" /></svg>,
  sew: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M8 44 Q20 28 32 44 T56 44" /><circle cx="48" cy="16" r="7" /><path d="M48 23 v10" /><path d="M8 20 h20 M8 26 h14" /></svg>,
  laser: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><rect x="10" y="10" width="18" height="12" rx="2" /><path d="M28 16 L54 42" /><path d="M54 42 l6 6 M46 42 l-4 8 M58 34 l6 4" /></svg>,
  grommet: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><circle cx="24" cy="32" r="12" /><circle cx="24" cy="32" r="5" /><circle cx="42" cy="20" r="8" opacity="0.55" /><circle cx="42" cy="20" r="3" opacity="0.55" /></svg>,
  carabiner: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M22 44 a14 14 0 1 1 14 -14 v6" /><path d="M36 22 v-6 a4 4 0 0 1 8 0 v10 a4 4 0 0 1 -4 4 h-6" /><circle cx="22" cy="44" r="3" /></svg>,
  strap: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><rect x="14" y="8" width="14" height="48" rx="3" /><path d="M14 20 h14 M14 32 h14 M14 44 h14" /></svg>,
  tunnel: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><rect x="8" y="24" width="30" height="16" rx="8" /><path d="M46 16 v32" /></svg>,
  palette: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 10 C17 10 8 21 8 33 c0 8 6 12 12 12 h4 a4 4 0 0 1 4 4 v2 c0 4 4 6 8 4 c10-4 16-14 16-22 C52 20 43 10 32 10 Z" /><circle cx="20" cy="30" r="2.4" fill="currentColor" stroke="none" /><circle cx="30" cy="22" r="2.4" fill="currentColor" stroke="none" /><circle cx="42" cy="26" r="2.4" fill="currentColor" stroke="none" /></svg>,
  sparkle: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 8 L36 26 L54 30 L36 34 L32 52 L28 34 L10 30 L28 26 Z" /></svg>,
  image: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><rect x="10" y="14" width="44" height="34" rx="3" /><circle cx="22" cy="26" r="4" /><path d="M12 44 l14-14 10 10 8-8 16 16" /></svg>,
  flagIcon: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M14 6 v52" /><path d="M14 10 h32 l-8 10 8 10 h-32" /></svg>,
  feather: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M46 10 C30 12 16 28 14 54 C40 52 54 38 50 12 Z" /><path d="M18 50 L46 12" /></svg>,
  tear: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 8 C18 26 12 38 16 48 a16 16 0 0 0 32 0 C52 38 46 26 32 8 Z" /></svg>,
  blade: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M26 6 C40 10 46 26 40 56 C24 54 16 40 20 18 C21 12 23 8 26 6 Z" /></svg>,
  wing: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M40 6 C20 10 10 26 14 56 C34 52 48 36 46 12 Z" /><path d="M16 40 C24 38 32 30 36 20" opacity="0.55" /></svg>,
  poleNone: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 4 v56" /></svg>,
  poleBasic: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 4 v56" /><path d="M24 10 h16" /><path d="M20 60 h24" /></svg>,
  polePro: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 4 v56" /><path d="M22 10 h20" /><path d="M18 60 h28" /><circle cx="32" cy="32" r="4" opacity="0.6" /></svg>,
  cross: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 10 v44 M10 32 h44" transform="rotate(45 32 32)" /><path d="M32 4 v20" /><rect x="26" y="46" width="12" height="10" rx="1" /></svg>,
  plate: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><rect x="10" y="38" width="44" height="10" rx="2" /><path d="M32 38 v-24" /><path d="M24 20 h16" /></svg>,
  spike: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 4 v30" /><path d="M22 34 h20 l-10 26 Z" /></svg>,
  waterbag: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M32 10 c10 14 16 22 16 30 a16 16 0 0 1 -32 0 c0-8 6-16 16-30 Z" /><path d="M24 40 q8 6 16 0" opacity="0.5" /></svg>,
  info: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><circle cx="32" cy="32" r="24" /><path d="M32 20 v2 M32 28 v16" /></svg>,
  bolt: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M34 6 L14 36 h14 l-4 22 22-32 H32 Z" /></svg>,
  cart: () => <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={ic}><path d="M8 10 h6 l6 30 h28 l6-20 H20" /><circle cx="24" cy="50" r="4" /><circle cx="44" cy="50" r="4" /></svg>,
};

function Step({ num, title, children, accent }) {
  return (
    <div className="grid grid-cols-[40px_1fr] gap-4 mb-6 last:mb-0">
      <div className={`w-10 h-10 rounded-xl ${accent} text-white font-extrabold text-lg flex items-center justify-center shrink-0`}>{num}</div>
      <div>
        <h2 className="font-extrabold text-base mb-2.5">{title}</h2>
        {children}
      </div>
    </div>
  );
}
function OptGrid({ children, cols }) {
  return <div className={`grid gap-2.5 ${cols || 'grid-cols-2 sm:grid-cols-4'}`}>{children}</div>;
}
function Opt({ icon: Icon, t, d, price, tone }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
      <div className={`w-6 h-6 mb-1.5 ${tone}`}><Icon /></div>
      <div className="text-xs font-bold">{t}</div>
      {d && <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{d}</div>}
      {price && <div className={`text-[11px] font-bold mt-0.5 ${tone}`}>{price}</div>}
    </div>
  );
}

function VlajkyPoster() {
  return (
    <div>
      <div className="bg-gradient-to-r from-teal-600 to-indigo-700 text-white rounded-t-2xl p-8 -m-8 mb-6">
        <div className="text-[11px] font-bold tracking-widest uppercase opacity-85 mb-1.5">PrintStudio Pro · Konfigurátor</div>
        <h1 className="text-3xl font-black mb-1.5">Ako objednať vlajku na mieru</h1>
        <p className="text-sm opacity-90 max-w-md">Krok za krokom presne podľa poradia v online konfigurátore.</p>
      </div>

      <Step num="1" title="Rozmer a materiál" accent="bg-teal-600">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {['30 cm', '50 cm', '75 cm', '100 cm'].map(s => <span key={s} className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold">{s}</span>)}
          <span className="border border-teal-600 text-teal-700 bg-teal-50 rounded-lg px-2.5 py-1 text-xs font-bold">150×100 cm · pomer 3:2</span>
          <span className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold">vlastný rozmer</span>
        </div>
        <p className="text-[11px] text-slate-500 mb-2.5">Plus výber materiálu podľa účelu použitia (interiér/exteriér, priesvitnosť, hmotnosť).</p>
        <div className="flex gap-2.5 bg-amber-50 border border-amber-300 rounded-xl p-3">
          <div className="w-5 h-5 text-amber-700 shrink-0 mt-0.5"><I.warn /></div>
          <p className="text-xs text-amber-800 leading-relaxed"><b>Dôležité:</b> šírka vlajky je obmedzená šírkou rolky zvoleného materiálu (zvyčajne 150 cm) — vlajka sa <b>nezošíva</b> z viacerých dielov. Ak zákazník potrebuje širšiu vlajku, treba zvoliť materiál so širšou rolkou. Dĺžka obmedzená nie je (bežne do ~500 cm).</p>
        </div>
      </Step>

      <Step num="2" title="Grafika a dizajn" accent="bg-teal-600">
        <OptGrid>
          <Opt icon={I.palette} t="Farba a Pantone" d="Farba pozadia + knižnica odtieňov" tone="text-teal-700" />
          <Opt icon={I.flagIcon} t="Štátna vlajka" d="Knižnica ~29 štátov ako podklad" tone="text-teal-700" />
          <Opt icon={I.image} t="Vlastné logo/obrázok" d="Nahratie vlastnej grafiky" tone="text-teal-700" />
          <Opt icon={I.sparkle} t="AI generátor" d="Vlastný text alebo AI grafika" tone="text-teal-700" />
        </OptGrid>
      </Step>

      <Step num="3" title="Ukončenie okrajov" accent="bg-teal-600">
        <OptGrid cols="grid-cols-2">
          <Opt icon={I.sew} t="Obšité dookola" d="Dvojitý steh niťou" tone="text-teal-700" />
          <Opt icon={I.laser} t="Orezané laserom" d="Tepelne zatavený okraj" tone="text-teal-700" />
        </OptGrid>
      </Step>

      <Step num="4" title="Uchytenie a doplnky" accent="bg-teal-600">
        <OptGrid>
          <Opt icon={I.tunnel} t="Tunely / rukávy" d="Strana hore/dole/vľavo/vpravo" tone="text-teal-700" />
          <Opt icon={I.grommet} t="Kovové očká" d="Všetky strany / 4 rohy / vlastné" tone="text-teal-700" />
          <Opt icon={I.carabiner} t="Kovové karabínky" d="Strana + počet" tone="text-teal-700" />
          <Opt icon={I.strap} t="Spevňujúci popruh" d="Po stranách" tone="text-teal-700" />
        </OptGrid>
        <p className="text-[11px] text-slate-500 mt-3 mb-1.5">Rýchle hotové kombinácie (predvyplnia doplnky automaticky):</p>
        <div className="flex flex-wrap gap-1.5">
          {['Stožiarová vlajka', 'Uličná zástava', 'Plotový banner', 'Karabínky + popruh'].map(t => (
            <span key={t} className="bg-teal-50 text-teal-700 rounded-lg px-2.5 py-1 text-[11px] font-bold">{t}</span>
          ))}
        </div>
      </Step>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 mt-6 pt-4 text-[11px] text-slate-500 font-semibold">
        <div className="flex items-center gap-2"><span className="w-4 h-4 text-teal-600"><I.bolt /></span>Expresné vyhotovenie (+príplatok) = odoslanie do 24/48 h od schválenia grafiky</div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 text-teal-600"><I.cart /></span>Cena sa prepočítava naživo podľa počtu kusov</div>
      </div>
    </div>
  );
}

function BeachvlajkyPoster() {
  return (
    <div>
      <div className="bg-gradient-to-r from-orange-600 to-red-700 text-white rounded-t-2xl p-8 -m-8 mb-6">
        <div className="text-[11px] font-bold tracking-widest uppercase opacity-85 mb-1.5">PrintStudio Pro · Konfigurátor</div>
        <h1 className="text-3xl font-black mb-1.5">Ako objednať beachvlajku</h1>
        <p className="text-sm opacity-90 max-w-md">Krok za krokom presne podľa poradia v online konfigurátore.</p>
      </div>

      <Step num="1" title="Tvar" accent="bg-orange-600">
        <OptGrid>
          <Opt icon={I.feather} t="Pierko (Feather)" tone="text-orange-700" />
          <Opt icon={I.tear} t="Slza (Tear)" tone="text-orange-700" />
          <Opt icon={I.blade} t="Čepeľ (Blade)" tone="text-orange-700" />
          <Opt icon={I.wing} t="Krídlo (Wing)" tone="text-orange-700" />
        </OptGrid>
      </Step>

      <Step num="2" title="Veľkosť a materiál" accent="bg-orange-600">
        <table className="w-full text-xs mb-2">
          <thead><tr className="text-[10px] uppercase text-slate-500"><th className="text-left font-bold py-1">Veľ.</th><th className="text-left font-bold py-1">Výška</th><th className="text-left font-bold py-1">Plátno</th><th className="text-left font-bold py-1">Od</th></tr></thead>
          <tbody>
            {[['S', '220 cm', '50×190 cm', '45 €'], ['M', '350 cm', '65×290 cm', '55 €'], ['L', '450 cm', '80×380 cm', '70 €'], ['XL', '550 cm', '90×480 cm', '90 €']].map(row => (
              <tr key={row[0]} className="border-t border-slate-200">
                <td className="py-1.5 font-bold">{row[0]}</td><td className="py-1.5">{row[1]}</td><td className="py-1.5">{row[2]}</td><td className="py-1.5 font-extrabold text-orange-700">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500">Plus výber materiálu z knižnice podľa účelu použitia.</p>
      </Step>

      <Step num="3" title="Opracovanie okrajov a konštrukcia" accent="bg-orange-600">
        <OptGrid cols="grid-cols-2 mb-2.5">
          <Opt icon={I.sew} t="Obšitie dookola" d="Spevnené dvojité prešitie" tone="text-orange-700" />
          <Opt icon={I.laser} t="Orezané laserom" d="Čistý okraj bez nití, ľahšie" tone="text-orange-700" />
        </OptGrid>
        <OptGrid cols="grid-cols-3">
          <Opt icon={I.poleNone} t="Bez konštrukcie" price="0 €" tone="text-orange-700" />
          <Opt icon={I.poleBasic} t="Basic laminát prút" price="+14 €" tone="text-orange-700" />
          <Opt icon={I.polePro} t="PRO hliník + sklo" price="+24 €" tone="text-orange-700" />
        </OptGrid>
      </Step>

      <Step num="4" title="Grafika" accent="bg-orange-600">
        <OptGrid cols="grid-cols-3">
          <Opt icon={I.palette} t="Farba a Pantone" tone="text-orange-700" />
          <Opt icon={I.image} t="Vlastné logo/obrázok" tone="text-orange-700" />
          <Opt icon={I.sparkle} t="AI generátor / text" tone="text-orange-700" />
        </OptGrid>
      </Step>

      <Step num="5" title="Podstavec" accent="bg-orange-600">
        <OptGrid>
          <Opt icon={I.cross} t="Krížový (skladací)" price="+18 € · max 5 ks" tone="text-orange-700" />
          <Opt icon={I.plate} t="Oceľová platňa 4 kg" price="+28 € · max 5 ks" tone="text-orange-700" />
          <Opt icon={I.spike} t="Zapichovací tŕň" price="+15 € · max 5 ks" tone="text-orange-700" />
          <Opt icon={I.waterbag} t="Vodný vak 10 L" price="+8 € · max 5 ks" tone="text-orange-700" />
        </OptGrid>
        <div className="flex gap-2.5 bg-sky-50 border border-sky-200 rounded-xl p-3 mt-3">
          <div className="w-5 h-5 text-sky-700 shrink-0 mt-0.5"><I.info /></div>
          <p className="text-xs text-sky-800 leading-relaxed">Cena beachvlajky = základná cena veľkosti + opracovanie okrajov + prút + zvolené podstavce + prípadný expresný príplatok, podľa počtu kusov.</p>
        </div>
      </Step>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 mt-6 pt-4 text-[11px] text-slate-500 font-semibold">
        <div className="flex items-center gap-2"><span className="w-4 h-4 text-orange-600"><I.bolt /></span>Expresné vyhotovenie (+príplatok)</div>
        <div className="flex items-center gap-2"><span className="w-4 h-4 text-orange-600"><I.cart /></span>Cena sa prepočítava naživo podľa počtu kusov</div>
      </div>
    </div>
  );
}

const QA = [
  { q: 'Zákazník chce vlajku 2 metre širokú — dá sa to zošiť z dvoch kusov?', no: true, a: <>Šírka je vždy len taká, akú má rolka materiálu (bežne 150 cm) — panely sa <b>nezošívajú</b>. Over v knižnici, či existuje materiál so širšou rolkou; ak nie, ponúkni max. šírku alebo zmenu orientácie.</> },
  { q: 'Je rozdiel medzi obšitím a orezaním laserom len vizuálny?', a: <>Väčšinou áno, ale <b>obšitie je odolnejšie</b> pri dlhodobom vonkajšom používaní (veterné namáhanie okraja), laser dáva čistejší a o niečo ľahší okraj — pre exteriér/vlajkosláv odporúčaj obšitie, pre interiér/eventy je laser v poriadku.</> },
  { q: 'Zákazník si vybral "Bez konštrukcie" pri beachvlajke — čo presne dostane?', yes: true, a: <>Len samotné potlačené plátno — žiadny prút, žiadny podstavec. Vždy sa opýtaj, či zákazník má vlastnú konštrukciu (napr. z predošlej objednávky), inak príde vlajka, ktorú nemá na čom vystaviť.</> },
  { q: 'Aký podstavec odporučiť, keď zákazník nevie?', a: <>Tvrdý rovný povrch → <b>krížový skladací</b> alebo <b>oceľová platňa</b> (platňa je stabilnejšia pri vetre, ťažšia na prenášanie). Tráva/piesok → <b>zapichovací tŕň</b>. Vodný vak sa <b>pridáva ako doplnková záťaž</b> k inému podstavcu, sám o sebe vlajku nepostaví.</> },
  { q: 'Rýchle šablóny pri vlajkách sú fixné balíčky?', no: true, a: <>Len predvyplnia bežnú kombináciu doplnkov, zákazník ich potom môže ľubovoľne upraviť. Neber ich ako uzavretý produkt s vlastnou cenou.</> },
  { q: '"Expresné vyhotovenie" garantuje dodanie do 24/48 h od objednávky?', no: true, a: <>Lehota beží <b>od schválenia grafického návrhu/tlačových podkladov</b>, nie od momentu objednávky. Vždy to zákazníkovi vysvetli vopred.</> },
  { q: 'Štátna vlajka pri objednávke znamená, že sa nedá pridať vlastné logo?', no: true, a: <>Nesprávne. Štátna vlajka je len podklad (nahrádza jednofarebné pozadie) — logo/text sa dá pridať navyše cez grafický editor rovnako ako pri inom podklade.</> },
];

function ObchodniciManual() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1.5">Manuál pre obchodníkov — vlajky a beachvlajky</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-2xl">Rýchla referencia + odpovede na najčastejšie nedorozumenia, aby sa neobjednalo niečo, čo sa reálne nedá vyrobiť.</p>

      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <div className="border border-slate-200 rounded-xl p-4">
          <span className="inline-block bg-teal-50 text-teal-700 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded mb-2">Vlajky</span>
          <ul className="text-xs space-y-1.5 text-slate-700">
            <li><b>Limit šírky</b> = šírka rolky materiálu (zvyčajne 150 cm), nezošíva sa</li>
            <li><b>Limit dĺžky</b> — neobmedzená, bežne do ~500 cm</li>
            <li><b>Okraje</b> — obšité dookola / orezané laserom</li>
            <li><b>Doplnky</b> — tunely, očká, karabínky, popruh</li>
            <li><b>Grafika</b> — farba/Pantone, štátna vlajka, logo, AI</li>
          </ul>
        </div>
        <div className="border border-slate-200 rounded-xl p-4">
          <span className="inline-block bg-orange-50 text-orange-700 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded mb-2">Beachvlajky</span>
          <ul className="text-xs space-y-1.5 text-slate-700">
            <li><b>Tvary</b> — Pierko, Slza, Čepeľ, Krídlo (len vzhľad)</li>
            <li><b>Veľkosti</b> — S 45€ / M 55€ / L 70€ / XL 90€ (od)</li>
            <li><b>Konštrukcia</b> — bez / basic +14€ / PRO +24€</li>
            <li><b>Podstavce</b> — krížový, platňa, tŕň, vodný vak (max 5ks)</li>
          </ul>
        </div>
      </div>

      <h2 className="text-sm font-extrabold uppercase tracking-wide border-b-2 border-slate-800 pb-1.5 mb-3">Časté nedorozumenia pri objednávke</h2>
      <div className="space-y-3">
        {QA.map((item, i) => (
          <div key={i} className="border-b border-dotted border-slate-300 pb-3 last:border-none">
            <p className="text-xs font-bold mb-1">{i + 1}. {item.q}</p>
            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              {item.no && <span className="text-rose-600 font-bold">Nie. </span>}
              {item.yes && <span className="text-emerald-600 font-bold">Áno. </span>}
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const DOCUMENTS = [
  { id: 'vlajky', label: 'Vlajky', icon: Flag, render: VlajkyPoster },
  { id: 'beachvlajky', label: 'Beachvlajky', icon: Waves, render: BeachvlajkyPoster },
  { id: 'obchodnici', label: 'Manuál pre obchodníkov', icon: HelpCircle, render: ObchodniciManual },
];

export default function ManualyTab() {
  const [activeDoc, setActiveDoc] = useState('vlajky');
  const [showPrint, setShowPrint] = useState(false);
  const doc = DOCUMENTS.find(d => d.id === activeDoc);
  const DocContent = doc.render;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Printer className="text-indigo-400 h-5 w-5" /> Manuály na tlač (A4)</h2>
        <p className="text-xs text-slate-400 mt-1">Sprievodcovia objednávkou vlajky/beachvlajky (na vytlačenie pre predajňu) a rýchla referencia + Q&amp;A pre obchodníkov.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-fit">
        {DOCUMENTS.map(d => {
          const Icon = d.icon;
          return (
            <button key={d.id} onClick={() => setActiveDoc(d.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${activeDoc === d.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
              <Icon className="w-3.5 h-3.5" /> {d.label}
            </button>
          );
        })}
      </div>

      <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition">
        <Printer className="w-4 h-4" /> Generovať / Tlačiť A4
      </button>

      {/* rovnaky portal-do-body vzor ako PredajnyCennikTab.jsx — bez neho by sa nahlad pri tlaci
          schoval spolu s "print:hidden" obalom, ktory ho skryva na obrazovke. */}
      {showPrint && createPortal(
        <div className="fixed inset-0 bg-slate-950/95 z-50 overflow-y-auto print:relative print:inset-auto print:bg-white">
          <div className="max-w-4xl mx-auto bg-white text-black p-8 my-6 rounded-xl print:my-0 print:rounded-none print:shadow-none shadow-2xl">
            <div className="flex justify-between items-center mb-2 print:hidden">
              <button onClick={() => printWithFilename(doc.label)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Printer className="h-4 w-4" /> Tlačiť / Uložiť ako PDF</button>
              <button onClick={() => setShowPrint(false)} className="p-1.5 rounded bg-slate-200 text-slate-600 hover:text-slate-900"><X className="h-5 w-5" /></button>
            </div>
            <DocContent />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
