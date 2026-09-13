import React, { useEffect, useRef, useState } from 'react';
import { Truck, Eye, ShoppingCart, CreditCard, Gift } from 'lucide-react';
import PbtHeader from './PbtHeader';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';
import { initCelenkyEngine } from './celenky/celenkyEngine';

const BUCKET = 'print-designs';

export default function Celenky({ supabase, onSpat }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [nakladKs, setNakladKs] = useState(0);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [nastavenia, setNastavenia] = useState(null);

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
      const [{ data: nak }, { data: cfg }, { data: n }] = await Promise.all([
        supabase.from('celenky_naklady_verejny').select('naklad_ks').maybeSingle(),
        supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('celenky_nastavenia').select('*').eq('id', 1).maybeSingle(),
      ]);
      setNakladKs(nak ? Number(nak.naklad_ks) : 0);
      if (cfg) setPricingConfig(mapConfigFromDb(cfg));
      setNastavenia(n || null);
      setIsLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (isLoading || loadError || !nastavenia || !rootRef.current) return;
    engineRef.current = initCelenkyEngine(rootRef.current);
    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  }, [isLoading, loadError, nastavenia]);

  // ---- Cena ----
  const cenaKus = priceAt(nakladKs, pocetKs, pricingConfig);
  const subtotal = Math.max(cenaKus * pocetKs, Number(nastavenia?.minimalna_cena_objednavky) || 0);
  const expressFee = deliverySpeed === 'express' ? subtotal * ((Number(nastavenia?.priplatok_expres_percent) || 0) / 100) : 0;
  const shippingFee = Number(nastavenia?.cena_doprava) || 0;
  const grandTotalBezDph = subtotal + expressFee + shippingFee;
  const dphPercent = Number(nastavenia?.dph_percent) || 0;
  const dphSuma = grandTotalBezDph * (dphPercent / 100);
  const grandTotal = grandTotalBezDph + dphSuma;

  const odoslatObjednavku = async () => {
    if (!engineRef.current) return;
    setIsSubmitting(true);
    setSubmitError('');
    setConfirmation('');
    try {
      const objednavkaId = crypto.randomUUID();
      const blob = await engineRef.current.getProductionBlob();
      const cesta = `celenky/${objednavkaId}/celenka.png`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
      if (uploadErr) throw new Error('Nepodarilo sa nahrať tlačový súbor: ' + uploadErr.message);
      const dizajnJson = engineRef.current.getDesignJson();

      const { data, error } = await supabase.functions.invoke('celenky-create-draft-order', {
        body: { pocetKs, deliverySpeed, suborNazov: 'celenka.png', suborCesta: cesta, dizajnJson },
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
  if (!nastavenia) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm px-4 text-center">Čelenky ešte nie sú nastavené — spusti migráciu `migration_celenky.sql`.</div>;

  return (
    <div className="bg-slate-100 text-slate-900 min-h-screen flex flex-col">
      <PbtHeader
        title="PrintStudio Pro"
        subtitle="Konfigurátor športových čeleniek"
        right={onSpat && <button onClick={onSpat} className="text-slate-600 hover:text-indigo-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition self-start">← Katalóg</button>}
      />

      <main ref={rootRef} className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ĽAVÝ PANEL: nástroje, farby, text, grafiky, vrstvy */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">✂️ Strih:</span>
            <span className="text-xs font-bold bg-white text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1.5">Štandard (51 × 9 cm)</span>
          </div>

          <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 overflow-x-auto">
            <button data-tab="tab-templates" className="tab-btn whitespace-nowrap px-2.5 py-1.5 text-xs font-bold rounded-lg transition bg-white text-indigo-600 shadow-xs">🏆 Vzory (10)</button>
            <button data-tab="tab-color" className="tab-btn whitespace-nowrap px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-indigo-600">🎨 Farba</button>
            <button data-tab="tab-text" className="tab-btn whitespace-nowrap px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-indigo-600">🔤 Text</button>
            <button data-tab="tab-graphics" className="tab-btn whitespace-nowrap px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-indigo-600">⭐ Motívy</button>
            <button data-tab="tab-layers" className="tab-btn whitespace-nowrap px-2.5 py-1.5 text-xs font-bold rounded-lg transition text-slate-600 hover:text-indigo-600">📑 Vrstvy (<span id="layersCountBadge">1</span>)</button>
          </div>

          <div id="transformInspector" className="mx-3 mt-3 p-3 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-white border border-indigo-200/80 rounded-xl space-y-2.5 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                <span id="selectedItemLabel" className="text-xs font-bold text-indigo-950 truncate max-w-[170px]">Zvolený objekt</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Otočenie & Mierka</span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>Uhol / Rotácia:</span>
                <span id="rotationValBadge" className="text-indigo-600 font-mono">0°</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="range" id="rotationSlider" min="-180" max="180" defaultValue="0" className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg" />
                <button id="rotResetBtn" className="px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded" title="Vyrovnať na 0°">0°</button>
              </div>
              <div className="grid grid-cols-4 gap-1 mt-1.5">
                <button id="rotMinus45Btn" className="py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded transition">↺ -45°</button>
                <button id="rotMinus15Btn" className="py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded transition">↺ -15°</button>
                <button id="rotPlus15Btn" className="py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded transition">↻ +15°</button>
                <button id="rotPlus45Btn" className="py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded transition">↻ +45°</button>
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-100">
              <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>Veľkosť (Mierka):</span>
                <span id="scaleValBadge" className="text-indigo-600 font-mono">100%</span>
              </div>
              <div className="flex items-center gap-2">
                <button id="scaleDownBtn" className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-bold text-sm shadow-2xs">−</button>
                <input type="range" id="scaleSlider" min="20" max="300" defaultValue="100" className="flex-1 accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg" />
                <button id="scaleUpBtn" className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-bold text-sm shadow-2xs">+</button>
              </div>
            </div>

            <div id="inspectorIconColorRow" className="hidden pt-2 border-t border-indigo-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">Farba ikony:</span>
              <div className="flex items-center gap-1.5">
                <input type="color" id="inspectorIconColorPicker" defaultValue="#facc15" className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0.5" />
                <span id="inspectorIconColorHex" className="text-[10px] font-mono text-slate-600">#FACC15</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button id="centerActiveObjBtn" className="flex-1 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-100/80 hover:bg-indigo-200 rounded-lg transition flex items-center justify-center gap-1"><span>🎯 Vycentrovať na stred</span></button>
              <button id="resetTransformBtn" className="py-1.5 px-2.5 text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition" title="Obnoviť 100% a 0°">Reset</button>
            </div>
          </div>

          <div className="p-3.5 space-y-4 custom-scroll max-h-[460px] overflow-y-auto">
            {/* TAB 0: VZORY */}
            <div id="tab-templates" className="tab-content space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">Vyberte si hotový dizajnový motív:</span>
              <div className="grid grid-cols-2 gap-2">
                <button data-template="1" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-900 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-lime-400">#1 • Neon Limits</span><span className="truncate text-[11px] font-normal">Push Your Limits</span></button>
                <button data-template="2" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-blue-900 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-blue-200">#2 • Alpine Peaks</span><span className="truncate text-[11px] font-normal">Mountains Calling</span></button>
                <button data-template="3" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-zinc-900 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-pink-400">#3 • Cyber Run</span><span className="truncate text-[11px] font-normal">Run More</span></button>
                <button data-template="4" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-stone-900 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-orange-400">#4 • Topo Trail</span><span className="truncate text-[11px] font-normal">Explore Train Repeat</span></button>
                <button data-template="5" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-100 text-slate-900 text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-indigo-600">#5 • Mono Shards</span><span className="truncate text-[11px] font-normal">Stronger Everyday</span></button>
                <button data-template="6" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-teal-950 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-rose-300">#6 • Tropical Flora</span><span className="truncate text-[11px] font-normal">Good Energy ♡</span></button>
                <button data-template="7" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-neutral-900 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-lime-300">#7 • Glitch Speed</span><span className="truncate text-[11px] font-normal">Faster Higher</span></button>
                <button data-template="8" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-sky-950 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-sky-300">#8 • Aero Waves</span><span className="truncate text-[11px] font-normal">Run Bike Hike</span></button>
                <button data-template="9" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-black text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-amber-300">#9 • Liquid Marble</span><span className="truncate text-[11px] font-normal">Limitless</span></button>
                <button data-template="10" className="template-card p-2 rounded-xl border border-slate-200 hover:border-indigo-500 bg-red-950 text-white text-left text-xs font-bold transition flex flex-col gap-1 shadow-2xs"><span className="text-[10px] text-red-300">#10 • Red Crystal</span><span className="truncate text-[11px] font-normal">Never Give Up</span></button>
              </div>
            </div>

            {/* TAB 1: FARBA */}
            <div id="tab-color" className="tab-content hidden space-y-3.5">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">Populárne farby čelenky:</span>
                <div className="grid grid-cols-7 gap-1.5">
                  <button data-color="#0f172a" className="color-swatch-btn w-full aspect-square rounded-lg bg-slate-900 ring-2 ring-indigo-500 shadow-2xs transition" title="Tmavo modrá"></button>
                  <button data-color="#dc2626" className="color-swatch-btn w-full aspect-square rounded-lg bg-red-600 hover:scale-105 transition" title="Červená"></button>
                  <button data-color="#2563eb" className="color-swatch-btn w-full aspect-square rounded-lg bg-blue-600 hover:scale-105 transition" title="Kráľovská modrá"></button>
                  <button data-color="#16a34a" className="color-swatch-btn w-full aspect-square rounded-lg bg-green-600 hover:scale-105 transition" title="Zelená"></button>
                  <button data-color="#ca8a04" className="color-swatch-btn w-full aspect-square rounded-lg bg-yellow-600 hover:scale-105 transition" title="Žltá"></button>
                  <button data-color="#9333ea" className="color-swatch-btn w-full aspect-square rounded-lg bg-purple-600 hover:scale-105 transition" title="Fialová"></button>
                  <button data-color="#ffffff" className="color-swatch-btn w-full aspect-square rounded-lg bg-white border border-slate-300 hover:scale-105 transition" title="Biela"></button>
                  <button data-color="#000000" className="color-swatch-btn w-full aspect-square rounded-lg bg-black hover:scale-105 transition" title="Čierna"></button>
                  <button data-color="#ea580c" className="color-swatch-btn w-full aspect-square rounded-lg bg-orange-600 hover:scale-105 transition" title="Oranžová"></button>
                  <button data-color="#0284c7" className="color-swatch-btn w-full aspect-square rounded-lg bg-sky-600 hover:scale-105 transition" title="Svetlomodrá"></button>
                  <button data-color="#db2777" className="color-swatch-btn w-full aspect-square rounded-lg bg-pink-600 hover:scale-105 transition" title="Ružová"></button>
                  <button data-color="#4b5563" className="color-swatch-btn w-full aspect-square rounded-lg bg-gray-600 hover:scale-105 transition" title="Sivá"></button>
                  <button data-color="#14b8a6" className="color-swatch-btn w-full aspect-square rounded-lg bg-teal-500 hover:scale-105 transition" title="Tyrkysová"></button>
                  <button data-color="#84cc16" className="color-swatch-btn w-full aspect-square rounded-lg bg-lime-500 hover:scale-105 transition" title="Limetková"></button>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-1.5">Vlastná farba látky:</span>
                <div className="flex items-center gap-2">
                  <input type="color" id="customColorPicker" defaultValue="#0f172a" className="w-10 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5" />
                  <span id="currentColorHex" className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">#0F172A</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-2">Športové farebné prechody:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button data-pattern="solid" className="pattern-btn p-2 rounded-lg border border-indigo-500 bg-indigo-50/50 text-left text-xs font-semibold">■ Jednoliata</button>
                  <button data-pattern="gradient-neon" className="pattern-btn p-2 rounded-lg border border-slate-200 hover:border-slate-300 text-left text-xs font-semibold bg-gradient-to-r from-indigo-500 via-pink-500 to-indigo-900 text-white shadow-2xs">⚡ Neon Cyber</button>
                  <button data-pattern="gradient-fire" className="pattern-btn p-2 rounded-lg border border-slate-200 hover:border-slate-300 text-left text-xs font-semibold bg-gradient-to-r from-slate-900 via-red-600 to-amber-500 text-white shadow-2xs">🔥 Fire Race</button>
                  <button data-pattern="gradient-trail" className="pattern-btn p-2 rounded-lg border border-slate-200 hover:border-slate-300 text-left text-xs font-semibold bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-950 text-white shadow-2xs">🌲 Alpine Trail</button>
                </div>
              </div>
            </div>

            {/* TAB 2: TEXT */}
            <div id="tab-text" className="tab-content hidden space-y-3">
              <div>
                <label htmlFor="textInput" className="text-xs font-bold text-slate-700 block mb-1">Nápis na čelenku:</label>
                <div className="flex gap-1.5">
                  <input type="text" id="textInput" placeholder="Napr. RUNNER, SLOVAKIA..." className="flex-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  <button id="addTextBtn" className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-2xs">+ Vložiť</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="fontFamilySelect" className="text-[11px] font-bold text-slate-600 block mb-1">Písmo (Font):</label>
                  <select id="fontFamilySelect" className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-1.5">
                    <option value="Bebas Neue">Bebas Neue (Atletické)</option>
                    <option value="Montserrat">Montserrat (Moderné)</option>
                    <option value="Russo One">Russo One (Masívne)</option>
                    <option value="Oswald">Oswald (Úzke športové)</option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Veľkosť:</span><span id="fontSizeVal" className="text-indigo-600">64 px</span></div>
                  <input type="range" id="fontSizeSlider" min="24" max="110" defaultValue="64" className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg mt-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Farba textu:</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" id="textColorPicker" defaultValue="#ffffff" className="w-8 h-7 rounded border border-slate-300 cursor-pointer p-0.5" />
                    <span id="textColorHex" className="text-[11px] font-mono text-slate-600">#FFFFFF</span>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Obrys (Stroke):</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" id="strokeColorPicker" defaultValue="#000000" className="w-8 h-7 rounded border border-slate-300 cursor-pointer p-0.5" />
                    <select id="strokeWidthSelect" className="text-xs border border-slate-300 rounded p-1 flex-1" defaultValue="2">
                      <option value="0">Bez</option>
                      <option value="2">2 px</option>
                      <option value="4">4 px</option>
                      <option value="6">6 px</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button id="boldToggleBtn" className="flex-1 py-1 text-xs font-extrabold border border-slate-200 hover:bg-slate-50 rounded-lg transition">B (Tučné)</button>
                <button id="italicToggleBtn" className="flex-1 py-1 text-xs font-serif italic border border-slate-200 hover:bg-slate-50 rounded-lg transition">I (Kurzíva)</button>
                <button id="centerTextBtn" className="flex-1 py-1 text-xs font-semibold border border-slate-200 hover:bg-slate-50 rounded-lg transition">🎯 Stred</button>
              </div>
            </div>

            {/* TAB 3: GRAFIKY */}
            <div id="tab-graphics" className="tab-content hidden space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Vlastné logo / obrázok (PNG, SVG, JPG):</label>
                <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition text-center">
                  <span className="text-2xl mb-1">📤</span>
                  <span className="text-xs font-bold text-indigo-700">Kliknite pre nahratie loga</span>
                  <span className="text-[10px] text-slate-500">Priehľadné PNG odporúčané</span>
                  <input type="file" id="logoUploadInput" accept="image/*" className="hidden" />
                </label>
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Rýchle športové ikony:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">Farba:</span>
                    <input type="color" id="iconColorPicker" defaultValue="#facc15" className="w-7 h-6 rounded border border-slate-300 cursor-pointer p-0.5" title="Vybrať farbu pre ikony" />
                    <span id="iconColorHex" className="text-[10px] font-mono text-slate-600">#FACC15</span>
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <button data-icon-color="#ffffff" className="quick-icon-col w-5 h-5 rounded-full bg-white border border-slate-300 shadow-2xs hover:scale-110 transition" title="Biela"></button>
                  <button data-icon-color="#facc15" className="quick-icon-col w-5 h-5 rounded-full bg-yellow-400 ring-1 ring-slate-300 shadow-2xs hover:scale-110 transition" title="Žltá"></button>
                  <button data-icon-color="#ef4444" className="quick-icon-col w-5 h-5 rounded-full bg-red-500 shadow-2xs hover:scale-110 transition" title="Červená"></button>
                  <button data-icon-color="#38bdf8" className="quick-icon-col w-5 h-5 rounded-full bg-sky-400 shadow-2xs hover:scale-110 transition" title="Svetlomodrá"></button>
                  <button data-icon-color="#4ade80" className="quick-icon-col w-5 h-5 rounded-full bg-green-400 shadow-2xs hover:scale-110 transition" title="Neon Zelená"></button>
                  <button data-icon-color="#000000" className="quick-icon-col w-5 h-5 rounded-full bg-black shadow-2xs hover:scale-110 transition" title="Čierna"></button>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button data-icon="runner" className="icon-add-btn p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-1 transition"><span className="text-xl">🏃</span><span className="text-[10px] font-bold text-slate-600">Bežec</span></button>
                  <button data-icon="mountains" className="icon-add-btn p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-1 transition"><span className="text-xl">⛰️</span><span className="text-[10px] font-bold text-slate-600">Hory</span></button>
                  <button data-icon="bike" className="icon-add-btn p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-1 transition"><span className="text-xl">🚴</span><span className="text-[10px] font-bold text-slate-600">Bicykel</span></button>
                  <button data-icon="pulse" className="icon-add-btn p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 flex flex-col items-center gap-1 transition"><span className="text-xl">💓</span><span className="text-[10px] font-bold text-slate-600">Tep</span></button>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-1.5">Doplnky dizajnu:</span>
                <div className="flex gap-2">
                  <button id="addStripesBtn" className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition text-center">🏁 Pretekárske pruhy</button>
                  <button id="addFlagBtn" className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition text-center">🇸🇰 Trikolóra</button>
                </div>
              </div>
            </div>

            {/* TAB 4: VRSTVY */}
            <div id="tab-layers" className="tab-content hidden space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span>Poradie prvkov na čelenke:</span>
                <div className="flex gap-1">
                  <button id="layerUpBtn" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold" title="Posunúť vyššie">↑</button>
                  <button id="layerDownBtn" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold" title="Posunúť nižšie">↓</button>
                  <button id="layerDeleteBtn" className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold" title="Zmazať zvolený">✕</button>
                </div>
              </div>
              <div id="layersContainer" className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll pr-1"></div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
            <span className="text-indigo-600 font-bold">💡 Tip:</span>
            <span>Objekt môžete otáčať za hornú rúčku ⟳, meniť veľkosť za rohy alebo cez posuvníky vľavo.</span>
          </div>
        </aside>

        {/* PRAVÝ PANEL: 3D náhľad + 2D editor + objednávka */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold tracking-wide uppercase">3D Realistický Mockup čelenky</span>
                <span className="text-[10px] bg-white/20 text-white/90 px-1.5 py-0.5 rounded font-mono">Live Sync</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button id="toggleAutoRotateBtn" className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/20 rounded-md font-semibold transition text-slate-200">⏸️ Pauza rotácie</button>
                <div className="flex bg-white/10 p-0.5 rounded-md text-[11px]">
                  <button id="viewFrontBtn" className="px-2 py-0.5 rounded bg-white text-indigo-950 font-bold shadow-xs">Spredu</button>
                  <button id="viewAngleBtn" className="px-2 py-0.5 rounded text-white/80 hover:text-white">Uhol</button>
                  <button id="viewBackBtn" className="px-2 py-0.5 rounded text-white/80 hover:text-white">Zozadu</button>
                </div>
              </div>
            </div>
            <div className="relative w-full h-72 sm:h-80 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center overflow-hidden">
              <div id="threeContainer" className="w-full h-full cursor-grab active:cursor-grabbing"></div>
              <div className="absolute bottom-2.5 left-3 text-[11px] text-white/60 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md pointer-events-none flex items-center gap-2"><span>👆 Ťahaním myšou otáčate model čelenky</span></div>
              <div className="absolute bottom-2.5 right-3 text-[11px] text-indigo-300 font-mono bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md pointer-events-none">3D Elastický úplet</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">📐 Rozložený strih čelenky</span>
                <span className="text-[11px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">51.0 × 9.0 cm</span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" id="bleedGuideCheckbox" defaultChecked className="accent-indigo-600 rounded" />
                <span>Zobraziť spadávku a stred</span>
              </label>
            </div>
            <div className="p-3 sm:p-4 checker-bg flex flex-col items-center justify-center overflow-x-auto custom-scroll">
              <div className="w-full max-w-[960px] flex flex-col items-center">
                <div className="w-full flex justify-between text-[10px] font-bold text-slate-500 mb-1 px-1">
                  <span>← Ľavý bok (pri uchu)</span>
                  <span className="text-indigo-600 font-black">▼ STRED ČELA (Hlavná grafika) ▼</span>
                  <span>Pravý bok (Zadný šev) →</span>
                </div>
                <canvas id="editorCanvas" width="960" height="169" className="w-full h-auto max-h-[190px] rounded-lg bg-slate-900 transition-shadow"></canvas>
                <div className="w-full flex justify-between text-[10px] text-slate-400 mt-1.5 px-1">
                  <span>Červená prerušovaná čiara = 5 mm lem na zapošitie (spadávka)</span>
                  <span>Fialová os = stred prednej časti</span>
                </div>
                <p className="text-[10px] text-amber-600 mt-2">ℹ️ Toto je len orientačný náhľad v nižšej kvalite — tlačový súbor sa pri odoslaní objednávky vygeneruje v plnej kvalite (300 DPI) a nie je možné ho stiahnuť.</p>
              </div>
            </div>
          </div>

          {/* SÚHRN OBJEDNÁVKY */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2"><Gift className="w-4 h-4 text-indigo-500" /> Súhrn objednávky</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Počet kusov</label>
                <input type="number" min="1" step="1" value={pocetKs} onChange={(e) => setPocetKs(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Doprava</label>
                <select value={deliverySpeed} onChange={(e) => setDeliverySpeed(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="standard">Štandard</option>
                  <option value="express">Expres (+{nastavenia.priplatok_expres_percent}%)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold">Cena</span>
                <span className="text-[10px] font-normal text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full">s DPH {nastavenia.dph_percent}%</span>
              </div>
              <RowSum label="Cena za kus" value={`${cenaKus.toFixed(2)} €`} />
              <RowSum label="Doprava" value={`${shippingFee.toFixed(2)} €`} />
              {expressFee > 0 && <RowSum label="Príplatok expres" value={`${expressFee.toFixed(2)} €`} />}
              <RowSum label="Cena bez DPH" value={`${grandTotalBezDph.toFixed(2)} €`} />
              <RowSum label={`DPH ${nastavenia.dph_percent}%`} value={`${dphSuma.toFixed(2)} €`} />
              <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Celkom s DPH (vrátane dopravy)</span>
                <span className="text-2xl font-extrabold font-mono">{grandTotal.toFixed(2)} €</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center gap-2 text-[11px] text-indigo-700">
              <CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify Pay)
            </div>

            <button onClick={odoslatObjednavku} disabled={isSubmitting} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
              <ShoppingCart className="w-4 h-4" /> {isSubmitting ? 'Vytváram objednávku…' : 'Objednať a zaplatiť'}
            </button>
            {confirmation && <p className="text-xs text-emerald-600">{confirmation}</p>}
            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}
          </div>
        </section>

        {/* Toast notifikacia (ovladana z celenkyEngine.js) */}
        <div id="toastBox" className="fixed bottom-4 right-4 z-50 transform translate-y-16 opacity-0 transition-all duration-300 pointer-events-none">
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 text-xs font-medium">
            <span className="text-emerald-400 font-bold text-sm">✓</span>
            <span id="toastMsg">Úprava uložená</span>
          </div>
        </div>
      </main>
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
