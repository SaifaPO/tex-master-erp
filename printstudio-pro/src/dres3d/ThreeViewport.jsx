import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCcw, Camera } from 'lucide-react';
import { updateJerseyTexture, logaVyrobcuReady, orezOffset, kresliVnutroDresu } from './dresRenderer';
import { vykresliTrenirky, postavCestyZon, zonaKusu, vypocitajPanelyNoh } from './trenirkyRenderer';

// Trenírky sa v komplete posunú o toľko cm nižšie, aby pás nohavíc sedel pod spodným lemom dresu (v pôvodnom
// súradnicovom systéme avatara sa oba kusy čiastočne prekrývajú — dres je prehodený cez pás).
const TRENIRKY_POSUN_Y_CM = -22;

// 3D náhľad dresu — vlastní celú Three.js scénu (kamera/svetlá/geometria/OrbitControls)
// a offscreen 2D canvas s textúrou. Portované z init3D/setupLighting/createJerseyModel/
// setViewAngle/captureSnapshotAndDownload v 3d_konfigurator_dresov.html, prepojené na React
// cez konfigState prop namiesto globálneho mutovateľného stavu.
const ThreeViewport = forwardRef(function ThreeViewport({ configState, onDragLogo, zostava = 'dres' }, ref) {
  const containerRef = useRef(null);
  // Nacitavanie 3D modelov (dres ~19 MB, trenirky ~1 MB): percento do kruhoveho indikatora. Ak server neposle celkovu
  // velkost (komprimovany prenos), pouzije sa odhad z velkosti suborov; po stiahnuti ostava 97 % kym sa model spracuje.
  const [nacitanie, setNacitanie] = useState({ pct: 0, hotovo: false });
  const postupRef = useRef({ dres: { loaded: 0, total: 19405704, done: false }, trenirky: { loaded: 0, total: 1075576, done: false } });
  const hlasPostup = (kluc, e, done) => {
    const p = postupRef.current[kluc];
    if (e?.chyba) p.done = true; // pri chybe nacitania sa indikator nema zasekavat
    if (e && !e.chyba) { if (e.lengthComputable && e.total > 0) p.total = e.total; p.loaded = e.loaded; }
    if (done) p.done = true;
    const v = Object.values(postupRef.current);
    const hotovo = v.every((x) => x.done);
    const stiahnute = v.reduce((sum, x) => sum + (x.done ? x.total : Math.min(x.loaded, x.total)), 0);
    const spolu = v.reduce((sum, x) => sum + x.total, 0);
    const pct = hotovo ? 100 : Math.min(97, Math.floor((stiahnute / spolu) * 97));
    // percento nikdy neklesá (skutočný postup sa môže líšiť od časového odhadu nižšie)
    setNacitanie((prev) => { const np = hotovo ? 100 : Math.max(prev.pct, pct); return prev.pct === np && prev.hotovo === hotovo ? prev : { pct: np, hotovo }; });
  };
  // Skutočný postup sťahovania chodí v skokoch (server často neposiela celkovú veľkosť) a po stiahnutí model ešte chvíľu spracúvame —
  // preto sa percento plynulo dopĺňa aj podľa uplynutého času (do 97 %), a keď je skutočný postup vyšší, použije sa ten.
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const odhad = Math.min(97, Math.floor(97 * (1 - Math.exp(-(Date.now() - t0) / 6000))));
      setNacitanie((prev) => (prev.hotovo || prev.pct >= odhad ? prev : { pct: odhad, hotovo: false }));
    }, 250);
    return () => clearInterval(id);
  }, []);
  const textureCanvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasTextureRef = useRef(null);
  const lightsRef = useRef({});
  // Ťahanie loga priamo na 3D modeli (pozri nižšie, pointerdown/move/up na renderer.domElement):
  // jerseyMeshesRef = meshe, na ktoré sa raycastuje; dragRegionsRef = kde presne (v px na
  // 2048×2048 plátne) sa práve nachádza ktoré logo — prepočíta sa pri každom prekreslení
  // textúry; draggingRef = aktuálne prebiehajúci drag (null = žiadny).
  const jerseyMeshesRef = useRef([]);
  const dragRegionsRef = useRef([]);
  const draggingRef = useRef(null);
  // 3D trenírky — vlastný koreň, vlastné plátno/textúra, Path2D zón z UV; zostava = 'dres' | 'trenky' | 'komplet'.
  const jerseyRootRef = useRef(null);
  const shortsRootRef = useRef(null);
  const jerseyBoxRef = useRef(null);
  const shortsBoxRef = useRef(null);
  const shortsCanvasRef = useRef(null);
  const shortsTextureRef = useRef(null);
  const shortsPathsRef = useRef(null);
  const shortsPanelsRef = useRef(null);
  const zostavaRef = useRef(zostava);
  zostavaRef.current = zostava;
  const configStateRef = useRef(configState);
  configStateRef.current = configState;
  const onDragLogoRef = useRef(onDragLogo);
  onDragLogoRef.current = onDragLogo;
  const [svetlo, setSvetlo] = useState('dark');
  const envRef = useRef({ group: null }); // aktuálne prostredie (miestnosť / štadión)
  const [autoRotate, setAutoRotate] = useState(false);
  const [aktivnyPohlad, setAktivnyPohlad] = useState('front');

  const captureSnapshot = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return null;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({ captureSnapshot }));

  // Rozloženie modelov podľa zostavy — dres sám, trenírky samé, alebo komplet (trenírky pod dresom).
  // Spoločný bounding box (v cm) sa vycentruje a zmenší tak, aby sa zmestil do kamery.
  const nastavRozlozenie = () => {
    const jr = jerseyRootRef.current, sr = shortsRootRef.current;
    const jb = jerseyBoxRef.current, sb = shortsBoxRef.current;
    const z = zostavaRef.current;
    if (jr) jr.visible = z !== 'trenky';
    if (sr) sr.visible = z !== 'dres';
    const zobrazDres = !!(jr && jb && z !== 'trenky');
    const zobrazTrenky = !!(sr && sb && z !== 'dres');
    const boxy = [];
    if (zobrazDres) boxy.push(jb.clone());
    if (zobrazTrenky) boxy.push(sb.clone().translate(new THREE.Vector3(0, TRENIRKY_POSUN_Y_CM, 0)));
    if (boxy.length === 0) return;
    const spolu = boxy.reduce((a, b) => a.union(b));
    const size = spolu.getSize(new THREE.Vector3());
    const center = spolu.getCenter(new THREE.Vector3());
    const s = (z === 'komplet' ? 2.45 : 2.1) / Math.max(size.x, size.y, size.z);
    const yOff = z === 'komplet' ? 0.05 : -0.15;
    const umiestni = (root, posunYcm) => {
      root.scale.setScalar(s);
      root.position.set(-center.x * s, -center.y * s + yOff + posunYcm * s, -center.z * s);
    };
    if (zobrazDres) umiestni(jr, 0);
    if (zobrazTrenky) umiestni(sr, TRENIRKY_POSUN_Y_CM);
  };

  const prekresliTrenirky = () => {
    const canvas = shortsCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !shortsPathsRef.current || !shortsTextureRef.current) return;
    vykresliTrenirky(ctx, canvas, shortsPathsRef.current, configStateRef.current, shortsPanelsRef.current);
    shortsTextureRef.current.needsUpdate = true;
  };

  // Inicializácia scény — raz pri mounte
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.set(0, 0, 4.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.4;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.target.set(0, -0.1, 0);
    controlsRef.current = controls;

    aplikujOsvetlenie(scene, lightsRef, renderer, 'dark');

    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x070b14, roughness: 0.8, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.0;
    floor.receiveShadow = true;
    floor.visible = false; // podlahu si stavia prostredie (pozri nastavProstredie)
    scene.add(floor);
    envRef.current = { group: null };
    nastavProstredie(scene, envRef.current, 'dark');

    const canvasTexture = vytvorDresGeometriu(scene, textureCanvasRef.current, jerseyMeshesRef, (root, box) => {
      jerseyRootRef.current = root;
      jerseyBoxRef.current = box;
      nastavRozlozenie();
      hlasPostup('dres', null, true);
    }, (e) => hlasPostup('dres', e));
    canvasTextureRef.current = canvasTexture;

    // Trenírky — načítajú sa vždy (1 MB), zobrazia sa podľa zostavy. Textúra sa vykreslí z UV zón.
    const shortsCanvas = document.createElement('canvas');
    shortsCanvas.width = 2048;
    shortsCanvas.height = 2048;
    shortsCanvasRef.current = shortsCanvas;
    vytvorTrenirky(scene, shortsCanvas, (root, box, cesty, textura, panely) => {
      shortsPanelsRef.current = panely;
      shortsRootRef.current = root;
      shortsBoxRef.current = box;
      shortsPathsRef.current = cesty;
      shortsTextureRef.current = textura;
      prekresliTrenirky();
      nastavRozlozenie();
      hlasPostup('trenirky', null, true);
    }, (e) => hlasPostup('trenirky', e));

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);
    // Okno náhľadu sa mení aj bez zmeny okna prehliadača (napr. vyššia horná lišta na mobile) — sleduje sa priamo kontajner.
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    resizeObserver?.observe(container);

    // Ťahanie loga/erbu priamo na 3D modeli — raycast z pozície myši na dres, prevod bodu
    // dopadu na UV → px na 2048×2048 textúrovom plátne (rovnaká konvencia ako PANELY v
    // dresRenderer.js, keďže canvasTexture.flipY=false zosúlaďuje smer V-osi s "raw" UV dátami
    // modelu), a hit-test proti dragRegionsRef (posledné vykreslené pozície log/erbu).
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const bodNaTexture = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, cameraRef.current);
      const hits = raycaster.intersectObjects(jerseyMeshesRef.current, false);
      if (hits.length === 0 || !hits[0].uv) return null;
      const canvas = textureCanvasRef.current;
      // UV tohto modelu sú mimo 0..1 (napr. v od -0,92 do -0,31 pri tele dresu) a textúra sa opakuje — preto sa zabalia do 0..1
      const zabal = (v) => ((v % 1) + 1) % 1;
      return { px: zabal(hits[0].uv.x) * canvas.width, py: zabal(hits[0].uv.y) * canvas.height };
    };
    const najdiRegion = (px, py) => {
      let najdeny = null, najmensiaPlocha = Infinity;
      for (const r of dragRegionsRef.current) {
        const polW = r.w / 2, polH = r.h / 2;
        if (px >= r.cx - polW && px <= r.cx + polW && py >= r.cy - polH && py <= r.cy + polH) {
          const plocha = r.w * r.h;
          if (plocha < najmensiaPlocha) { najmensiaPlocha = plocha; najdeny = r; }
        }
      }
      return najdeny;
    };
    const ziskajAktualnyOffset = (dragId) => {
      const loga = configStateRef.current.loga || {};
      if (dragId === 'erb') return loga.erbOffset || { x: 0, y: 0 };
      if (dragId === 'logoPred') return loga.logoPredOffset || { x: 0, y: 0 };
      if (dragId.startsWith('rukav:')) {
        const id = Number(dragId.slice(6));
        const logo = (loga.rukavLoga || []).find((l) => l.id === id);
        return { x: logo?.offsetX || 0, y: logo?.offsetY || 0 };
      }
      return { x: 0, y: 0 };
    };
    // Plynulé ťahanie: raycast (drahý — modely majú státisíce trojuholníkov) sa robí len 3× pri stlačení a z neho sa odvodí prepočet
    // pohybu myši na pixely textúry. Počas ťahania sa textúra prekresľuje najviac raz za snímok (requestAnimationFrame) priamo,
    // bez prekresľovania celej aplikácie — stav (React) sa uloží až po pustení myši.
    const prekresliPocasTahania = () => {
      const drag = draggingRef.current;
      if (!drag) return;
      drag.cakaFrame = false;
      const canvas = textureCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      const tex = canvasTextureRef.current;
      if (!ctx || !tex || !drag.posledne) return;
      const cfg = configStateRef.current;
      const loga = cfg.loga || {};
      const { x, y } = drag.posledne;
      let novaLoga = loga;
      if (drag.dragId === 'erb') novaLoga = { ...loga, erbOffset: { x, y } };
      else if (drag.dragId === 'logoPred') novaLoga = { ...loga, logoPredOffset: { x, y } };
      else if (drag.dragId.startsWith('rukav:')) {
        const id = Number(drag.dragId.slice(6));
        novaLoga = { ...loga, rukavLoga: (loga.rukavLoga || []).map((l) => (l.id === id ? { ...l, offsetX: x, offsetY: y } : l)) };
      }
      dragRegionsRef.current = updateJerseyTexture(ctx, canvas, { ...cfg, loga: novaLoga }) || dragRegionsRef.current;
      tex.needsUpdate = true;
    };
    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (zostavaRef.current === 'trenky') return; // dres je skrytý — nie je čo ťahať
      const bod = bodNaTexture(e.clientX, e.clientY);
      if (!bod) return;
      const region = najdiRegion(bod.px, bod.py);
      if (!region) return;
      // lineárny prepočet pohybu myši (px na obrazovke) -> pohyb v textúre (px), odvodený z dvoch pomocných lúčov
      const KROK = 14;
      const bx = bodNaTexture(e.clientX + KROK, e.clientY);
      const by = bodNaTexture(e.clientX, e.clientY + KROK);
      const jakobian = bx && by ? { xx: (bx.px - bod.px) / KROK, xy: (by.px - bod.px) / KROK, yx: (bx.py - bod.py) / KROK, yy: (by.py - bod.py) / KROK } : null;
      draggingRef.current = {
        dragId: region.dragId,
        panelW: region.panelW,
        panelH: region.panelH,
        startPx: bod,
        startMys: { x: e.clientX, y: e.clientY },
        jakobian,
        startOffset: ziskajAktualnyOffset(region.dragId),
        posledne: null,
        cakaFrame: false,
      };
      controls.enabled = false;
    };
    const onPointerMove = (e) => {
      const drag = draggingRef.current;
      if (!drag) return;
      let dPx, dPy;
      if (drag.jakobian) {
        const dx = e.clientX - drag.startMys.x, dy = e.clientY - drag.startMys.y;
        dPx = drag.jakobian.xx * dx + drag.jakobian.xy * dy;
        dPy = drag.jakobian.yx * dx + drag.jakobian.yy * dy;
      } else {
        const bod = bodNaTexture(e.clientX, e.clientY);
        if (!bod) return;
        dPx = bod.px - drag.startPx.px; dPy = bod.py - drag.startPx.py;
      }
      drag.posledne = {
        x: orezOffset(drag.startOffset.x + dPx / drag.panelW),
        y: orezOffset(drag.startOffset.y + dPy / drag.panelH),
      };
      if (!drag.cakaFrame) { drag.cakaFrame = true; requestAnimationFrame(prekresliPocasTahania); }
    };
    const onPointerUp = () => {
      const drag = draggingRef.current;
      if (!drag) return;
      draggingRef.current = null;
      controls.enabled = true;
      if (drag.posledne) onDragLogoRef.current?.(drag.dragId, drag.posledne.x, drag.posledne.y); // až teraz sa uloží do stavu aplikácie
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prekreslenie textúry pri každej zmene konfigurácie. Google Font sa do prehliadača
  // dotiahne až pri PRVOM skutočnom použití (canvas text ho nečaká) — bez tohto čakania by
  // prvých pár prekreslení po prepnutí fontu ešte kreslilo starým/záložným písmom, kým sa font
  // dotiahne, a zmena "naskočila" až o niekoľko klikov neskôr.
  useEffect(() => {
    let zrusene = false;
    const font = configState.text.fontRodina;
    Promise.resolve(document.fonts?.load?.(`bold 32px "${font}"`)).catch(() => {}).finally(() => {
      if (zrusene) return;
      const canvas = textureCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !canvasTextureRef.current) return;
      dragRegionsRef.current = updateJerseyTexture(ctx, canvas, configState) || [];
      canvasTextureRef.current.needsUpdate = true;
    });
    return () => { zrusene = true; };
  }, [configState]);

  // Fixné logá výrobcu (logo-pred.png/logo-zad.png) sa načítavajú asynchrónne — ak sa načítajú
  // až po prvom vykreslení, treba textúru prekresliť ešte raz, inak by ostali neviditeľné.
  useEffect(() => {
    logaVyrobcuReady.then(() => {
      const canvas = textureCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !canvasTextureRef.current) return;
      dragRegionsRef.current = updateJerseyTexture(ctx, canvas, configState) || [];
      canvasTextureRef.current.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { nastavRozlozenie(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [zostava]);

  useEffect(() => { prekresliTrenirky(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [configState.farby, configState.trenirky, configState.cislo, configState.loga, configState.text.cisloHraca, configState.text.fontRodina, configState.vzor]);
  // obrazok loga vyrobcu a pisma sa nacitaju asynchronne — po nacitani sa trenirky prekreslia
  useEffect(() => { logaVyrobcuReady.then(() => prekresliTrenirky()); if (document.fonts?.ready) document.fonts.ready.then(() => prekresliTrenirky()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (sceneRef.current && rendererRef.current) {
      aplikujOsvetlenie(sceneRef.current, lightsRef, rendererRef.current, svetlo);
      nastavProstredie(sceneRef.current, envRef.current, svetlo);
    }
  }, [svetlo]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 3.0;
    }
  }, [autoRotate]);

  const nastavPohlad = (view) => {
    setAktivnyPohlad(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const dist = 4.2;
    let targetX = 0, targetZ = dist;
    if (view === 'front') { targetX = 0; targetZ = dist; }
    else if (view === 'back') { targetX = 0; targetZ = -dist; }
    else if (view === 'left') { targetX = -dist; targetZ = 0; }
    else if (view === 'right') { targetX = dist; targetZ = 0; }

    const startX = camera.position.x;
    const startZ = camera.position.z;
    const startTime = performance.now();
    const duration = 500;
    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
      camera.position.x = startX + (targetX - startX) * ease;
      camera.position.z = startZ + (targetZ - startZ) * ease;
      controls.update();
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const stiahniSnimku = () => {
    const url = captureSnapshot();
    if (!url) return;
    const link = document.createElement('a');
    link.download = `dres-3d-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const POHLADY = [
    { id: 'front', label: 'Predok' },
    { id: 'back', label: 'Zadok' },
    { id: 'left', label: 'Ľavý bok' },
    { id: 'right', label: 'Pravý bok' },
  ];

  return (
    <div className="relative flex-1 min-h-[200px] lg:min-h-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-hidden flex items-center justify-center rounded-2xl">
      <canvas ref={textureCanvasRef} width={2048} height={2048} className="hidden" />
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {!nacitanie.hotovo && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 backdrop-blur-sm">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="7" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#6366f1" strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - nacitanie.pct / 100)} style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">{nacitanie.pct}%</span>
          </div>
          <p className="text-sm font-bold text-slate-200">Načítavam 3D model…</p>
          <p className="text-[11px] text-slate-500 text-center px-6">Pri prvom otvorení to trvá o niečo dlhšie, nabudúce už bude rýchlejšie.</p>
        </div>
      )}

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-md">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
          <span>360° 3D Náhľad</span>
        </div>
        <div className="pointer-events-auto flex gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-md">
          {[{ id: 'light', icon: '☀️', nazov: 'Svetlé', popis: 'Svetlé béžové prostredie (miestnosť)' }, { id: 'dark', icon: '🌙', nazov: 'Tmavé', popis: 'Tmavomodré až čierne prostredie (miestnosť)' }, { id: 'stadium', icon: '🏟️', nazov: 'Štadión', popis: 'Futbalový štadión dookola — trávnik, tribúny, reflektory' }].map(o => (
            <button key={o.id} onClick={() => setSvetlo(o.id)} title={o.popis} className={`px-1.5 py-1.5 rounded-lg text-xs flex items-center gap-1 ${svetlo === o.id ? 'bg-slate-800 text-indigo-400 font-medium' : 'text-slate-400 hover:text-white'}`}>{o.icon}{svetlo === o.id && <span className="text-[11px]">{o.nazov}</span>}</button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-1 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800/80 shadow-2xl z-10 max-w-full overflow-x-auto">
        {POHLADY.map(p => (
          <button key={p.id} onClick={() => nastavPohlad(p.id)} className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition shrink-0 ${aktivnyPohlad === p.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
            {p.label}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-800 mx-0.5 shrink-0" />
        <button onClick={() => setAutoRotate(v => !v)} title="Zapnúť / Vypnúť 360° rotáciu" className={`p-1.5 rounded-xl shrink-0 transition ${autoRotate ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={stiahniSnimku} title="Stiahnuť obrázok náhľadu" className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0">
          <Camera className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ThreeViewport;

// ---------- PROSTREDIE ----------
// ☀️ svetlé: béžová kocka (miestnosť) • 🌙 tmavé: tmavomodro-čierna kocka • 🏟️ štadión: trávnik s čiarami, tribúny s divákmi,
// reklamné pásy, reflektory — celé dookola. Postavená skupina sa pri zmene režimu zahodí a postaví nová.
function plochaTextura(w, h, kresli, opakX = 1, opakY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  kresli(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(opakX, opakY);
  t.anisotropy = 8;
  return t;
}

function texturaHriska() {
  return plochaTextura(2048, 1344, (g, w, h) => {
    const pruhov = 14;
    for (let i = 0; i < pruhov; i++) { g.fillStyle = i % 2 ? '#2f8f3a' : '#3aa346'; g.fillRect((w / pruhov) * i, 0, w / pruhov + 1, h); }
    g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 7;
    const m = 40; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
    g.beginPath(); g.moveTo(w / 2, m); g.lineTo(w / 2, h - m); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, h * 0.135, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, h / 2, 9, 0, Math.PI * 2); g.fill();
    // pokutové územia
    const pw = w * 0.16, ph = h * 0.6;
    g.strokeRect(m, (h - ph) / 2, pw, ph); g.strokeRect(w - m - pw, (h - ph) / 2, pw, ph);
    const bw = w * 0.055, bh = h * 0.27;
    g.strokeRect(m, (h - bh) / 2, bw, bh); g.strokeRect(w - m - bw, (h - bh) / 2, bw, bh);
  });
}

function texturaDivakov() {
  return plochaTextura(1024, 256, (g, w, h) => {
    g.fillStyle = '#111a2e'; g.fillRect(0, 0, w, h);
    const farby = ['#dc2626', '#1d4ed8', '#f8fafc', '#facc15', '#16a34a', '#94a3b8', '#f97316'];
    let sem = 12345; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    for (let rad = 0; rad < 18; rad++) {
      const y = 10 + rad * (h - 16) / 18;
      for (let x = (rad % 2) * 6; x < w; x += 12) {
        const farba = farby[Math.floor(rnd() * farby.length)];
        g.fillStyle = farba; g.fillRect(x, y + 5, 10, 8);                      // telo / dres
        g.fillStyle = rnd() > 0.5 ? '#f1c9a5' : '#b98563'; g.beginPath(); g.arc(x + 5, y + 3, 3.2, 0, Math.PI * 2); g.fill(); // hlava
      }
    }
  }, 7, 1);
}

function texturaReklam() {
  return plochaTextura(2048, 128, (g, w, h) => {
    const panely = [['#dc2626', 'ATAK'], ['#1d4ed8', 'PBT'], ['#f8fafc', 'FC TÍM'], ['#facc15', 'DRES'], ['#16a34a', 'ŠPORT']];
    const sirka = w / (panely.length * 2);
    for (let i = 0; i < panely.length * 2; i++) {
      const [farba, text] = panely[i % panely.length];
      g.fillStyle = farba; g.fillRect(i * sirka, 0, sirka, h);
      g.fillStyle = farba === '#f8fafc' || farba === '#facc15' ? '#0f172a' : '#ffffff';
      g.font = '800 64px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, i * sirka + sirka / 2, h / 2);
    }
  });
}

// Pohľad na valec zvnútra zrkadlí texty — reklamy sa preto zrkadlia späť.
function texturaReklamZvnutra() {
  const t = texturaReklam();
  t.repeat.x = -1;
  return t;
}

// Skutočná 360° fotka štadióna (equirectangular, pomer 2:1): public/models/stadium-360.jpg. Ak súbor neexistuje, použije sa
// vyrobený štadión (vektorový, nižšie). Mierka sveta: 1 jednotka ≈ 0,55 m (súprava dres+trenírky ≈ 1,1 m = 2 jednotky);
// kamera je približne vo výške očí a dres visí v úrovni hrude nad trávnikom.
const panorama = { stav: 'nenacitana', tex: null };
function nacitajPanoramu(hotovo) {
  if (panorama.stav !== 'nenacitana') { hotovo(); return; }
  panorama.stav = 'nacitava';
  // fotka má 8192×4096 — pre grafické karty a mobily sa zmenší na 4096×2048 (aj tak ostrý pri našom zábere)
  new THREE.ImageLoader().load('/models/stadium-360.jpg', (img) => {
    const c = document.createElement('canvas');
    c.width = 4096; c.height = 2048;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    panorama.tex = t; panorama.stav = 'ok'; hotovo();
  }, undefined, () => { panorama.stav = 'chyba'; hotovo(); });
}

function nastavProstredie(scene, env, type) {
  env.typ = type;
  if (env.group) {
    scene.remove(env.group);
    env.group.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
    env.group = null;
  }
  const g = new THREE.Group();
  const Y = type === 'stadium' ? 0 : -2.0; // úroveň podlahy (štadión: skupina je posunutá a zväčšená nižšie)
  const plocha = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; return m; };
  const PODLAHA_Y = -2.0;

  if (type === 'stadium' && panorama.stav === 'ok') {
    // 360° fotka na veľkej gule okolo dresu; stred gule vo výške očí (≈1,7 m nad trávnikom ≈ 3,1 jednotky)
    const geo = new THREE.SphereGeometry(150, 96, 56);
    geo.scale(-1, 1, 1);
    const obloha = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: panorama.tex, toneMapped: false, depthWrite: false }));
    obloha.position.y = PODLAHA_Y + 3.1;
    obloha.rotation.y = Math.PI; // stred ihriska a hlavná tribúna za dresom pri pohľade spredu
    obloha.renderOrder = -10;
    g.add(obloha);
    // trávnik pod dresom: tmavozelený kruh s plynulým prechodom do fotky + tieň dresu
    const grad = plochaTextura(512, 512, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(47,115,52,1)'); gr.addColorStop(0.55, 'rgba(47,115,52,0.9)'); gr.addColorStop(1, 'rgba(47,115,52,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { // jemná štruktúra trávy
        const x = Math.random() * w, y = Math.random() * h;
        c.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
        c.fillRect(x, y, 2, 6);
      }
    });
    const trava = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ map: grad, transparent: true, roughness: 1, depthWrite: false }));
    trava.rotation.x = -Math.PI / 2; trava.position.y = PODLAHA_Y; trava.receiveShadow = true; trava.renderOrder = -5;
    g.add(trava);
    const tien = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.4 }));
    tien.rotation.x = -Math.PI / 2; tien.position.y = PODLAHA_Y + 0.01; tien.receiveShadow = true;
    g.add(tien);
    scene.add(g);
    env.group = g;
    return;
  }

  if (type === 'stadium') {
    // vyrobený štadión (záloha, kým nie je k dispozícii 360° fotka) — väčší, aby pomer k dresu zodpovedal skutočnosti
    g.position.y = PODLAHA_Y;
    g.scale.setScalar(3);
    nacitajPanoramu(() => { if (panorama.stav === 'ok' && env.typ === 'stadium') nastavProstredie(scene, env, 'stadium'); });
    // vonkajšia tráva + hracia plocha
    const trava = plocha(new THREE.CircleGeometry(14.5, 64), new THREE.MeshStandardMaterial({ color: 0x1f5c2a, roughness: 0.95 }), Y);
    trava.rotation.x = -Math.PI / 2; trava.receiveShadow = true; g.add(trava);
    const hriste = plocha(new THREE.PlaneGeometry(21, 13.6), new THREE.MeshStandardMaterial({ map: texturaHriska(), roughness: 0.9 }), Y + 0.004);
    hriste.rotation.x = -Math.PI / 2; hriste.receiveShadow = true; g.add(hriste);
    // reklamné pásy
    const reklamy = plocha(new THREE.CylinderGeometry(13.7, 13.7, 0.9, 96, 1, true), new THREE.MeshBasicMaterial({ map: texturaReklamZvnutra(), side: THREE.DoubleSide, color: 0xdddddd }), Y + 0.45);
    g.add(reklamy);
    // tribúny — dva sklony s divákmi
    const divaci = (rDole, rHore, vyska, y) => {
      const m = plocha(new THREE.CylinderGeometry(rHore, rDole, vyska, 96, 1, true), new THREE.MeshBasicMaterial({ map: texturaDivakov(), side: THREE.DoubleSide, color: 0xa8a8a8 }), y + vyska / 2);
      g.add(m);
    };
    divaci(14.1, 19, 5.2, Y + 0.9);
    // chodba medzi poschodiami
    const chodba = plocha(new THREE.CylinderGeometry(19.6, 19.1, 1.0, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b2438, side: THREE.DoubleSide, roughness: 0.9 }), Y + 6.6);
    g.add(chodba);
    divaci(19.6, 26, 6, Y + 7.1);
    // vonkajší múr a obloha
    const mur = plocha(new THREE.CylinderGeometry(26.3, 26.3, 16, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b1224, side: THREE.BackSide, roughness: 1 }), Y + 8);
    g.add(mur);
    // reflektory vo štyroch rohoch
    [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].forEach((uhol) => {
      const x = Math.cos(uhol) * 22, z = Math.sin(uhol) * 22;
      const stlp = plocha(new THREE.CylinderGeometry(0.18, 0.25, 16, 12), new THREE.MeshStandardMaterial({ color: 0x8a94a8 }), Y + 8);
      stlp.position.x = x; stlp.position.z = z; g.add(stlp);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.25), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
      panel.position.set(x, Y + 16.4, z); panel.lookAt(0, Y + 6, 0); g.add(panel);
      const luc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 24), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.18, depthWrite: false }));
      luc.position.set(x, Y + 16.4, z); luc.lookAt(0, Y + 6, 0); luc.translateZ(0.2); g.add(luc);
    });
  } else {
    // miestnosť (kocka): svetlá béžová alebo tmavomodro-čierna
    const svetla = type === 'light';
    const steny = new THREE.MeshStandardMaterial({ color: svetla ? 0xeadfca : 0x0b1228, roughness: 0.95, metalness: 0, side: THREE.BackSide });
    const kocka = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 16), steny);
    kocka.position.y = Y + 5; kocka.receiveShadow = true; g.add(kocka);
    const podlaha = plocha(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: svetla ? 0xd9cab0 : 0x060a18, roughness: svetla ? 0.9 : 0.6, metalness: svetla ? 0 : 0.25 }), Y + 0.01);
    podlaha.rotation.x = -Math.PI / 2; podlaha.receiveShadow = true; g.add(podlaha);
  }
  scene.add(g);
  env.group = g;
}

function aplikujOsvetlenie(scene, lightsRef, renderer, type) {
  const l = lightsRef.current;
  if (l.ambient) scene.remove(l.ambient);
  if (l.main) scene.remove(l.main);
  if (l.fill) scene.remove(l.fill);
  if (l.rim) scene.remove(l.rim);

  let ambient, main, fill, rim;
  if (type === 'light') {
    // svetlá béžová miestnosť — teplé, mäkké svetlo
    ambient = new THREE.AmbientLight(0xfff3e0, 1.15);
    main = new THREE.DirectionalLight(0xfff6e8, 1.3);
    fill = new THREE.DirectionalLight(0xffe9cc, 0.7);
    rim = new THREE.DirectionalLight(0xffffff, 0.5);
    renderer.setClearColor(0xe6dac4, 1);
  } else if (type === 'stadium') {
    // večerný štadión pod reflektormi
    ambient = new THREE.AmbientLight(0xdfe9ff, 0.8);
    main = new THREE.DirectionalLight(0xffffff, 2.1);
    fill = new THREE.DirectionalLight(0xfff1c8, 0.7);
    rim = new THREE.DirectionalLight(0xbcd4ff, 0.8);
    renderer.setClearColor(0x0a1530, 1);
  } else {
    // tmavomodrá až čierna miestnosť
    ambient = new THREE.AmbientLight(0x9fb0d8, 0.6);
    main = new THREE.DirectionalLight(0xffffff, 1.15);
    fill = new THREE.DirectionalLight(0x3b6fd8, 0.55);
    rim = new THREE.DirectionalLight(0x6d8be0, 0.6);
    renderer.setClearColor(0x04060e, 1);
  }

  main.position.set(3, 4, 4);
  main.castShadow = true;
  fill.position.set(-4, 2, -2);
  rim.position.set(0, 4, -4);

  scene.add(ambient, main, fill, rim);
  lightsRef.current = { ambient, main, fill, rim };
}

// Predoslé pokusy (poťahované valce, plochý strihový obrys, potom hotový T-shirt model bez UV
// s ručne dopočítanou projekciou) boli všetky nedostatočné — buď vyzerali hranato, alebo mali
// zle namapované rukávy (planárna projekcia z jedného spoločného bounding boxu na celý model
// nefunguje pre skutočne 3D tvarovaný odev). Tento model je skutočný CLO3D/Marvelous Designer
// strih (kúpený, licencia viď public/models/README.txt) s poriadnym, neprekrývajúcim sa UV
// rozvinutím — predný diel, zadný diel, rukávy a lemy sú samostatné strihové kusy so svojimi
// vlastnými UV súradnicami priamo v súbore. Preto sa UV vôbec nedopočítava ručne — len sa
// necháva tak, ako je, a naša plátnová textúra sa nakreslí do rovnakého rozloženia, aké malo
// pôvodné (referenčné) textúrové pozadie modelu (predok/zadok v ľavej/pravej polovici, rukávy
// dole, lemy v úzkom pruhu úplne dole) — pozri dresRenderer.js.
function vytvorDresGeometriu(scene, textureCanvas, jerseyMeshesRef, onLoaded, onProgress) {
  const canvasTexture = new THREE.CanvasTexture(textureCanvas);
  canvasTexture.anisotropy = 16;
  canvasTexture.generateMipmaps = true;
  canvasTexture.wrapS = THREE.RepeatWrapping;
  canvasTexture.wrapT = THREE.RepeatWrapping;
  // GLTFLoader nastavuje pre textúry z glTF súboru flipY=false (glTF konvencia počiatku UV
  // v ľavom hornom rohu) — no THREE.CanvasTexture má defaultne flipY=true (tradičná OpenGL
  // konvencia). Bez zosúladenia by sa naša plátnová textúra vzorkovala inak ako pôvodná
  // (referenčná) textúra modelu, čo pri zápornych/wrapovaných UV hodnotách tohto strihu
  // spôsobovalo vzorkovanie z nesprávnej/zrkadlenej časti plátna (skomolený text).
  canvasTexture.flipY = false;
  // Farebný priestor: plátno s farbami je sRGB. Bez tohto nastavenia three.js berie textúru ako lineárnu a farby dresu
  // vyzerajú vyblednuto/tmavo (trenírky mali sRGB nastavené hneď, dres nie — preto bol dres oproti nim fádny).
  canvasTexture.colorSpace = THREE.SRGBColorSpace;

  // Skutočná normálová mapa látky z kúpeného modelu (švy, rebrovanie manžiet/lemu) — dáva
  // jemný reliéf tkaniny namiesto úplne plochého povrchu. Nepoužíva sa aj priložená roughness
  // mapa výrobcu, tá má napečené presvitanie PÔVODNÉHO textu "PLAYER 11" z ich ukážky, čo by
  // pri inom mene/čísle vytváralo falošný "duch" starého textu.
  const normalTexture = new THREE.TextureLoader().load('/models/jersey-normal.png');
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.flipY = false;

  const jerseyMaterial = new THREE.MeshStandardMaterial({
    map: canvasTexture,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.6,
    metalness: 0.05,
    // FrontSide (nie DoubleSide) — vnútro dresu teraz kreslí samostatná biela "škrupina"
    // (pozri nižšie), takže tu netreba kresliť aj zadné strany trojuholníkov potlačou.
    side: THREE.FrontSide,
  });

  // Biele vnútro dresu — namiesto potlačenej textúry na zadných stranách tých istých
  // trojuholníkov (čo by pri modeli bez skutočnej hrúbky látky spôsobilo blikanie/z-fighting,
  // keďže vonkajšia aj vnútorná "vrstva" majú identickú geometriu). BackSide materiál sa
  // vykresľuje len na stranách odvrátených od kamery, takže sa s vonkajším FrontSide materiálom
  // nikdy neprekryje na tom istom pixli — vidno ho len cez skutočné otvory (golier, manžety, lem).
  const interiorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0,
    side: THREE.BackSide,
  });
  // Vnútro dresu je biele, na zadnom dielci pod krkom je veľkostný transfer (pozri kresliVnutroDresu).
  const vnutroCanvas = document.createElement('canvas');
  vnutroCanvas.width = 2048; vnutroCanvas.height = 2048;
  kresliVnutroDresu(vnutroCanvas, 'XL');
  const vnutroTextura = new THREE.CanvasTexture(vnutroCanvas);
  vnutroTextura.flipY = false;
  vnutroTextura.wrapS = THREE.RepeatWrapping; vnutroTextura.wrapT = THREE.RepeatWrapping;
  vnutroTextura.colorSpace = THREE.SRGBColorSpace;
  vnutroTextura.anisotropy = 8;
  interiorMaterial.map = vnutroTextura;
  // fonty (Inter) sa môžu dočítať až po vykreslení — plátno sa prekreslí, keď sú pripravené
  document.fonts?.ready?.then(() => { kresliVnutroDresu(vnutroCanvas, 'XL'); vnutroTextura.needsUpdate = true; });

  const loader = new GLTFLoader();
  loader.load(
    '/models/jersey-base.glb',
    (gltf) => {
      const root = gltf.scene;
      odstranDuplicitneVrstvy(root);
      const povodneMeshe = [];
      root.traverse((child) => { if (child.isMesh) povodneMeshe.push(child); });
      // Raycasting pri ťahaní loga (pozri hlavný useEffect vyššie) sa robí len proti týmto
      // pôvodným (vonkajším, potlačeným) meshom — nie aj proti bielym "vnútorným" duplikátom
      // pridaným nižšie, tie by pri pohľade cez otvor (golier/manžeta) mohli skresliť zásah.
      if (jerseyMeshesRef) jerseyMeshesRef.current = povodneMeshe;
      povodneMeshe.forEach((child) => {
        zuzPrazokNaKrku(child.geometry, 0.5);
        child.material = jerseyMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
        // Biela podšívka sa posunie ~3 mm dovnútra, aby cez ňu zvnútra (napr. v rukáve) neprerážali farebné
        // plochy susedných dielcov, ktoré sa v simulácii látky navzájom čiastočne pretínajú.
        if (jePrazokSitia(child.geometry)) return; // prúžok šitia (krk/spodok) je plný valec — nepotrebuje podšívku, bola by vidno ako druhý prúžok
        const vnutro = new THREE.Mesh(vytvorPodsivku(child.geometry, 0.28), interiorMaterial);
        vnutro.position.copy(child.position);
        vnutro.rotation.copy(child.rotation);
        vnutro.scale.copy(child.scale);
        child.parent.add(vnutro);
      });

      // Model prichádza vo vlastnej mierke/polohe (cm) — vycentrovanie a normalizácia na výšku ~2
      // jednotky robí nastavRozlozenie() v komponente (podľa zostavy dres / trenírky / komplet).
      const box = new THREE.Box3().setFromObject(root);
      scene.add(root);
      onLoaded?.(root, box);
    },
    (e) => onProgress?.(e),
    (err) => { console.error('Nepodarilo sa načítať 3D model dresu:', err); onProgress?.({ chyba: true }); },
  );

  return canvasTexture;
}

// Trenírky: skutočný CLO3D strih (public/models/shorts-base.glb, 1 MB) — už zbavený prešívania a vnútorných vrstiev (pozri
// tools/optimize-shorts-glb.mjs). Každý strihový kus sa zaradí do farebnej zóny (trenirkyRenderer.zonaKusu) a textúra sa
// maľuje z UV trojuholníkov zón. Textúra aj normálová mapa majú flipY=false ako pri dresi (konvencia glTF UV).
function vytvorTrenirky(scene, textureCanvas, onLoaded, onProgress) {
  const textura = new THREE.CanvasTexture(textureCanvas);
  textura.anisotropy = 16;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.flipY = false;
  textura.colorSpace = THREE.SRGBColorSpace;

  const normalTexture = new THREE.TextureLoader().load('/models/shorts-normal.png');
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.flipY = false;

  const material = new THREE.MeshStandardMaterial({
    map: textura,
    normalMap: normalTexture,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.FrontSide,
  });
  const interiorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.BackSide });

  new GLTFLoader().load(
    '/models/shorts-base.glb',
    (gltf) => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const meshe = [];
      root.traverse((child) => { if (child.isMesh) meshe.push(child); });
      const zaradene = meshe.map((mesh) => ({ mesh, zona: zonaKusu(new THREE.Box3().setFromObject(mesh)) }));
      // Pás (gumička) má farbu aj zvnútra — dvojstranný materiál s rovnakou textúrou namiesto bielej podšívky.
      const materialPas = material.clone();
      materialPas.side = THREE.DoubleSide;
      zaradene.forEach(({ mesh, zona }) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (zona === 'pas') { mesh.material = materialPas; return; }
        mesh.material = material;
        const vnutro = new THREE.Mesh(mesh.geometry, interiorMaterial);
        vnutro.position.copy(mesh.position);
        vnutro.rotation.copy(mesh.rotation);
        vnutro.scale.copy(mesh.scale);
        mesh.parent.add(vnutro);
      });
      const cesty = postavCestyZon(zaradene, textureCanvas.width, textureCanvas.height);
      const box = new THREE.Box3().setFromObject(root);
      scene.add(root);
      onLoaded?.(root, box, cesty, textura, vypocitajPanelyNoh(zaradene));
    },
    (e) => onProgress?.(e),
    (err) => { console.error('Nepodarilo sa načítať 3D model trenírok:', err); onProgress?.({ chyba: true }); },
  );
}

// Kópia geometrie posunutá o `posunCm` (cm v súradniciach modelu) proti normále, t. j. dovnútra odevu. Normály sa pred posunom
// spriemerujú podľa polohy vrcholu, inak by sa kópie vrcholov na hrane dielca posunuli rôznymi smermi a vznikli by zúbky.
// Lemovací prúžok na krku (kus s UV v pásiku golierKus2) je v modeli hrubý ~9 mm — zúži sa na ~4,5 mm. Vrcholy sa v rámci rovnakej
// pozície po dĺžke prúžku (rovnaké u) stiahnu k jeho stredu, takže prúžok sleduje výstrih a len sa zúži naprieč.
// Prúžky šitia v modeli: na krku (UV pásik golierKus2) a na spodku dresu (golierKus3).
function jePrazokSitia(geometry) {
  const uv = geometry.attributes.uv;
  if (!uv || uv.count < 1) return false;
  const u = uv.getX(0), v = uv.getY(0);
  return (u > 0.42 && u < 0.51 && v > -0.2 && v < -0.17) || (u > 0.38 && u < 0.47 && v > -0.12 && v < -0.09);
}

function zuzPrazokNaKrku(geometry, faktor) {
  const uv = geometry.attributes.uv, p = geometry.attributes.position;
  if (!uv || !p || uv.count < 1) return;
  const u0 = uv.getX(0), v0 = uv.getY(0);
  if (!(u0 > 0.42 && u0 < 0.51 && v0 > -0.2 && v0 < -0.17)) return;
  const kluc = (i) => Math.round(uv.getX(i) * 800);
  const sumy = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = kluc(i);
    const s = sumy.get(k) || [0, 0, 0, 0];
    s[0] += p.getX(i); s[1] += p.getY(i); s[2] += p.getZ(i); s[3]++;
    sumy.set(k, s);
  }
  for (let i = 0; i < p.count; i++) {
    const s = sumy.get(kluc(i));
    const cx = s[0] / s[3], cy = s[1] / s[3], cz = s[2] / s[3];
    p.setXYZ(i, cx + (p.getX(i) - cx) * faktor, cy + (p.getY(i) - cy) * faktor, cz + (p.getZ(i) - cz) * faktor);
  }
  p.needsUpdate = true;
}

function vytvorPodsivku(geometry, posunCm) {
  const g = geometry.clone();
  const p = g.attributes.position, nr = g.attributes.normal;
  if (!nr) return g;
  const kluc = (i) => `${Math.round(p.getX(i) * 500)}_${Math.round(p.getY(i) * 500)}_${Math.round(p.getZ(i) * 500)}`;
  const sumy = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = kluc(i);
    const s = sumy.get(k) || [0, 0, 0];
    s[0] += nr.getX(i); s[1] += nr.getY(i); s[2] += nr.getZ(i);
    sumy.set(k, s);
  }
  for (let i = 0; i < p.count; i++) {
    const s = sumy.get(kluc(i));
    const d = Math.hypot(s[0], s[1], s[2]) || 1;
    p.setXYZ(i, p.getX(i) - (s[0] / d) * posunCm, p.getY(i) - (s[1] / d) * posunCm, p.getZ(i) - (s[2] / d) * posunCm);
  }
  p.needsUpdate = true;
  return g;
}

// CLO3D exportuje látku ako "škrupinu" s hrúbkou — každý strihový kus (predok, zadok, rukáv...)
// je v súbore 3× (vonkajšia vrstva, vnútorná podšívka so zrkadlenými UV, spojovací bočný pásik),
// všetky na tej istej pozícii s tou istou UV bounding boxou. Bez odstránenia duplicít dochádza
// k z-fightingu (blikanie/roztrhnutá textúra podľa toho, ktorá z takmer zhodných vrstiev sa
// práve vykreslí) — vidno napr. ako "roztrhnutý"/zrkadlený text. Necháva sa len tá vrstva
// z každej skupiny, ktorej priemerná normála smeruje najviac VON zo stredu modelu (skutočný
// vonkajší, viditeľný povrch); zvyšné 1-2 takmer zhodné kópie sa zo scény odstránia.
function odstranDuplicitneVrstvy(root) {
  const meshes = [];
  root.traverse((child) => { if (child.isMesh) meshes.push(child); });
  if (meshes.length < 2) return;

  const overallCenter = new THREE.Vector3();
  let vertexTotal = 0;
  meshes.forEach((m) => {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      overallCenter.x += pos.getX(i);
      overallCenter.y += pos.getY(i);
      overallCenter.z += pos.getZ(i);
    }
    vertexTotal += pos.count;
  });
  overallCenter.divideScalar(Math.max(1, vertexTotal));

  const groups = new Map();
  meshes.forEach((m) => {
    const geo = m.geometry;
    const uv = geo.attributes.uv;
    if (!uv) return;
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (u < uMin) uMin = u; if (u > uMax) uMax = u;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
    const matName = m.material && m.material.name ? m.material.name : 'x';
    const key = `${matName}|${uMin.toFixed(2)}|${uMax.toFixed(2)}|${vMin.toFixed(2)}|${vMax.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  const outward = new THREE.Vector3();
  const normal = new THREE.Vector3();
  // Kusy s rovnakou textúrou aj UV môžu byť rôzne diely na rôznych miestach (napr. predná a zadná polovica prúžku šitia na spodku alebo na
  // krku, ľavý a pravý rukáv) — duplicitnými vrstvami sú len tie, ktoré ležia na tom istom mieste (stred do 1,5 cm).
  const stred = (m) => { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); return m.geometry.boundingBox.getCenter(new THREE.Vector3()); };
  const zhluky = [];
  groups.forEach((group) => {
    const kopie = [];
    group.forEach((m) => {
      const c = stred(m);
      const k = kopie.find((z) => z.c.distanceTo(c) < 1.5);
      if (k) k.m.push(m); else kopie.push({ c, m: [m] });
    });
    kopie.forEach((k) => zhluky.push(k.m));
  });
  zhluky.forEach((group) => {
    if (group.length < 2) return;
    let best = null, bestScore = -Infinity;
    group.forEach((m) => {
      const pos = m.geometry.attributes.position;
      const nrm = m.geometry.attributes.normal;
      const step = Math.max(1, Math.floor(pos.count / 500));
      let score = 0, sampled = 0;
      for (let i = 0; i < pos.count; i += step) {
        outward.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(overallCenter).normalize();
        normal.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
        score += outward.dot(normal);
        sampled++;
      }
      score /= Math.max(1, sampled);
      if (score > bestScore) { bestScore = score; best = m; }
    });
    group.forEach((m) => {
      if (m !== best && m.parent) m.parent.remove(m);
    });
  });
}
