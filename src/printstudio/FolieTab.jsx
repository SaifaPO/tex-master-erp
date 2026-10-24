import React, { useEffect, useState } from 'react';
import { Scissors, AlertTriangle, Trash2, Plus } from 'lucide-react';
import { Karta, Pole, eur, useNastavenia, ObchodneNastavenia, SkupinaMoznosti, ObjednavkyKarta, KalkulackaKarta, useErpProdukty } from './AdminPomocky';

// Rezané fólie (vinyl): druhy fólií s farbami a nákupnou cenou €/bm, rolka, rezanie na plotri, separácia a príprava.
// Náklad = materiál (bm × cena × odpad) + rezanie (stroj + práca) + separácia (min/ks) + príprava, × riziko; predaj cez maržový modul.
export default function FolieTab({ supabase }) {
  const { nast, zmen, chyba, ulozene } = useNastavenia(supabase, 'folie_nastavenia');
  const erp = useErpProdukty(supabase);
  const [druhy, setDruhy] = useState([]);
  const [farby, setFarby] = useState([]);
  const [kalk, setKalk] = useState({ druh: '', farba: '', sirka: 150, vyska: 100, ks: 10, uroven: 'vylupanie' });

  useEffect(() => {
    if (!nast) return;
    (async () => {
      const [d, f] = await Promise.all([supabase.from('folie_druhy').select('*').order('poradie'), supabase.from('folie_farby').select('*').order('poradie')]);
      setDruhy(d.data || []); setFarby(f.data || []);
      const prvy = d.data?.[0]?.kod || '';
      setKalk((k) => ({ ...k, druh: prvy, farba: (f.data || []).find((x) => x.druh_kod === prvy)?.kod || '' }));
    })();
  }, [supabase, nast === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const zmenFarbu = async (kod, patch) => { setFarby((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x))); await supabase.from('folie_farby').update(patch).eq('kod', kod); };
  const pridajFarbu = async (druhKod) => {
    const nazov = window.prompt('Názov novej farby:'); if (!nazov?.trim()) return;
    const riadok = { kod: `${druhKod}_${Math.random().toString(36).slice(2, 7)}`, druh_kod: druhKod, nazov: nazov.trim(), hex: '#ffffff', poradie: farby.filter((x) => x.druh_kod === druhKod).length + 1 };
    const { error } = await supabase.from('folie_farby').insert(riadok);
    if (error) { window.alert('Pridanie zlyhalo: ' + error.message); return; }
    setFarby((rows) => [...rows, riadok]);
  };
  const zmazFarbu = async (kod) => { if (!window.confirm('Zmazať farbu?')) return; await supabase.from('folie_farby').delete().eq('kod', kod); setFarby((rows) => rows.filter((x) => x.kod !== kod)); };

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (!nast) return <p className="text-sm text-slate-500">Načítavam…</p>;
  const farbyKalk = farby.filter((x) => x.druh_kod === kalk.druh);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Scissors className="text-indigo-400 h-5 w-5" /> Rezané fólie — vektorový vyrezávaný transfer</h2>
          <p className="text-xs text-slate-400 mt-1">Zákazník nahrá vektorový súbor, zvolí rozmer, počet, druh a farbu fólie; motívy sa uložia na rolku a spočíta sa spotreba v bm. Ceny sú bez DPH.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmen({ aktivny: e.target.checked })} /> Objednávanie zapnuté</label>
        </div>
      </div>

      <Karta nadpis="Rolka a rozloženie motívov" popis="Šírka rolky a rezacia (pracovná) šírka — okraje sa nerežú. Medzera medzi motívmi sa pripočíta aj na konci rolky.">
        <Pole label="Šírka rolky" jednotka="mm" step="1" value={nast.sirka_rolky_mm} onChange={(v) => zmen({ sirka_rolky_mm: v })} />
        <Pole label="Pracovná (rezacia) šírka" jednotka="mm" step="1" value={nast.pracovna_sirka_mm} onChange={(v) => zmen({ pracovna_sirka_mm: v })} />
        <Pole label="Medzera medzi motívmi" jednotka="mm" step="0.5" value={nast.medzera_mm} onChange={(v) => zmen({ medzera_mm: v })} />
        <Pole label="Minimálny rozmer grafiky" jednotka="mm" step="1" value={nast.min_rozmer_mm} onChange={(v) => zmen({ min_rozmer_mm: v })} />
        <Pole label="Maximálna dĺžka objednávky" jednotka="mm" step="100" value={nast.max_dlzka_mm} onChange={(v) => zmen({ max_dlzka_mm: v })} />
        <Pole label="Odpad materiálu" jednotka="%" step="1" value={nast.odpad_percent} onChange={(v) => zmen({ odpad_percent: v })} />
      </Karta>

      <Karta nadpis="Rezanie, separácia a práca" popis="Rezanie plotrom sa počíta podľa dĺžky rolky, separácia (weeding) podľa počtu kusov — veľký motív trvá dlhšie ako malý.">
        <Pole label="Rezanie plotrom — čas na 1 bm" jednotka="min" value={nast.rez_min_bm} onChange={(v) => zmen({ rez_min_bm: v })} />
        <Pole label="Plotter — amortizácia + prevádzka" jednotka="€/hod" value={nast.stroj_rezanie_hod} onChange={(v) => zmen({ stroj_rezanie_hod: v })} />
        <Pole label="Cena práce pracovníka" jednotka="€/hod" value={nast.praca_hod} onChange={(v) => zmen({ praca_hod: v })} />
        <Pole label="Príprava súboru a plotra" jednotka="min / objednávka" value={nast.priprava_min} onChange={(v) => zmen({ priprava_min: v })} />
        <Pole label="Separácia — malý motív" jednotka="min / ks" value={nast.weeding_min_maly} onChange={(v) => zmen({ weeding_min_maly: v })} />
        <Pole label="Separácia — veľký motív" jednotka="min / ks" value={nast.weeding_min_velky} onChange={(v) => zmen({ weeding_min_velky: v })} />
        <Pole label="Za veľký motív sa považuje od" jednotka="mm (dlhší rozmer)" step="1" value={nast.hranica_velky_mm} onChange={(v) => zmen({ hranica_velky_mm: v })} />
        <Pole label="Koeficient rizika" jednotka="%" step="1" value={nast.riziko_percent} onChange={(v) => zmen({ riziko_percent: v })} />
      </Karta>

      <Karta nadpis="Nastrihanie (úroveň Full servis)" popis="Úrovne služby pre zákazníka: Len rezaná fólia (vylúpanie si robí sám) → Rezaná a vylúpaná → Full servis (vylúpané aj nastrihané). Nastrihanie sa účtuje ako samostatný príplatok: dĺžka rolky (bm) × minút na 1 bm × sadzba strihača, plus marža.">
        <Pole label="Sadzba strihača" jednotka="€/hod" step="0.5" value={nast.strihanie_hod} onChange={(v) => zmen({ strihanie_hod: v })} />
        <Pole label="Nastrihanie — malé motívy" jednotka="min / 1 bm" step="0.5" value={nast.strihanie_min_bm_maly} onChange={(v) => zmen({ strihanie_min_bm_maly: v })} />
        <Pole label="Nastrihanie — veľké motívy" jednotka="min / 1 bm" step="0.5" value={nast.strihanie_min_bm_velky} onChange={(v) => zmen({ strihanie_min_bm_velky: v })} />
        <Pole label="Marža na nastrihanie" jednotka="%" step="5" value={nast.strihanie_marza_percent} onChange={(v) => zmen({ strihanie_marza_percent: v })} />
      </Karta>

      <ObchodneNastavenia nast={nast} zmen={zmen} supabase={supabase} {...erp} />

      <SkupinaMoznosti supabase={supabase} tabulka="folie_druhy" nadpis="Druhy fólií" popis="Nákupná cena materiálu v €/bm (rolka 50 cm) a technické údaje, ktoré vidí zákazník (nažehlenie, pranie, hrúbka). Foto je ukážka materiálu."
        riadky={druhy} setRiadky={setDruhy} priecinok="folie" novy={{ cena_bm: 0, popis: '' }}
        polia={[{ k: 'cena_bm', l: 'Nákupná cena', j: '€/bm' }]}
        textovePolia={[{ k: 'interny_nazov', l: 'Interný názov (zákazník ho nevidí, napr. značka fólie)' }, { k: 'teplota', l: 'Teplota (napr. 150°C)' }, { k: 'cas', l: 'Čas (napr. 15s)' }, { k: 'odtrhnutie', l: 'Odtrhnutie (za tepla / studena)' }, { k: 'tlak', l: 'Tlak' }, { k: 'pranie', l: 'Pranie (napr. do 60°C)' }, { k: 'hrubka', l: 'Hrúbka (napr. 90 μm)' }, { k: 'trieda', l: 'Vzhľad: flock / reflective / metallic / glitter' }]}
        extra={(d) => (
          <div>
            <label className="block text-slate-500 mb-1.5 text-[11px]">Farby tohto druhu</label>
            <div className="flex flex-wrap gap-2">
              {farby.filter((x) => x.druh_kod === d.kod).map((f) => (
                <div key={f.kod} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg p-1.5">
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(f.hex) ? f.hex : '#ffffff'} onChange={(e) => zmenFarbu(f.kod, { hex: e.target.value })} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                  <input type="text" value={f.nazov} onChange={(e) => zmenFarbu(f.kod, { nazov: e.target.value })} className="w-28 bg-transparent text-xs text-white border-b border-slate-700" />
                  <button type="button" onClick={() => zmazFarbu(f.kod)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => pridajFarbu(d.kod)} className="flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200 px-2"><Plus className="w-3.5 h-3.5" /> farba</button>
            </div>
          </div>
        )} />

      <KalkulackaKarta supabase={supabase} funkcia="folie-create-draft-order" pred={async () => { if (!ulozene) await new Promise((r) => setTimeout(r, 1000)); }}
        telo={{ druh: kalk.druh, farba: kalk.farba, sirkaMm: kalk.sirka, vyskaMm: kalk.vyska, pocetKs: kalk.ks, uroven: kalk.uroven }}
        popisky={{ material: 'Materiál (fólia)', strojRezanie: 'Plotter (stroj)', praca: 'Pracovník (príprava, rezanie, vylúpanie)', riziko: 'Riziko', nastrihanie: 'Nastrihanie (náklad, bez marže)' }}>
        <div><label className="block text-slate-400 mb-1 text-xs">Druh fólie</label>
          <select value={kalk.druh} onChange={(e) => setKalk({ ...kalk, druh: e.target.value, farba: farby.find((x) => x.druh_kod === e.target.value)?.kod || '' })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{druhy.map((x) => <option key={x.kod} value={x.kod}>{x.nazov} — {eur(x.cena_bm)}/bm</option>)}</select></div>
        <div><label className="block text-slate-400 mb-1 text-xs">Farba</label>
          <select value={kalk.farba} onChange={(e) => setKalk({ ...kalk, farba: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">{farbyKalk.map((x) => <option key={x.kod} value={x.kod}>{x.nazov}</option>)}</select></div>
        <div className="w-24"><Pole label="Šírka" jednotka="mm" step="1" value={kalk.sirka} onChange={(v) => setKalk({ ...kalk, sirka: v })} /></div>
        <div className="w-24"><Pole label="Výška" jednotka="mm" step="1" value={kalk.vyska} onChange={(v) => setKalk({ ...kalk, vyska: v })} /></div>
        <div className="w-24"><Pole label="Počet ks" step="1" value={kalk.ks} onChange={(v) => setKalk({ ...kalk, ks: Math.max(1, Math.round(v)) })} /></div>
        <div><label className="block text-slate-400 mb-1 text-xs">Úroveň služby</label>
          <select value={kalk.uroven} onChange={(e) => setKalk({ ...kalk, uroven: e.target.value })} className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs">
            <option value="rez">Len rezaná fólia</option><option value="vylupanie">Rezaná a vylúpaná</option><option value="plny">Full servis (vylúpané + nastrihané)</option>
          </select></div>
      </KalkulackaKarta>

      <ObjednavkyKarta supabase={supabase} tabulka="folie_objednavky" nadpis="Prijaté objednávky rezaných fólií"
        popisRiadku={(o) => `${druhy.find((x) => x.kod === o.druh)?.nazov || o.druh} · ${farby.find((x) => x.kod === o.farba)?.nazov || o.farba} · ${o.sirka_mm}×${o.vyska_mm} mm · ${o.dlzka_bm} bm${o.uroven === 'plny' ? ' · full servis (vylúpané + nastrihané)' : o.uroven === 'vylupanie' || o.separacia ? ' · vylúpané' : ' · len rezané'}`}
        subory={(o) => [{ cesta: o.subor_cesta, label: 'Vektorový súbor' }]} />
    </div>
  );
}
