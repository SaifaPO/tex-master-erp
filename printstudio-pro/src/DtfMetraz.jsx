import React, { useEffect, useRef, useState } from 'react';
import { Scroll, UploadCloud, Truck, Eye, ShoppingCart, TriangleAlert, CreditCard } from 'lucide-react';

const BUCKET = 'print-designs';
const ROLL_WIDTH_CM = 56;
const MARGIN_CM = 0.5;

function vypocitajRozlozenie(widthCm, heightCm, qty) {
  const effectiveWidth = Math.min(widthCm, ROLL_WIDTH_CM);
  const itemsPerRow = Math.max(1, Math.floor((ROLL_WIDTH_CM + MARGIN_CM) / (effectiveWidth + MARGIN_CM)));
  const totalRows = Math.ceil(qty / itemsPerRow);
  const rowHeightCm = heightCm + MARGIN_CM;
  const totalHeightCm = totalRows * rowHeightCm;
  return { itemsPerRow, totalRows, dlzkaBm: Math.max(0.1, totalHeightCm / 100) };
}

export default function DtfMetraz({ supabase, onSpat }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hladiny, setHladiny] = useState([]);
  const [nastavenia, setNastavenia] = useState(null);

  const [mode, setMode] = useState('auto'); // 'auto' | 'subor'
  const [widthCm, setWidthCm] = useState(10);
  const [heightCm, setHeightCm] = useState(10);
  const [qty, setQty] = useState(30);
  const [directLengthBm, setDirectLengthBm] = useState(1.0);
  const [deliverySpeed, setDeliverySpeed] = useState('standard');
  const [scheduleOption, setScheduleOption] = useState(null);

  const [rawFile, setRawFile] = useState(null);
  const [logoImage, setLogoImage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitError, setSubmitError] = useState('');

  const canvasRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setLoadError('Supabase klient nie je nakonfigurovaný.'); setIsLoading(false); return; }
    (async () => {
      const [{ data: h }, { data: n }] = await Promise.all([
        supabase.from('dtf_cenove_hladiny').select('*').order('poradie'),
        supabase.from('dtf_nastavenia').select('*').eq('id', 1).maybeSingle(),
      ]);
      setHladiny(h || []);
      setNastavenia(n || null);
      setIsLoading(false);
    })();
  }, [supabase]);

  // ---- Výpočet ceny a metráže ----
  let totalLengthBm = 0, totalM2 = 0, totalCm2 = 0, currentTier = null, subtotal = 0, expressFee = 0, shippingFee = 0, grandTotal = 0, capacityIssue = null;

  if (nastavenia) {
    if (mode === 'auto') {
      const { dlzkaBm } = vypocitajRozlozenie(widthCm, heightCm, qty);
      totalLengthBm = dlzkaBm;
      totalM2 = totalLengthBm * (ROLL_WIDTH_CM / 100);
      totalCm2 = widthCm * heightCm * qty;
    } else {
      totalLengthBm = Math.max(0.01, directLengthBm);
      totalM2 = totalLengthBm * (ROLL_WIDTH_CM / 100);
      totalCm2 = Math.round(totalM2 * 10000);
    }

    currentTier = hladiny[0] || null;
    for (const t of hladiny) {
      if (totalLengthBm >= t.min_bm) currentTier = t;
    }

    const baseRate = currentTier ? Number(currentTier.cena_bm) : 0;
    subtotal = Math.max(totalLengthBm * baseRate, Number(nastavenia.minimalna_cena_objednavky));
    expressFee = deliverySpeed === 'express' ? subtotal * (Number(nastavenia.priplatok_expres_percent) / 100) : 0;
    shippingFee = Number(nastavenia.cena_doprava);
    grandTotal = subtotal + expressFee + shippingFee;

    if (deliverySpeed === 'express' && totalLengthBm > Number(nastavenia.limit_expres_bm)) {
      capacityIssue = {
        title: `Kapacitný limit expresnej tlače (max ${nastavenia.limit_expres_bm} bm/deň)`,
        desc: `Objednali ste ${totalLengthBm.toFixed(1)} bm. Tlačiareň dokáže v deň objednávky vytlačiť maximálne ${nastavenia.limit_expres_bm} bm expresne.`,
        options: [
          { value: 'exp_split', label: `Prvých ${nastavenia.limit_expres_bm} m dnes expresne, zvyšok nasledujúci deň` },
          { value: 'exp_standard', label: 'Celá zásielka naraz na 3. pracovný deň (bez stornovania expres poplatku)' },
        ],
      };
    } else if (deliverySpeed === 'standard' && totalLengthBm > Number(nastavenia.limit_standard_bm)) {
      capacityIssue = {
        title: `Veľkoobjemová zákazka nad ${nastavenia.limit_standard_bm} bm (kapacita do 48h)`,
        desc: `Objednaná metráž ${totalLengthBm.toFixed(1)} bm presahuje kapacitu 48h štandardnej expedície.`,
        options: [
          { value: 'std_all_day3', label: 'Kompletná zásielka naraz na 3. pracovný deň' },
          { value: 'std_daily_batches', label: 'Postupné denné odosielanie po častiach' },
        ],
      };
    }
  }

  const aktualnyHarmonogram = capacityIssue
    ? (scheduleOption ? capacityIssue.options.find(o => o.value === scheduleOption)?.label : capacityIssue.options[0].label)
    : (deliverySpeed === 'express' ? 'Expresne v deň objednávky' : 'Štandardne do 48 hodín');

  // ---- Canvas náhľad ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nastavenia) return;
    const ctx = canvas.getContext('2d');
    const ratio = 300 / ROLL_WIDTH_CM;
    canvas.width = 300;
    const lengthBm = mode === 'auto' ? vypocitajRozlozenie(widthCm, heightCm, qty).dlzkaBm : directLengthBm;
    const canvasHeightPx = Math.min(450, Math.max(180, lengthBm * 100 * ratio));
    canvas.height = canvasHeightPx;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e2e8f0';
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    if (mode === 'auto') {
      const wPx = widthCm * ratio, hPx = heightCm * ratio, marginPx = MARGIN_CM * ratio;
      let x = marginPx, y = marginPx;
      for (let i = 0; i < qty; i++) {
        if (y + hPx > canvas.height + 10) break;
        if (logoImage) {
          ctx.drawImage(logoImage, x, y, wPx, hPx);
        } else {
          ctx.fillStyle = 'rgba(79, 70, 229, 0.15)';
          ctx.fillRect(x, y, wPx, hPx);
          ctx.strokeStyle = '#6366f1';
          ctx.strokeRect(x, y, wPx, hPx);
          ctx.fillStyle = '#4f46e5';
          ctx.font = '9px sans-serif';
          ctx.fillText(`DTF #${i + 1}`, x + 4, y + 12);
        }
        x += wPx + marginPx;
        if (x + wPx > canvas.width) { x = marginPx; y += hPx + marginPx; }
      }
    } else {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
      ctx.fillStyle = '#047857';
      ctx.font = '12px sans-serif';
      ctx.fillText('Pripravený tlačový súbor (300 DPI)', 20, 30);
      ctx.fillText(`Dĺžka: ${directLengthBm.toFixed(2)} bm`, 20, 50);
    }
  }, [mode, widthCm, heightCm, qty, directLengthBm, logoImage, nastavenia]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRawFile(file);
    if (mode === 'auto') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => setLogoImage(img);
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const odoslatObjednavku = async () => {
    if (!nastavenia) return;
    if (!nastavenia.shopify_variant_id) {
      setSubmitError('Modul ešte nie je pripojený na Shopify — chýba nastavený Variant ID v admin karte "DTF metráž".');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    setConfirmation('');

    try {
      const objednavkaId = crypto.randomUUID();
      let suborCesta = null;
      if (rawFile) {
        const cesta = `dtf/${objednavkaId}/${rawFile.name}`;
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, rawFile, { contentType: rawFile.type });
        if (!uploadErr) suborCesta = cesta;
      }

      const { error: insertErr } = await supabase.from('dtf_objednavky').insert({
        id: objednavkaId,
        rezim: mode,
        sirka_cm: mode === 'auto' ? widthCm : null,
        vyska_cm: mode === 'auto' ? heightCm : null,
        pocet_ks: mode === 'auto' ? qty : null,
        dlzka_bm: Math.round(totalLengthBm * 100) / 100,
        plocha_m2: Math.round(totalM2 * 100) / 100,
        cena_hladina: currentTier?.label || null,
        cena_spolu: Math.round(grandTotal * 100) / 100,
        doprava_rychlost: deliverySpeed,
        harmonogram: aktualnyHarmonogram,
        subor_nazov: rawFile?.name || null,
        subor_cesta: suborCesta,
      });
      if (insertErr) throw insertErr;

      const jednotkovaCena = Number(nastavenia.jednotka_cena_eur) || 0.05;
      const quantity = Math.max(1, Math.round(grandTotal / jednotkovaCena));

      const shopifyPayload = {
        items: [{
          id: nastavenia.shopify_variant_id,
          quantity,
          properties: {
            _objednavka_id: objednavkaId,
            _rezim: mode === 'auto' ? `Skladanie z loga (${qty}ks, ${widthCm}×${heightCm}cm)` : 'Hotová rolka v metráži',
            _dlzka_bm: totalLengthBm.toFixed(2),
            _harmonogram: aktualnyHarmonogram,
            _cena: grandTotal.toFixed(2) + ' €',
          },
        }],
      };

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(shopifyPayload),
        });
        if (!res.ok) throw new Error('Shopify odpovedal chybou ' + res.status);
        setConfirmation(`Objednávka bola vložená do košíka — ${totalLengthBm.toFixed(2)} bm, ${grandTotal.toFixed(2)} € (${aktualnyHarmonogram}).`);
      } catch (e) {
        // Mimo skutočného Shopify obchodu (napr. lokálny vývoj) /cart/add.js neexistuje — očakávané.
        setConfirmation(`Objednávka ${objednavkaId} bola uložená (mimo Shopify obchodu /cart/add.js zlyhalo — v reálnom obchode pridá do košíka automaticky).`);
      }
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!nastavenia) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm px-4 text-center">DTF metráž ešte nie je nastavená — spusti migráciu `migration_dtf_metraz.sql`.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-white p-5 sm:p-6 rounded-2xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2"><Scroll className="text-indigo-600 w-6 h-6" /> Objednávka DTF transferov v metráži</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Tlač na rolku (šírka 56 cm). Tlačové rozlíšenie 300 DPI, formát TIFF/PNG bez pozadia.</p>
        </div>
        {onSpat && <button onClick={onSpat} className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium transition self-start">← Katalóg</button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ľavý stĺpec */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-1 shadow-sm">
            <button onClick={() => setMode('auto')} className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${mode === 'auto' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>1. Skladanie z loga</button>
            <button onClick={() => setMode('subor')} className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${mode === 'subor' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>2. Nahrať hotovú rolku</button>
          </div>

          {mode === 'auto' ? (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Zadať rozmer a počet kusov</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Šírka loga (cm)</label>
                  <input type="number" min="0.5" max={ROLL_WIDTH_CM} step="0.5" value={widthCm} onChange={(e) => setWidthCm(parseFloat(e.target.value) || 0.5)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Výška loga (cm)</label>
                  <input type="number" min="0.5" step="0.5" value={heightCm} onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0.5)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Počet kusov</label>
                  <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition bg-slate-50/50">
                <UploadCloud className="w-6 h-6 text-indigo-500" />
                <span className="text-xs text-slate-600 font-medium">{rawFile ? `Nahraté: ${rawFile.name}` : 'Kliknite pre výber (PNG / TIFF, 300 DPI)'}</span>
                <input type="file" accept="image/png,image/tiff" onChange={handleFile} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Nahrať hotovú pripravenú rolku</h3>
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition bg-slate-50/50">
                <UploadCloud className="w-7 h-7 text-indigo-500" />
                <span className="text-xs text-slate-600 font-medium">{rawFile ? `Súbor pripravený: ${rawFile.name}` : 'Vyberte exportný súbor (TIFF / PNG, 300 DPI, šírka 56 cm)'}</span>
                <input type="file" accept="image/png,image/tiff" onChange={handleFile} className="hidden" />
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dĺžka rolky (bm)</label>
                <input type="number" min="0.01" step="0.1" value={directLengthBm} onChange={(e) => setDirectLengthBm(parseFloat(e.target.value) || 0.01)} className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2"><Truck className="w-4 h-4 text-indigo-500" /> Rýchlosť doručenia</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border cursor-pointer transition ${deliverySpeed === 'standard' ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200'}`}>
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
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5"><Eye className="w-4 h-4 text-indigo-500" /> Náhľad rozloženia (56 cm)</span>
              <span className="text-[10px] text-slate-400 font-mono">{ROLL_WIDTH_CM}cm × {totalLengthBm.toFixed(2)}m</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center p-2 bg-slate-50 min-h-[200px]">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
          </div>

          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-3">
            <h3 className="text-sm font-bold flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Súhrn objednávky</span>
              <span className="text-[10px] font-normal text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full">Bez DPH</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <Row label="Cenová hladina" value={currentTier ? `${currentTier.label} (${Number(currentTier.cena_bm).toFixed(2)} €/bm)` : '—'} />
              <Row label="Potrebná dĺžka rolky" value={`${totalLengthBm.toFixed(2)} bm`} highlight />
              <Row label="Tlačová plocha" value={`${totalM2.toFixed(2)} m²`} />
              <Row label="Príplatok za expres" value={`${expressFee.toFixed(2)} €`} />
              <Row label="Doprava" value={`${shippingFee.toFixed(2)} €`} />
              <Row label="Harmonogram dodania" value={aktualnyHarmonogram} small />
            </div>
            <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Celková cena spolu (vrátane dopravy)</span>
              <span className="text-2xl font-extrabold font-mono">{grandTotal.toFixed(2)} €</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 flex items-center gap-2 text-[11px] text-indigo-300">
              <CreditCard className="w-4 h-4" /> Platba vopred kartou (Shopify Pay)
            </div>
            <button onClick={odoslatObjednavku} disabled={isSubmitting} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
              <ShoppingCart className="w-4 h-4" /> {isSubmitting ? 'Odosielam…' : 'Vložiť do košíka a zaplatiť'}
            </button>
            {confirmation && <p className="text-xs text-emerald-400">{confirmation}</p>}
            {submitError && <p className="text-xs text-rose-400">{submitError}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Prehľad množstevných zliav (šírka 56 cm)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                <th className="p-2.5">Hladina</th><th className="p-2.5">Metráž od</th><th className="p-2.5">Cena €/bm</th><th className="p-2.5">Zľava</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hladiny.map(t => {
                const isCurrent = currentTier && t.id === currentTier.id;
                const base = Number(hladiny[0]?.cena_bm || t.cena_bm);
                const discount = Math.round(((base - Number(t.cena_bm)) / base) * 100);
                return (
                  <tr key={t.id} className={isCurrent ? 'bg-indigo-50 font-semibold' : ''}>
                    <td className="p-2.5 text-slate-700">{t.label} {isCurrent && <span className="ml-1 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">Váš odber</span>}</td>
                    <td className="p-2.5 font-mono text-slate-500">{t.min_bm} bm{Number(t.max_bm) < 1000 ? ` - ${t.max_bm} bm` : '+'}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">{Number(t.cena_bm).toFixed(2)} €</td>
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
