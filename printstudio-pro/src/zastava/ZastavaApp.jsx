import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Flag, Eye } from 'lucide-react';
import { nacitajZastavaKatalog } from './zastavaData';
import { getSessionId } from '../supabaseClient';
import RozmeryTab from './RozmeryTab';
import GrafikaTab from '../beachflag/GrafikaTab';
import StatnaVlajkaPicker from './StatnaVlajkaPicker';
import DoplnkyTab from './DoplnkyTab';

const BUCKET = 'print-designs';
const PREVIEW_MAX_PX_DEFAULT = 480;

const SABLONY = {
  stoziar: { tunely: [{ side: 'top' }], ocka: [], karabinky: [{ side: 'left', count: 4 }], popruhy: { left: true } },
  ulicna: { tunely: [{ side: 'top' }, { side: 'bottom' }], ocka: [], karabinky: [], popruhy: {} },
  plot: { tunely: [], ocka: [{ side: 'all', count: 12 }], karabinky: [], popruhy: {} },
  karabiny: { tunely: [], ocka: [], karabinky: [{ side: 'left', count: 6 }], popruhy: { left: true } },
};

export default function ZastavaApp({ supabase }) {
  const [katalog, setKatalog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [krok, setKrok] = useState('rozmery'); // rozmery | grafika | doplnky
  const [materialKod, setMaterialKod] = useState('');
  const [sirkaCm, setSirkaCm] = useState(150);
  const [vyskaCm, setVyskaCm] = useState(100);
  const [vyhotovenie, setVyhotovenie] = useState('obsite');

  const [bgColor, setBgColor] = useState('#ffffff');
  const [pantoneNote, setPantoneNote] = useState('');
  const [customText, setCustomText] = useState('');
  const [statnaVlajka, setStatnaVlajka] = useState(null); // { nazov, url }

  const [tunely, setTunely] = useState([]);
  const [ocka, setOcka] = useState([]);
  const [karabinky, setKarabinky] = useState([]);
  const [popruhy, setPopruhy] = useState({});
  const [expresne, setExpresne] = useState(false);
  const [pocetKs, setPocetKs] = useState(1);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [cena, setCena] = useState(null);
  const [cenaChyba, setCenaChyba] = useState('');
  const [cenaNacitava, setCenaNacitava] = useState(false);

  const [canvasReady, setCanvasReady] = useState(false);
  const [debugObjCount, setDebugObjCount] = useState(0);
  const [previewMaxPx, setPreviewMaxPx] = useState(PREVIEW_MAX_PX_DEFAULT);
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const stateFlagImgRef = useRef(null);
  const previewBoxRef = useRef(null);

  // Nahlad sa prisposobi realnej sirke svojho kontajnera (napr. na uzsej mobilnej obrazovke) —
  // predtym bola pevna sirka 480px, ktora na uzsom okne pretiekla mimo viditelnu oblast a odrezala
  // pravu stranu platna (aj s hardverom, co bol tam nakresleny).
  useEffect(() => {
    // Kym je isLoading, previewBoxRef este nie je namontovany v DOM (zobrazuje sa len "Načítavam…") —
    // efekt s prazdnym [] by preto zbehol predtym, nez ref vobec existuje, a ResizeObserver by sa
    // nikdy nenapojil. Zavisi aj na isLoading, aby sa spravne napojil hned po realnom namontovani.
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewMaxPx(Math.max(180, Math.min(PREVIEW_MAX_PX_DEFAULT, el.clientWidth - 16)));
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
        const data = await nacitajZastavaKatalog(supabase);
        if (zrusene) return;
        setKatalog(data);
        setMaterialKod(data.materialy[0]?.kod || '');
      } catch (e) {
        setLoadError(e.message || 'Katalóg sa nepodarilo načítať.');
      }
      setIsLoading(false);
    })();
    return () => { zrusene = true; };
  }, [supabase]);

  // Fabric plátno — vytvorí sa RAZ, hneď so správnym rozmerom napečeným priamo do konštruktora
  // (nie dodatočným setDimensions() po vytvorení — to sa v niektorých prehliadačoch/pri vyššom
  // devicePixelRatio nespoľahlivo prekresľuje a plátno ostane vizuálne "zamrznuté").
  useEffect(() => {
    if (isLoading || !canvasElRef.current || fabricRef.current) return;
    const ratio = sirkaCm / vyskaCm;
    const w = ratio >= 1 ? previewMaxPx : previewMaxPx * ratio;
    const h = ratio >= 1 ? previewMaxPx / ratio : previewMaxPx;
    const canvas = new fabric.Canvas(canvasElRef.current, { backgroundColor: bgColor, width: w, height: h });
    fabricRef.current = canvas;
    setCanvasReady(true);
    return () => { canvas.dispose(); fabricRef.current = null; setCanvasReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Zmena rozmerov PO vytvorení plátna (užívateľ upraví cm v kroku 1) — tu setDimensions()
  // nevyhnutne treba, iniciálny rozmer už rieši konštruktor vyššie.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;
    const ratio = sirkaCm / vyskaCm;
    const w = ratio >= 1 ? previewMaxPx : previewMaxPx * ratio;
    const h = ratio >= 1 ? previewMaxPx / ratio : previewMaxPx;
    if (canvas.getWidth() !== w || canvas.getHeight() !== h) {
      canvas.setDimensions({ width: w, height: h });
    }

    canvas.getObjects().filter(o => o.isSafeGuide).forEach(o => canvas.remove(o));
    const inset = Math.min(w, h) * 0.05;
    const guide = new fabric.Rect({
      left: inset, top: inset, width: w - inset * 2, height: h - inset * 2,
      fill: 'transparent', stroke: '#10b981', strokeWidth: 1.5, strokeDashArray: [4, 4],
      selectable: false, evented: false, isSafeGuide: true,
    });
    canvas.add(guide);

    // Statna vlajka (ak je vybrata) sa musi znova roztiahnut na novy rozmer platna — inak by
    // ostala v starej mierke z chvile, kedy bola vybrata.
    canvas.getObjects().filter(o => o.isStateFlag).forEach((o) => {
      o.set({ left: 0, top: 0, scaleX: w / o.width, scaleY: h / o.height });
      o.setCoords();
    });

    canvas.requestRenderAll();
  }, [sirkaCm, vyskaCm, canvasReady, previewMaxPx]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    canvas.requestRenderAll();
  }, [bgColor, canvasReady]);

  // Vykreslenie modularneho hardveru (tunely/ocka/karabinky/popruh) na zivy nahlad —
  // vizualna reprezentacia, presne poradie vrstiev/velkosti su len ilustracne.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().filter(o => o.isHardwareOverlay).forEach(o => canvas.remove(o));

    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const pridaj = (obj) => { obj.set({ selectable: false, evented: false, isHardwareOverlay: true }); canvas.add(obj); };

    // Spevnujuci popruh — sytý farebný pás pri okraji (dost hrubý a nepriehľadný, aby bol
    // jasne viditelny aj na malom nahlade)
    const strapColor = '#d97706';
    const strapT = Math.max(14, Math.min(w, h) * 0.045);
    if (popruhy.left) pridaj(new fabric.Rect({ left: 0, top: 0, width: strapT, height: h, fill: strapColor, opacity: 0.9 }));
    if (popruhy.top) pridaj(new fabric.Rect({ left: 0, top: 0, width: w, height: strapT, fill: strapColor, opacity: 0.9 }));
    if (popruhy.right) pridaj(new fabric.Rect({ left: w - strapT, top: 0, width: strapT, height: h, fill: strapColor, opacity: 0.9 }));
    if (popruhy.bottom) pridaj(new fabric.Rect({ left: 0, top: h - strapT, width: w, height: strapT, fill: strapColor, opacity: 0.9 }));

    // Tunely — sirsi, sytejsi pas so stehovanym okrajom
    const tunnelT = Math.max(28, Math.min(w, h) * 0.12);
    tunely.forEach((t) => {
      const p = t.side === 'top' ? { left: 0, top: 0, width: w, height: tunnelT }
        : t.side === 'bottom' ? { left: 0, top: h - tunnelT, width: w, height: tunnelT }
        : t.side === 'left' ? { left: 0, top: 0, width: tunnelT, height: h }
        : { left: w - tunnelT, top: 0, width: tunnelT, height: h };
      pridaj(new fabric.Rect({ ...p, fill: '#94a3b8', opacity: 0.85, stroke: '#334155', strokeWidth: 3, strokeDashArray: [10, 6] }));
    });

    // Kovove priechodky (ocka) — vacsie kruhy pozdlz strany/strán
    const ockoR = Math.max(8, Math.min(w, h) * 0.016);
    const kruh = (x, y) => pridaj(new fabric.Circle({ left: x - ockoR, top: y - ockoR, radius: ockoR, fill: '#334155', stroke: '#e2e8f0', strokeWidth: 3 }));
    ocka.forEach((g) => {
      const cnt = Math.max(1, g.count || 1);
      const okraj = ockoR + 10;
      const strany = g.side === 'all' ? ['top', 'bottom', 'left', 'right'] : g.side === 'corners' ? ['corners'] : [g.side];
      strany.forEach((s) => {
        if (s === 'left') for (let i = 0; i < cnt; i++) kruh(okraj, (h / (cnt + 1)) * (i + 1));
        if (s === 'right') for (let i = 0; i < cnt; i++) kruh(w - okraj, (h / (cnt + 1)) * (i + 1));
        if (s === 'top') for (let i = 0; i < cnt; i++) kruh((w / (cnt + 1)) * (i + 1), okraj);
        if (s === 'bottom') for (let i = 0; i < cnt; i++) kruh((w / (cnt + 1)) * (i + 1), h - okraj);
        if (s === 'corners') { kruh(okraj, okraj); kruh(w - okraj, okraj); kruh(okraj, h - okraj); kruh(w - okraj, h - okraj); }
      });
    });

    // Kovove karabinky — vacsie obdlzniky pozdlz strany/strán
    const karW = Math.max(18, Math.min(w, h) * 0.035);
    const karH = Math.max(14, Math.min(w, h) * 0.028);
    const karabina = (x, y, horiz) => pridaj(new fabric.Rect({
      ...(horiz ? { left: x - karW / 2, top: y - karH / 2, width: karW, height: karH } : { left: x - karH / 2, top: y - karW / 2, width: karH, height: karW }),
      fill: '#dc2626', stroke: '#7f1d1d', strokeWidth: 2, rx: 3, ry: 3,
    }));
    karabinky.forEach((c) => {
      const cnt = Math.max(1, c.count || 1);
      const okraj = karW / 2 + 8;
      const strany = c.side === 'all' ? ['left', 'right', 'top', 'bottom'] : [c.side];
      strany.forEach((s) => {
        if (s === 'left') for (let i = 0; i < cnt; i++) karabina(okraj, (h / (cnt + 1)) * (i + 1), false);
        if (s === 'right') for (let i = 0; i < cnt; i++) karabina(w - okraj, (h / (cnt + 1)) * (i + 1), false);
        if (s === 'top') for (let i = 0; i < cnt; i++) karabina((w / (cnt + 1)) * (i + 1), okraj, true);
        if (s === 'bottom') for (let i = 0; i < cnt; i++) karabina((w / (cnt + 1)) * (i + 1), h - okraj, true);
      });
    });

    canvas.getObjects().filter(o => o.isSafeGuide).forEach(o => canvas.bringToFront(o));
    canvas.requestRenderAll();
    setDebugObjCount(canvas.getObjects().length);
  }, [tunely, ocka, karabinky, popruhy, sirkaCm, vyskaCm, canvasReady]);

  const pridajText = () => {
    const canvas = fabricRef.current;
    if (!canvas || !customText.trim()) return;
    const text = new fabric.Text(customText.trim(), { left: 40, top: 60, fontFamily: 'Arial', fill: '#000000', fontSize: 24, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
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
        img.set({ left: 40, top: 60, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
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
          canvas.getObjects().filter(o => o.isSafeGuide).forEach(o => canvas.bringToFront(o));
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

  const vyberStatnuVlajku = async (nazov, url) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Explicitne pockat na UPLNE dekodovanie obrazka (image.decode()), nie len na 'load' event —
    // niektore prehliadace (typicky Safari pri velkych obrazkoch) vedia zacat maluvat obrazok este
    // pred dokoncenim dekodovania, co sposobi orezany/nedokresleny obrazok pri prvom vykresleni.
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = url;
    try {
      await imgEl.decode();
    } catch {
      // ak decode() zlyha (napr. stary prehliadac bez podpory), skusime pokracovat aj tak cez 'load'
      await new Promise((resolve, reject) => { imgEl.onload = resolve; imgEl.onerror = reject; });
    }
    if (fabricRef.current !== canvas) return; // medzitym doslo k unmountu/zmene platna

    canvas.getObjects().filter(o => o.isStateFlag).forEach(o => canvas.remove(o));
    const fimg = new fabric.Image(imgEl);
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    fimg.set({
      left: 0, top: 0,
      scaleX: w / fimg.width, scaleY: h / fimg.height,
      selectable: false, evented: false, isStateFlag: true,
    });
    canvas.add(fimg);
    canvas.sendToBack(fimg);
    canvas.getObjects().filter(o => o.isSafeGuide).forEach(o => canvas.bringToFront(o));
    canvas.requestRenderAll();

    stateFlagImgRef.current = url;
    setStatnaVlajka({ nazov, url });
  };
  const odstranitStatnuVlajku = () => {
    const canvas = fabricRef.current;
    canvas?.getObjects().filter(o => o.isStateFlag).forEach(o => canvas.remove(o));
    canvas?.renderAll();
    setStatnaVlajka(null);
  };

  const aplikujSablonu = (id) => {
    const s = SABLONY[id];
    if (!s) return;
    setTunely(s.tunely);
    setOcka(s.ocka);
    setKarabinky(s.karabinky);
    setPopruhy(s.popruhy);
    setKrok('doplnky');
  };

  // Ziva cena — debounced volanie Edge Function pri kazdej zmene konfiguracie.
  useEffect(() => {
    if (!materialKod || !sirkaCm || !vyskaCm) return;
    setCenaNacitava(true);
    setCenaChyba('');
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('zastava-price-preview', {
        body: { materialKod, sirkaCm, vyskaCm, vyhotovenie, tunely, ocka, karabinky, popruhy, pocetKs, expresne },
      });
      setCenaNacitava(false);
      if (error) { setCenaChyba(error.message); return; }
      if (data?.error) { setCenaChyba(data.error); return; }
      setCena(data.cena);
    }, 400);
    return () => clearTimeout(t);
  }, [supabase, materialKod, sirkaCm, vyskaCm, vyhotovenie, tunely, ocka, karabinky, popruhy, pocetKs, expresne]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Načítavam…</div>;
  if (loadError) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-rose-600 text-sm px-4 text-center">{loadError}</div>;
  if (!katalog || katalog.materialy.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm px-4 text-center">Katalóg zástav je zatiaľ prázdny — doplň materiály v admin paneli (PrintStudio Pro → Vlajky).</div>;

  const objednat = async () => {
    const canvas = fabricRef.current;
    if (!canvas || !cena) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const designId = 'zastava_' + Date.now();
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 0.92 });
      const blob = await fetch(dataUrl).then(r => r.blob());
      const cesta = `${designId}/zastava.png`;
      await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(cesta);

      const payload = {
        designId, materialKod, sirkaCm, vyskaCm, vyhotovenie,
        tunely, ocka, karabinky, popruhy,
        statnaVlajka: statnaVlajka?.nazov || null,
        farbaHex: bgColor, farbaPoznamka: pantoneNote, textNaVlajke: customText,
        expresne, pocetKs,
        nahladUrl: publicUrlData?.publicUrl || null,
      };

      const { data, error } = await supabase.functions.invoke('zastava-create-draft-order', { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Server nevrátil odkaz na platbu.');
      }
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať (' + e.message + '). Mimo živého Shopify obchodu je to očakávané.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-200 bg-slate-50 text-slate-600 font-medium text-xs sm:text-sm">
          {[{ id: 'rozmery', label: 'Rozmery a materiál' }, { id: 'grafika', label: 'Grafika & AI' }, { id: 'doplnky', label: 'Doplnky & Súhrn' }].map((t, i) => (
            <button key={t.id} onClick={() => setKrok(t.id)} className={`flex-1 py-3 px-3 text-center flex items-center justify-center gap-2 ${krok === t.id ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'hover:bg-slate-100'}`}>
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">{i + 1}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {krok === 'rozmery' && (
          <RozmeryTab
            materialy={katalog.materialy} materialKod={materialKod} onMaterial={setMaterialKod}
            sirkaCm={sirkaCm} vyskaCm={vyskaCm} onRozmery={(w, h) => { setSirkaCm(w); setVyskaCm(h); }}
            vyhotovenie={vyhotovenie} onVyhotovenie={setVyhotovenie}
            onSablona={aplikujSablonu}
            onDalej={() => setKrok('grafika')}
          />
        )}
        {krok === 'grafika' && (
          <div>
            <div className="p-4 sm:p-6 pb-0">
              <StatnaVlajkaPicker vybranyNazov={statnaVlajka?.nazov} onVyber={vyberStatnuVlajku} onOdstranit={odstranitStatnuVlajku} />
            </div>
            <GrafikaTab
              katalog={katalog} bgColor={bgColor} onBgColor={setBgColor} pantoneNote={pantoneNote} onPantoneNote={setPantoneNote}
              customText={customText} onCustomTextChange={setCustomText} onPridajText={pridajText}
              onUploadObrazok={uploadObrazok} onAiGenerate={aiGenerate} aiGenerating={aiGenerating} aiError={aiError}
              onSpat={() => setKrok('rozmery')} onDalej={() => setKrok('doplnky')}
            />
          </div>
        )}
        {krok === 'doplnky' && (
          <DoplnkyTab
            tunely={tunely} onTunely={setTunely} ocka={ocka} onOcka={setOcka}
            karabinky={karabinky} onKarabinky={setKarabinky} popruhy={popruhy} onPopruhy={setPopruhy}
            expresne={expresne} onExpresne={setExpresne} expresnyPriplatokPercent={cena?.expresnyPercent}
            pocetKs={pocetKs} onPocetKs={setPocetKs}
            cena={cena} cenaChyba={cenaChyba} cenaNacitava={cenaNacitava}
            isSubmitting={isSubmitting} submitError={submitError} onObjednat={objednat}
            onSpat={() => setKrok('grafika')}
          />
        )}
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-600" /> Živý náhľad zástavy</h3>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono flex items-center gap-1"><Flag className="w-3 h-3" /> {sirkaCm}×{vyskaCm} cm</span>
          </div>
          <div ref={previewBoxRef} className="relative bg-slate-100 rounded-xl border border-slate-300 p-2 flex items-center justify-center min-h-[380px] sm:min-h-[440px] overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
            <canvas ref={canvasElRef} className="shadow-md rounded" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Zelená čiara je odporúčaná bezpečná zóna pre text/logo.</p>
          <p className="mt-1 text-[10px] text-slate-300 font-mono">build v5 — canvasReady:{String(canvasReady)}, objektov na plátne:{debugObjCount}, {tunely.length} tunel(y), {ocka.length} skup. očiek, {karabinky.length} skup. karabín, popruh: {Object.entries(popruhy).filter(([, v]) => v).map(([k]) => k).join(',') || '—'}</p>
        </div>
      </div>
    </div>
  );
}
