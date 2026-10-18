import React, { useEffect, useRef, useState } from 'react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import PlochaEditor from './fabricEditor/PlochaEditor';
import { useCenaNahlad, CenaSuhrn } from './cenaNahlad';

const BUCKET = 'print-designs';

// Malá ikonka tvaru vlajky (kým admin nenahrá vlastnú fotku)
function TvarIkona({ kod }) {
  const d = {
    shield: 'M 4 4 L 36 4 L 36 38 Q 20 52 4 38 Z',
    pentagon: 'M 4 4 L 36 4 L 36 38 L 20 50 L 4 38 Z',
    rectangle: 'M 4 4 L 36 4 L 36 40 Q 20 56 4 40 Z',
    triangle: 'M 4 4 L 36 4 L 20 50 Z',
  }[kod] || 'M 4 4 L 36 4 L 36 50 L 4 50 Z';
  return <svg viewBox="0 0 40 58" className="h-16 w-12 mx-auto"><path d={d} fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2" /></svg>;
}

function Karta({ aktivna, onClick, foto, ikona, nazov, popis }) {
  return (
    <button type="button" onClick={onClick} className={`border-2 rounded-xl p-2 text-center transition ${aktivna ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      {foto ? <img src={foto} alt={nazov} className="w-full h-16 object-cover rounded-lg mb-1" /> : ikona}
      <span className="text-xs font-semibold text-slate-800 block leading-tight">{nazov}</span>
      {popis && <span className="text-[10px] text-slate-500 block">{popis}</span>}
    </button>
  );
}

export default function Stolova({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [d, setD] = useState({ velkosti: [], tvary: [], okraje: [], podstavce: [], nast: null, fonty: [], grafiky: [] });
  const [velkost, setVelkost] = useState('');
  const [tvar, setTvar] = useState('');
  const [okraj, setOkraj] = useState('');
  const [podstavec, setPodstavec] = useState('');
  const [pocetKs, setPocetKs] = useState(1);
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const b2b = useB2bKod(supabase);
  const [bezi, setBezi] = useState(false);
  const [chybaObj, setChybaObj] = useState('');
  const [potvrdenie, setPotvrdenie] = useState('');
  const editorRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setChybaNacitania('Supabase klient nie je nakonfigurovaný.'); setNacitava(false); return; }
    (async () => {
      const [n, v, t, o, p, f, g] = await Promise.all([
        supabase.from('stolova_nastavenia_verejny').select('*').maybeSingle(),
        supabase.from('stolova_velkosti_verejny').select('*').order('poradie'),
        supabase.from('stolova_tvary_verejny').select('*').order('poradie'),
        supabase.from('stolova_okraje_verejny').select('*').order('poradie'),
        supabase.from('stolova_podstavce_verejny').select('*').order('poradie'),
        supabase.from('fonty').select('*').order('id'),
        supabase.from('grafiky').select('id, nazov, url, kategoria').order('nazov'),
      ]);
      if (n.error || !n.data) { setChybaNacitania('Objednávka stolových vlajok ešte nie je pripravená (chýba migrácia migration_stolove_snurky_folie.sql).'); setNacitava(false); return; }
      setD({ nast: n.data, velkosti: v.data || [], tvary: t.data || [], okraje: o.data || [], podstavce: p.data || [], fonty: f.data || [], grafiky: g.data || [] });
      setVelkost((v.data || []).find((x) => x.kod === 'medium')?.kod || v.data?.[0]?.kod || '');
      setTvar(t.data?.[0]?.kod || ''); setOkraj(o.data?.[0]?.kod || '');
      setPodstavec((p.data || []).find((x) => x.kod === 'chrome')?.kod || p.data?.[0]?.kod || '');
      setNacitava(false);
    })();
  }, [supabase]);

  const vel = d.velkosti.find((x) => x.kod === velkost);
  const pripravene = !!(vel && tvar && okraj && podstavec);
  const { cena, chyba } = useCenaNahlad(supabase, 'stolova-create-draft-order', { velkost, tvar, okraj, podstavec, pocetKs, osobnyOdber, b2bKod: b2b.kod }, pripravene);

  const objednat = async () => {
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const ex = await editorRef.current.exportuj();
      const id = crypto.randomUUID();
      const nahraj = async (blob, nazov) => {
        const { error } = await supabase.storage.from(BUCKET).upload(`stolova/${id}/${nazov}`, blob, { contentType: 'image/png' });
        if (error) throw new Error('Nepodarilo sa nahrať tlačový súbor: ' + error.message);
        return `stolova/${id}/${nazov}`;
      };
      const [c1, c2] = [await nahraj(ex.front, 'liec.png'), await nahraj(ex.back, 'rub.png')];
      const { data, error } = await supabase.functions.invoke('stolova-create-draft-order', {
        body: { velkost, tvar, okraj, podstavec, pocetKs, osobnyOdber, b2bKod: b2b.kod, suborNazov: 'liec.png', suborCesta: c1, suborCesta2: c2, dizajnJson: ex.json },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Server nevrátil odpoveď.');
      setPotvrdenie(`Objednávka bola vytvorená — ${Number(data.cenaSpolu).toFixed(2)} €. Presmerúvam na platbu…`);
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setChybaObj('Objednávku sa nepodarilo odoslať: ' + e.message);
    } finally { setBezi(false); }
  };

  if (nacitava) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (chybaNacitania) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{chybaNacitania}</div>;
  if (d.nast.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Objednávanie stolových vlajok je dočasne vypnuté.</div>;

  const okrajeSkupiny = [['strapce', 'Strapce'], ['snurka', 'Jednoduché obsitie šnúrkou']];
  const nazov = (zoznam, kod) => zoznam.find((x) => x.kod === kod)?.nazov || '—';

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Stolové vlajky" subtitle="Dizajnér stolových vlajok s vlastným dizajnom" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {d.nast.info_text && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{d.nast.info_text}</p>}

      <PlochaEditor ref={editorRef} sirkaMm={vel?.sirka_mm || 150} vyskaMm={vel?.vyska_mm || 220} tvar={tvar || null} ppm={2} rozlozenie="vedla" fonty={d.fonty} grafiky={d.grafiky}>
        {({ nastroje, plocha }) => (
          <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[24rem_1fr] gap-5 items-start">
            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">1. Tvar vlajky</label>
                  <div className="grid grid-cols-2 gap-2">{d.tvary.map((t) => <Karta key={t.kod} aktivna={tvar === t.kod} onClick={() => setTvar(t.kod)} foto={t.foto_url} ikona={<TvarIkona kod={t.kod} />} nazov={t.nazov} popis={t.popis} />)}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Veľkosť</label>
                  <div className="grid grid-cols-3 gap-2">{d.velkosti.map((x) => <Karta key={x.kod} aktivna={velkost === x.kod} onClick={() => setVelkost(x.kod)} foto={x.foto_url} nazov={x.nazov} popis={x.popis || `${x.sirka_mm / 10} × ${x.vyska_mm / 10} cm`} />)}</div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">2. Ukončenie okrajov</label>
                  <select value={okraj} onChange={(e) => setOkraj(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white">
                    {okrajeSkupiny.map(([sk, n]) => <optgroup key={sk} label={n}>{d.okraje.filter((o) => o.skupina === sk).map((o) => <option key={o.kod} value={o.kod}>{o.nazov}</option>)}</optgroup>)}
                  </select>
                  {d.okraje.find((o) => o.kod === okraj)?.foto_url && <img src={d.okraje.find((o) => o.kod === okraj).foto_url} alt="" className="mt-2 w-full h-24 object-cover rounded-lg" />}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Podstavec / stojanček</label>
                  <select value={podstavec} onChange={(e) => setPodstavec(e.target.value)} className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-white">
                    {d.podstavce.map((p) => <option key={p.kod} value={p.kod}>{p.nazov}</option>)}
                  </select>
                  {d.podstavce.find((p) => p.kod === podstavec)?.foto_url && <img src={d.podstavce.find((p) => p.kod === podstavec).foto_url} alt="" className="mt-2 w-full h-28 object-contain rounded-lg bg-slate-50" />}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3">3. Vlastný dizajn</h3>
                {nastroje}
              </div>
            </aside>

            <section className="space-y-5 min-w-0">
              {plocha}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
                <div className="w-32"><label className="block text-xs font-medium text-slate-500 mb-1">Počet kusov</label><NumberInput min="1" step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.max(1, Math.round(v)))} fallback={1} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <p className="text-xs text-slate-500 flex-1 min-w-[200px]">Tlačové súbory (líce aj rub, ≈ 300 DPI, priehľadné mimo tvaru) sa vygenerujú automaticky pri odoslaní objednávky.</p>
              </div>
              <div className="max-w-xl">
                <CenaSuhrn cena={cena} chyba={chyba} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi} chybaObjednavky={chybaObj} potvrdenie={potvrdenie}
                  riadky={[['Veľkosť', nazov(d.velkosti, velkost)], ['Tvar', nazov(d.tvary, tvar)], ['Okraje', nazov(d.okraje, okraj)], ['Podstavec', nazov(d.podstavce, podstavec)], ['Počet kusov', `${pocetKs} ks`]]} />
              </div>
            </section>
          </main>
        )}
      </PlochaEditor>
    </div>
  );
}
