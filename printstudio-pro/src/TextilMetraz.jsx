import React, { useEffect, useRef, useState } from 'react';
import { Shirt, UploadCloud, Truck, Eye, ShoppingCart, TriangleAlert, CreditCard, Grid3x3, Rows, Shapes } from 'lucide-react';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

const BUCKET = 'print-designs';
const ROLL_WIDTH_CM = 160;
// Referencne urovne (bm) len pre "Prehlad mnozstevnych zliav" nizsie — samotny vypocet ceny
// funguje pre lubovolnu (aj neceloriselnu) dlzku, toto je len ilustracna tabulka.
const BM_PREVIEW_LEVELS = [1, 5, 10, 25, 50, 100, 200, 500, 1000];

const REPEAT_OPTIONS = [
  { id: 'grid', label: 'Rovnobežný (Grid)', icon: Grid3x3 },
  { id: 'half-drop', label: 'Posun 1/2 (Half-Drop)', icon: Rows },
  { id: 'stack', label: 'Samostatné motívy', icon: Shapes },
];

export default function TextilMetraz({ supabase, onSpat }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [nakladBmByTech, setNakladBmByTech] = useState({ sublimacia: 0, bavlna: 0 });
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [nastavenia, setNastavenia] = useState(null);

  const [technologia, setTechnologia] = useState('sublimacia'); // 'sublimacia' | 'bavlna'
  const [mode, setMode] = useState('auto'); // 'auto' (vzor s opakovaním) | 'subor' (hotova rolka)
  const [patternRepeat, setPatternRepeat] = useState('grid');
  const [widthCm, setWidthCm] = useState(20);
  const [heightCm, setHeightCm] = useState(20);
  const [lengthBm, setLengthBm] = useState(2.0);
  const [directLengthBm, setDirectLengthBm] = useState(5.0);
  const [deliverySpeed, setDeliverySpeed] = useState('standard');
  const [scheduleOption, setScheduleOption] = useState(null);

  const [rawFile, setRawFile] = useState(null);
  const [patternImage, setPatternImage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [pridaneDoKosika, setPridaneDoKosika] = useState(false);

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný.'); setIsLoading(false); return; }
    (async () => {
      const [{ data: nak }, { data: cfg }, { data: n }] = await Promise.all([
        supabase.from('textil_naklady_verejny').select('technologia, naklad_bm'),
        supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('textil_nastavenia').select('*').eq('id', 1).maybeSingle(),
      ]);
      const map = { sublimacia: 0, bavlna: 0 };
      (nak || []).forEach(r => { map[r.technologia] = Number(r.naklad_bm) || 0; });
      setNakladBmByTech(map);
      if (cfg) setPricingConfig(mapConfigFromDb(cfg));
      setNastavenia(n || null);
      setIsLoading(false);
    })();
  }, [supabase]);

  // ---- Výpočet ceny a metráže ----
  let totalLengthBm = 0, totalM2 = 0, baseRate = 0, subtotal = 0, expressFee = 0, shippingFee = 0, grandTotalBezDph = 0, dphSuma = 0, grandTotal = 0, capacityIssue = null;
  const nakladBm = nakladBmByTech[technologia] || 0;

  if (nastavenia) {
    totalLengthBm = mode === 'auto' ? Math.max(0.5, lengthBm) : Math.max(0.5, directLengthBm);
    totalM2 = totalLengthBm * (ROLL_WIDTH_CM / 100);

    // Sadzba (€/bm) sa dopocitava z vyrobnej ceny na meter + jednotneho marzoveho vzorca
    // (rovnaky ako v celom PrintStudio Pro) — vacsi odber = nizsia marza = nizsia sadzba.
    baseRate = priceAt(nakladBm, totalLengthBm, pricingConfig);
    subtotal = Math.max(totalLengthBm * baseRate, Number(nastavenia.minimalna_cena_objednavky));
    expressFee = deliverySpeed === 'express' ? subtotal * (Number(nastavenia.priplatok_expres_percent) / 100) : 0;
    shippingFee = Number(nastavenia.cena_doprava);
    grandTotalBezDph = subtotal + expressFee + shippingFee;
    // Slovensky B2C zakaznik vzdy plati s DPH — cena v kosiku aj cele vyuctovanie musi byt s DPH.
    dphSuma = grandTotalBezDph * (Number(nastavenia.dph_percent || 0) / 100);
    grandTotal = grandTotalBezDph + dphSuma;

    const limitExpres = technologia === 'sublimacia' ? Number(nastavenia.limit_expres_bm_sublimacia) : Number(nastavenia.limit_expres_bm_bavlna);
    const limitStandard = technologia === 'sublimacia' ? Number(nastavenia.limit_standard_bm_sublimacia) : Number(nastavenia.limit_standard_bm_bavlna);

    if (deliverySpeed === 'express' && totalLengthBm > limitExpres) {
      capacityIssue = {
        title: `Kapacitný limit expresnej tlače (max ${limitExpres} bm/deň)`,
        desc: `Objednali ste ${totalLengthBm.toFixed(1)} bm. Tlačiareň dokáže v deň objednávky vytlačiť maximálne ${limitExpres} bm expresne touto technológiou.`,
        options: [
          { value: 'exp_split', label: `Prvých ${limitExpres} m dnes expresne, zvyšok nasledujúci deň` },
          { value: 'exp_standard', label: 'Celá zásielka naraz na 3. pracovný deň' },
        ],
      };
    } else if (deliverySpeed === 'standard' && totalLengthBm > limitStandard) {
      capacityIssue = {
        title: `Veľkoobjemová zákazka nad ${limitStandard} bm (štandardná kapacita)`,
        desc: `Objednaná metráž ${totalLengthBm.toFixed(1)} bm presahuje štandardnú dennú kapacitu tejto technológie.`,
        options: [
          { value: 'std_all_day3', label: 'Kompletná zásielka naraz na 3.-4. pracovný deň' },
          { value: 'std_daily_batches', label: 'Postupné denné odosielanie po častiach' },
        ],
      };
    }
  }

  const aktualnyHarmonogram = capacityIssue
    ? (scheduleOption ? capacityIssue.options.find(o => o.value === scheduleOption)?.label : capacityIssue.options[0].label)
    : (deliverySpeed === 'express' ? 'Expresne v deň objednávky' : 'Štandardne do 48 hodín');

  // ---- Canvas náhľad (dlaždicovanie vzoru podľa typu opakovania) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nastavenia) return;
    const ctx = canvas.getContext('2d');
    const ratio = 280 / ROLL_WIDTH_CM;
    canvas.width = 280;
    const previewLengthBm = mode === 'auto' ? Math.max(0.5, lengthBm) : Math.max(0.5, directLengthBm);
    const canvasHeightPx = Math.min(440, Math.max(180, previewLengthBm * 100 * ratio));
    canvas.height = canvasHeightPx;

    ctx.fillStyle = technologia === 'sublimacia' ? '#f0fdfa' : '#fffbeb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e2e8f0';
    for (let y = 0; y < canvas.height; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    if (mode === 'auto') {
      const wPx = Math.max(14, widthCm * ratio);
      const hPx = Math.max(14, heightCm * ratio);
      const cols = Math.ceil(canvas.width / wPx) + 1;
      const rows = Math.ceil(canvas.height / hPx);
      for (let r = 0; r < rows; r++) {
        let offsetX = 0;
        if (patternRepeat === 'half-drop' && r % 2 === 1) offsetX = wPx / 2;
        for (let c = -1; c <= cols; c++) {
          const x = c * wPx + offsetX;
          const y = r * hPx;
          if (patternImage) {
            ctx.drawImage(patternImage, x, y, wPx, hPx);
          } else {
            ctx.fillStyle = technologia === 'sublimacia' ? 'rgba(20, 184, 166, 0.25)' : 'rgba(245, 158, 11, 0.25)';
            ctx.fillRect(x + 1, y + 1, wPx - 2, hPx - 2);
            ctx.strokeStyle = technologia === 'sublimacia' ? '#14b8a6' : '#f59e0b';
            ctx.strokeRect(x + 1, y + 1, wPx - 2, hPx - 2);
          }
        }
      }
    } else {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
      ctx.fillStyle = '#047857';
      ctx.font = '11px sans-serif';
      ctx.fillText('Pripravená rolka 160cm (150-300 DPI)', 16, 28);
      ctx.fillText(`Dĺžka: ${directLengthBm.toFixed(2)} bm`, 16, 46);
    }
  }, [mode, technologia, widthCm, heightCm, lengthBm, directLengthBm, patternRepeat, patternImage, nastavenia]);

  const handlePatternUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRawFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => setPatternImage(img);
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  };
  const handleRollUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRawFile(file);
  };

  const odoslatObjednavku = async () => {
    if (!nastavenia) return;
    if (!nastavenia.shopify_variant_id) {
      setSubmitError('Modul ešte nie je pripojený na Shopify — chýba nastavený Variant ID v admin karte "Textilná metráž".');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    setConfirmation('');
    setPridaneDoKosika(false);

    try {
      const objednavkaId = crypto.randomUUID();
      let suborCesta = null;
      if (rawFile) {
        const cesta = `textil/${objednavkaId}/${rawFile.name}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, rawFile, { contentType: rawFile.type });
        if (!uploadErr) suborCesta = cesta;
      }

      const { error: insertErr } = await supabase.from('textil_objednavky').insert({
        id: objednavkaId,
        technologia,
        rezim: mode,
        raster_typ: mode === 'auto' ? patternRepeat : null,
        sirka_cm: mode === 'auto' ? widthCm : null,
        vyska_cm: mode === 'auto' ? heightCm : null,
        dlzka_bm: Math.round(totalLengthBm * 100) / 100,
        plocha_m2: Math.round(totalM2 * 100) / 100,
        cena_hladina: `${baseRate.toFixed(2)} €/bm`,
        cena_spolu: Math.round(grandTotal * 100) / 100,
        doprava_rychlost: deliverySpeed,
        harmonogram: aktualnyHarmonogram,
        subor_nazov: rawFile?.name || null,
        subor_cesta: suborCesta,
      });
      if (insertErr) throw insertErr;

      const jednotkovaCena = Number(nastavenia.jednotka_cena_eur) || 0.05;
      const quantity = Math.max(1, Math.round(grandTotal / jednotkovaCena));
      const technikaLabel = technologia === 'sublimacia' ? 'Sublimačná potlač' : 'Digitálna potlač bavlny';

      const shopifyPayload = {
        items: [{
          id: nastavenia.shopify_variant_id,
          quantity,
          properties: {
            _objednavka_id: objednavkaId,
            _technologia: technikaLabel,
            _rezim: mode === 'auto' ? `Vzor s opakovaním (${widthCm}×${heightCm}cm, ${patternRepeat})` : 'Hotová rolka v metráži',
            _dlzka_bm: totalLengthBm.toFixed(2),
            _harmonogram: aktualnyHarmonogram,
            _cena: grandTotal.toFixed(2) + ' €',
          },
        }],
      };

      // Sietova chyba (fetch samotny zlyha, napr. mimo realneho Shopify obchodu) sa lisi od toho,
      // ze Shopify odpoved PRIJAL ale vratil chybu (napr. zle Variant ID) — druhy pripad je
      // skutocny problem, ktory sa nesmie tichoschovat pod "to je normalne mimo obchodu".
      let res;
      try {
        res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(shopifyPayload),
        });
      } catch (networkErr) {
        setConfirmation(`Objednávka ${objednavkaId} bola uložená (mimo Shopify obchodu /cart/add.js zlyhalo — v reálnom obchode pridá do košíka automaticky).`);
        return;
      }
      if (!res.ok) {
        let chybaText = '';
        try { const j = await res.json(); chybaText = j.description || j.message || JSON.stringify(j); } catch { chybaText = await res.text().catch(() => String(res.status)); }
        setSubmitError(`Objednávka ${objednavkaId} bola uložená, ale pridanie do košíka zlyhalo (Shopify: ${chybaText}). Skontroluj Variant ID v nastaveniach "Textilná metráž".`);
        return;
      }
      setConfirmation(`Objednávka bola vložená do košíka — ${totalLengthBm.toFixed(2)} bm, ${grandTotal.toFixed(2)} € (${aktualnyHarmonogram}).`);
      setPridaneDoKosika(true);
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!nastavenia) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm px-4 text-center">Textilná metráž ešte nie je nastavená — spusti migráciu `migration_textil_metraz.sql`.</div>;

  const accent = technologia === 'sublimacia' ? 'teal' : 'amber';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-gradient-to-r from-slate-50 to-white p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2"><Shirt className="text-teal-600 w-6 h-6" /> Textilná metráž — sublimácia & digitálna bavlna</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Tlač na rolku šírky 160 cm. Nahraj vzor s opakovaním alebo hotovú rolku (150-300 DPI, TIFF/PNG/PDF).</p>
        </div>
        {onSpat && <button onClick={onSpat} className="text-slate-600 hover:text-teal-600 hover:bg-teal-50 px-3 py-2 rounded-lg text-sm font-medium transition self-start">← Katalóg</button>}
      </div>

      {/* PREPINAC TECHNOLOGIE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button type="button" onClick={() => setTechnologia('sublimacia')} className={`p-4 rounded-xl border-2 text-left transition ${technologia === 'sublimacia' ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <span className="font-bold text-slate-900 text-sm block">1. Sublimačná potlač</span>
          <span className="text-xs text-slate-500 mt-1 block">Transferový papier + kalander — polyester, funkčný úplet, softshell, vlajkovina.</span>
        </button>
        <button type="button" onClick={() => setTechnologia('bavlna')} className={`p-4 rounded-xl border-2 text-left transition ${technologia === 'bavlna' ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
          <span className="font-bold text-slate-900 text-sm block">2. Digitálna potlač bavlny</span>
          <span className="text-xs text-slate-500 mt-1 block">Priama pigmentová tlač (bez papiera) — popelín, mušelín, teplákovina, bavlna satén.</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ľavý stĺpec */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-1 shadow-sm">
            <button onClick={() => setMode('auto')} className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${mode === 'auto' ? `bg-${accent}-600 text-white` : 'text-slate-500 hover:bg-slate-50'}`} style={mode === 'auto' ? { backgroundColor: technologia === 'sublimacia' ? '#0d9488' : '#d97706' } : undefined}>1. Vzor s opakovaním</button>
            <button onClick={() => setMode('subor')} className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${mode === 'subor' ? 'text-white' : 'text-slate-500 hover:bg-slate-50'}`} style={mode === 'subor' ? { backgroundColor: technologia === 'sublimacia' ? '#0d9488' : '#d97706' } : undefined}>2. Nahrať hotovú rolku</button>
          </div>

          {mode === 'auto' ? (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Parametre vzoru</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Šírka motívu (cm)</label>
                  <input type="number" min="1" max={ROLL_WIDTH_CM} step="0.5" value={widthCm} onChange={(e) => setWidthCm(parseFloat(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Výška motívu (cm)</label>
                  <input type="number" min="1" step="0.5" value={heightCm} onChange={(e) => setHeightCm(parseFloat(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Dĺžka látky (bm)</label>
                  <input type="number" min="0.5" step="0.5" value={lengthBm} onChange={(e) => setLengthBm(parseFloat(e.target.value) || 0.5)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Typ opakovania vzoru</label>
                <div className="grid grid-cols-3 gap-2">
                  {REPEAT_OPTIONS.map(r => {
                    const Icon = r.icon;
                    const active = patternRepeat === r.id;
                    return (
                      <button key={r.id} type="button" onClick={() => setPatternRepeat(r.id)} className={`p-2.5 rounded-lg border text-center text-xs font-medium transition ${active ? 'border-teal-500 bg-teal-50/60 text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition bg-slate-50/50">
                <UploadCloud className="w-6 h-6 text-teal-500" />
                <span className="text-xs text-slate-600 font-medium">{rawFile ? `Nahraté: ${rawFile.name}` : 'Kliknite pre výber vzoru (PNG/TIFF/PDF, 150-300 DPI)'}</span>
                <input type="file" accept="image/png,image/tiff,image/jpeg,application/pdf" onChange={handlePatternUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Nahrať hotovú pripravenú rolku (160 cm)</h3>
              <label className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition bg-slate-50/50">
                <UploadCloud className="w-7 h-7 text-teal-500" />
                <span className="text-xs text-slate-600 font-medium">{rawFile ? `Súbor pripravený: ${rawFile.name}` : 'Vyberte exportný súbor (TIFF/PNG/PDF, 150-300 DPI, šírka 160cm)'}</span>
                <input type="file" accept="image/png,image/tiff,application/pdf" onChange={handleRollUpload} className="hidden" />
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dĺžka rolky (bm)</label>
                <input type="number" min="0.5" step="0.5" value={directLengthBm} onChange={(e) => setDirectLengthBm(parseFloat(e.target.value) || 0.5)} className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2"><Truck className="w-4 h-4 text-teal-500" /> Rýchlosť doručenia</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border cursor-pointer transition ${deliverySpeed === 'standard' ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200'}`}>
                <input type="radio" name="rychlost" className="hidden" checked={deliverySpeed === 'standard'} onChange={() => { setDeliverySpeed('standard'); setScheduleOption(null); }} />
                <span className="text-sm font-bold text-slate-900 block">Štandard — do 48 hodín</span>
                <span className="text-xs text-slate-500">Bez príplatku</span>
              </label>
              <label className={`p-3.5 rounded-xl border cursor-pointer transition ${deliverySpeed === 'express' ? 'border-amber-500 bg-amber-50/60' : 'border-slate-200'}`}>
                <input type="radio" name="rychlost" className="hidden" checked={deliverySpeed === 'express'} onChange={() => { setDeliverySpeed('express'); setScheduleOption(null); }} />
                <span className="text-sm font-bold text-slate-900 block">Expres — v deň objednávky</span>
                <span className="text-xs text-amber-600 font-medium">+{nastavenia.priplatok_expres_percent}% príplatok</span>
              </label>
            </div>

            {capacityIssue && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-800 block text-sm">{capacityIssue.title}</span>
                    <p className="text-amber-700 mt-1">{capacityIssue.desc}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200 space-y-1.5">
                  {capacityIssue.options.map(o => (
                    <label key={o.value} className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input type="radio" name="harmonogram" checked={(scheduleOption || capacityIssue.options[0].value) === o.value} onChange={() => setScheduleOption(o.value)} />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pravý stĺpec */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5"><Eye className="w-4 h-4 text-teal-500" /> Náhľad látky (160 cm)</span>
              <span className="text-[10px] text-slate-400 font-mono">{ROLL_WIDTH_CM}cm × {totalLengthBm.toFixed(2)}m</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center p-2 bg-slate-50 min-h-[200px]">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
          </div>

          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Súhrn objednávky</span>
              <span className="text-[10px] font-normal text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full">s DPH {nastavenia.dph_percent}%</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <Row label="Technológia" value={technologia === 'sublimacia' ? 'Sublimácia' : 'Digitálna bavlna'} />
              <Row label="Sadzba pri tomto odbere" value={`${baseRate.toFixed(2)} €/bm`} />
              <Row label="Objednaná dĺžka metráže" value={`${totalLengthBm.toFixed(2)} bm`} highlight />
              <Row label="Tlačová plocha" value={`${totalM2.toFixed(2)} m²`} />
              <Row label="Príplatok za expres" value={`${expressFee.toFixed(2)} €`} />
              <Row label="Doprava (DPD kuriér)" value={`${shippingFee.toFixed(2)} €`} />
              <Row label="Harmonogram dodania" value={aktualnyHarmonogram} small />
              <Row label="Cena bez DPH" value={`${grandTotalBezDph.toFixed(2)} €`} />
              <Row label={`DPH ${nastavenia.dph_percent}%`} value={`${dphSuma.toFixed(2)} €`} />
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Celková cena spolu s DPH (vrátane dopravy)</span>
              <span className="text-2xl font-extrabold font-mono">{grandTotal.toFixed(2)} €</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center gap-2 text-[11px] text-indigo-300">
              <CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify Pay)
            </div>
            {pridaneDoKosika ? (
              <a href="/cart" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                <ShoppingCart className="w-4 h-4" /> Zobraziť košík a dokončiť objednávku
              </a>
            ) : (
              <button onClick={odoslatObjednavku} disabled={isSubmitting} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                <ShoppingCart className="w-4 h-4" /> {isSubmitting ? 'Odosielam…' : 'Vložiť do košíka a zaplatiť'}
              </button>
            )}
            {confirmation && <p className="text-xs text-emerald-400">{confirmation}</p>}
            {submitError && <p className="text-xs text-rose-400">{submitError}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Množstevné zľavy — {technologia === 'sublimacia' ? 'Sublimácia' : 'Digitálna bavlna'} (šírka 160cm)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                <th className="p-2.5">Metráž</th><th className="p-2.5">Cena €/bm</th><th className="p-2.5">Prepočet €/m²</th><th className="p-2.5">Zľava</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BM_PREVIEW_LEVELS.map(level => {
                const rate = priceAt(nakladBm, level, pricingConfig);
                const base = priceAt(nakladBm, BM_PREVIEW_LEVELS[0], pricingConfig);
                const discount = base > 0 ? Math.round(((base - rate) / base) * 100) : 0;
                const isCurrent = totalLengthBm >= level && (level === BM_PREVIEW_LEVELS[BM_PREVIEW_LEVELS.length - 1] || totalLengthBm < BM_PREVIEW_LEVELS[BM_PREVIEW_LEVELS.indexOf(level) + 1]);
                return (
                  <tr key={level} className={isCurrent ? 'bg-teal-50 font-semibold' : ''}>
                    <td className="p-2.5 text-slate-700">od {level} bm {isCurrent && <span className="ml-1 text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full">Váš odber</span>}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">{rate.toFixed(2)} €</td>
                    <td className="p-2.5 font-mono text-slate-500">{(rate / 1.60).toFixed(2)} €</td>
                    <td className={`p-2.5 font-mono ${discount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{discount > 0 ? `-${discount}%` : 'Základ'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, small }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
      <span className="text-slate-400">{label}:</span>
      <span className={`font-mono ${small ? 'text-[11px] font-semibold' : 'font-semibold'} ${highlight ? 'text-indigo-400' : 'text-slate-100'}`}>{value}</span>
    </div>
  );
}
