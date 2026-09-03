import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Flag, Eye } from 'lucide-react';
import { nacitajVlajkaKatalog } from './vlajkaData';
import { vypocitajCenuVlajky } from './vlajkaCenotvorba';
import { getSessionId } from '../supabaseClient';
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
  const [dokoncenieKod, setDokoncenieKod] = useState('');
  const [stoziarKod, setStoziarKod] = useState('');
  const [doplnkyMnozstva, setDoplnkyMnozstva] = useState({});
  const [bgColor, setBgColor] = useState('#ffffff');
  const [pantoneNote, setPantoneNote] = useState('');
  const [customText, setCustomText] = useState('');
  const [expresne, setExpresne] = useState(false);
  const [pocetKs, setPocetKs] = useState(1);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [techPanel, setTechPanel] = useState('');

  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const katalogRef = useRef(null);

  useEffect(() => { katalogRef.current = katalog; }, [katalog]);

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
        setDokoncenieKod(data.dokoncenie[0]?.kod || '');
        setStoziarKod(data.stoziare[0]?.kod || '');
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
    return () => { canvas.dispose(); fabricRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Prekreslí orezovú (červená) a bezpečnú (zelená) masku podľa aktuálneho tvaru + veľkosti
  useEffect(() => {
    const canvas = fabricRef.current;
    const k = katalogRef.current;
    if (!canvas || !k || !tvarKod || !velkostKod) return;
    const tvar = k.tvary.find(t => t.kod === tvarKod);
    const rozmer = tvar?.rozmery?.[velkostKod];
    if (!rozmer) return;
    const { w, h } = parseViewbox(rozmer.viewbox);
    canvas.setDimensions({ width: w, height: h });

    canvas.getObjects().filter(o => o.isMaskOverlay).forEach(o => canvas.remove(o));
    const cutPath = new fabric.Path(rozmer.cut_path, { stroke: '#ef4444', strokeWidth: 2, fill: 'transparent', strokeDashArray: [6, 4], selectable: false, evented: false, isMaskOverlay: true });
    const safePath = new fabric.Path(rozmer.safe_path, { stroke: '#10b981', strokeWidth: 1.5, fill: 'transparent', strokeDashArray: [3, 3], selectable: false, evented: false, isMaskOverlay: true });
    canvas.add(cutPath);
    canvas.add(safePath);
    canvas.renderAll();
  }, [tvarKod, velkostKod, katalog]);

  useEffect(() => {
    fabricRef.current?.setBackgroundColor(bgColor, () => fabricRef.current?.renderAll());
  }, [bgColor]);

  const pridajText = () => {
    const canvas = fabricRef.current;
    if (!canvas || !customText.trim()) return;
    const text = new fabric.Text(customText.trim(), { left: 40, top: 100, fontFamily: 'Arial', fill: '#000000', fontSize: 24, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
    canvas.add(text);
    canvas.setActiveObject(text);
    setCustomText('');
  };

  const uploadObrazok = (file) => {
    const canvas = fabricRef.current;
    if (!canvas || !file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      fabric.Image.fromURL(e.target.result, (img) => {
        img.scaleToWidth(Math.min(120, canvas.getWidth() * 0.5));
        img.set({ left: 40, top: 80, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
        canvas.add(img);
        canvas.setActiveObject(img);
      });
    };
    reader.readAsDataURL(file);
  };

  const aiGenerate = async (prompt) => {
    if (!prompt.trim() || !supabase) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-motif', { body: { prompt: prompt.trim(), sessionId: getSessionId() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await new Promise((resolve, reject) => {
        fabric.Image.fromURL(data.previewUrl, (img) => {
          if (!img) { reject(new Error('Motív sa nepodarilo načítať.')); return; }
          const canvas = fabricRef.current;
          img.scaleToWidth(canvas.getWidth());
          img.set({ left: 0, top: 0, selectable: true, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
          canvas.add(img);
          canvas.sendToBack(img);
          canvas.getObjects().filter(o => o.isMaskOverlay).forEach(o => canvas.bringToFront(o));
          canvas.renderAll();
          resolve();
        });
      });
    } catch (e) {
      setAiError(e.message || 'AI generovanie zlyhalo.');
    } finally {
      setAiGenerating(false);
    }
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

  const velkost = katalog.velkosti.find(v => v.kod === velkostKod);
  const dokoncenie = katalog.dokoncenie.find(d => d.kod === dokoncenieKod);
  const stoziar = katalog.stoziare.find(s => s.kod === stoziarKod);
  const doplnkyVybrane = Object.entries(doplnkyMnozstva).map(([kod, mnozstvo]) => {
    const d = katalog.doplnky.find(x => x.kod === kod);
    return d ? { kod, nazov: d.nazov, cena: d.cena, mnozstvo } : null;
  }).filter(Boolean);

  const cena = vypocitajCenuVlajky({ velkost, dokoncenie, stoziar, doplnky: doplnkyVybrane, expresne, pocetKs, nastavenia: katalog.nastavenia });

  const objednat = async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
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
        tvarKod, velkostKod, dokoncenieKod, stoziarKod,
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
          <ParametreTab katalog={katalog} tvarKod={tvarKod} velkostKod={velkostKod} dokoncenieKod={dokoncenieKod} stoziarKod={stoziarKod}
            onTvar={setTvarKod} onVelkost={setVelkostKod} onDokoncenie={setDokoncenieKod} onStoziar={setStoziarKod}
            onDalej={() => setKrok('grafika')} />
        )}
        {krok === 'grafika' && (
          <GrafikaTab katalog={katalog} bgColor={bgColor} onBgColor={setBgColor} pantoneNote={pantoneNote} onPantoneNote={setPantoneNote}
            customText={customText} onCustomTextChange={setCustomText} onPridajText={pridajText}
            onUploadObrazok={uploadObrazok} onAiGenerate={aiGenerate} aiGenerating={aiGenerating} aiError={aiError}
            onSpat={() => setKrok('parametre')} onDalej={() => setKrok('doplnky')} />
        )}
        {krok === 'doplnky' && (
          <DoplnkyTab katalog={katalog} doplnkyMnozstva={doplnkyMnozstva} onZmenMnozstvo={zmenMnozstvoDoplnku}
            expresne={expresne} onExpresne={setExpresne} pocetKs={pocetKs} onPocetKs={setPocetKs}
            cena={cena} isSubmitting={isSubmitting} submitError={submitError} onObjednat={objednat}
            onSpat={() => setKrok('grafika')} />
        )}
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-600" /> Živý náhľad vlajky</h3>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono flex items-center gap-1"><Flag className="w-3 h-3" /> {tvarKod} · {velkostKod}</span>
          </div>
          <div className="relative bg-slate-100 rounded-xl border border-slate-300 p-2 flex items-center justify-center min-h-[380px] sm:min-h-[440px] overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
            <canvas ref={canvasElRef} className="shadow-md rounded bg-white" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Červená čiara je orez, zelená je bezpečná zóna.</p>
          {techPanel && (
            <details className="mt-3">
              <summary className="text-[11px] text-slate-400 cursor-pointer">Technický detail</summary>
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-2 rounded-lg overflow-auto max-h-48 mt-1">{techPanel}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
