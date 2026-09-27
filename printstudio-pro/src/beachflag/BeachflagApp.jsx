import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Flag, Eye } from 'lucide-react';
import PbtHeader from '../PbtHeader';
import { nacitajVlajkaKatalog } from './vlajkaData';
import ParametreTab from './ParametreTab';
import GrafikaTab from './GrafikaTab';
import DoplnkyTab from './DoplnkyTab';

const BUCKET = 'print-designs';
const DEFAULT_VIEWBOX = { w: 200, h: 420 };

function parseViewbox(vb) {
  const parts = (vb || '0 0 200 420').split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) return { w: parts[2], h: parts[3] };
  return DEFAULT_VIEWBOX;
}

export default function BeachflagApp({ supabase }) {
  const [katalog, setKatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [krok, setKrok] = useState('parametre'); // parametre | grafika | doplnky
  const [tvarKod, setTvarKod] = useState('');
  const [velkostKod, setVelkostKod] = useState('');
  const [materialKod, setMaterialKod] = useState('');
  const [dokoncenieKod, setDokoncenieKod] = useState('');
  const [stoziarKod, setStoziarKod] = useState('');
  const [podstavecKod, setPodstavecKod] = useState('');
  const [doplnkyMnozstva, setDoplnkyMnozstva] = useState({});
  const [bgColor, setBgColor] = useState('#ffffff');
  const [pantoneNote, setPantoneNote] = useState('');
  const [customText, setCustomText] = useState('');
  const [expresne, setExpresne] = useState(false);
  const [pocetKs, setPocetKs] = useState(1);
  const [cena, setCena] = useState(null);
  const [cenaNacitava, setCenaNacitava] = useState(false);
  const [cenaChyba, setCenaChyba] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [techPanel, setTechPanel] = useState('');

  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const katalogRef = useRef(null);
  const logicalSizeRef = useRef(DEFAULT_VIEWBOX); // aktualna velkost platna v cm (logicke suradnice, nezavisle od zoomu)
  const previewBoxRef = useRef(null);
  const [previewBoxSize, setPreviewBoxSize] = useState({ w: 320, h: 420 });
  const [userZoom, setUserZoom] = useState(1); // dodatocne priblizenie nad ramec auto-fit, ovlada zakaznik (+/-)
  const [canvasVersion, setCanvasVersion] = useState(0); // pretiahne novy render do GrafikaTab, ked sa fabric platno prvykrat vytvori

  useEffect(() => { katalogRef.current = katalog; }, [katalog]);

  // Nahladovy box sa prisposobi realnej sirke/vyske svojho kontajnera (rovnaky vzor ako Zastava/
  // beachflag ma navyse zoom vrstvu - viz efekt nizsie - lebo cut/bleed/safe cesty su ulozene v
  // pevnych cm suradniciach z viewboxu, plátno sa preto nesmie len "natiahnut" na velkost boxu).
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewBoxSize({ w: Math.max(180, el.clientWidth - 16), h: Math.max(240, el.clientHeight - 16) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

  useEffect(() => {
    let zrusene = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await nacitajVlajkaKatalog(supabase);
        if (zrusene) return;
        setKatalog(data);
        setTvarKod(data.tvary[0]?.kod || '');
        setVelkostKod(data.velkosti[0]?.kod || '');
        setMaterialKod(data.materialy[0]?.kod || '');
        setDokoncenieKod(data.dokoncenie[0]?.kod || '');
        setStoziarKod(data.stoziare[0]?.kod || '');
        // Podstavec je volitelny (zakaznik moze mat vlastny, alebo montuje na stenu) — bez
        // predvyberu, na rozdiel od stoziara/materialu, ktore su vzdy potrebne.
      } catch (e) {
        setLoadError(e.message || 'Katalóg sa nepodarilo načítať.');
      }
      setIsLoading(false);
    })();
    return () => { zrusene = true; };
  }, [supabase]);

  // Inicializácia Fabric plátna, keď je <canvas> reálne v DOM
  useEffect(() => {
    if (isLoading || !canvasElRef.current || fabricRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, { backgroundColor: bgColor });
    fabricRef.current = canvas;
    setCanvasVersion(v => v + 1); // GrafikaTab (vrstvy/inspektor) caka, kym instancia existuje
    return () => { canvas.dispose(); fabricRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Prekreslí orezovú (červená) a bezpečnú (zelená) masku podľa aktuálneho tvaru + veľkosti a
  // priblizi platno na maximum dostupneho miesta v nahladovom boxe (predtym malo platno pevnu
  // velkost = cislo z viewboxu v cm, takze S vlajka bola na obrazovke drobna a XL velka - zle sa
  // na malej kreslila grafika). Logicke suradnice objektov (text/logo/masky) ostavaju v cm z
  // viewboxu nezmenene — mení sa len fabric "zoom" (viewportTransform), takze existujuce
  // pozicie/cesty netreba prepocitavat.
  useEffect(() => {
    const canvas = fabricRef.current;
    const k = katalogRef.current;
    if (!canvas || !k || !tvarKod || !velkostKod) return;
    const tvar = k.tvary.find(t => t.kod === tvarKod);
    const rozmer = tvar?.rozmery?.[velkostKod];
    if (!rozmer) return;
    const { w, h } = parseViewbox(rozmer.viewbox);
    logicalSizeRef.current = { w, h };
    const autoFit = Math.min(previewBoxSize.w / w, previewBoxSize.h / h);
    const zoom = autoFit * userZoom;
    canvas.setZoom(zoom);
    canvas.setDimensions({ width: w * zoom, height: h * zoom });

    canvas.getObjects().filter(o => o.isMaskOverlay).forEach(o => canvas.remove(o));
    // Hrubka ciar je v RIADKOVYCH (cm) jednotkach, nie fyzickych px — pri velkom priblizeni
    // (velky zoom) sa 2cm cesta zobrazovala neprimerane hrubo, znizene na cca 2-4mm.
    if (rozmer.bleed_path) {
      const bleedPath = new fabric.Path(rozmer.bleed_path, { stroke: '#f59e0b', strokeWidth: 0.4, fill: 'transparent', strokeDashArray: [1.2, 0.8], selectable: false, evented: false, isMaskOverlay: true });
      canvas.add(bleedPath);
    }
    const cutPath = new fabric.Path(rozmer.cut_path, { stroke: '#ef4444', strokeWidth: 0.4, fill: 'transparent', strokeDashArray: [1.2, 0.8], selectable: false, evented: false, isMaskOverlay: true });
    const safePath = new fabric.Path(rozmer.safe_path, { stroke: '#10b981', strokeWidth: 0.3, fill: 'transparent', strokeDashArray: [0.6, 0.6], selectable: false, evented: false, isMaskOverlay: true });
    canvas.add(cutPath);
    canvas.add(safePath);
    canvas.renderAll();
  }, [tvarKod, velkostKod, katalog, previewBoxSize, userZoom, canvasVersion]);

  useEffect(() => {
    fabricRef.current?.setBackgroundColor(bgColor, () => fabricRef.current?.renderAll());
  }, [bgColor]);

  // Ziva cena — debounced volanie Edge Function pri kazdej zmene konfiguracie (rovnaky vzor ako
  // Zastava). Naklad materialu (naklad_m2 x spotreba_m2) sa nikdy nepocita na klientovi.
  useEffect(() => {
    if (!katalog || !tvarKod || !velkostKod || !materialKod) return;
    const doplnky = Object.entries(doplnkyMnozstva).map(([kod, mnozstvo]) => ({ kod, mnozstvo }));
    setCenaNacitava(true);
    setCenaChyba('');
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('beachflag-price-preview', {
        body: { tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnky, pocetKs, expresne },
      });
      setCenaNacitava(false);
      if (error) { setCenaChyba(error.message); return; }
      if (data?.error) { setCenaChyba(data.error); return; }
      setCena(data.cena);
    }, 400);
    return () => clearTimeout(t);
  }, [supabase, katalog, tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnkyMnozstva, pocetKs, expresne]);

  // snapAngle/snapThreshold = vstavana fabric funkcia, otacanie tahanim za rohovy uchyt "zaskoci"
  // na najblizsi nasobok 45° (v okruhu 5°) — presne ako pytal Martin, bez vlastnej implementacie.
  const OBJEKT_ZAKLAD = { cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false, snapAngle: 45, snapThreshold: 5 };

  const pridajText = () => {
    const canvas = fabricRef.current;
    if (!canvas || !customText.trim()) return;
    const { w, h } = logicalSizeRef.current;
    const fontSize = Math.max(4, h * 0.05); // cm — cca 5% vysky vlajky, citatelne z dialky
    const text = new fabric.Text(customText.trim(), {
      left: w * 0.15, top: h * 0.1, fontFamily: 'Arial', fill: '#000000', fontSize,
      stroke: '#ffffff', strokeWidth: 0, // obrys pripraveny, ale neviditelny kym ho zakaznik nezapne v inspektore
      ...OBJEKT_ZAKLAD,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    setCustomText('');
  };

  const uploadObrazok = (file) => {
    const canvas = fabricRef.current;
    if (!canvas || !file) return;
    const { w, h } = logicalSizeRef.current;
    const reader = new FileReader();
    reader.onload = (e) => {
      fabric.Image.fromURL(e.target.result, (img) => {
        img.scaleToWidth(Math.min(w * 0.5, w - 10));
        img.set({ left: w * 0.25, top: h * 0.08, ...OBJEKT_ZAKLAD });
        canvas.add(img);
        canvas.setActiveObject(img);
      });
    };
    reader.readAsDataURL(file);
  };

  const zmenMnozstvoDoplnku = (kod, delta, max = 10) => {
    setDoplnkyMnozstva(m => {
      const next = Math.max(0, Math.min(max, (m[kod] || 0) + delta));
      const copy = { ...m };
      if (next === 0) delete copy[kod]; else copy[kod] = next;
      return copy;
    });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!katalog || katalog.tvary.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm px-4 text-center">Katalóg beachvlajok je zatiaľ prázdny — doplň tvary a veľkosti v admin paneli.</div>;
  if (katalog.materialy.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm px-4 text-center">Zatiaľ nie je nastavený žiadny materiál — doplň ho v admin paneli (PrintStudio Pro → Beachvlajky → Materiály).</div>;

  const doplnkyVybrane = Object.entries(doplnkyMnozstva).map(([kod, mnozstvo]) => {
    const d = katalog.doplnky.find(x => x.kod === kod);
    return d ? { kod, nazov: d.nazov, cena: d.cena, mnozstvo } : null;
  }).filter(Boolean);

  const objednat = async () => {
    const canvas = fabricRef.current;
    if (!canvas || !cena) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const designId = 'vlajka_' + Date.now();
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 0.92 });
      const blob = await fetch(dataUrl).then(r => r.blob());
      const cesta = `${designId}/vlajka.png`;
      await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(cesta);

      const payload = {
        designId,
        tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod,
        doplnky: doplnkyVybrane,
        farbaHex: bgColor,
        farbaPoznamka: pantoneNote,
        textNaVlajke: customText,
        expresne, pocetKs,
        nahladUrl: publicUrlData?.publicUrl || null,
      };

      const { data, error } = await supabase.functions.invoke('beachflag-create-draft-order', { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTechPanel(JSON.stringify({ payload, response: data }, null, 2));
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Server nevrátil odkaz na platbu.');
      }
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať (' + e.message + '). Mimo živého Shopify obchodu je to očakávané — over si payload v technickom paneli.');
    }
    setIsSubmitting(false);
  };

  return (
    <>
    <PbtHeader title="PrintStudio Pro" subtitle="Konfigurátor plážovej vlajky" />
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-200 bg-slate-50 text-slate-600 font-medium text-xs sm:text-sm">
          {[{ id: 'parametre', label: 'Parametre' }, { id: 'grafika', label: 'Grafika & AI' }, { id: 'doplnky', label: 'Doplnky & Súhrn' }].map((t, i) => (
            <button key={t.id} onClick={() => setKrok(t.id)} className={`flex-1 py-3 px-3 text-center flex items-center justify-center gap-2 ${krok === t.id ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'hover:bg-slate-100'}`}>
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">{i + 1}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {krok === 'parametre' && (
          <ParametreTab katalog={katalog} tvarKod={tvarKod} velkostKod={velkostKod} materialKod={materialKod} dokoncenieKod={dokoncenieKod} stoziarKod={stoziarKod} podstavecKod={podstavecKod}
            onTvar={setTvarKod} onVelkost={setVelkostKod} onMaterial={setMaterialKod} onDokoncenie={setDokoncenieKod} onStoziar={setStoziarKod} onPodstavec={setPodstavecKod}
            onDalej={() => setKrok('grafika')} />
        )}
        {krok === 'grafika' && (
          <GrafikaTab katalog={katalog} bgColor={bgColor} onBgColor={setBgColor} pantoneNote={pantoneNote} onPantoneNote={setPantoneNote}
            customText={customText} onCustomTextChange={setCustomText} onPridajText={pridajText}
            onUploadObrazok={uploadObrazok}
            canvas={fabricRef.current} canvasVersion={canvasVersion}
            onSpat={() => setKrok('parametre')} onDalej={() => setKrok('doplnky')} />
        )}
        {krok === 'doplnky' && (
          <DoplnkyTab katalog={katalog} doplnkyMnozstva={doplnkyMnozstva} onZmenMnozstvo={zmenMnozstvoDoplnku}
            expresne={expresne} onExpresne={setExpresne} pocetKs={pocetKs} onPocetKs={setPocetKs}
            cena={cena} cenaNacitava={cenaNacitava} cenaChyba={cenaChyba} isSubmitting={isSubmitting} submitError={submitError} onObjednat={objednat}
            onSpat={() => setKrok('grafika')} />
        )}
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-600" /> Živý náhľad vlajky</h3>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono flex items-center gap-1"><Flag className="w-3 h-3" /> {tvarKod} · {velkostKod}</span>
          </div>
          <div ref={previewBoxRef} className="relative bg-slate-100 rounded-xl border border-slate-300 p-2 flex items-center justify-center min-h-[380px] sm:min-h-[440px] overflow-auto" onContextMenu={(e) => e.preventDefault()}>
            <canvas ref={canvasElRef} className="shadow-md rounded" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <button type="button" onClick={() => setUserZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">−</button>
            <span className="text-[11px] text-slate-500 font-mono w-12 text-center">{Math.round(userZoom * 100)}%</span>
            <button type="button" onClick={() => setUserZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">+</button>
            {userZoom !== 1 && <button type="button" onClick={() => setUserZoom(1)} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold ml-1">Resetovať</button>}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Červená čiara je orez, zelená je bezpečná zóna.</p>
          {techPanel && (
            <details className="mt-3">
              <summary className="text-[11px] text-slate-400 cursor-pointer">Technický detail</summary>
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-2 rounded-lg overflow-auto max-h-48 mt-1">{techPanel}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
