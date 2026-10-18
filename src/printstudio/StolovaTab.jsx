import React, { useEffect, useState } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import { Pole, useNastavenia, ObchodneNastavenia, SkupinaMoznosti, ObjednavkyKarta, KalkulackaKarta, useErpProdukty } from './AdminPomocky';

// Stolové vlajky: veľkosti, tvary, ukončenie okrajov a podstavce majú každý vlastný náklad (ručne alebo z produktu v Katalógu).
// Náklad 1 ks = veľkosť + tvar + okraj + podstavec; predajnú cenu dopočíta server cez maržový modul.
export default function StolovaTab({ supabase }) {
  const { nast, zmen, chyba, ulozene } = useNastavenia(supabase, 'stolova_nastavenia');
  const erp = useErpProdukty(supabase);
  const [velkosti, setVelkosti] = useState([]);
  const [tvary, setTvary] = useState([]);
  const [okraje, setOkraje] = useState([]);
  const [podstavce, setPodstavce] = useState([]);
  const [kalk, setKalk] = useState({ velkost: '', tvar: '', okraj: '', podstavec: '', ks: 10 });

  useEffect(() => {
    if (!nast) return;
    (async () => {
      const [v, t, o, p] = await Promise.all([
        supabase.from('stolova_velkosti').select('*').order('poradie'), supabase.from('stolova_tvary').select('*').order('poradie'),
        supabase.from('stolova_okraje').select('*').order('poradie'), supabase.from('stolova_podstavce').select('*').order('poradie'),
      ]);
      setVelkosti(v.data || []); setTvary(t.data || []); setOkraje(o.data || []); setPodstavce(p.data || []);
      setKalk((k) => ({ ...k, velkost: (v.data || []).find((x) => x.kod === 'medium')?.kod || v.data?.[0]?.kod || '', tvar: t.data?.[0]?.kod || '', okraj: o.data?.[0]?.kod || '', podstavec: (p.data || []).find((x) => x.kod === 'chrome')?.kod || p.data?.[0]?.kod || '' }));
    })();
  }, [supabase, nast === null]); // eslint-disable-line react-hooks/exhaustive-deps

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (!nast) return <p className="text-sm text-slate-500">Načítavam…</p>;
  const sel = (zoznam, k) => <select value={kalk[k]} onChange={(e) => setKalk({ ...kalk, [k]: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{zoznam.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}</select>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Flag className="text-indigo-400 h-5 w-5" /> Stolové vlajky — dizajnér s vlastným dizajnom</h2>
          <p className="text-xs text-slate-400 mt-1">Zákazník si vyberie tvar, veľkosť, okraje a podstavec a nakreslí dizajn (líce aj rub). Tlačové PNG (≈ 300 DPI) dostanete pri objednávke. Všetky ceny tu sú bez DPH.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmen({ aktivny: e.target.checked })} /> Objednávanie zapnuté</label>
        </div>
      </div>

      <ObchodneNastavenia nast={nast} zmen={zmen} supabase={supabase} {...erp} />

      <SkupinaMoznosti supabase={supabase} tabulka="stolova_velkosti" nadpis="Veľkosti" popis="Rozmer plátna v mm a náklad na 1 ks (látka, tlač, šitie). Ak vyberiete produkt z Katalógu, náklad sa berie z jeho výrobnej ceny."
        riadky={velkosti} setRiadky={setVelkosti} priecinok="stolova" erp={erp} novy={{ sirka_mm: 150, vyska_mm: 220, naklad_eur: 0, popis: '' }}
        polia={[{ k: 'sirka_mm', l: 'Šírka', j: 'mm', step: '1' }, { k: 'vyska_mm', l: 'Výška', j: 'mm', step: '1' }, { k: 'naklad_eur', l: 'Náklad', j: '€/ks' }]} />
      <SkupinaMoznosti supabase={supabase} tabulka="stolova_tvary" nadpis="Tvary vlajky" popis="Tvar výrezu (erb, špic, zaoblená, trojuholník). Príplatok sa pripočíta k nákladu na 1 ks (odpad látky pri zložitejšom tvare)." mozeMazat={false}
        riadky={tvary} setRiadky={setTvary} priecinok="stolova" polia={[{ k: 'naklad_eur', l: 'Príplatok k nákladu', j: '€/ks' }]} />
      <SkupinaMoznosti supabase={supabase} tabulka="stolova_okraje" nadpis="Ukončenie okrajov" popis="Strapce alebo obsitie šnúrkou. Skupina určuje, v ktorej časti výberu sa možnosť zobrazí (strapce / snurka)."
        riadky={okraje} setRiadky={setOkraje} priecinok="stolova" erp={erp} novy={{ skupina: 'strapce', farba_hex: '#ffffff', naklad_eur: 0, popis: '' }} textovePolia={[{ k: 'skupina', l: 'Skupina (strapce / snurka)' }]}
        polia={[{ k: 'naklad_eur', l: 'Náklad', j: '€/ks' }]} />
      <SkupinaMoznosti supabase={supabase} tabulka="stolova_podstavce" nadpis="Podstavce / stojančeky" popis="Náklad na 1 ks podstavca (nákupná cena)."
        riadky={podstavce} setRiadky={setPodstavce} priecinok="stolova" erp={erp} novy={{ naklad_eur: 0, popis: '' }} polia={[{ k: 'naklad_eur', l: 'Náklad', j: '€/ks' }]} />

      <KalkulackaKarta supabase={supabase} funkcia="stolova-create-draft-order" pred={async () => { if (!ulozene) await new Promise((r) => setTimeout(r, 1000)); }}
        telo={{ velkost: kalk.velkost, tvar: kalk.tvar, okraj: kalk.okraj, podstavec: kalk.podstavec, pocetKs: kalk.ks }}
        popisky={{ velkost: 'Veľkosť', tvar: 'Tvar', okraj: 'Okraje', podstavec: 'Podstavec' }}>
        <div><label className="block text-slate-400 mb-1 text-xs">Veľkosť</label>{sel(velkosti, 'velkost')}</div>
        <div><label className="block text-slate-400 mb-1 text-xs">Tvar</label>{sel(tvary, 'tvar')}</div>
        <div><label className="block text-slate-400 mb-1 text-xs">Okraje</label>{sel(okraje, 'okraj')}</div>
        <div><label className="block text-slate-400 mb-1 text-xs">Podstavec</label>{sel(podstavce, 'podstavec')}</div>
        <div className="w-24"><Pole label="Počet ks" step="1" value={kalk.ks} onChange={(v) => setKalk({ ...kalk, ks: Math.max(1, Math.round(v)) })} /></div>
      </KalkulackaKarta>

      <ObjednavkyKarta supabase={supabase} tabulka="stolova_objednavky" nadpis="Prijaté objednávky stolových vlajok"
        popisRiadku={(o) => `${velkosti.find((x) => x.kod === o.velkost)?.nazov || o.velkost} · ${tvary.find((x) => x.kod === o.tvar)?.nazov || o.tvar} · ${okraje.find((x) => x.kod === o.okraj)?.nazov || o.okraj} · ${podstavce.find((x) => x.kod === o.podstavec)?.nazov || o.podstavec}`}
        subory={(o) => [{ cesta: o.subor_cesta, label: 'Líce (PNG)' }, { cesta: o.subor2_cesta, label: 'Rub (PNG)' }]} />
    </div>
  );
}
