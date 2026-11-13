import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';
import { cenaPotlace, METODY_POTLACE, nacitaj3dNaklad, nacitaj3dMoznosti } from './printstudio/kalkulaciaPotlace';

// Kalkulačka „Viac potlačí“ (Cenové ponuky): jeden dopyt s VIACERÝMI potlačami (napr. malé logo vpredu + veľké vzadu na chrbte).
// Každú potlač zadáš zvlášť (umiestnenie, technológia, rozmer…), na konci je rozpísaná cena každej potlače a súčet.
// Cena každej potlače = rovnaký vzorec ako v kalkulačke „Potlač“ (VC z Kostry cien × marža podľa počtu kusov, min. cena úkonu).
const UMIESTNENIA = ['Hruď — srdce', 'Hruď — stred', 'Chrbát', 'Ľavý rukáv', 'Pravý rukáv', 'Nohavica', 'Šiltovka — čelo', 'Iné'];

const novaPotlac = (kostra, n) => ({
  id: `vp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  nazov: UMIESTNENIA[n] || '',
  metoda: 'dtf', sirka: 10, vyska: 10, farby: 1, velkostId: 'vlastny', tmavy: false, zlozitost: 'jednoduche', foliaId: kostra?.folie?.[0]?.id ?? '', uroven: 'medium', lak: 'partial',
});

// Dva režimy: samostatný (Cenové ponuky) a „vložený“ do testovacej kalkulačky (PrintStudio Pro → Potlače) — vtedy je Potlač 1 zadaná
// hore v testovacej kalkulačke (`prva`), počet kusov a zľava klienta sa preberajú zhora (`ksExt`, `zlavaExt`) a tu sa len pridávajú ďalšie potlače.
export default function ViacPotlaciKalkulacka({ kostra, fmtMoney, inputCls, labelCls, onPridat, prva, ksExt, zlavaExt, supabase }) {
  const [moznosti3d, setMoznosti3d] = useState({ urovne: [], laky: [] });
  const [tick3d, setTick3d] = useState(0);
  useEffect(() => { if (supabase) nacitaj3dMoznosti(supabase).then(setMoznosti3d); }, [supabase]);
  const vlozeny = !!prva;
  const [dalsie, setDalsie] = useState(() => (vlozeny ? [] : [novaPotlac(kostra, 0)]));
  const [nazov1, setNazov1] = useState('Hruď — srdce');
  const [ksVlastne, setKs] = useState(1);
  const [klient, setKlient] = useState({ on: false, pct: 15 });

  const ks = ksExt != null ? ksExt : ksVlastne;
  const kusov = Math.max(1, Math.round(Number(ks)) || 1);
  const zlava = zlavaExt != null ? zlavaExt : (klient.on ? Math.min(90, Math.max(0, Number(klient.pct) || 0)) : 0);
  const potlace = useMemo(() => (vlozeny ? [{ ...prva, id: 'prva', nazov: nazov1, pevna: true }, ...dalsie] : dalsie), [vlozeny, prva, nazov1, dalsie]);
  const setPotlace = setDalsie;
  // 3D transfery: náklad príde zo servera (asynchrónne) — po načítaní sa výpočet prekreslí
  const kluc3dVsetky = potlace.filter((p) => p.metoda === 't3d').map((p) => `${p.sirka}x${p.vyska}|${p.uroven}|${p.lak}`).join(';');
  useEffect(() => {
    if (!supabase || !kluc3dVsetky) return undefined;
    const t = setTimeout(() => {
      Promise.all(potlace.filter((p) => p.metoda === 't3d').map((p) => nacitaj3dNaklad(supabase, p, kusov))).then(() => setTick3d((x) => x + 1));
    }, 500); // krátke oneskorenie, kým sa dopíše rozmer
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, kluc3dVsetky, kusov]);
  const vypocty = useMemo(() => potlace.map((p) => {
    const p3 = p.metoda === 't3d' ? { ...p, urovenNazov: moznosti3d.urovne.find((u) => u.kod === p.uroven)?.nazov, lakNazov: moznosti3d.laky.find((l) => l.kod === p.lak)?.nazov } : p;
    const r = cenaPotlace(kostra, p3, kusov);
    const jedn = Math.round(r.jednotkova * (1 - zlava / 100) * 100) / 100;
    return { ...r, jednotkovaKlient: jedn, spolu: Math.round(jedn * kusov * 100) / 100 };
  }), [potlace, kusov, zlava, kostra, moznosti3d, tick3d]);

  const sucetKs = Math.round(vypocty.reduce((s, v) => s + v.jednotkovaKlient, 0) * 100) / 100;
  const sucetSpolu = Math.round(vypocty.reduce((s, v) => s + v.spolu, 0) * 100) / 100;
  const sucetVc = vypocty.reduce((s, v) => s + v.vc, 0);
  const sucetBezZlavy = vypocty.reduce((s, v) => s + v.jednotkova, 0);
  const chybaNiekde = vypocty.some((v) => v.chyba || !(v.jednotkova > 0));

  const zmen = (id, patch) => setPotlace((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const pridajPotlac = () => setPotlace((l) => [...l, novaPotlac(kostra, l.length + (vlozeny ? 1 : 0))]);
  const zmazPotlac = (id) => setPotlace((l) => (vlozeny || l.length > 1 ? l.filter((p) => p.id !== id) : l));

  const polozka = (p, v, i) => ({
    key: `it-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Potlač${p.nazov ? ` — ${p.nazov}` : ''} — ${v.label}`,
    desc: `VC ${v.vc.toFixed(3)} €/ks × marža ${v.marza.toFixed(0)} % (pri ${kusov} ks) = ${v.jednotkova.toFixed(2)} €/ks${zlava > 0 ? ` • zľava klienta ${zlava} % → ${v.jednotkovaKlient.toFixed(2)} €/ks` : ''}`,
    badge: '', price: Number(v.jednotkovaKlient.toFixed(2)), qty: kusov,
  });
  const pridajZvlast = () => onPridat(potlace.map((p, i) => polozka(p, vypocty[i], i)));
  const pridajJednu = () => onPridat([{
    key: `it-${Date.now()}-sum`,
    title: `Potlač — ${potlace.length} motívy: ${potlace.map((p, i) => p.nazov || `č. ${i + 1}`).join(' + ')}`,
    desc: potlace.map((p, i) => `${p.nazov || `č. ${i + 1}`}: ${vypocty[i].label} = ${vypocty[i].jednotkovaKlient.toFixed(2)} €/ks`).join(' • '),
    badge: '', price: Number(sucetKs.toFixed(2)), qty: kusov,
  }]);

  return (
    <div className="space-y-2.5">
      {!vlozeny && (
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <p className="text-[11px] text-slate-400 flex-1">Zadaj každú potlač zvlášť (napr. <em>malé logo vpredu</em> a <em>veľké na chrbát</em>) — dole uvidíš cenu každej a súčet. Počet kusov je spoločný.</p>
          <div className="w-24"><label className={labelCls}>Počet kusov</label><input type="number" min="1" value={ksVlastne} onChange={(e) => setKs(e.target.value)} className={inputCls} /></div>
        </div>
      )}

      {vlozeny && (
        <div className="bg-slate-900 border border-indigo-900/50 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-300 w-14 shrink-0">Potlač 1</span>
          <input list="vp-umiestnenia" value={nazov1} onChange={(e) => setNazov1(e.target.value)} placeholder="Umiestnenie (napr. Hruď)" className={`${inputCls} flex-1 min-w-[9rem]`} />
          <span className="text-[11px] text-slate-400">{vypocty[0]?.label} <span className="text-slate-600">— zo zadania a vybranej technológie vyššie</span></span>
        </div>
      )}

      {potlace.map((p, i) => {
        if (p.pevna) return null;
        const def = METODY_POTLACE.find((m) => m.id === p.metoda);
        const v = vypocty[i];
        const vlastnyFormat = !p.velkostId || p.velkostId === 'vlastny';
        return (
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-300 w-14 shrink-0">Potlač {i + 1}</span>
              <input list="vp-umiestnenia" value={p.nazov} onChange={(e) => zmen(p.id, { nazov: e.target.value })} placeholder="Umiestnenie (napr. Chrbát)" className={`${inputCls} flex-1 min-w-[9rem]`} />
              <select value={p.metoda} onChange={(e) => zmen(p.id, { metoda: e.target.value })} className={`${inputCls} w-40 shrink-0`}>
                {METODY_POTLACE.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button type="button" onClick={() => zmazPotlac(p.id)} disabled={!vlozeny && potlace.length < 2} title="Zmazať potlač" className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(def?.needsRozmer || (def?.needsFormat && vlastnyFormat)) && (<>
                <div><label className={labelCls}>Šírka (cm)</label><input type="number" min="0" value={p.sirka} onChange={(e) => zmen(p.id, { sirka: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Výška (cm)</label><input type="number" min="0" value={p.vyska} onChange={(e) => zmen(p.id, { vyska: e.target.value })} className={inputCls} /></div>
              </>)}
              {def?.needsFormat && (
                <div className="col-span-2 sm:col-span-2">
                  <label className={labelCls}>Formát</label>
                  <select value={p.velkostId} onChange={(e) => zmen(p.id, { velkostId: e.target.value })} className={inputCls}>
                    <option value="vlastny">Vlastný rozmer</option>
                    {kostra.sietotlacVelkosti.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
              )}
              {def?.needs3d && (<>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>3D efekt (hrúbka)</label>
                  <select value={p.uroven} onChange={(e) => zmen(p.id, { uroven: e.target.value })} className={inputCls}>
                    {moznosti3d.urovne.length === 0 && <option value={p.uroven}>{p.uroven}</option>}
                    {moznosti3d.urovne.map((u) => <option key={u.kod} value={u.kod}>{u.nazov}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Lak</label>
                  <select value={p.lak} onChange={(e) => zmen(p.id, { lak: e.target.value })} className={inputCls}>
                    {moznosti3d.laky.length === 0 && <option value={p.lak}>{p.lak}</option>}
                    {moznosti3d.laky.map((l) => <option key={l.kod} value={l.kod}>{l.nazov}</option>)}
                  </select>
                </div>
              </>)}
              {def?.needsFolia && (
                <div className="col-span-2">
                  <label className={labelCls}>Typ fólie</label>
                  <select value={p.foliaId} onChange={(e) => zmen(p.id, { foliaId: e.target.value })} className={inputCls}>
                    {kostra.folie.length === 0 && <option value="">-- žiadna fólia (pridaj v Kostra cien) --</option>}
                    {kostra.folie.map((f) => <option key={f.id} value={f.id}>{f.nazov}</option>)}
                  </select>
                </div>
              )}
              {def?.needsFolia && (
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Zložitosť loga</label>
                  <select value={p.zlozitost} onChange={(e) => zmen(p.id, { zlozitost: e.target.value })} className={inputCls}>
                    <option value="jednoduche">Jednoduché</option>
                    <option value="stredne">Stredne zložité</option>
                    <option value="zlozite">Zložité (veľa jemných detailov)</option>
                  </select>
                </div>
              )}
              {def?.colors && (
                <div><label className={labelCls}>Počet farieb</label><input type="number" min="1" value={p.farby} onChange={(e) => zmen(p.id, { farby: e.target.value })} className={inputCls} /></div>
              )}
              {def?.needsFormat && (
                <div className="flex items-end gap-1.5">
                  <button type="button" onClick={() => zmen(p.id, { tmavy: false })} className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border-2 ${!p.tmavy ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Svetlý</button>
                  <button type="button" onClick={() => zmen(p.id, { tmavy: true })} className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border-2 ${p.tmavy ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-700 text-slate-400'}`}>Tmavý</button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] border-t border-slate-800 pt-1.5">
              <span className="text-slate-500">{v.chyba || `VC ${v.vc.toFixed(3)} € • marža ${v.marza.toFixed(0)} %`}</span>
              <span className="text-emerald-400 font-bold font-mono">{fmtMoney(v.jednotkovaKlient)}/ks</span>
            </div>
          </div>
        );
      })}
      <datalist id="vp-umiestnenia">{UMIESTNENIA.map((u) => <option key={u} value={u} />)}</datalist>

      <button type="button" onClick={pridajPotlac} className="text-[11px] bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"><Plus className="h-3 w-3" /> Pridať ďalšiu potlač</button>

      {zlavaExt == null && <div className={`rounded-lg border px-3 py-2 flex flex-wrap items-center gap-2 ${klient.on ? 'border-amber-500/60 bg-amber-950/25' : 'border-slate-800 bg-slate-900'}`}>
        <button type="button" onClick={() => setKlient((k) => ({ ...k, on: !k.on }))} className={`px-2.5 py-1 rounded-md text-[11px] font-bold border-2 ${klient.on ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>Režim klienta: {klient.on ? 'ZAP' : 'VYP'}</button>
        <label className="text-[11px] text-slate-400 flex items-center gap-1">Zľava <input type="number" min="0" max="90" step="1" value={klient.pct} onChange={(e) => setKlient((k) => ({ ...k, pct: e.target.value }))} className="w-14 px-1.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white" /> % (na všetky potlače)</label>
        {[10, 15, 20].map((q) => <button key={q} type="button" onClick={() => setKlient({ on: true, pct: q })} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700">{q} %</button>)}
      </div>}

      {/* ROZPIS CENY: každá potlač zvlášť + súčet (vo vloženom režime až keď je pridaná aspoň jedna ďalšia potlač) */}
      {(!vlozeny || dalsie.length > 0) && <><div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden text-[11px]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 text-slate-500 uppercase tracking-wide text-[10px] bg-slate-950/60"><span>Potlač</span><span className="text-right">€/ks</span><span className="text-right">Spolu za {kusov} ks</span></div>
        {potlace.map((p, i) => (
          <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 border-t border-slate-800 text-slate-300">
            <span>{i + 1}. {p.nazov ? <strong>{p.nazov}</strong> : 'Potlač'} <span className="text-slate-500">— {vypocty[i].label}</span></span>
            <span className="text-right font-mono">{fmtMoney(vypocty[i].jednotkovaKlient)}</span>
            <span className="text-right font-mono text-emerald-400">{fmtMoney(vypocty[i].spolu)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 border-t border-slate-700 text-white font-bold bg-slate-950/40">
          <span>Spolu všetky potlače ({potlace.length}) — bez DPH</span>
          <span className="text-right font-mono">{fmtMoney(sucetKs)}</span>
          <span className="text-right font-mono text-emerald-400">{fmtMoney(sucetSpolu)}</span>
        </div>
        {zlava > 0 && (
          <div className="px-3 py-1.5 border-t border-slate-800 text-amber-300">Bežná cena bez zľavy: {fmtMoney(sucetBezZlavy)}/ks • {fmtMoney(sucetBezZlavy * kusov)} za {kusov} ks (zľava {zlava} %). VC spolu {sucetVc.toFixed(3)} €/ks.</div>
        )}
      </div>
      <p className="text-[10px] text-sky-300/90 font-semibold">💶 Ceny sú BEZ DPH — DPH sa pripočíta v súčte ponuky. Cena textilu v nich nie je.</p></>}

      {onPridat && <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={pridajJednu} disabled={chybaNiekde} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">Pridať do ponuky ako 1 položku</button>
        <button type="button" onClick={pridajZvlast} disabled={chybaNiekde} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="h-3 w-3" /> Pridať každú potlač zvlášť</button>
      </div>}
    </div>
  );
}
