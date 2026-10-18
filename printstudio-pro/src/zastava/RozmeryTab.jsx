import React, { useEffect } from 'react';
import { Ruler, Layers, Scissors, Sparkles } from 'lucide-react';
import NumberInput from '../NumberInput';

// Proporcne rozmery podla pomeru bezneho standardu 150x100 (3:2). Sirka je fyzicky obmedzena
// sirkou rolky materialu (vlajka nemoze byt sirsia ako vlajkovina) — vyska/dlzka nie je sirkou
// rolky obmedzena, len prakticky (bezne robime do cca 500cm).
const POMER = 150 / 100; // 3:2
function rozmer(w, h, standard) {
  return { w, h, label: `${w}×${h}`, standard };
}
const STD_ROZMERY = [
  rozmer(30, Math.round(30 / POMER)),
  rozmer(50, Math.round(50 / POMER)),
  rozmer(75, Math.round(75 / POMER)),
  rozmer(100, Math.round(100 / POMER)),
  rozmer(150, 100, true),
  rozmer(Math.round(150 * POMER), 150),
];

const SABLONY = [
  { id: 'stoziar', nazov: 'Stožiarová vlajka', popis: 'Tunel hore + karabínky vľavo' },
  { id: 'ulicna', nazov: 'Uličná zástava', popis: 'Obojstranný tunel hore aj dole' },
  { id: 'plot', nazov: 'Plotový banner', popis: 'Očká po celom obvode' },
  { id: 'karabiny', nazov: 'Karabínky + popruh', popis: 'Spevnená ľavá strana' },
];

export default function RozmeryTab({
  materialy, materialKod, onMaterial,
  obojstranna, onObojstranna, sendvicInfo,
  sirkaCm, vyskaCm, onRozmery,
  vyhotovenie, onVyhotovenie,
  onSablona,
  onDalej,
}) {
  const vybranyMaterial = materialy.find(m => m.kod === materialKod);
  const maxSirka = Number(vybranyMaterial?.sirka_rolky_cm) || 150;
  const nastavRozmery = (w, h) => onRozmery(Math.min(w, maxSirka), h);

  // Ak zakaznik prepne na material s uzsou rolkou, nez ma aktualne zadanu sirku, treba ju
  // znizit na novy limit (inak by ostala "neplatna" sirka nad realnou sirkou vlajkoviny).
  useEffect(() => {
    if (sirkaCm > maxSirka) onRozmery(maxSirka, vyskaCm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSirka]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2"><Ruler className="w-4 h-4 text-indigo-600" /> Rozmery vlajky (cm)</label>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {STD_ROZMERY.map((r) => (
            <button
              key={r.label}
              onClick={() => nastavRozmery(r.w, r.h)}
              title={r.standard ? 'Štandardný pomer 3:2' : undefined}
              className={`text-[11px] px-2 py-1 rounded ${r.standard ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold ring-1 ring-indigo-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[11px] text-slate-500 mb-1">Šírka (cm) — max {maxSirka} pre vybraný materiál</span>
            <NumberInput min="20" max={maxSirka} value={sirkaCm} onChange={(v) => nastavRozmery(v, vyskaCm)} fallback={20} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 mb-1">Výška/dĺžka (cm)</span>
            <NumberInput min="20" max="1000" value={vyskaCm} onChange={(v) => onRozmery(sirkaCm, v)} fallback={20} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Plocha: {((sirkaCm * vyskaCm) / 10000).toFixed(2)} m² • Šírka je obmedzená šírkou rolky materiálu, dĺžka nie je (bežne do cca 500 cm).</p>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Layers className="w-4 h-4 text-indigo-600" /> Materiál vlajkoviny</label>
        <div className="space-y-2">
          {materialy.map(m => (
            <label key={m.kod} className={`flex items-start gap-3 p-2.5 border rounded-lg transition ${obojstranna && m.je_mesh ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${materialKod === m.kod ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="material" checked={materialKod === m.kod} disabled={!!(obojstranna && m.je_mesh)} onChange={() => onMaterial(m.kod)} className="mt-1 text-indigo-600" />
              <div className="flex-1 text-xs">
                <span className="font-bold text-slate-800 block">{m.nazov}{obojstranna && m.je_mesh && <span className="ml-1.5 text-[10px] font-semibold text-rose-600">(na sendvič sa nepoužíva)</span>}</span>
                {m.popis && <p className="text-slate-500 text-[11px]">{m.popis}</p>}
                {m.pouzitie && <p className="text-slate-400 text-[10px] mt-0.5">Použitie: {m.pouzitie}</p>}
              </div>
            </label>
          ))}
          {materialy.length === 0 && <p className="text-xs text-slate-500">Katalóg materiálov je zatiaľ prázdny.</p>}
        </div>
        {onObojstranna && materialy.some(m => !m.je_mesh) && (
          <label className={`mt-3 flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${obojstranna ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={!!obojstranna} className="mt-1 w-4 h-4 accent-indigo-600" onChange={() => {
              const zapnut = !obojstranna;
              onObojstranna(zapnut);
              const vybrany = materialy.find(m => m.kod === materialKod);
              if (zapnut && vybrany?.je_mesh) onMaterial(materialy.find(m => !m.je_mesh).kod); // mesh sa na sendvic nepouziva
            }} />
            <div className="text-xs">
              <span className="font-bold text-slate-800 block">Obojstranná sendvičová zástava (3 vrstvy)</span>
              <p className="text-[11px] text-slate-500">Motív je čitateľný z oboch strán — dve potlačené látky a vnútorná zatmavovacia vrstva proti presvitaniu. Zástava je ťažšia a drahšia.</p>
              {obojstranna && sendvicInfo?.priplatokKus != null && <p className="text-xs font-black text-indigo-600 mt-1">+{Number(sendvicInfo.priplatokKus).toFixed(2)} € bez DPH za kus</p>}
            </div>
          </label>
        )}
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Scissors className="w-4 h-4 text-indigo-600" /> Úprava okrajov</label>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer ${vyhotovenie === 'obsite' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" checked={vyhotovenie === 'obsite'} onChange={() => onVyhotovenie('obsite')} className="text-indigo-600" />
            <div><span className="font-bold block text-slate-800">Obšité dookola</span><span className="text-[10px] text-slate-500">Dvojitý steh s nitou</span></div>
          </label>
          <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer ${vyhotovenie === 'laser' ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" checked={vyhotovenie === 'laser'} onChange={() => onVyhotovenie('laser')} className="text-indigo-600" />
            <div><span className="font-bold block text-slate-800">Orezané laserom</span><span className="text-[10px] text-slate-500">Tepelne zatavený okraj</span></div>
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-600" /> Rýchle šablóny vyhotovenia</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {SABLONY.map(s => (
            <button key={s.id} onClick={() => onSablona(s.id)} className="p-2 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-lg text-left transition">
              <div className="font-bold text-slate-800">{s.nazov}</div>
              <div className="text-[10px] text-slate-500">{s.popis}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Šablóna len predvyplní tunely/karabínky/popruh v ďalšom kroku — vždy si ich tam vieš doladiť.</p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button onClick={onDalej} disabled={!materialKod} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">Pokračovať na Grafiku →</button>
      </div>
    </div>
  );
}
