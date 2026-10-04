import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Flag, Eye } from 'lucide-react';
import PbtHeader from '../PbtHeader';
import AskQuestion from '../AskQuestion';
import { nacitajVlajkaKatalog } from './vlajkaData';
import ParametreTab from './ParametreTab';
import GrafikaTab from './GrafikaTab';
import DoplnkyTab from './DoplnkyTab';
import VelkostnePorovnanie from './VelkostnePorovnanie';

const BUCKET = 'print-designs';
const DEFAULT_VIEWBOX = { w: 200, h: 420 };

// Velkost s prepisanym popisom rozmeru a vyskou podla vybraneho tvaru (napr. Square 66 x 220 cm, 270 cm od zeme).
function velkostPreTvar(katalog, tvarKod, velkostKod) {
  const v = katalog?.velkosti?.find(x => x.kod === velkostKod);
  if (!v) return v;
  const rozmer = katalog.tvary.find(t => t.kod === tvarKod)?.rozmery?.[velkostKod];
  return { ...v, rozmer_popis: rozmer?.rozmer_popis || v.rozmer_popis, vyska_cm: rozmer?.vyska_cm ?? v.vyska_cm };
}

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
  // Pocet kusov prutov a podstavcov — zakaznik si v poslednom kroku zvoli kolko z kazdeho chce (aj viac druhov podstavcov naraz).
  // Pokial ich nezmenil rucne, kopiruju vyber z kroku Parametre x pocet vlajok.
  const [stoziareMn, setStoziareMn] = useState({});
  const [podstavceMn, setPodstavceMn] = useState({});
  const [mnozstvaRucne, setMnozstvaRucne] = useState(false);
  const [osobnyOdber, setOsobnyOdber] = useState(false);
  const [cena, setCena] = useState(null);
  const [cenyVolieb, setCenyVolieb] = useState(null); // predajne ceny opracovania/prutov/podstavcov/doplnkov (zo servera)
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
  const mierkaCmRef = useRef({ x: 1, y: 1 }); // prepocet "jednotka platna" -> skutocne cm (podla rozmerov vybranej velkosti)
  const [rozmerVlajkyCm, setRozmerVlajkyCm] = useState(null);
  const [nahladDizajnu, setNahladDizajnu] = useState(null); // dataURL aktualneho dizajnu pre ilustraciu vedla ziveho nahladu
  const [selInfo, setSelInfo] = useState(null); // rozmer (cm) a otocenie prave vybraneho objektu na platne
  const [previewBoxSize, setPreviewBoxSize] = useState({ w: 320, h: 420 });
  const [userZoom, setUserZoom] = useState(1); // dodatocne priblizenie nad ramec auto-fit, ovlada zakaznik (+/-)
  const [canvasVersion, setCanvasVersion] = useState(0); // pretiahne novy render do GrafikaTab, ked sa fabric platno prvykrat vytvori

  useEffect(() => { katalogRef.current = katalog; }, [katalog]);

  // Pokial zakaznik pocty prutov/podstavcov nemenil rucne, kopiruju vyber z kroku Parametre x pocet vlajok.
  useEffect(() => {
    if (mnozstvaRucne) return;
    setStoziareMn(stoziarKod ? { [stoziarKod]: pocetKs } : {});
    setPodstavceMn(podstavecKod ? { [podstavecKod]: pocetKs } : {});
  }, [mnozstvaRucne, stoziarKod, podstavecKod, pocetKs]);

  const zoznamMnozstiev = (mapa) => Object.entries(mapa).filter(([, m]) => m > 0).map(([kod, mnozstvo]) => ({ kod, mnozstvo }));
  const nastavStoziarMn = (kod, hodnota) => { setMnozstvaRucne(true); setStoziareMn(m => ({ ...m, [kod]: Math.max(0, Math.round(hodnota) || 0) })); };
  const nastavPodstavecMn = (kod, hodnota) => { setMnozstvaRucne(true); setPodstavceMn(m => ({ ...m, [kod]: Math.max(0, Math.round(hodnota) || 0) })); };
  // Zmena vyberu v kroku Parametre znovu naplni mnozstva z vyberu (nech zakaznikovi neostane stary rucny stav).
  const vyberTvar = (k) => { setTvarKod(k); setMnozstvaRucne(false); };
  const vyberVelkost = (k) => { setVelkostKod(k); setMnozstvaRucne(false); };
  const vyberStoziar = (k) => { setStoziarKod(k); setMnozstvaRucne(false); };
  const vyberPodstavec = (k) => { setPodstavecKod(k); setMnozstvaRucne(false); };

  // Niektore prúty su len pre urcite tvary (napr. Square) — ak zvoleny prut pre tvar nie je dostupny, prepni na prvy dostupny.
  useEffect(() => {
    if (!katalog || !tvarKod || !stoziarKod) return;
    const tvar = katalog.tvary.find(t => t.kod === tvarKod);
    const dostupne = katalog.stoziare.filter(st => !st.tvarIds?.length || st.tvarIds.includes(tvar?.id));
    if (dostupne.length > 0 && !dostupne.some(st => st.kod === stoziarKod)) setStoziarKod(dostupne[0].kod);
  }, [katalog, tvarKod, stoziarKod]);

  // Niektore tvary nemaju vsetky velkosti (napr. Square je len S, M, L) — ak zvolena velkost pre tvar neexistuje, prepni na prvu dostupnu.
  useEffect(() => {
    if (!katalog || !tvarKod) return;
    const tvar = katalog.tvary.find(t => t.kod === tvarKod);
    if (!tvar?.rozmery || tvar.rozmery[velkostKod]) return;
    const prva = katalog.velkosti.find(v => tvar.rozmery[v.kod]);
    if (prva) setVelkostKod(prva.kod);
  }, [katalog, tvarKod, velkostKod]);

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
    const aktualizujInfo = () => {
      const o = canvas.getActiveObject();
      if (!o || o.isMaskOverlay) { setSelInfo(null); return; }
      const m = mierkaCmRef.current;
      const nova = { sirkaCm: o.getScaledWidth() * m.x, vyskaCm: o.getScaledHeight() * m.y, uhol: ((Math.round(o.angle || 0) % 360) + 360) % 360 };
      setSelInfo(p => (p && Math.abs(p.sirkaCm - nova.sirkaCm) < 0.05 && Math.abs(p.vyskaCm - nova.vyskaCm) < 0.05 && p.uhol === nova.uhol ? p : nova));
    };
    ['selection:created', 'selection:updated', 'selection:cleared', 'object:scaling', 'object:rotating', 'object:moving', 'object:modified', 'after:render'].forEach(ev => canvas.on(ev, aktualizujInfo));
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
    const velkostRiadok = k.velkosti.find(v => v.kod === velkostKod);
    // Strihy (cut/bleed/safe) su 1:1 v cm, viewbox = vlajka + 5 cm okraj na kazdej strane, takze 1 jednotka
    // platna = 1 cm. Rozmer z popisu (napr. 66 x 220 cm, moze byt per tvar) sluzi len na zobrazenie.
    const mRozmer = /([\d.,]+)\s*x\s*([\d.,]+)/i.exec(rozmer.rozmer_popis || velkostRiadok?.rozmer_popis || '');
    mierkaCmRef.current = { x: 1, y: 1 };
    if (mRozmer) setRozmerVlajkyCm({ sirkaCm: Number(mRozmer[1].replace(',', '.')), vyskaCm: Number(mRozmer[2].replace(',', '.')) });
    else setRozmerVlajkyCm(null);
    canvas.mierkaCm = mierkaCmRef.current; // cita LayersPanel na zobrazenie realnych cm
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

  // Nahlad aktualneho dizajnu (bez cervenej/zelenej masky) pre ilustraciu vedla ziveho nahladu —
  // zakaznik tak vidi svoje upravy (texty, loga, obrysy) aj na schematickej vlajke s postavou.
  // toDataURL vnútorne vyvola 'after:render', preto strazca "generuje" zabrani nekonecnej slucke.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let timer = null;
    let generuje = false;
    const vytvor = () => {
      timer = null;
      const { w } = logicalSizeRef.current;
      const zoom = canvas.getZoom();
      if (!w || !zoom) return;
      const masky = canvas.getObjects().filter(o => o.isMaskOverlay);
      generuje = true;
      try {
        masky.forEach(o => { o.visible = false; });
        setNahladDizajnu(canvas.toDataURL({ format: 'png', multiplier: 280 / (w * zoom) }));
      } catch (e) { /* nahlad je len pomocka — pri chybe ostane predchadzajuci */ } finally {
        masky.forEach(o => { o.visible = true; });
        generuje = false;
      }
    };
    const naplanuj = () => { if (generuje || timer) return; timer = setTimeout(vytvor, 250); };
    canvas.on('after:render', naplanuj);
    naplanuj();
    return () => { clearTimeout(timer); canvas.off('after:render', naplanuj); };
  }, [canvasVersion]);

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
        body: { tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnky, pocetKs, expresne, osobnyOdber, stoziare: zoznamMnozstiev(stoziareMn), podstavce: zoznamMnozstiev(podstavceMn) },
      });
      setCenaNacitava(false);
      if (error) { setCenaChyba(error.message); return; }
      if (data?.error) { setCenaChyba(data.error); return; }
      setCena(data.cena);
    }, 400);
    return () => clearTimeout(t);
  }, [supabase, katalog, tvarKod, velkostKod, materialKod, dokoncenieKod, stoziarKod, podstavecKod, doplnkyMnozstva, pocetKs, expresne, osobnyOdber, stoziareMn, podstavceMn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Predajne ceny jednotlivych volieb — v DB su NAKUPNE ceny (verejnost ich nevidi), predajna cena sa
  // dopocita na serveri z marze a poctu kusov (rezim 'cenovnik' v beachflag-price-preview).
  useEffect(() => {
    if (!katalog || !velkostKod) return;
    let zrusene = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('beachflag-price-preview', { body: { cenovnik: true, velkostKod, pocetKs } });
      if (!zrusene) setCenyVolieb(!error && !data?.error ? data.cenovnik : null);
    }, 300);
    return () => { zrusene = true; clearTimeout(t); };
  }, [supabase, katalog, velkostKod, pocetKs]);

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
      // Obrys je predvolene VONKU (za pismom): paintFirst 'stroke' vykresli obrys pod vyplnou, takze
      // hruba linka nikdy nezakryje vnutro textu (LayersPanel pri tom zdvojnasobi strokeWidth).
      obrysHrubka: 0, obrysPoloha: 'vonku', paintFirst: 'stroke', strokeLineJoin: 'round',
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
    return d ? { kod, nazov: d.nazov, mnozstvo } : null;
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
        expresne, pocetKs, osobnyOdber,
        stoziare: zoznamMnozstiev(stoziareMn), podstavce: zoznamMnozstiev(podstavceMn),
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
    <AskQuestion zdroj="Beachvlajky" />
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
          <ParametreTab katalog={katalog} cenyVolieb={cenyVolieb} tvarKod={tvarKod} velkostKod={velkostKod} materialKod={materialKod} dokoncenieKod={dokoncenieKod} stoziarKod={stoziarKod} podstavecKod={podstavecKod}
            onTvar={vyberTvar} onVelkost={vyberVelkost} onMaterial={setMaterialKod} onDokoncenie={setDokoncenieKod} onStoziar={vyberStoziar} onPodstavec={vyberPodstavec}
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
          <DoplnkyTab katalog={katalog} cenyVolieb={cenyVolieb} doplnkyMnozstva={doplnkyMnozstva} onZmenMnozstvo={zmenMnozstvoDoplnku}
            tvarKod={tvarKod} velkostKod={velkostKod}
            stoziareMn={stoziareMn} onStoziarMn={nastavStoziarMn} podstavceMn={podstavceMn} onPodstavecMn={nastavPodstavecMn}
            expresne={expresne} onExpresne={setExpresne} pocetKs={pocetKs} onPocetKs={setPocetKs}
            osobnyOdber={osobnyOdber} onOsobnyOdber={setOsobnyOdber}
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
          <div className="flex gap-2 items-stretch" style={{ height: 'clamp(440px, 72vh, 680px)' }}>
          <div className="relative flex-1 min-w-0 flex flex-col">
          <div className="absolute top-2 right-2 z-10 bg-slate-900/85 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-mono leading-tight shadow pointer-events-none text-right">
            {selInfo ? (<><div>Objekt: <b>{selInfo.sirkaCm.toFixed(1)} × {selInfo.vyskaCm.toFixed(1)} cm</b></div><div>Otočenie: <b>{selInfo.uhol}°</b></div></>) : rozmerVlajkyCm ? (<><div>Vlajka: <b>{rozmerVlajkyCm.sirkaCm} × {rozmerVlajkyCm.vyskaCm} cm</b></div><div className="text-slate-400">vyber objekt = jeho rozmer</div></>) : null}
          </div>
          <div ref={previewBoxRef} className="relative flex-1 min-h-0 bg-slate-100 rounded-xl border border-slate-300 p-2 flex items-center justify-center overflow-auto" onContextMenu={(e) => e.preventDefault()}>
            <canvas ref={canvasElRef} className="shadow-md rounded" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <button type="button" onClick={() => setUserZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">−</button>
            <span className="text-[11px] text-slate-500 font-mono w-12 text-center">{Math.round(userZoom * 100)}%</span>
            <button type="button" onClick={() => setUserZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">+</button>
            {userZoom !== 1 && <button type="button" onClick={() => setUserZoom(1)} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold ml-1">Resetovať</button>}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Červená čiara je orez, zelená je bezpečná zóna.</p>
          </div>
          <div className="w-36 sm:w-44 shrink-0 bg-slate-50 rounded-xl border border-slate-200 p-1.5 flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center mb-1">Porovnanie veľkosti</span>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <VelkostnePorovnanie kompaktny rozmer={katalog?.tvary.find(t => t.kod === tvarKod)?.rozmery?.[velkostKod]} velkost={velkostPreTvar(katalog, tvarKod, velkostKod)} velkosti={(katalog?.velkosti || []).filter(v => katalog.tvary.find(t => t.kod === tvarKod)?.rozmery?.[v.kod]).map(v => velkostPreTvar(katalog, tvarKod, v.kod))} bgColor={bgColor} nahladUrl={nahladDizajnu} />
            </div>
          </div>
          </div>
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
