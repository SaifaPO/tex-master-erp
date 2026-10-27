import React, { useEffect, useRef, useState } from 'react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import PlochaEditor from './fabricEditor/PlochaEditor';
import { useCenaNahlad, CenaSuhrn, MnozstevneZlavy } from './cenaNahlad';

// Predvolené fotky typov šnúrok (public/snurka). Ak je v administrácii nahraná vlastná fotka (foto_url), použije sa tá.
// Plná adresa nasadenia: appka beží aj cez Shopify App Proxy (pbtprint.sk/apps/...), kde by cesta "/snurka/..." mierila na neexistujúcu stránku obchodu.
const FOTO_ZAKLAD = 'https://printstudio-pro.vercel.app/snurka/';
const VYCHODZIE_FOTO = { klasicka: FOTO_ZAKLAD + 'klasicka.webp', sponou: FOTO_ZAKLAD + 'sponou.webp', spona_poistka: FOTO_ZAKLAD + 'spona_poistka.webp', klucenka: FOTO_ZAKLAD + 'klucenka.webp' };

const BUCKET = 'print-designs';

export default function Snurka({ supabase }) {
  const [nacitava, setNacitava] = useState(true);
  const [chybaNacitania, setChybaNacitania] = useState('');
  const [d, setD] = useState({ modely: [], nast: null, fonty: [], grafiky: [] });
  const [model, setModel] = useState('');
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
      const [n, m, f, g] = await Promise.all([
        supabase.from('snurka_nastavenia_verejny').select('*').maybeSingle(),
        supabase.from('snurka_modely_verejny').select('*').order('poradie'),
        supabase.from('fonty').select('*').order('id'),
        supabase.from('grafiky').select('id, nazov, url, kategoria').order('nazov'),
      ]);
      if (n.error || !n.data) { setChybaNacitania('Objednávka šnúrok ešte nie je pripravená (chýba migrácia migration_stolove_snurky_folie.sql).'); setNacitava(false); return; }
      setD({ nast: n.data, modely: m.data || [], fonty: f.data || [], grafiky: g.data || [] });
      setModel(m.data?.[0]?.kod || '');
      setNacitava(false);
    })();
  }, [supabase]);

  const mod = d.modely.find((x) => x.kod === model);
  // Tlač v častiach (napr. "700,120" mm): časti sa kreslia vedľa seba na jednej ploche s medzerou na strih
  const MEDZERA_CASTI = 10;
  const casti = (mod?.casti_mm || '').split(',').map((x) => Number(String(x).trim())).filter((x) => x > 0);
  const sirkaPlochy = casti.length ? casti.reduce((s, x) => s + x, 0) + MEDZERA_CASTI * (casti.length - 1) : (mod?.sirka_mm || 936);
  const { cena, chyba } = useCenaNahlad(supabase, 'snurka-create-draft-order', { model, pocetKs, osobnyOdber, b2bKod: b2b.kod, urovne: true }, !!mod);

  const objednat = async () => {
    setBezi(true); setChybaObj(''); setPotvrdenie('');
    try {
      const ex = await editorRef.current.exportuj();
      const id = crypto.randomUUID();
      const nahraj = async (blob, nazov) => {
        const { error } = await supabase.storage.from(BUCKET).upload(`snurka/${id}/${nazov}`, blob, { contentType: 'image/png' });
        if (error) throw new Error('Nepodarilo sa nahrať tlačový súbor: ' + error.message);
        return `snurka/${id}/${nazov}`;
      };
      const [c1, c2] = [await nahraj(ex.front, 'liec.png'), await nahraj(ex.back, 'rub.png')];
      const { data, error } = await supabase.functions.invoke('snurka-create-draft-order', {
        body: { model, pocetKs, osobnyOdber, b2bKod: b2b.kod, suborNazov: 'liec.png', suborCesta: c1, suborCesta2: c2, dizajnJson: ex.json },
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
  if (d.nast.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Objednávanie šnúrok je dočasne vypnuté.</div>;

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="Šnúrky na krk" subtitle="Dizajnér šnúrok s vlastnou potlačou" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>
      {d.nast.info_text && <p className="px-4 pt-3 text-xs text-slate-500 text-center">{d.nast.info_text}</p>}

      <PlochaEditor ref={editorRef} sirkaMm={sirkaPlochy} vyskaMm={mod?.vyska_mm || 26} ppm={3} rozlozenie="pod" spadavkaMm={3} casti={casti.length ? casti : null} medzeraCastiMm={MEDZERA_CASTI} fonty={d.fonty} grafiky={d.grafiky}>
        {({ nastroje, plocha }) => (
          <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[24rem_1fr] gap-5 items-start">
            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">1. Typ šnúrky</label>
                <div className="grid grid-cols-2 gap-2">
                  {d.modely.map((m) => (
                    <button key={m.kod} type="button" onClick={() => setModel(m.kod)} className={`border-2 rounded-xl p-2 text-center transition ${model === m.kod ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      {(m.foto_url || VYCHODZIE_FOTO[m.kod]) ? <img src={m.foto_url || VYCHODZIE_FOTO[m.kod]} alt={m.nazov} className="w-full h-36 object-contain rounded-lg bg-white mb-1" /> : <div className="h-36 flex items-center justify-center text-3xl">🪢</div>}
                      <span className="text-xs font-semibold text-slate-800 block">{m.nazov}</span>
                      {m.popis && <span className="text-[10px] text-slate-500 block leading-tight">{m.popis}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3">2. Vlastný dizajn</h3>
                {nastroje}
              </div>
            </aside>

            <section className="space-y-5 min-w-0">
              {plocha}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
                <div className="w-32"><label className="block text-xs font-medium text-slate-500 mb-1">Počet kusov</label><NumberInput min="1" step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.max(1, Math.round(v)))} fallback={1} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <p className="text-xs text-slate-500 flex-1 min-w-[200px]">{casti.length > 1 ? `Tlač v ${casti.length} častiach (${casti.map((x) => x / 10).join(' + ')} cm), výška ${mod?.vyska_mm} mm.` : `Rozmer šnúrky ${sirkaPlochy} × ${mod?.vyska_mm} mm.`} Tlačové súbory (líce aj rub, ≈ 300 DPI) sa vygenerujú automaticky pri odoslaní objednávky. Dôležité texty nechajte v zelenom ráme (bezpečná zóna).</p>
              </div>
              <div className="max-w-xl">
                <CenaSuhrn cena={cena} chyba={chyba} osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber} onObjednat={objednat} bezi={bezi} chybaObjednavky={chybaObj} potvrdenie={potvrdenie}
                  riadky={[['Typ šnúrky', mod?.nazov || '—'], ['Rozmer', mod ? (casti.length > 1 ? `${casti.map((x) => x / 10).join(' + ')} cm × ${mod.vyska_mm} mm` : `${sirkaPlochy} × ${mod.vyska_mm} mm`) : '—'], ['Počet kusov', `${pocetKs} ks`]]} />
              </div>
              <MnozstevneZlavy urovne={cena?.urovne} pocetKs={pocetKs} b2bPercent={b2b.zlavaPercent} b2bKod={b2b.kod} />
            </section>
          </main>
        )}
      </PlochaEditor>
    </div>
  );
}
