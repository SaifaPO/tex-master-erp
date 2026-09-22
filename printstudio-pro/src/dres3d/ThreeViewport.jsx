import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCcw, Camera } from 'lucide-react';
import { updateJerseyTexture, logaVyrobcuReady, orezOffset } from './dresRenderer';

// 3D náhľad dresu — vlastní celú Three.js scénu (kamera/svetlá/geometria/OrbitControls)
// a offscreen 2D canvas s textúrou. Portované z init3D/setupLighting/createJerseyModel/
// setViewAngle/captureSnapshotAndDownload v 3d_konfigurator_dresov.html, prepojené na React
// cez konfigState prop namiesto globálneho mutovateľného stavu.
const ThreeViewport = forwardRef(function ThreeViewport({ configState, onDragLogo }, ref) {
  const containerRef = useRef(null);
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
  const configStateRef = useRef(configState);
  configStateRef.current = configState;
  const onDragLogoRef = useRef(onDragLogo);
  onDragLogoRef.current = onDragLogo;
  const [svetlo, setSvetlo] = useState('dark');
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

  // Inicializácia scény — raz pri mounte
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
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
    scene.add(floor);

    const canvasTexture = vytvorDresGeometriu(scene, textureCanvasRef.current, jerseyMeshesRef);
    canvasTextureRef.current = canvasTexture;

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
      return { px: hits[0].uv.x * canvas.width, py: hits[0].uv.y * canvas.height };
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
    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const bod = bodNaTexture(e.clientX, e.clientY);
      if (!bod) return;
      const region = najdiRegion(bod.px, bod.py);
      if (!region) return;
      draggingRef.current = {
        dragId: region.dragId,
        panelW: region.panelW,
        panelH: region.panelH,
        startPx: bod,
        startOffset: ziskajAktualnyOffset(region.dragId),
      };
      controls.enabled = false;
    };
    const onPointerMove = (e) => {
      const drag = draggingRef.current;
      if (!drag) return;
      const bod = bodNaTexture(e.clientX, e.clientY);
      if (!bod) return;
      const deltaFracX = (bod.px - drag.startPx.px) / drag.panelW;
      const deltaFracY = (bod.py - drag.startPx.py) / drag.panelH;
      const novyX = orezOffset(drag.startOffset.x + deltaFracX);
      const novyY = orezOffset(drag.startOffset.y + deltaFracY);
      onDragLogoRef.current?.(drag.dragId, novyX, novyY);
    };
    const onPointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
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

  useEffect(() => {
    if (sceneRef.current && rendererRef.current) aplikujOsvetlenie(sceneRef.current, lightsRef, rendererRef.current, svetlo);
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
    <div className="relative flex-1 h-[42vh] sm:h-[50vh] lg:h-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-hidden flex items-center justify-center rounded-2xl">
      <canvas ref={textureCanvasRef} width={2048} height={2048} className="hidden" />
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-md">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
          <span>360° 3D Náhľad</span>
        </div>
        <div className="pointer-events-auto flex gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-md">
          {[{ id: 'dark', icon: '🌙' }, { id: 'light', icon: '☀️' }, { id: 'stadium', icon: '🏟️' }].map(o => (
            <button key={o.id} onClick={() => setSvetlo(o.id)} className={`p-1.5 rounded-lg text-xs ${svetlo === o.id ? 'bg-slate-800 text-indigo-400 font-medium' : 'text-slate-400 hover:text-white'}`}>{o.icon}</button>
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

function aplikujOsvetlenie(scene, lightsRef, renderer, type) {
  const l = lightsRef.current;
  if (l.ambient) scene.remove(l.ambient);
  if (l.main) scene.remove(l.main);
  if (l.fill) scene.remove(l.fill);
  if (l.rim) scene.remove(l.rim);

  let ambient, main, fill, rim;
  if (type === 'light') {
    ambient = new THREE.AmbientLight(0xffffff, 0.9);
    main = new THREE.DirectionalLight(0xffffff, 1.2);
    fill = new THREE.DirectionalLight(0xe2e8f0, 0.8);
    rim = new THREE.DirectionalLight(0x38bdf8, 0.6);
    renderer.setClearColor(0x1e293b, 1);
  } else if (type === 'stadium') {
    ambient = new THREE.AmbientLight(0x38bdf8, 0.6);
    main = new THREE.DirectionalLight(0xffffff, 1.8);
    fill = new THREE.DirectionalLight(0x22c55e, 0.7);
    rim = new THREE.DirectionalLight(0xec4899, 1.0);
    renderer.setClearColor(0x020617, 1);
  } else {
    ambient = new THREE.AmbientLight(0xffffff, 0.75);
    main = new THREE.DirectionalLight(0xffffff, 1.3);
    fill = new THREE.DirectionalLight(0x94a3b8, 0.6);
    rim = new THREE.DirectionalLight(0x22c55e, 0.5);
    renderer.setClearColor(0x070d18, 1);
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
function vytvorDresGeometriu(scene, textureCanvas, jerseyMeshesRef) {
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
        child.material = jerseyMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
        const vnutro = new THREE.Mesh(child.geometry, interiorMaterial);
        vnutro.position.copy(child.position);
        vnutro.rotation.copy(child.rotation);
        vnutro.scale.copy(child.scale);
        child.parent.add(vnutro);
      });

      // Model prichádza vo vlastnej mierke/polohe — vycentrovanie a normalizácia na výšku ~2
      // jednotky (rovnaký rád veľkosti, aký očakáva kamera/OrbitControls nastavené nižšie).
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.1 / Math.max(size.x, size.y, size.z);
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -center.y * scale - 0.15, -center.z * scale);
      scene.add(root);
    },
    undefined,
    (err) => console.error('Nepodarilo sa načítať 3D model dresu:', err),
  );

  return canvasTexture;
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
  groups.forEach((group) => {
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
