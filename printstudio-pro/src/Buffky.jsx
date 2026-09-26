import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCart, CreditCard, Gift } from 'lucide-react';
import PbtHeader from './PbtHeader';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG, QUANTITY_LEVELS } from './pricingEngine';
import { initBuffkyEngine } from './buffky/buffkyEngine';

const BUCKET = 'print-designs';

export default function Buffky({ supabase, onSpat }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [naklady, setNaklady] = useState(null); // { naklad_ks, naklad_potlac_ks, cena_sitia_bok_ks }
  const [premiumMaterialy, setPremiumMaterialy] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [nastavenia, setNastavenia] = useState(null);

  const [typ, setTyp] = useState('tubular_basic'); // 'tubular_basic' | 'premium'
  const [materialKod, setMaterialKod] = useState('');
  const [pocetKs, setPocetKs] = useState(1);
  const [deliverySpeed, setDeliverySpeed] = useState('standard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitError, setSubmitError] = useState('');

  const rootRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný.'); setIsLoading(false); return; }
    (async () => {
      const [{ data: nak }, { data: cfg }, { data: n }, { data: pm }] = await Promise.all([
        supabase.from('buffky_naklady_verejny').select('*').maybeSingle(),
        supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('buffky_nastavenia').select('*').eq('id', 1).maybeSingle(),
        supabase.from('buffky_premium_materialy_verejny').select('*'),
      ]);
      setNaklady(nak || null);
      if (cfg) setPricingConfig(mapConfigFromDb(cfg));
      setNastavenia(n || null);
      setPremiumMaterialy(pm || []);
      if (pm && pm.length > 0) setMaterialKod(pm[0].kod);
      setIsLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (isLoading || loadError || !nastavenia || !rootRef.current) return;
    engineRef.current?.destroy();
    engineRef.current = initBuffkyEngine(rootRef.current, { typ });
    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  }, [isLoading, loadError, nastavenia, typ]);

  const vybranyMaterial = premiumMaterialy.find(m => m.kod === materialKod);
  const nakladKs = !naklady ? 0 : (typ === 'premium'
    ? Number(vybranyMaterial?.naklad_material_ks || 0) + Number(naklady.naklad_potlac_ks || 0) + Number(naklady.cena_sitia_bok_ks || 0)
    : Number(naklady.naklad_ks || 0));

  const cenaKus = priceAt(nakladKs, pocetKs, pricingConfig);
  const subtotal = Math.max(cenaKus * pocetKs, Number(nastavenia?.minimalna_cena_objednavky) || 0);
  const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia?.priplatok_expres_percent) || 0) / 100) : 0;
  const shippingFee = Number(nastavenia?.cena_doprava) || 0;
  const grandTotalBezDph = subtotal + expressFee + shippingFee;
  const dphPercent = Number(pricingConfig.dphPercent) || 0;
  const dphSuma = grandTotalBezDph * (dphPercent / 100);
  const grandTotal = grandTotalBezDph + dphSuma;

  const odoslatObjednavku = async () => {
    if (!engineRef.current) return;
    if (typ === 'premium' && !materialKod) { setSubmitError('Vyber materiál buffky.'); return; }
    setIsSubmitting(true);
    setSubmitError('');
    setConfirmation('');
    try {
      const objednavkaId = crypto.randomUUID();
      const blob = await engineRef.current.getProductionBlob();
      const cesta = `buffky/${objednavkaId}/buffka.png`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
      if (uploadErr) throw new Error('Nepodarilo sa nahrať tlačový súbor: ' + uploadErr.message);
      const dizajnJson = engineRef.current.getDesignJson();

      const { data, error } = await supabase.functions.invoke('buffky-create-draft-order', {
        body: { typ, materialKod: typ === 'premium' ? materialKod : null, pocetKs, deliverySpeed, suborNazov: 'buffka.png', suborCesta: cesta, dizajnJson },
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!nastavenia) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm px-4 text-center">Buffky ešte nie sú nastavené — spusti migráciu `migration_buffky.sql`.</div>;

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
      <PbtHeader
        title="PrintStudio Pro"
        subtitle="Konfigurátor multifunkčných šatiek (Buffiek)"
        right={onSpat && <button onClick={onSpat} className="text-slate-300 hover:text-cyan-400 hover:bg-slate-800 px-3 py-2 rounded-lg text-sm font-medium transition self-start">← Katalóg</button>}
      />

      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-xl border border-slate-700/60">
          <button onClick={() => setTyp('tubular_basic')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typ === 'tubular_basic' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Tubular Basic</button>
          <button onClick={() => setTyp('premium')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typ === 'premium' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Premium</button>
        </div>
        {typ === 'tubular_basic' ? (
          <p className="text-[11px] text-slate-400">Bez švov, bez obšívania — potlač priamo na bezšvovú tubulárnu pletenú látku.</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-400">Jeden bočný šev, obšitý horný aj spodný okraj (ako rukáv trička).</p>
            <select value={materialKod} onChange={(e) => setMaterialKod(e.target.value)} className="ml-auto bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
              {premiumMaterialy.length === 0 && <option value="">-- materiály nie sú nastavené --</option>}
              {premiumMaterialy.map(m => <option key={m.kod} value={m.kod}>{m.nazov}</option>)}
            </select>
          </>
        )}
      </div>

      <main ref={rootRef} className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden relative">
        {/* ĽAVÝ PANEL: 2D dizajn a nástroje */}
        <section className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="sticky top-0 z-30 p-3 md:p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-xl border border-slate-700/60" id="toolTabs">
              <button data-tab="bg" className="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-cyan-600 text-white flex items-center gap-1.5"><i className="fa-solid fa-fill-drip"></i> Pozadie</button>
              <button data-tab="text" className="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white flex items-center gap-1.5"><i className="fa-solid fa-font"></i> Text</button>
              <button data-tab="graphics" className="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white flex items-center gap-1.5"><i className="fa-solid fa-image"></i> Vzory a Logo</button>
              <button data-tab="layers" className="tab-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-400 hover:text-white flex items-center gap-1.5"><i className="fa-solid fa-layer-group"></i> Vrstvy</button>
            </div>
            <div className="flex items-center gap-2">
              <button id="toggleGuidesBtn" className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5" title="Zobraziť/skryť línie spojov">
                <i className="fa-solid fa-ruler-combined text-rose-400"></i>
                <span className="hidden sm:inline">Línie spojov</span>
              </button>
              <button id="btnClearCanvas" className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-rose-400 border border-slate-700/70 text-xs font-medium hover:bg-rose-500/20 flex items-center gap-1.5" title="Vyčistiť návrh"><i className="fa-solid fa-trash"></i></button>
            </div>
          </div>

          <div className="relative z-20 p-4 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
            <div id="tabContent-bg" className="tab-content flex flex-wrap items-center gap-4 lg:gap-6">
              <div className="shrink-0">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Farba podkladu</label>
                <div className="flex items-center gap-2">
                  <input type="color" id="bgColorPicker" defaultValue="#0f172a" className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer" />
                  <div className="flex items-center gap-1.5">
                    <button className="w-6 h-6 rounded-full bg-slate-950 border border-slate-700 quick-color" data-color="#020617" title="Čierna"></button>
                    <button className="w-6 h-6 rounded-full bg-white border border-slate-300 quick-color" data-color="#ffffff" title="Biela"></button>
                    <button className="w-6 h-6 rounded-full bg-red-600 border border-red-400 quick-color" data-color="#dc2626" title="Červená"></button>
                    <button className="w-6 h-6 rounded-full bg-amber-500 border border-amber-400 quick-color" data-color="#f59e0b" title="Oranžová"></button>
                    <button className="w-6 h-6 rounded-full bg-emerald-600 border border-emerald-400 quick-color" data-color="#059669" title="Zelená"></button>
                    <button className="w-6 h-6 rounded-full bg-sky-600 border border-sky-400 quick-color" data-color="#0284c7" title="Modrá"></button>
                    <button className="w-6 h-6 rounded-full bg-purple-600 border border-purple-400 quick-color" data-color="#9333ea" title="Fialová"></button>
                  </div>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-800 hidden md:block"></div>
              <div className="flex-1 min-w-[280px]">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Rýchly motív šatky (10 moderných štýlov)</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-cyan-500" data-pattern="mountain">⛰️ Hory</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-emerald-500" data-pattern="camo">🌲 Camo</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-indigo-500" data-pattern="geo">📐 Geometria</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-purple-500" data-pattern="gradient">🌈 Gradient</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-cyan-400" data-pattern="topomap">🗺️ Topo Mapa</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-teal-400" data-pattern="cyber_hex">⚡ Hex Honeycomb</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-amber-400" data-pattern="splash">🎨 Paint Splash</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-rose-400" data-pattern="speed_stripes">🏁 Speed Racing</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-sky-300" data-pattern="nordic_tri">❄️ Nordic Frost</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium pattern-btn transition hover:border-orange-500" data-pattern="lava_smoke">🌋 Láva & Dym</button>
                  <button className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium pattern-btn text-slate-400 hover:text-white transition" data-pattern="none" title="Odstrániť vzor">✖ Čistá farba</button>
                </div>
              </div>
            </div>

            <div id="tabContent-text" className="tab-content hidden flex flex-wrap items-center gap-3">
              <input type="text" id="textInput" placeholder="Zadajte text (napr. TATRA RUN)" className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 w-48" />
              <select id="fontSelect" className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none">
                <option value="Montserrat">Montserrat Extra</option>
                <option value="Oswald">Oswald Athletic</option>
                <option value="Plus Jakarta Sans">Modern Sans</option>
                <option value="Playfair Display">Serif Elegant</option>
              </select>
              <input type="color" id="textColorPicker" defaultValue="#ffffff" className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer" />
              <div className="flex items-center gap-1.5">
                {typ === 'tubular_basic' ? (
                  <>
                    <button id="btnAddTextFront" className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow">+ Na prednú stranu (A)</button>
                    <button id="btnAddTextBack" className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow">+ Na zadnú stranu (B)</button>
                  </>
                ) : (
                  <button id="btnAddTextFront" className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow">+ Pridať text</button>
                )}
              </div>
            </div>

            <div id="tabContent-graphics" className="tab-content hidden flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Nahrať vlastné logo / grafiku (PNG, JPG, SVG)</label>
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-cyan-400 font-semibold transition">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>Vybrať súbor</span>
                  <input type="file" id="imageUpload" accept="image/*" className="hidden" />
                </label>
              </div>
              <div className="h-10 w-px bg-slate-800 hidden sm:block"></div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Športové ikony</label>
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-sm add-icon-btn" data-icon="mountain"><i className="fa-solid fa-mountain text-amber-400"></i></button>
                  <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-sm add-icon-btn" data-icon="person-running"><i className="fa-solid fa-person-running text-cyan-400"></i></button>
                  <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-sm add-icon-btn" data-icon="person-biking"><i className="fa-solid fa-person-biking text-emerald-400"></i></button>
                  <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-sm add-icon-btn" data-icon="compass"><i className="fa-solid fa-compass text-rose-400"></i></button>
                  <button className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-sm add-icon-btn" data-icon="snowflake"><i className="fa-solid fa-snowflake text-sky-300"></i></button>
                </div>
              </div>
            </div>

            <div id="tabContent-layers" className="tab-content hidden flex items-center justify-between w-full">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span>Aktuálny objekt:</span>
                <span id="selectedItemLabel" className="font-bold text-cyan-400">Žiadny vybratý</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button id="btnLayerUp" className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs border border-slate-700" title="Posunúť dopredu"><i className="fa-solid fa-arrow-up"></i></button>
                <button id="btnLayerDown" className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs border border-slate-700" title="Posunúť dozadu"><i className="fa-solid fa-arrow-down"></i></button>
                <button id="btnDuplicate" className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs border border-slate-700" title="Duplikovať"><i className="fa-solid fa-clone"></i></button>
                <button id="btnDeleteSelected" className="p-1.5 px-2.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs border border-rose-700/60" title="Zmazať vybraté"><i className="fa-solid fa-trash-can"></i></button>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 md:p-6 flex flex-col items-center justify-start relative select-none">
            <div className="w-full max-w-[520px] flex flex-col items-center mt-1">
              {typ === 'tubular_basic' ? (
                <div className="w-full grid grid-cols-2 text-center text-xs font-semibold mb-3 gap-2 relative z-10">
                  <div className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 py-2 px-3 rounded-xl flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-1.5 font-bold"><i className="fa-solid fa-shirt text-cyan-400"></i> A: Predná strana</span>
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">25 × 50 cm</span>
                  </div>
                  <div className="bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 py-2 px-3 rounded-xl flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-1.5 font-bold"><i className="fa-regular fa-clone text-indigo-400"></i> B: Zadná strana</span>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-500/30">25 × 50 cm</span>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center text-xs font-semibold mb-3 relative z-10">
                  <div className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 py-2 px-3 rounded-xl flex items-center justify-between shadow-sm">
                    <span className="flex items-center gap-1.5 font-bold"><i className="fa-solid fa-image text-cyan-400"></i> Jeden celkový obrázok (obopína celú šatku)</span>
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">50 × 50 cm</span>
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-950 group">
                <canvas id="designCanvas" width="960" height="960" className="w-full h-full cursor-crosshair checkerboard-bg block"></canvas>
                <div id="guidesOverlay" className="absolute inset-0 pointer-events-none transition-opacity duration-200 opacity-100">
                  {typ === 'tubular_basic' ? (
                    <>
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/70 border-r border-rose-300/40 flex items-center">
                        <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-r rotate-90 origin-left ml-2 tracking-widest uppercase">SPOJ</span>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-rose-500/80 flex flex-col items-center justify-between py-3 shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                        <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full shadow tracking-wider uppercase">SPOJ</span>
                        <div className="h-full border-r-2 border-dashed border-rose-400/80 my-2"></div>
                        <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full shadow tracking-wider uppercase">SPOJ (25 cm)</span>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-rose-500/70 border-l border-rose-300/40 flex items-center justify-end">
                        <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-l -rotate-90 origin-right mr-2 tracking-widest uppercase">SPOJ</span>
                      </div>
                      <div className="absolute top-0 left-0 right-0 h-4 border-b border-dashed border-sky-400/40 bg-sky-500/10 flex items-center justify-center">
                        <span className="text-[9px] text-sky-300 font-mono">↑ Horný okraj šatky (otvorený koniec) ↑</span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-4 border-t border-dashed border-sky-400/40 bg-sky-500/10 flex items-center justify-center">
                        <span className="text-[9px] text-sky-300 font-mono">↓ Spodný okraj šatky (otvorený koniec) ↓</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-rose-500/70 border-l border-rose-300/40 flex items-center justify-end">
                        <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-l -rotate-90 origin-right mr-2 tracking-widest uppercase">SPOJ</span>
                      </div>
                      <div className="absolute top-0 left-0 right-0 h-[4%] bg-amber-500/25 border-b-2 border-dashed border-amber-400/70 flex items-center justify-center">
                        <span className="text-[9px] text-amber-300 font-mono font-bold">⚠ Nedávať obsah — obšitý lem 2cm (zahne sa dovnútra)</span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-[4%] bg-amber-500/25 border-t-2 border-dashed border-amber-400/70 flex items-center justify-center">
                        <span className="text-[9px] text-amber-300 font-mono font-bold">⚠ Nedávať obsah — obšitý lem 2cm (zahne sa dovnútra)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                <span className="flex items-center gap-1"><i className="fa-solid fa-arrows-up-down-left-right text-cyan-400"></i> Kliknite a ťahajte prvky na plátne</span>
                <span className="text-rose-400/90 font-medium">{typ === 'tubular_basic' ? 'Červené línie znázorňujú SPOJ šatky' : 'Červená línia = bočný šev, žlté pásy = obšitý lem'}</span>
              </div>
              <p className="text-[10px] text-amber-500 mt-2 text-center">ℹ️ Toto je len orientačný náhľad v nižšej kvalite — tlačový súbor sa pri odoslaní objednávky vygeneruje v plnej kvalite (300 DPI) a nie je možné ho stiahnuť.</p>
            </div>
          </div>
        </section>

        {/* PRAVÝ PANEL: 3D náhľad + objednávka */}
        <section className="lg:col-span-5 flex flex-col bg-slate-950 relative min-h-[420px] lg:min-h-full">
          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur z-20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold text-slate-200">Živý 3D Náhľad (360° Rotácia)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button id="btnToggleRotate" className="p-2 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition" title="Zapnúť / Zastaviť otáčanie"><i className="fa-solid fa-rotate"></i></button>
              <button id="btnToggle3DSeams" className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-rose-400 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition flex items-center gap-1.5" title="Zobraziť spoj v 3D"><i className="fa-solid fa-circle-nodes"></i><span className="hidden sm:inline text-[11px]">3D Spoj</span></button>
              <button id="btnResetView" className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs hover:bg-slate-700 transition" title="Vycentrovať pohľad"><i className="fa-solid fa-arrows-to-dot"></i></button>
            </div>
          </div>

          <div className="absolute top-16 left-4 z-20 flex flex-col gap-1.5">
            <button className="cam-preset-btn text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-500 text-left transition flex items-center gap-1.5" data-angle="0"><span className="w-2 h-2 rounded-full bg-cyan-400"></span> {typ === 'tubular_basic' ? 'Predná strana (A)' : 'Pohľad spredu'}</button>
            <button className="cam-preset-btn text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white hover:border-indigo-500 text-left transition flex items-center gap-1.5" data-angle="180"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> {typ === 'tubular_basic' ? 'Zadná strana (B)' : 'Pohľad zozadu'}</button>
            <button className="cam-preset-btn text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white hover:border-rose-500 text-left transition flex items-center gap-1.5" data-angle="90"><span className="w-2 h-2 rounded-full bg-rose-500"></span> {typ === 'tubular_basic' ? 'Bočný SPOJ (A/B)' : 'Bočný SPOJ'}</button>
            {typ === 'tubular_basic' && (
              <button className="cam-preset-btn text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur border border-slate-700 text-slate-300 hover:text-white hover:border-rose-500 text-left transition flex items-center gap-1.5" data-angle="270"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Bočný SPOJ (B/A)</button>
            )}
          </div>

          <div id="threeContainer" className="flex-1 min-h-[360px] w-full relative cursor-grab active:cursor-grabbing overflow-hidden">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 shadow-lg">
              <i className="fa-solid fa-hand-pointer text-cyan-400"></i>
              <span>Otáčajte myšou • Kolieskom približujte</span>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/70 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Materiál</div>
              <div className="font-bold text-slate-200 mt-0.5">{typ === 'tubular_basic' ? '100% Polyester CoolMax' : (vybranyMaterial?.nazov || 'Vyber materiál')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Konštrukcia</div>
              <div className="font-bold text-slate-200 mt-0.5">{typ === 'tubular_basic' ? 'Tubulárna, bez švov' : '1 bočný šev, obšitý lem'}</div>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-2 border border-slate-700/50">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Rozmery</div>
              <div className="font-bold text-cyan-400 mt-0.5">50 × 25 cm (valec)</div>
            </div>
          </div>

          {/* SÚHRN OBJEDNÁVKY */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Gift className="w-4 h-4 text-cyan-400" /> Súhrn objednávky</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Počet kusov</label>
                <input type="number" min="1" step="1" value={pocetKs} onChange={(e) => setPocetKs(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Doprava</label>
                <select value={deliverySpeed} onChange={(e) => setDeliverySpeed(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="standard">Štandard</option>
                  <option value="express">Expres (+{nastavenia.priplatok_expres_percent}%)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-xs font-bold text-slate-200">Cena</span>
                <span className="text-[10px] font-normal text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-full">sadzba DPH {dphPercent}%</span>
              </div>
              <RowSum label="Cena za kus (bez DPH)" value={`${cenaKus.toFixed(2)} €`} />
              <RowSum label="Doprava" value={`${shippingFee.toFixed(2)} €`} />
              {expressFee > 0 && <RowSum label="Príplatok expres" value={`${expressFee.toFixed(2)} €`} />}
              <RowSum label="Cena bez DPH" value={`${grandTotalBezDph.toFixed(2)} €`} />
              <RowSum label={`DPH ${dphPercent}%`} value={`${dphSuma.toFixed(2)} €`} />
              <div className="pt-1.5 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Celkom s DPH</span>
                <span className="text-xl font-extrabold font-mono text-white">{grandTotal.toFixed(2)} €</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2 text-[11px] text-cyan-300">
              <CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify Pay)
            </div>

            <button onClick={odoslatObjednavku} disabled={isSubmitting} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition">
              <ShoppingCart className="w-4 h-4" /> {isSubmitting ? 'Vytváram objednávku…' : 'Objednať a zaplatiť'}
            </button>
            {confirmation && <p className="text-xs text-emerald-400">{confirmation}</p>}
            {submitError && <p className="text-xs text-rose-400">{submitError}</p>}
          </div>
        </section>

        <div id="toastBox" className="fixed bottom-6 right-6 z-50 pointer-events-none transition-all duration-300 transform translate-y-12 opacity-0">
          <div className="bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-medium">
            <i className="fa-solid fa-circle-check text-cyan-400 text-base"></i>
            <span id="toastMsg">Návrh bol úspešne aktualizovaný</span>
          </div>
        </div>
      </main>

      <div className="max-w-7xl w-full mx-auto p-3 sm:p-4">
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-white mb-1">Množstevné zľavy</h3>
          <p className="text-[11px] text-slate-500 mb-3">Ceny v tabuľke sú bez DPH.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                  <th className="p-2.5">Počet ks</th><th className="p-2.5">Cena €/ks (bez DPH)</th><th className="p-2.5">Zľava</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {QUANTITY_LEVELS.map(level => {
                  const rate = priceAt(nakladKs, level, pricingConfig);
                  const base = priceAt(nakladKs, QUANTITY_LEVELS[0], pricingConfig);
                  const discount = base > 0 ? Math.round(((base - rate) / base) * 100) : 0;
                  const isCurrent = pocetKs >= level && (level === QUANTITY_LEVELS[QUANTITY_LEVELS.length - 1] || pocetKs < QUANTITY_LEVELS[QUANTITY_LEVELS.indexOf(level) + 1]);
                  return (
                    <tr key={level} className={isCurrent ? 'bg-cyan-500/10 font-semibold' : ''}>
                      <td className="p-2.5 text-slate-300">od {level} ks {isCurrent && <span className="ml-1 text-[10px] bg-cyan-600 text-white px-2 py-0.5 rounded-full">Váš odber</span>}</td>
                      <td className="p-2.5 font-mono font-bold text-white">{rate.toFixed(2)} €</td>
                      <td className={`p-2.5 font-mono ${discount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{discount > 0 ? `-${discount}%` : 'Základ'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RowSum({ label, value }) {
  return (
    <div className="flex justify-between items-center py-0.5 text-xs">
      <span className="text-slate-400">{label}:</span>
      <span className="font-mono font-semibold text-slate-100">{value}</span>
    </div>
  );
}
