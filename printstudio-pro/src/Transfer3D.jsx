import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, ShoppingCart, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import PbtHeader from './PbtHeader';
import NumberInput from './NumberInput';
import { useB2bKod } from './b2b';
import B2bKod from './B2bKod';
import { CenaB2b } from './CenaB2b';

const BUCKET = 'print-designs';

// Jednoduchá kresba výšky 3D efektu (1–3 vrstvy), kým admin nenahrá vlastnú fotku úrovne.
function VrstvyObrazok({ pocet }) {
  return (
    <svg viewBox="0 0 120 80" className="w-full aspect-[3/2] rounded-lg bg-slate-100">
      <rect x="10" y="62" width="100" height="8" rx="3" fill="#cbd5e1" />
      {Array.from({ length: pocet }).map((_, i) => (
        <rect key={i} x={26 + i * 3} y={52 - i * 11} width={68 - i * 6} height="11" rx="4" fill={['#93c5fd', '#60a5fa', '#3b82f6'][i]} stroke="#1e40af" strokeWidth="0.8" />
      ))}
    </svg>
  );
}

function RowSum({ label, value }) {
  return <div className="flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-100">{value}</span></div>;
}

export default function Transfer3D({ supabase }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [nastavenia, setNastavenia] = useState(null);
  const [urovne, setUrovne] = useState([]);
  const [laky, setLaky] = useState([]);

  const [sirka, setSirka] = useState(10);
  const [vyska, setVyska] = useState(10);
  const [pocetKs, setPocetKs] = useState(1);
  const [uroven, setUroven] = useState('');
  const [lak, setLak] = useState('');
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const [subor, setSubor] = useState(null);
  const [nahladUrl, setNahladUrl] = useState('');
  const b2b = useB2bKod(supabase);

  const [cena, setCena] = useState(null);
  const [cenaChyba, setCenaChyba] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const poslednyDotaz = useRef(0);

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný.'); setIsLoading(false); return; }
    (async () => {
      const [{ data: n, error: nErr }, { data: u }, { data: l }] = await Promise.all([
        supabase.from('transfer3d_nastavenia_verejny').select('*').maybeSingle(),
        supabase.from('transfer3d_urovne_verejny').select('*').order('poradie'),
        supabase.from('transfer3d_laky_verejny').select('*').order('poradie'),
      ]);
      if (nErr || !n) { setLoadError('Objednávka 3D transferov ešte nie je pripravená (chýba migrácia migration_transfer3d.sql).'); setIsLoading(false); return; }
      setNastavenia(n);
      setUrovne(u || []);
      setLaky(l || []);
      if (u?.length) setUroven(u.find((x) => x.kod === 'medium')?.kod || u[0].kod);
      if (l?.length) setLak(l.find((x) => x.kod === 'partial')?.kod || l[0].kod);
      setIsLoading(false);
    })();
  }, [supabase]);

  const maxSirka = Number(nastavenia?.max_sirka_cm) || 28;
  const maxVyska = Number(nastavenia?.max_vyska_cm) || 38;
  const rozmerChyba = useMemo(() => {
    if (!(sirka > 0) || !(vyska > 0) || !(pocetKs > 0)) return 'Rozmery a množstvo musia byť väčšie ako 0.';
    if (sirka > maxSirka || vyska > maxVyska) return `Maximálny rozmer motívu je ${maxSirka} × ${maxVyska} cm.`;
    return '';
  }, [sirka, vyska, pocetKs, maxSirka, maxVyska]);

  // Živý náhľad ceny — počíta server (Edge Function), zákazník nikdy nevidí nákupné ceny ani spotreby
  useEffect(() => {
    if (!supabase || !nastavenia || !uroven || !lak || rozmerChyba) { setCena(null); setCenaChyba(rozmerChyba); return; }
    const id = ++poslednyDotaz.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('transfer3d-create-draft-order', {
        body: { preview: true, sirkaCm: sirka, vyskaCm: vyska, pocetKs, uroven, lak, osobnyOdber, b2bKod: b2b.kod },
      });
      if (id !== poslednyDotaz.current) return;
      if (error || !data?.ok) { setCena(null); setCenaChyba(data?.error || 'Cenu sa nepodarilo vypočítať (je funkcia transfer3d-create-draft-order nasadená?).'); return; }
      setCenaChyba('');
      setCena(data);
    }, 350);
    return () => clearTimeout(t);
  }, [supabase, nastavenia, sirka, vyska, pocetKs, uroven, lak, osobnyOdber, b2b.kod, rozmerChyba]);

  const vyberSubor = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubor(f);
    if (nahladUrl) URL.revokeObjectURL(nahladUrl);
    setNahladUrl(/^image\//.test(f.type) ? URL.createObjectURL(f) : '');
  };

  const odoslat = async () => {
    if (!subor) { setSubmitError('Nahraj prosím súbor s logom.'); return; }
    setIsSubmitting(true); setSubmitError(''); setConfirmation('');
    try {
      const cesta = `transfer3d/${crypto.randomUUID()}/${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, subor, { contentType: subor.type || undefined });
      if (uploadErr) throw new Error('Súbor sa nepodarilo nahrať: ' + uploadErr.message);
      const { data, error } = await supabase.functions.invoke('transfer3d-create-draft-order', {
        body: { sirkaCm: sirka, vyskaCm: vyska, pocetKs, uroven, lak, osobnyOdber, b2bKod: b2b.kod, suborNazov: subor.name, suborCesta: cesta },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.checkoutUrl) throw new Error('Server nevrátil odkaz na platbu.');
      setConfirmation(`Objednávka bola vytvorená — ${Number(data.cenaSpolu).toFixed(2)} €. Presmerúvam na platbu…`);
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (nastavenia?.aktivny === false) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm px-4 text-center">Objednávanie 3D transferov je dočasne vypnuté.</div>;

  const dph = cena?.dphPercent ?? 23;
  const kartaStyl = (aktivna) => `border-2 rounded-xl p-3 cursor-pointer transition flex flex-col items-center text-center ${aktivna ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'}`;

  return (
    <div className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col">
      <PbtHeader title="3D transfery" subtitle="Objednávka transferov podľa vášho loga" />
      <div className="px-4 py-2 bg-white border-b border-slate-200"><B2bKod b2b={b2b} /></div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Objednávka 3D transferov</h2>
          <p className="mt-2 text-sm text-slate-600">Nahrajte logo, nastavte rozmery a vyberte si 3D vyhotovenie.</p>
          <div className="mt-2 text-xs text-indigo-700 bg-indigo-50 py-1 px-3 rounded-full inline-block font-medium">
            Tlačíme na {Number(nastavenia.sirka_folie_cm) || 30} cm fóliu. Maximálny rozmer grafiky je {maxSirka}×{maxVyska} cm.
          </div>
          {nastavenia.info_text && <p className="mt-2 text-xs text-slate-500 max-w-xl mx-auto">{nastavenia.info_text}</p>}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">1. Logo a rozmery</h3>
              <label className="block text-xs font-medium text-slate-600 mb-2">Súbor s logom (vektor: PDF, AI, EPS; alebo PNG / JPG)</label>
              <label className="relative block border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-xl p-6 text-center cursor-pointer transition">
                <input type="file" accept=".pdf,.ai,.eps,.svg,.png,.jpg,.jpeg" onChange={vyberSubor} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                {subor ? (
                  <div className="flex flex-col items-center gap-2">
                    {nahladUrl && <img src={nahladUrl} alt="" className="max-h-32 object-contain rounded bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] bg-[length:16px_16px]" />}
                    <span className="text-indigo-700 font-medium text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {subor.name}</span>
                    <span className="text-[11px] text-slate-500">Kliknutím vyberiete iný súbor.</span>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm"><Upload className="w-8 h-8 mx-auto text-slate-400 mb-1" /> Kliknite pre nahranie alebo pretiahnite súbor sem.</div>
                )}
              </label>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Šírka (cm)</label><NumberInput min="1" max={maxSirka} step="0.1" value={sirka} onChange={setSirka} fallback={10} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Výška (cm)</label><NumberInput min="1" max={maxVyska} step="0.1" value={vyska} onChange={setVyska} fallback={10} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Počet kusov</label><NumberInput min="1" step="1" value={pocetKs} onChange={(v) => setPocetKs(Math.max(1, Math.round(v)))} fallback={1} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-1">2. Výška 3D efektu</h3>
              <p className="text-xs text-slate-500 mb-4">Čím vyšší efekt, tým dlhšia tlač a vyššia spotreba farby — preto aj vyššia cena.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {urovne.map((u, i) => (
                  <div key={u.kod} onClick={() => setUroven(u.kod)} className={kartaStyl(uroven === u.kod)}>
                    {u.foto_url ? <img src={u.foto_url} alt={u.nazov} className="w-full aspect-[3/2] object-cover rounded-lg mb-2" /> : <VrstvyObrazok pocet={Math.min(3, i + 1)} />}
                    <h4 className="font-bold text-slate-900 mt-2 text-sm">{u.nazov}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{u.popis}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-1">3. Povrchová úprava (lak)</h3>
              <p className="text-xs text-slate-500 mb-4">Lak môže ísť na celý motív, len na vybrané detaily, alebo vôbec — ovplyvňuje vzhľad aj cenu.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {laky.map((l) => (
                  <div key={l.kod} onClick={() => setLak(l.kod)} className={kartaStyl(lak === l.kod)}>
                    {l.foto_url && <img src={l.foto_url} alt={l.nazov} className="w-full aspect-[3/2] object-cover rounded-lg mb-2" />}
                    <h4 className="font-semibold text-slate-900 text-sm">{l.nazov}</h4>
                    {l.popis && <p className="text-[11px] text-slate-500 mt-0.5">{l.popis}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="w-full lg:w-96">
            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 lg:sticky lg:top-20">
              <h3 className="text-base font-bold border-b border-slate-700 pb-3">Zhrnutie objednávky</h3>
              <div className="space-y-2 text-xs">
                <RowSum label="Rozmer motívu" value={`${sirka} × ${vyska} cm`} />
                <RowSum label="Počet kusov" value={`${pocetKs} ks`} />
                <RowSum label="3D efekt" value={urovne.find((u) => u.kod === uroven)?.nazov || '—'} />
                <RowSum label="Lak" value={laky.find((l) => l.kod === lak)?.nazov || '—'} />
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300">
                <input type="checkbox" checked={osobnyOdber} onChange={(e) => setOsobnyOdber(e.target.checked)} className="mt-0.5" />
                <span>Osobný odber v Prešove alebo Košiciach (neplatím poštovné)</span>
              </label>

              {cenaChyba ? (
                <div className="bg-rose-950/60 border border-rose-700 text-rose-200 p-3 rounded-lg text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {cenaChyba}</div>
              ) : cena ? (
                <div className="space-y-2 border-t border-slate-700 pt-3">
                  <RowSum label="Cena za 1 ks (bez DPH)" value={<CenaB2b v={cena.cenaKsBezDph} p={cena.zlavaB2bPercent} />} />
                  <RowSum label="Motívy spolu (bez DPH)" value={<CenaB2b v={cena.logaSpoluBezDph} p={cena.zlavaB2bPercent} />} />
                  {cena.zlavaB2bEur > 0 && <RowSum label={`B2B zľava ${cena.zlavaB2bPercent} %`} value={`−${cena.zlavaB2bEur.toFixed(2)} €`} />}
                  {cena.manipulaciaBezDph > 0 && <RowSum label="Manipulačný poplatok" value={`${cena.manipulaciaBezDph.toFixed(2)} €`} />}
                  <RowSum label="Poštovné a balné" value={cena.postovneBezDph === 0 ? 'Zdarma' : `${cena.postovneBezDph.toFixed(2)} €`} />
                  <RowSum label="Cena bez DPH" value={`${cena.spoluBezDph.toFixed(2)} €`} />
                  <RowSum label={`DPH ${dph} %`} value={`${cena.dph.toFixed(2)} €`} />
                  <div className="bg-indigo-600 rounded-xl p-3 mt-2">
                    <div className="text-indigo-100 text-[11px]">Celkom s DPH:</div>
                    <div className="text-2xl font-extrabold font-mono">{cena.spolu.toFixed(2)} €</div>
                    <div className="text-[10px] text-indigo-200 mt-0.5">Cena vychádza z dodaných rozmerov; konečnú kontrolu grafiky robíme pred výrobou.</div>
                  </div>
                </div>
              ) : <p className="text-xs text-slate-400">Počítam cenu…</p>}

              <div className="p-2.5 rounded-lg bg-slate-800 flex items-center gap-2 text-[11px] text-slate-300"><CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify)</div>

              {submitError && <p className="text-xs text-rose-300">{submitError}</p>}
              {confirmation && <p className="text-xs text-emerald-300">{confirmation}</p>}
              <button onClick={odoslat} disabled={isSubmitting || !cena || !subor} className="w-full py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" /> {isSubmitting ? 'Vytváram objednávku…' : 'Objednať a zaplatiť'}
              </button>
              {!subor && <p className="text-[11px] text-slate-400 text-center">Najprv nahrajte súbor s logom.</p>}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
