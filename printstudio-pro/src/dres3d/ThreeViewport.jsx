import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Camera } from 'lucide-react';
import { updateJerseyTexture } from './dresRenderer';

// 3D náhľad dresu — vlastní celú Three.js scénu (kamera/svetlá/geometria/OrbitControls)
// a offscreen 2D canvas s textúrou. Portované z init3D/setupLighting/createJerseyModel/
// setViewAngle/captureSnapshotAndDownload v 3d_konfigurator_dresov.html, prepojené na React
// cez konfigState prop namiesto globálneho mutovateľného stavu.
const ThreeViewport = forwardRef(function ThreeViewport({ configState }, ref) {
  const containerRef = useRef(null);
  const textureCanvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const canvasTextureRef = useRef(null);
  const lightsRef = useRef({});
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

    const canvasTexture = vytvorDresGeometriu(scene, textureCanvasRef.current);
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

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prekreslenie textúry pri každej zmene konfigurácie
  useEffect(() => {
    const canvas = textureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !canvasTextureRef.current) return;
    updateJerseyTexture(ctx, canvas, configState);
    canvasTextureRef.current.needsUpdate = true;
  }, [configState]);

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

function remapJerseyUV(geometry, part) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (part === 'body') {
      uv.setXY(i, u, v);
    } else if (part === 'sleeveL') {
      uv.setXY(i, 0.05 + u * 0.2, 0.05 + v * 0.3);
    } else if (part === 'sleeveR') {
      uv.setXY(i, 0.75 + u * 0.2, 0.05 + v * 0.3);
    } else if (part === 'collar') {
      uv.setXY(i, 0.4 + u * 0.2, 0.02 + v * 0.1);
    }
  }
  uv.needsUpdate = true;
}

function vytvorDresGeometriu(scene, textureCanvas) {
  const canvasTexture = new THREE.CanvasTexture(textureCanvas);
  canvasTexture.anisotropy = 16;
  canvasTexture.generateMipmaps = true;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    for (let y = 0; y < 256; y += 4) {
      bCtx.fillStyle = ((x + y) % 8 === 0) ? '#909090' : '#707070';
      bCtx.fillRect(x, y, 2, 2);
    }
  }
  const fabricBumpTexture = new THREE.CanvasTexture(bumpCanvas);
  fabricBumpTexture.wrapS = THREE.RepeatWrapping;
  fabricBumpTexture.wrapT = THREE.RepeatWrapping;
  fabricBumpTexture.repeat.set(32, 32);

  const jerseyMaterial = new THREE.MeshStandardMaterial({
    map: canvasTexture,
    bumpMap: fabricBumpTexture,
    bumpScale: 0.008,
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const jerseyGroup = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.78, 0.72, 1.75, 48, 24, true);
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    z *= 0.68;
    if (y > 0.2) x *= (1.0 + (y - 0.2) * 0.32);
    pos.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();
  remapJerseyUV(bodyGeo, 'body');
  const jerseyMesh = new THREE.Mesh(bodyGeo, jerseyMaterial);
  jerseyMesh.castShadow = true;
  jerseyGroup.add(jerseyMesh);

  const sleeveGeoL = new THREE.CylinderGeometry(0.32, 0.28, 0.9, 32, 16, true);
  sleeveGeoL.rotateZ(Math.PI / 3.4);
  sleeveGeoL.translate(-0.95, 0.45, 0);
  remapJerseyUV(sleeveGeoL, 'sleeveL');
  const sleeveL = new THREE.Mesh(sleeveGeoL, jerseyMaterial);
  sleeveL.castShadow = true;
  jerseyGroup.add(sleeveL);

  const sleeveGeoR = new THREE.CylinderGeometry(0.32, 0.28, 0.9, 32, 16, true);
  sleeveGeoR.rotateZ(-Math.PI / 3.4);
  sleeveGeoR.translate(0.95, 0.45, 0);
  remapJerseyUV(sleeveGeoR, 'sleeveR');
  const sleeveR = new THREE.Mesh(sleeveGeoR, jerseyMaterial);
  sleeveR.castShadow = true;
  jerseyGroup.add(sleeveR);

  const collarGeo = new THREE.TorusGeometry(0.42, 0.045, 16, 48);
  collarGeo.rotateX(Math.PI / 2);
  collarGeo.scale(1, 1.2, 0.8);
  collarGeo.translate(0, 0.88, 0);
  remapJerseyUV(collarGeo, 'collar');
  const collar = new THREE.Mesh(collarGeo, jerseyMaterial);
  collar.castShadow = true;
  jerseyGroup.add(collar);

  jerseyGroup.position.set(0, -0.15, 0);
  scene.add(jerseyGroup);

  return canvasTexture;
}
