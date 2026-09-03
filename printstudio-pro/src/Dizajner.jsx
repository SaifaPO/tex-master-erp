import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Trash2, Download, ShoppingBag, Type, Image as ImageIcon, Sparkles, Shirt as ShirtIcon, Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { nacitajDetailProduktu, nacitajPersonalizacieVarianty, najblizsiPersonalizacnyVariant } from './produktData';
import { nacitajCennik, vypocitajCenuPotlace } from './cenotvorba';
import { getSessionId } from './supabaseClient';

const ZONE_KEYS = ['predok', 'chrbat', 'lavy_rukav', 'pravy_rukav', 'stitok_golier'];
const NAZVY_ZON = { predok: 'Predná strana', chrbat: 'Chrbát', lavy_rukav: 'Ľavý rukáv', pravy_rukav: 'Pravý rukáv', stitok_golier: 'Štítok (golier)' };
const NAZVY_TECHNOLOGIE = { sublimacia: 'Sublimácia', dtf: 'Digitálny transfer (DTF)', sietotlac: 'Sieťotlač', rezany: 'Rezaný transfer' };
const CANVAS_PX_W = 240;
const CANVAS_PX_H = 340;
const MOCKUP_BOX_W = 380;
const MOCKUP_BOX_H = 460;
const BUCKET = 'print-designs';

// Zistí, či pre aktuálnu farbu+zónu existuje reálna fotka s kalibráciou, a vypočíta presnú
// pixelovú polohu/veľkosť plátna v rámci pevnej MOCKUP_BOX_W×MOCKUP_BOX_H schránky.
// Bez fotky sa plátno vycentruje na predvolenú veľkosť (rovnaké správanie ako predtým).
function vypocitajZonuBox(produkt, currentColorHex, zona) {
  const farba = produkt?.colors?.find(c => c.hex === currentColorHex);
  const mockup = farba ? produkt?.mockupy?.[farba.id]?.[zona] : null;
  if (mockup) {
    return {
      mockup,
      canvasLeft: Math.round(MOCKUP_BOX_W * mockup.x / 100),
      canvasTop: Math.round(MOCKUP_BOX_H * mockup.y / 100),
      canvasW: Math.max(1, Math.round(MOCKUP_BOX_W * mockup.w / 100)),
      canvasH: Math.max(1, Math.round(MOCKUP_BOX_H * mockup.h / 100)),
    };
  }
  return {
    mockup: null,
    canvasLeft: Math.round((MOCKUP_BOX_W - CANVAS_PX_W) / 2),
    canvasTop: Math.round((MOCKUP_BOX_H - CANVAS_PX_H) / 2),
    canvasW: CANVAS_PX_W,
    canvasH: CANVAS_PX_H,
  };
}

const CLIP_ART = {
  star: { path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', color: '#f59e0b' },
  heart: { path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z', color: '#ef4444' },
  flame: { path: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3c0-1 1-2 1-3z', color: '#f97316' },
  zap: { path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', color: '#eab308' },
};

// Cena sa počíta zo spoločného obalového obdĺžnika (bounding box) VŠETKÝCH prvkov v danej zóne naraz —
// nie zo súčtu plôch jednotlivých prvkov. Viac prekrývajúcich sa/blízkych prvkov tak nenafukuje cenu umelo,
// ale rozmiestnenie prvkov ďaleko od seba reálne zväčší plochu, ktorú treba vytlačiť na fólii/papieri.
function boundingBoxCm2(objects, scalePxPerCm) {
  if (!objects || objects.length === 0) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  objects.forEach(o => {
    const wPx = (o.width || 0) * (o.scaleX || 1);
    const hPx = (o.height || 0) * (o.scaleY || 1);
    const left = o.left || 0;
    const top = o.top || 0;
    const originX = o.originX || 'left';
    const originY = o.originY || 'top';
    const x0 = originX === 'center' ? left - wPx / 2 : originX === 'right' ? left - wPx : left;
    const y0 = originY === 'center' ? top - hPx / 2 : originY === 'bottom' ? top - hPx : top;
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x0 + wPx);
    maxY = Math.max(maxY, y0 + hPx);
  });
  const wCm = (maxX - minX) / scalePxPerCm;
  const hCm = (maxY - minY) / scalePxPerCm;
  return wCm * hCm;
}

function pocetPouzitychFarieb(objects) {
  const farby = new Set();
  let maObrazok = false;
  objects.forEach(o => {
    if (o.type === 'image') { maObrazok = true; return; }
    if (o.fill) farby.add(o.fill);
    if (o.stroke) farby.add(o.stroke);
  });
  if (maObrazok) farby.add('__obrazok__');
  return Math.max(1, farby.size);
}

export default function Dizajner({ supabase, produktId }) {
  const [produkt, setProdukt] = useState(null);
  const [cennik, setCennik] = useState(null);
  const [fonty, setFonty] = useState([]);
  const [grafiky, setGrafiky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [aktivnaTab, setAktivnaTab] = useState('product');
  const [currentColor, setCurrentColor] = useState('');
  const [currentSize, setCurrentSize] = useState('');
  const [currentZona, setCurrentZona] = useState('');
  const [currentTechnologia, setCurrentTechnologia] = useState('');
  const [currentFolia, setCurrentFolia] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedObj, setSelectedObj] = useState(null);
  const [liveSize, setLiveSize] = useState(null); // { w, h, presahuje }
  const [priceInfo, setPriceInfo] = useState({ cenaKus: 0, cenaPotlace: 0, total: 0 });
  const [cartConfirmation, setCartConfirmation] = useState(null);
  const [techPanelOpen, setTechPanelOpen] = useState(false);
  const [techPanelContent, setTechPanelContent] = useState('');
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiVylepsujeSa, setAiVylepsujeSa] = useState(false);
  const [aiHotovo, setAiHotovo] = useState(false);
  const [aiError, setAiError] = useState('');
  const [customText, setCustomText] = useState('');
  const [jerseyName, setJerseyName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenError, setAiGenError] = useState('');
  const [personalizacieVarianty, setPersonalizacieVarianty] = useState([]);
  const [cartError, setCartError] = useState('');

  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const zoneStateRef = useRef({}); // { zona: jsonString }
  const produktRef = useRef(null);
  const scaleRef = useRef(8);
  const lastUploadedImgRef = useRef(null); // { img, dataUrl, mimeType } posledného nahratého obrázka (pre AI úpravu)
  // Canvas udalosti (object:added, selection:created...) sa napájajú len RAZ pri vytvorení plátna,
  // takže by inak navždy volali "zamrznuté" verzie handlerov z toho jedného renderu (so starými
  // currentSize/currentZona/currentTechnologia/... v uzávere). Tento ref vždy ukazuje na najnovšiu verziu.
  const handlersRef = useRef({});

  useEffect(() => { produktRef.current = produkt; }, [produkt]);

  useEffect(() => {
    let zrusene = false;
    setIsLoading(true);
    (async () => {
      const [detail, cen, { data: fontyData }, { data: grafikyData }, personalizacie] = await Promise.all([
        nacitajDetailProduktu(supabase, produktId),
        nacitajCennik(supabase),
        supabase.from('fonty').select('*').order('id'),
        supabase.from('grafiky').select('*').order('id', { ascending: false }),
        nacitajPersonalizacieVarianty(supabase),
      ]);
      if (zrusene) return;
      setProdukt(detail);
      setCennik(cen);
      setFonty(fontyData || []);
      setGrafiky(grafikyData || []);
      setPersonalizacieVarianty(personalizacie);
      setCurrentColor(detail.colors[0]?.hex || '#ffffff');
      setCurrentSize(detail.sizes[0]?.velkost || '');
      setCurrentZona(detail.zony[0] || '');
      setCurrentTechnologia(detail.technologie[0] || detail.technologia || '');
      setCurrentFolia(cen.folie[0]?.id ?? null);
      zoneStateRef.current = {};
      setIsLoading(false);
    })();
    return () => { zrusene = true; };
  }, [produktId]);

  // Inicializácia Fabric canvasu — beží až keď je <canvas> reálne v DOM (t.j. po skončení načítania produktu)
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current);
    fabricRef.current = canvas;
    nastavMierku(currentSize, currentZona);
    canvas.on('selection:created', (e) => handlersRef.current.handleSelection(e.selected?.[0]));
    canvas.on('selection:updated', (e) => handlersRef.current.handleSelection(e.selected?.[0]));
    canvas.on('selection:cleared', () => { setSelectedObj(null); setLiveSize(null); });
    canvas.on('object:added', () => handlersRef.current.aktualizujCenu());
    canvas.on('object:removed', () => handlersRef.current.aktualizujCenu());
    canvas.on('object:modified', () => handlersRef.current.aktualizujCenu());
    canvas.on('object:scaling', (e) => handlersRef.current.zobrazZivyRozmer(e.target));
    canvas.on('object:moving', (e) => handlersRef.current.zobrazZivyRozmer(e.target));
    return () => { canvas.dispose(); fabricRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const getZoneMaxDims = (size, zona) => {
    const s = (produktRef.current?.sizes || []).find(v => v.velkost === size);
    return (s && s.zony[zona]) || { w: 30, h: 40 };
  };

  const scaleForZone = (zona) => {
    const { w, h } = getZoneMaxDims(currentSize, zona);
    const box = vypocitajZonuBox(produktRef.current, currentColor, zona);
    return Math.max(1, Math.min(box.canvasW / w, box.canvasH / h));
  };

  // Nastaví mierku (px/cm) pre danú veľkosť+zónu a podľa potreby fyzicky zmení pixelové rozmery
  // plátna, aby presne sedelo na kalibrovanú tlačovú zónu na fotke danej farby (ak existuje).
  // colorHex je voliteľný explicitný parameter — pri zmene farby by čítanie currentColor z uzáveru
  // v tom istom synchrónnom volaní videlo ešte starú hodnotu, preto ho vieme preskočiť explicitne.
  const nastavMierku = (size, zona, colorHex = currentColor) => {
    const { w, h } = getZoneMaxDims(size, zona);
    const box = vypocitajZonuBox(produktRef.current, colorHex, zona);
    if (fabricRef.current && (fabricRef.current.getWidth() !== box.canvasW || fabricRef.current.getHeight() !== box.canvasH)) {
      fabricRef.current.setDimensions({ width: box.canvasW, height: box.canvasH });
    }
    scaleRef.current = Math.max(1, Math.min(box.canvasW / w, box.canvasH / h));
  };

  const objektyVZone = (zona) => {
    const canvas = fabricRef.current;
    if (zona === currentZona) return canvas ? canvas.getObjects() : [];
    const saved = zoneStateRef.current[zona];
    if (!saved) return [];
    try { return JSON.parse(saved).objects || []; } catch (e) { return []; }
  };

  // Plocha = súčet obalových obdĺžnikov KAŽDEJ zóny zvlášť (zóny sú fyzicky oddelené plochy na odeve),
  // počet farieb sa počíta naprieč všetkými zónami naraz.
  const plochaAFarbyVsetkychZon = () => {
    const p = produktRef.current;
    if (!p) return { plocha: 0, farby: 1, vsetkyObjekty: [] };
    let plocha = 0;
    let vsetkyObjekty = [];
    (p.zony || []).forEach(z => {
      const objekty = objektyVZone(z);
      plocha += boundingBoxCm2(objekty, scaleForZone(z));
      vsetkyObjekty = vsetkyObjekty.concat(objekty);
    });
    return { plocha, farby: pocetPouzitychFarieb(vsetkyObjekty), vsetkyObjekty };
  };

  // Fabric.js objekty majú `type`, `fontFamily` a pod. na prototype, nie ako vlastnú property —
  // obyčajný { ...obj } by ich pri kopírovaní do Reactového stavu stratil, preto ich vypíšeme explicitne.
  const snapshotObj = (obj) => obj ? { type: obj.type, fill: obj.fill, fontFamily: obj.fontFamily, fontSize: obj.fontSize } : null;

  const handleSelection = (obj) => {
    setSelectedObj(snapshotObj(obj));
    zobrazZivyRozmer(obj);
  };

  const zobrazZivyRozmer = (obj) => {
    if (!obj) { setLiveSize(null); return; }
    const scale = scaleRef.current;
    const wCm = (obj.width * obj.scaleX) / scale;
    const hCm = (obj.height * obj.scaleY) / scale;
    const max = getZoneMaxDims(currentSize, currentZona);
    setLiveSize({ w: wCm, h: hCm, presahuje: wCm > max.w || hCm > max.h });
  };

  // Prepočíta cenu naprieč všetkými zónami (aktívna zóna sa berie živá z plátna, ostatné z uloženého stavu)
  const aktualizujCenu = () => {
    const p = produktRef.current;
    const canvas = fabricRef.current;
    if (!p || !canvas || !cennik) return;
    const tech = currentTechnologia || p.technologia;
    const jeTmavyTextil = !!p.colors.find(c => c.hex === currentColor)?.je_tmava;
    const { plocha, farby } = plochaAFarbyVsetkychZon();
    const cenaPotlace = vypocitajCenuPotlace(cennik, tech, plocha, farby, jeTmavyTextil, currentFolia);
    const cenaKus = Number(p.zakladna_cena) + cenaPotlace;
    setPriceInfo({ cenaKus, cenaPotlace, total: cenaKus * quantity });
  };

  // handlersRef.current musí vždy ukazovať na TÚTO (najnovšiu) verziu handlerov — pozri komentár vyššie pri handlersRef.
  useEffect(() => { handlersRef.current = { handleSelection, aktualizujCenu, zobrazZivyRozmer }; });

  useEffect(() => { aktualizujCenu(); }, [quantity, currentZona, currentSize, currentColor, currentTechnologia, currentFolia, cennik]); // eslint-disable-line react-hooks/exhaustive-deps

  const prepniZonu = (zona, onReady) => {
    const canvas = fabricRef.current;
    if (!canvas || zona === currentZona) { if (onReady) onReady(); return; }
    zoneStateRef.current[currentZona] = JSON.stringify(canvas);
    canvas.clear();
    setCurrentZona(zona);
    nastavMierku(currentSize, zona);
    const saved = zoneStateRef.current[zona];
    if (saved) {
      canvas.loadFromJSON(saved, () => { canvas.renderAll(); aktualizujCenu(); if (onReady) onReady(); });
    } else {
      aktualizujCenu();
      if (onReady) onReady();
    }
  };

  const zmenVelkost = (size) => {
    setCurrentSize(size);
    nastavMierku(size, currentZona);
    aktualizujCenu();
  };

  // Iná farba môže mať inak kalibrovanú fotku pre tú istú zónu (iný uhol fotenia a pod.) —
  // preto treba prepočítať aj mierku/rozmer plátna, nielen cenu.
  const zmenFarbu = (hex) => {
    setCurrentColor(hex);
    nastavMierku(currentSize, currentZona, hex);
    aktualizujCenu();
  };

  // Sublimácia sa fyzicky dá tlačiť len na bielu (svetlú polyesterovú) látku — pri prepnutí na ňu
  // preskoč na prvú dostupnú bielu farbu, ak práve zvolená farba nie je biela.
  const zmenTechnologiu = (t) => {
    setCurrentTechnologia(t);
    if (t === 'sublimacia') {
      const p = produktRef.current;
      const aktualna = p?.colors.find(c => c.hex === currentColor);
      if (!aktualna?.je_biela) {
        const biela = p?.colors.find(c => c.je_biela);
        if (biela) zmenFarbu(biela.hex);
      }
    }
    aktualizujCenu();
  };

  const pocetObjektovVZone = (zona) => {
    const canvas = fabricRef.current;
    if (!canvas) return 0;
    if (zona === currentZona) return canvas.getObjects().length;
    const saved = zoneStateRef.current[zona];
    if (!saved) return 0;
    try { return (JSON.parse(saved).objects || []).length; } catch (e) { return 0; }
  };

  const pridajText = () => {
    const canvas = fabricRef.current;
    if (!canvas || !customText.trim()) return;
    const text = new fabric.Text(customText.trim(), { left: 50, top: 100, fontFamily: 'Arial', fill: '#000000', fontSize: 28, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
    canvas.add(text);
    canvas.setActiveObject(text);
    setCustomText('');
  };

  const updateTextProperty = (prop, value) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj && obj.type === 'text') { obj.set(prop, value); canvas.requestRenderAll(); aktualizujCenu(); setSelectedObj(snapshotObj(obj)); }
  };
  const toggleFontWeight = () => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o && o.type === 'text') { o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold'); canvas.requestRenderAll(); }
  };
  const toggleFontStyle = () => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o && o.type === 'text') { o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic'); canvas.requestRenderAll(); }
  };
  const alignText = (align) => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o && o.type === 'text') { o.set('textAlign', align); canvas.requestRenderAll(); }
  };

  const addClipArt = (typ) => {
    const canvas = fabricRef.current;
    const def = CLIP_ART[typ];
    if (!canvas || !def) return;
    const path = new fabric.Path(def.path, { fill: def.color, left: 80, top: 90, scaleX: 3, scaleY: 3, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
    canvas.add(path);
    canvas.setActiveObject(path);
  };

  const handleImageUpload = (file) => {
    const canvas = fabricRef.current;
    if (!canvas || !file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      fabric.Image.fromURL(dataUrl, (img) => {
        img.scaleToWidth(120);
        img.set({ left: 60, top: 80, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
        canvas.add(img);
        canvas.setActiveObject(img);
        lastUploadedImgRef.current = { img, dataUrl, mimeType: file.type || 'image/png' };
      });
    };
    reader.readAsDataURL(file);
    setAiPanelOpen(true);
    setAiHotovo(false);
    setAiError('');
  };

  // AI príprava nahratého obrázka (odstránenie pozadia / zvýšenie kvality) cez Supabase Edge Function
  // "ai-prepare-image" (Nano Banana Pro). Appka vidí len zmenšený náhľad — plná kvalita ostáva na serveri.
  const vylepsiObrazokAI = async () => {
    const info = lastUploadedImgRef.current;
    if (!info || !supabase) return;
    setAiVylepsujeSa(true);
    setAiError('');
    try {
      const base64 = info.dataUrl.split(',')[1];
      const { data, error } = await supabase.functions.invoke('ai-prepare-image', {
        body: { imageBase64: base64, mimeType: info.mimeType, sessionId: getSessionId() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await new Promise((resolve, reject) => {
        fabric.Image.fromURL(data.previewUrl, (novyImg) => {
          if (!novyImg) { reject(new Error('Náhľad sa nepodarilo načítať.')); return; }
          const stary = info.img;
          novyImg.set({ left: stary.left, top: stary.top, originX: stary.originX, originY: stary.originY, angle: stary.angle, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
          novyImg.scaleToWidth(stary.getScaledWidth());
          fabricRef.current.remove(stary);
          fabricRef.current.add(novyImg);
          fabricRef.current.setActiveObject(novyImg);
          fabricRef.current.requestRenderAll();
          lastUploadedImgRef.current = { img: novyImg, dataUrl: data.previewUrl, mimeType: 'image/png' };
          aktualizujCenu();
          resolve();
        }, { crossOrigin: 'anonymous' });
      });
      setAiHotovo(true);
      setTimeout(() => { setAiPanelOpen(false); setAiHotovo(false); }, 1800);
    } catch (e) {
      setAiError(e.message || 'AI spracovanie zlyhalo.');
    } finally {
      setAiVylepsujeSa(false);
    }
  };

  // AI generátor motívov (text → obrázok) cez Supabase Edge Function "ai-generate-motif" (Nano Banana Pro).
  const generujAiMotiv = async () => {
    if (!aiPrompt.trim() || !supabase) return;
    setAiGenerating(true);
    setAiGenError('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-motif', { body: { prompt: aiPrompt.trim(), sessionId: getSessionId() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await new Promise((resolve, reject) => {
        fabric.Image.fromURL(data.previewUrl, (img) => {
          if (!img) { reject(new Error('Motív sa nepodarilo načítať.')); return; }
          img.scaleToWidth(140);
          img.set({ left: 70, top: 90, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
          fabricRef.current.add(img);
          fabricRef.current.setActiveObject(img);
          aktualizujCenu();
          resolve();
        }, { crossOrigin: 'anonymous' });
      });
      setAiPrompt('');
    } catch (e) {
      setAiGenError(e.message || 'Generovanie zlyhalo.');
    } finally {
      setAiGenerating(false);
    }
  };

  const pridajObrazokDoCanvasu = (file, left, top, sirkaPx) => new Promise((resolve) => {
    if (!file) { resolve(); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      fabric.Image.fromURL(e.target.result, (img) => {
        img.scaleToWidth(sirkaPx);
        img.set({ left, top, originX: 'center', cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false });
        fabricRef.current.add(img);
        aktualizujCenu();
        resolve();
      });
    };
    reader.readAsDataURL(file);
  });

  const aplikujDresExpres = async (ligaFile, sponzorHrudFile, sponzorCisloFile) => {
    const p = produktRef.current;
    const name = jerseyName.trim();
    const number = jerseyNumber.trim();
    if (!name && !number && !ligaFile && !sponzorHrudFile && !sponzorCisloFile) return;

    if ((name || number || sponzorCisloFile) && p.zony.includes('chrbat')) {
      prepniZonu('chrbat', async () => {
        const canvas = fabricRef.current;
        if (name) canvas.add(new fabric.Text(name.toUpperCase(), { left: 120, top: 60, originX: 'center', fontFamily: 'Impact', fontSize: 26, fill: '#ffffff', stroke: '#000000', strokeWidth: 1 }));
        if (number) canvas.add(new fabric.Text(number, { left: 120, top: 110, originX: 'center', fontFamily: 'Impact', fontSize: 80, fill: '#ffffff', stroke: '#000000', strokeWidth: 2 }));
        canvas.renderAll();
        aktualizujCenu();
        await pridajObrazokDoCanvasu(sponzorCisloFile, 120, 220, 90);
      });
    }
    if ((ligaFile || sponzorHrudFile) && p.zony.includes('predok')) {
      prepniZonu('predok', async () => {
        await pridajObrazokDoCanvasu(ligaFile, 40, 25, 30);
        await pridajObrazokDoCanvasu(sponzorHrudFile, 120, 130, 100);
      });
    }
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length) { active.forEach(o => canvas.remove(o)); canvas.discardActiveObject(); canvas.requestRenderAll(); aktualizujCenu(); }
  };
  const bringForward = () => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o) canvas.bringForward(o);
  };
  const clearCanvas = () => {
    if (!window.confirm(`Naozaj chcete vymazať potlač na tejto zóne (${NAZVY_ZON[currentZona]})?`)) return;
    fabricRef.current?.clear();
    aktualizujCenu();
  };
  const downloadDesign = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const link = document.createElement('a');
    link.download = `potlac-${produkt?.nazov || 'navrh'}-${currentZona}.png`;
    link.href = dataURL;
    link.click();
  };

  // Vyexportuje PNG danej zóny — aktívnu priamo z canvasu, ostatné z uloženého JSON cez dočasný StaticCanvas.
  const exportZonyPng = async (zona) => {
    if (zona === currentZona) return fabricRef.current.toDataURL({ format: 'png', quality: 0.92 });
    const saved = zoneStateRef.current[zona];
    if (!saved) return null;
    return new Promise((resolve) => {
      const staticCanvas = new fabric.StaticCanvas(null, { width: CANVAS_PX_W, height: CANVAS_PX_H });
      staticCanvas.loadFromJSON(saved, () => {
        const dataUrl = staticCanvas.toDataURL({ format: 'png', quality: 0.92 });
        staticCanvas.dispose();
        resolve(dataUrl);
      });
    });
  };

  const dataUrlToBlob = (dataUrl) => fetch(dataUrl).then(r => r.blob());

  const pouziteZony = () => {
    const p = produktRef.current;
    return (p?.zony || []).filter(z => pocetObjektovVZone(z) > 0);
  };

  const pridatDoKosika = async () => {
    const p = produktRef.current;
    const canvas = fabricRef.current;
    if (!p || !canvas) return;
    setCartError('');

    // Skutočné Shopify Variant ID musia byť nastavené v Master Admin (karta "Shopify prepojenie"),
    // inak by appka pridala do košíka niečo nezmyselné/prázdne.
    const farba = p.colors.find(c => c.hex === currentColor);
    const blankVariantId = farba ? p.shopifyVarianty?.[farba.id]?.[currentSize] : null;
    if (!blankVariantId) {
      setCartError(`Pre "${p.nazov}" (${farba?.nazov || currentColor} / ${currentSize}) chýba nastavené Shopify Variant ID — doplň ho v Master Admin → Shopify prepojenie.`);
      return;
    }
    const personalizacia = najblizsiPersonalizacnyVariant(personalizacieVarianty, priceInfo.cenaPotlace);
    if (!personalizacia) {
      setCartError('V Master Admin → Shopify prepojenie nie je nastavený žiadny cenový stupeň pre "Personalizácia potlače".');
      return;
    }

    setIsAddingToCart(true);
    zoneStateRef.current[currentZona] = JSON.stringify(canvas);

    const zonyPouzite = pouziteZony();
    const designId = 'design_' + Date.now();
    const tlacoveSubory = {};

    for (const zona of zonyPouzite) {
      const dataUrl = await exportZonyPng(zona);
      if (!dataUrl) continue;
      const blob = await dataUrlToBlob(dataUrl);
      const cesta = `${designId}/${zona}.png`;
      const { error } = await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
      if (!error) tlacoveSubory['_tlacovy_subor_' + zona] = cesta;
    }

    const { plocha: plochaCelkom, farby: pocetFarieb } = plochaAFarbyVsetkychZon();

    const shopifyPayload = {
      items: [
        {
          id: blankVariantId,
          quantity,
          properties: {
            Farba: farba.nazov,
            Veľkosť: currentSize,
            _design_id: designId,
            _technologia: currentTechnologia || p.technologia,
            ...(currentTechnologia === 'rezany' ? { _typ_folie: cennik.folie.find(f => f.id === currentFolia)?.nazov || '' } : {}),
            _potlacene_zony: zonyPouzite.map(z => NAZVY_ZON[z]).join(', '),
            _plocha_cm2_spolu: Math.round(plochaCelkom),
            _pocet_farieb: pocetFarieb,
            ...tlacoveSubory,
          },
        },
        {
          id: personalizacia.shopify_variant_id,
          quantity,
          properties: { _design_id: designId, _pre_produkt: p.nazov },
        },
      ],
    };

    setTechPanelContent(JSON.stringify(shopifyPayload, null, 2));

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(shopifyPayload),
      });
      if (!res.ok) {
        const chyba = await res.json().catch(() => null);
        throw new Error(chyba?.description || `Shopify vrátil chybu ${res.status}`);
      }
      setCartConfirmation(`${p.nazov} · ${currentSize} · potlač: ${zonyPouzite.map(z => NAZVY_ZON[z]).join(', ') || '—'} · ${quantity} ks — ${priceInfo.total.toFixed(2)} € (zaokrúhlená personalizácia: ${Number(personalizacia.cena_eur).toFixed(2)} €/ks)`);
    } catch (e) {
      // Mimo skutočného Shopify obchodu (napr. lokálny vývoj) /cart/add.js neexistuje — to je očakávané,
      // payload si aspoň vieš overiť v technickom paneli nižšie.
      setCartError('Volanie /cart/add.js zlyhalo (' + e.message + '). Mimo Shopify obchodu je to očakávané — over si payload v technickom paneli nižšie.');
    }
    setIsAddingToCart(false);
  };

  const zoneMax = currentZona ? getZoneMaxDims(currentSize, currentZona) : { w: 0, h: 0 };
  const zonaBox = currentZona ? vypocitajZonuBox(produkt, currentColor, currentZona) : null;

  if (isLoading || !produkt) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-20">Načítavam produkt…</div>;
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ĽAVÝ PANEL */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[760px]">
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1 gap-1 flex-wrap">
          {[
            { id: 'product', label: 'Produkt', icon: ShirtIcon },
            { id: 'text', label: 'Text', icon: Type },
            { id: 'sports', label: 'Dresy Expres', icon: Trophy },
            { id: 'graphics', label: 'Obrázky', icon: ImageIcon },
            { id: 'ai', label: 'AI Generátor', icon: Sparkles },
          ].map(t => {
            const Icon = t.icon;
            const active = aktivnaTab === t.id;
            return (
              <button key={t.id} onClick={() => setAktivnaTab(t.id)} className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-xl flex flex-col items-center gap-1 transition ${active ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-600 hover:bg-white/50'}`}>
                <Icon className="w-4 h-4" /><span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {aktivnaTab === 'product' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
                <p className="text-xs text-indigo-700">Práve navrhuješ</p>
                <p className="text-sm font-bold text-indigo-900">{produkt.nazov}</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Farba textilu</label>
                <div className="flex flex-wrap gap-3">
                  {(currentTechnologia === 'sublimacia' ? produkt.colors.filter(c => c.je_biela) : produkt.colors).map(c => (
                    <button key={c.id} onClick={() => zmenFarbu(c.hex)} title={c.nazov} className={`w-8 h-8 rounded-full border-2 transition ${currentColor === c.hex ? 'border-indigo-600 scale-110 shadow' : 'border-slate-300 hover:scale-105'}`} style={{ backgroundColor: c.hex }} />
                  ))}
                  {produkt.colors.length === 0 && <p className="text-xs text-slate-400">Žiadne farby nastavené pre tento produkt.</p>}
                </div>
                {currentTechnologia === 'sublimacia' && <p className="text-[11px] text-slate-400 mt-1.5">Sublimácia sa dá tlačiť len na bielu látku.</p>}
              </div>
              {produkt.technologie.length > 1 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Spôsob potlače</label>
                  <div className="flex flex-wrap gap-2">
                    {produkt.technologie.map(t => (
                      <button key={t} onClick={() => zmenTechnologiu(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${currentTechnologia === t ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{NAZVY_TECHNOLOGIE[t] || t}</button>
                    ))}
                  </div>
                </div>
              )}
              {currentTechnologia === 'rezany' && (cennik?.folie || []).length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Typ fólie</label>
                  <div className="flex flex-wrap gap-2">
                    {cennik.folie.map(f => (
                      <button key={f.id} onClick={() => setCurrentFolia(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${currentFolia === f.id ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{f.nazov}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Veľkosť</label>
                <div className="flex flex-wrap gap-2">
                  {produkt.sizes.map(s => (
                    <button key={s.velkost} onClick={() => zmenVelkost(s.velkost)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${currentSize === s.velkost ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{s.velkost}</button>
                  ))}
                  {produkt.sizes.length === 0 && <p className="text-xs text-slate-400">Žiadne veľkosti nastavené pre tento produkt.</p>}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Kde chcem potlač — dá sa naraz na viac miest</label>
                <div className="grid grid-cols-2 gap-2">
                  {produkt.zony.map(z => {
                    const pocet = pocetObjektovVZone(z);
                    const active = currentZona === z;
                    return (
                      <button key={z} onClick={() => prepniZonu(z)} className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold flex items-center justify-between transition ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <span>{NAZVY_ZON[z]}</span>
                        {pocet > 0 && <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">{pocet}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {aktivnaTab === 'text' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Pridať vlastný text</label>
                <div className="flex gap-2">
                  <input type="text" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Zadajte váš text..." className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" />
                  <button onClick={pridajText} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">Pridať</button>
                </div>
              </div>
              <div className={`space-y-4 pt-4 border-t border-slate-100 ${selectedObj?.type === 'text' ? '' : 'opacity-50 pointer-events-none'}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Úprava označeného textu</h4>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Písmo (Font)</label>
                  <select onChange={(e) => updateTextProperty('fontFamily', e.target.value)} value={selectedObj?.fontFamily || 'Arial'} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
                    <option value="Arial">Arial</option>
                    {fonty.map(f => <option key={f.id} value={f.nazov}>{f.nazov}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Farba textu</label>
                    <input type="color" onChange={(e) => updateTextProperty('fill', e.target.value)} value={selectedObj?.fill || '#000000'} className="w-full h-10 p-1 border border-slate-300 rounded-xl cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Veľkosť</label>
                    <input type="number" min="10" max="150" onChange={(e) => updateTextProperty('fontSize', parseInt(e.target.value))} value={selectedObj?.fontSize || 30} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={toggleFontWeight} className="flex-1 border border-slate-300 py-2 rounded-xl font-bold text-sm hover:bg-slate-50">B</button>
                  <button onClick={toggleFontStyle} className="flex-1 border border-slate-300 py-2 rounded-xl italic text-sm hover:bg-slate-50">I</button>
                  <button onClick={() => alignText('left')} className="flex-1 border border-slate-300 py-2 rounded-xl text-xs hover:bg-slate-50">⟵</button>
                  <button onClick={() => alignText('center')} className="flex-1 border border-slate-300 py-2 rounded-xl text-xs hover:bg-slate-50">↔</button>
                  <button onClick={() => alignText('right')} className="flex-1 border border-slate-300 py-2 rounded-xl text-xs hover:bg-slate-50">⟶</button>
                </div>
              </div>
            </div>
          )}

          {aktivnaTab === 'sports' && (
            <JerseyTab
              jerseyName={jerseyName} setJerseyName={setJerseyName}
              jerseyNumber={jerseyNumber} setJerseyNumber={setJerseyNumber}
              onApply={aplikujDresExpres}
              onColor={(color) => { fabricRef.current?.getObjects().forEach(o => { if (o.type === 'text') o.set('fill', color); }); fabricRef.current?.renderAll(); aktualizujCenu(); }}
            />
          )}

          {aktivnaTab === 'graphics' && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nahrať vlastný obrázok / logo</label>
                <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-600">Kliknite pre výber súboru</span>
                  <span className="text-[10px] text-slate-400 mt-1">PNG, JPG alebo SVG (Max 5MB)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files[0])} />
                </label>
                {aiPanelOpen && (
                  <div className="mt-2 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
                    <p className="text-xs text-indigo-900 font-semibold">Obrázok vyzerá v nižšej kvalite alebo má pozadie</p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">Necháme ho pripraviť pre tlač — odstránime pozadie a zvýšime kvalitu.</p>
                    <button onClick={vylepsiObrazokAI} disabled={aiVylepsujeSa} className={`mt-2 flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition ${aiHotovo ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-70`}>
                      {aiVylepsujeSa ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Spracúva sa…</> : aiHotovo ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pripravené</> : <><Sparkles className="w-3.5 h-3.5" /> Pripraviť obrázok pre tlač (AI)</>}
                    </button>
                    {aiError && <p className="text-[11px] text-rose-600 mt-1.5">{aiError}</p>}
                  </div>
                )}
              </div>
              {grafiky.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Design knižnica</label>
                  <div className="grid grid-cols-4 gap-3">
                    {grafiky.map(g => (
                      <button key={g.id} onClick={() => { if (g.url) fabric.Image.fromURL(g.url, (img) => { img.scaleToWidth(100); img.set({ left: 70, top: 90, cornerColor: '#4f46e5', cornerSize: 8, transparentCorners: false }); fabricRef.current.add(img); fabricRef.current.setActiveObject(img); }, { crossOrigin: 'anonymous' }); }} className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 aspect-square overflow-hidden">
                        {g.url ? <img src={g.url} alt={g.nazov} className="w-full h-full object-cover rounded-lg" /> : <ImageIcon className="w-5 h-5 text-slate-300 m-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Vstavané vektory & ikony</label>
                <div className="grid grid-cols-4 gap-3">
                  {Object.keys(CLIP_ART).map(k => (
                    <button key={k} onClick={() => addClipArt(k)} className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full inline-block" style={{ background: CLIP_ART[k].color }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {aktivnaTab === 'ai' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5" /><h3 className="font-bold text-sm">AI Motívy</h3></div>
                <p className="text-xs opacity-90">Vygeneruje nový motív podľa popisu. Zobrazí sa len zmenšený náhľad — appka si za teba pripraví aj kvalitnú verziu pre tlač.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Popis motívu (Prompt)</label>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} placeholder="napr. Roztomilá mačka v astronautickom obleku, retro štýl..." className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <button onClick={generujAiMotiv} disabled={aiGenerating || !aiPrompt.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition">
                {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generuje sa…</> : <><Sparkles className="w-4 h-4" /> Vygenerovať motív</>}
              </button>
              {aiGenError && <p className="text-xs text-rose-600">{aiGenError}</p>}
            </div>
          )}
        </div>
      </div>

      {/* PRAVÝ PANEL */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex-1 flex flex-col items-center justify-center relative min-h-[520px]">
          <div className="absolute top-4 left-4 bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span>{NAZVY_ZON[currentZona] || '—'}</span>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button onClick={bringForward} title="Posunúť dopredu" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">⬆</button>
            <button onClick={deleteSelected} title="Odstrániť vybrané" className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="relative rounded-2xl overflow-hidden bg-slate-100 shadow-lg" style={{ width: MOCKUP_BOX_W, height: MOCKUP_BOX_H }}>
            {zonaBox?.mockup ? (
              <img src={zonaBox.mockup.fotoUrl} alt={produkt.nazov} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] h-[380px] rounded-xl" style={{ background: currentColor, opacity: 0.9 }} />
              </div>
            )}
            {zonaBox && (
              <div
                className="absolute border-2 border-dashed border-indigo-400/70 pointer-events-none rounded-lg"
                style={{ left: zonaBox.canvasLeft, top: zonaBox.canvasTop, width: zonaBox.canvasW, height: zonaBox.canvasH }}
              >
                <span className="text-[10px] text-indigo-500 font-medium tracking-widest uppercase bg-white/90 px-2 py-0.5 rounded mt-1 absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">Tlačová zóna · {zoneMax.w}×{zoneMax.h} cm</span>
              </div>
            )}
            <canvas
              ref={canvasElRef}
              width={CANVAS_PX_W}
              height={CANVAS_PX_H}
              className="absolute z-10"
              style={zonaBox ? { left: zonaBox.canvasLeft, top: zonaBox.canvasTop } : undefined}
            />
            {liveSize && (
              <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1.5 rounded-full z-20 shadow-lg ${liveSize.presahuje ? 'bg-red-600' : 'bg-slate-900'}`}>
                {liveSize.w.toFixed(1)} × {liveSize.h.toFixed(1)} cm{liveSize.presahuje ? ' — presahuje zónu!' : ''}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={clearCanvas} className="text-slate-600 hover:text-red-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Vyčistiť zónu</button>
            <button onClick={downloadDesign} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Stiahnuť návrh</button>
          </div>
        </div>

        {/* CENA A KOŠÍK */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Cena za kus s potlačou</span>
              <span className="text-2xl font-black text-slate-900">{priceInfo.cenaKus.toFixed(2)} €</span>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg font-bold text-sm transition">-</button>
                <span className="w-12 text-center font-bold text-sm">{quantity} ks</span>
                <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white rounded-lg font-bold text-sm transition">+</button>
              </div>
              <button onClick={pridatDoKosika} disabled={isAddingToCart} className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm">
                {isAddingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}<span>Pridať do košíka</span>
              </button>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-right">
            <span className="text-xs text-slate-500">Spolu za </span>
            <span className="text-sm font-bold text-slate-800">{quantity} ks</span>
            <span className="text-lg font-black text-indigo-600 ml-2">{priceInfo.total.toFixed(2)} €</span>
          </div>
        </div>

        {cartConfirmation && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1"><CheckCircle2 className="w-5 h-5" /> Pridané do košíka</div>
            <p className="text-xs text-emerald-700">{cartConfirmation}</p>
          </div>
        )}
        {cartError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-xs text-rose-700">{cartError}</p>
          </div>
        )}

        <div className="bg-slate-900 rounded-2xl p-4 text-slate-300">
          <button onClick={() => setTechPanelOpen(o => !o)} className="w-full flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>⚙ Technické detaily (Shopify cart payload) — vidí len vývojár</span>
            <span>{techPanelOpen ? 'skryť' : 'zobraziť'}</span>
          </button>
          {techPanelOpen && (
            <pre className="mt-3 text-[10px] leading-relaxed overflow-x-auto bg-black/30 rounded-lg p-3">{techPanelContent || 'Zatiaľ nič — pridaj produkt do košíka.'}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function JerseyTab({ jerseyName, setJerseyName, jerseyNumber, setJerseyNumber, onApply, onColor }) {
  const [ligaFile, setLigaFile] = useState(null);
  const [sponzorHrudFile, setSponzorHrudFile] = useState(null);
  const [sponzorCisloFile, setSponzorCisloFile] = useState(null);

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
        <h3 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-2"><Trophy className="w-4 h-4 text-indigo-600" /> Dresy Expres</h3>
        <p className="text-xs text-indigo-700">Vyplň, čo potrebuješ — meno a číslo pôjdu na chrbát, liga a sponzor na predok. Ostatné polia môžeš nechať prázdne.</p>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Meno na drese</label>
        <input type="text" value={jerseyName} onChange={(e) => setJerseyName(e.target.value)} placeholder="napr. HRONSKÝ" className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold uppercase" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Číslo dresu</label>
        <input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} placeholder="10" min="0" max="99" className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Farba mena a čísla</label>
        <div className="flex gap-2">
          {['#ffffff', '#000000', '#facc15', '#ef4444'].map(c => (
            <button key={c} onClick={() => onColor(c)} className="w-8 h-8 rounded-full border border-slate-300 shadow-sm" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="pt-3 border-t border-slate-100">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Liga / súťaž — logo na srdce</label>
        <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-500 cursor-pointer hover:border-indigo-400">
          <span>{ligaFile ? `✓ ${ligaFile.name}` : 'Nahrať logo ligy'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setLigaFile(e.target.files[0] || null)} />
        </label>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Sponzor — logo na hrudi</label>
        <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-500 cursor-pointer hover:border-indigo-400">
          <span>{sponzorHrudFile ? `✓ ${sponzorHrudFile.name}` : 'Nahrať logo sponzora'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setSponzorHrudFile(e.target.files[0] || null)} />
        </label>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Sponzor — logo pod číslom</label>
        <label className="flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-500 cursor-pointer hover:border-indigo-400">
          <span>{sponzorCisloFile ? `✓ ${sponzorCisloFile.name}` : 'Nahrať logo sponzora'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setSponzorCisloFile(e.target.files[0] || null)} />
        </label>
      </div>
      <button onClick={() => onApply(ligaFile, sponzorHrudFile, sponzorCisloFile)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Aplikovať na dres
      </button>
    </div>
  );
}
