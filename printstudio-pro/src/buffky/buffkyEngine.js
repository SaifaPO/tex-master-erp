// Kresliaci a 3D nahladovy engine pre konfigurator buffiek (multifunkcnych tunelovych satok) —
// rovnaky vzor ako celenky/celenkyEngine.js. Kanonicky priestor kreslenia je uz v povodnom
// navrhu 1000x1000 (stvorec), co PRESNE zodpoveda rozlozenemu vyrobnemu formatu 50x50cm —
// na rozdiel od celeniek tu netreba menit pomer stran, staci zvacsit na 300 DPI pri exporte.
// Zakaznik nikdy nevidi ani nemoze stiahnut tlacovy subor v plnej kvalite — v editore vidi len
// nizkorozlisenu ukazku (960px), plnu kvalitu (300 DPI, 5906x5906px) vidi az admin po objednani.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CANON = 1000; // kanonicky priestor kreslenia — stvorec, zhodny s 50x50cm formatom

const ICON_UNICODE = {
  mountain: '',
  'person-running': '',
  'person-biking': '',
  compass: '',
  snowflake: '',
};

export function initBuffkyEngine(root) {
  const state = {
    backgroundColor: '#0f172a',
    pattern: 'mountain',
    showGuides: true,
    show3DSeams: true,
    autoRotate: true,
    items: [
      { type: 'text', text: 'TATRA MOUNTAINS', x: 250, y: 420, fontSize: 34, fontFamily: 'Montserrat', fontWeight: 'bold', color: '#ffffff', scale: 1, rotation: 0 },
      { type: 'text', text: 'EXPEDITION 2026', x: 250, y: 470, fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', color: '#38bdf8', scale: 1, rotation: 0 },
      { type: 'icon', unicode: ICON_UNICODE.mountain, iconName: 'mountain', x: 250, y: 330, fontSize: 74, color: '#38bdf8', scale: 1, rotation: 0 },
      { type: 'text', text: 'TRAIL RUNNER', x: 750, y: 450, fontSize: 38, fontFamily: 'Oswald', fontWeight: 'bold', color: '#f8fafc', scale: 1, rotation: 0 },
      { type: 'icon', unicode: ICON_UNICODE['person-running'], iconName: 'person-running', x: 750, y: 350, fontSize: 70, color: '#fb7185', scale: 1, rotation: 0 },
    ],
    selectedItemIndex: -1,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
  };

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));
  const cleanupFns = [];
  const on = (el, ev, fn, opts) => { if (!el) return; el.addEventListener(ev, fn, opts); cleanupFns.push(() => el.removeEventListener(ev, fn, opts)); };

  const canvas = q('#designCanvas');
  const ctx = canvas.getContext('2d');

  let scene, camera, renderer, controls, buffMesh, buffTexture, seamLine1, seamLine2;
  let rafId = null;
  const container3D = q('#threeContainer');

  function toast(text) {
    const box = q('#toastBox'), msg = q('#toastMsg');
    if (!box || !msg) return;
    msg.textContent = text;
    box.classList.remove('opacity-0', 'translate-y-12');
    box.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { box.classList.remove('opacity-100', 'translate-y-0'); box.classList.add('opacity-0', 'translate-y-12'); }, 3000);
  }

  /* ---------- 10 vzorov pozadia (identicke s povodnym navrhom) ---------- */
  function drawPattern(patternType, c, w, h) {
    if (patternType === 'mountain') {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f172a'); grad.addColorStop(0.5, '#1e293b'); grad.addColorStop(1, '#0284c7');
      c.fillStyle = grad; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(15, 23, 42, 0.7)';
      c.beginPath(); c.moveTo(0, h * 0.7); c.lineTo(w * 0.2, h * 0.45); c.lineTo(w * 0.4, h * 0.65); c.lineTo(w * 0.5, h * 0.52); c.lineTo(w * 0.75, h * 0.4); c.lineTo(w * 0.9, h * 0.6); c.lineTo(w, h * 0.5); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      c.fillStyle = 'rgba(2, 6, 23, 0.95)';
      c.beginPath(); c.moveTo(0, h * 0.85); c.lineTo(w * 0.25, h * 0.62); c.lineTo(w * 0.5, h * 0.78); c.lineTo(w * 0.7, h * 0.58); c.lineTo(w, h * 0.85); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 40; i++) { const sx = (i * 97) % w, sy = (i * 61) % (h * 0.45); c.beginPath(); c.arc(sx, sy, 2 + (i % 2), 0, Math.PI * 2); c.fill(); }
    } else if (patternType === 'camo') {
      c.fillStyle = '#263428'; c.fillRect(0, 0, w, h);
      const camoColors = ['#1d261e', '#3c4e3e', '#596954', '#818d78'];
      camoColors.forEach((color, idx) => {
        c.fillStyle = color;
        for (let i = 0; i < 18; i++) {
          const cx = (i * 123 + idx * 80) % w, cy = (i * 179 + idx * 110) % h, r = 50 + (i % 5) * 25;
          c.beginPath(); c.ellipse(cx, cy, r * 1.3, r * 0.7, i * 0.5, 0, Math.PI * 2); c.fill();
        }
      });
    } else if (patternType === 'geo') {
      const grad = c.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(1, '#312e81');
      c.fillStyle = grad; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(99, 102, 241, 0.25)'; c.lineWidth = 3;
      const step = 80;
      for (let x = -step; x <= w + step; x += step) for (let y = -step; y <= h + step; y += step) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + step, y + step); c.lineTo(x + step * 2, y); c.stroke(); }
    } else if (patternType === 'gradient') {
      const grad = c.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#06b6d4'); grad.addColorStop(0.5, '#6366f1'); grad.addColorStop(1, '#d946ef');
      c.fillStyle = grad; c.fillRect(0, 0, w, h);
    } else if (patternType === 'topomap') {
      const grad = c.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#091522'); grad.addColorStop(1, '#0f2b38');
      c.fillStyle = grad; c.fillRect(0, 0, w, h);
      c.lineWidth = 2.5;
      for (let ring = 1; ring <= 14; ring++) {
        c.strokeStyle = ring % 4 === 0 ? 'rgba(56, 189, 248, 0.65)' : 'rgba(56, 189, 248, 0.22)';
        c.beginPath();
        const baseRadius = ring * (w / 22.2);
        for (let deg = 0; deg <= 360; deg += 6) {
          const rad = (deg * Math.PI) / 180;
          const wave = Math.sin(rad * 4 + ring) * (w / 45) + Math.cos(rad * 2 - ring) * (w / 55);
          const r = baseRadius + wave;
          const x = w * 0.25 + Math.cos(rad) * r, y = h * 0.48 + Math.sin(rad) * r;
          if (deg === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        c.beginPath();
        for (let deg = 0; deg <= 360; deg += 6) {
          const rad = (deg * Math.PI) / 180;
          const wave = Math.sin(rad * 3 - ring) * (w / 42) + Math.cos(rad * 5) * (w / 71);
          const r = baseRadius + wave;
          const x = w * 0.75 + Math.cos(rad) * r, y = h * 0.52 + Math.sin(rad) * r;
          if (deg === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
    } else if (patternType === 'cyber_hex') {
      c.fillStyle = '#0b0f19'; c.fillRect(0, 0, w, h);
      const hexRadius = w / 26.3, dx = hexRadius * 1.5, dy = hexRadius * Math.sqrt(3);
      c.lineWidth = 1.5;
      for (let col = -1; col < w / dx + 2; col++) for (let row = -1; row < h / dy + 2; row++) {
        const cx = col * dx, cy = row * dy + (col % 2 ? dy / 2 : 0);
        const isGlow = (col * 17 + row * 29) % 11 === 0;
        c.strokeStyle = isGlow ? '#14b8a6' : 'rgba(30, 41, 59, 0.7)';
        c.fillStyle = isGlow ? 'rgba(20, 184, 166, 0.15)' : 'transparent';
        c.beginPath();
        for (let a = 0; a < 6; a++) { const angle = (Math.PI / 3) * a, hx = cx + hexRadius * Math.cos(angle), hy = cy + hexRadius * Math.sin(angle); if (a === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy); }
        c.closePath(); c.stroke(); if (isGlow) c.fill();
      }
    } else if (patternType === 'splash') {
      c.fillStyle = '#180d2b'; c.fillRect(0, 0, w, h);
      const strokes = [
        { x1: -0.05 * w, y1: 0.2 * h, x2: 0.6 * w, y2: 0.45 * h, color: 'rgba(236, 72, 153, 0.65)', width: w * 0.085 },
        { x1: 0.45 * w, y1: 0.15 * h, x2: 1.05 * w, y2: 0.5 * h, color: 'rgba(245, 158, 11, 0.6)', width: w * 0.095 },
        { x1: 0.05 * w, y1: 0.75 * h, x2: 0.95 * w, y2: 0.6 * h, color: 'rgba(14, 165, 233, 0.65)', width: w * 0.07 },
        { x1: 0.2 * w, y1: 0.1 * h, x2: 0.85 * w, y2: 0.85 * h, color: 'rgba(168, 85, 247, 0.5)', width: w * 0.055 },
      ];
      strokes.forEach(s => { c.strokeStyle = s.color; c.lineWidth = s.width; c.lineCap = 'round'; c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); });
      const colors = ['#f43f5e', '#fbbf24', '#38bdf8', '#c084fc', '#ffffff'];
      for (let i = 0; i < 180; i++) { const sx = (i * 137) % w, sy = (i * 223) % h, sr = 1.5 + (i % 7) * 2; c.fillStyle = colors[i % colors.length]; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill(); }
    } else if (patternType === 'speed_stripes') {
      const bgGrad = c.createLinearGradient(0, 0, w, 0);
      bgGrad.addColorStop(0, '#030712'); bgGrad.addColorStop(0.5, '#111827'); bgGrad.addColorStop(1, '#030712');
      c.fillStyle = bgGrad; c.fillRect(0, 0, w, h);
      const bands = [
        { y: 0.15 * h, h: 0.014 * h, col: '#f43f5e' }, { y: 0.175 * h, h: 0.032 * h, col: '#fb7185' }, { y: 0.22 * h, h: 0.008 * h, col: '#ffffff' },
        { y: 0.72 * h, h: 0.04 * h, col: '#e11d48' }, { y: 0.775 * h, h: 0.016 * h, col: '#f43f5e' }, { y: 0.805 * h, h: 0.008 * h, col: 'rgba(255,255,255,0.7)' },
      ];
      bands.forEach(b => { c.fillStyle = b.col; c.beginPath(); c.moveTo(0, b.y + 0.07 * h); c.lineTo(w, b.y - 0.07 * h); c.lineTo(w, b.y - 0.07 * h + b.h); c.lineTo(0, b.y + 0.07 * h + b.h); c.closePath(); c.fill(); });
      c.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let cIdx = 0; cIdx < 12; cIdx++) {
        const cx = cIdx * (w / 11.1) + 0.04 * w;
        c.beginPath(); c.moveTo(cx, 0.44 * h); c.lineTo(cx + 0.045 * w, 0.5 * h); c.lineTo(cx, 0.56 * h); c.lineTo(cx + 0.025 * w, 0.56 * h); c.lineTo(cx + 0.07 * w, 0.5 * h); c.lineTo(cx + 0.025 * w, 0.44 * h); c.closePath(); c.fill();
      }
    } else if (patternType === 'nordic_tri') {
      c.fillStyle = '#0f172a'; c.fillRect(0, 0, w, h);
      const palette = ['#082f49', '#0c4a6e', '#075985', '#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];
      const cols = 8, rows = 12, stepX = w / cols, stepY = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const x0 = i * stepX, y0 = j * stepY, x1 = (i + 1) * stepX, y1 = (j + 1) * stepY;
        const cIdx1 = (i * 3 + j * 5 + 2) % palette.length, cIdx2 = (i * 7 + j * 2 + 1) % palette.length;
        c.fillStyle = palette[cIdx1]; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x0, y1); c.closePath(); c.fill();
        c.fillStyle = palette[cIdx2]; c.beginPath(); c.moveTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x0, y1); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let p = 0; p < 50; p++) { const px = (p * 109) % w, py = (p * 83) % h; c.fillRect(px, py, 3, 3); }
    } else if (patternType === 'lava_smoke') {
      const lavaGrad = c.createLinearGradient(0, 0, 0, h);
      lavaGrad.addColorStop(0, '#0a0a0c'); lavaGrad.addColorStop(0.5, '#180a06'); lavaGrad.addColorStop(1, '#431407');
      c.fillStyle = lavaGrad; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ea580c'; c.lineWidth = w / 250; c.shadowColor = '#f97316'; c.shadowBlur = 12;
      const crackPaths = [
        [[0, 0.78 * h], [0.18 * w, 0.82 * h], [0.32 * w, 0.75 * h], [0.5 * w, 0.84 * h], [0.68 * w, 0.77 * h], [0.85 * w, 0.83 * h], [w, 0.79 * h]],
        [[0, 0.62 * h], [0.22 * w, 0.58 * h], [0.42 * w, 0.65 * h], [0.5 * w, 0.61 * h], [0.72 * w, 0.66 * h], [0.92 * w, 0.59 * h], [w, 0.64 * h]],
        [[0.12 * w, 0.3 * h], [0.25 * w, 0.37 * h], [0.45 * w, 0.32 * h], [0.5 * w, 0.38 * h], [0.65 * w, 0.34 * h], [0.82 * w, 0.41 * h], [0.95 * w, 0.36 * h]],
      ];
      crackPaths.forEach(pts => { c.beginPath(); pts.forEach((pt, idx) => { if (idx === 0) c.moveTo(pt[0], pt[1]); else c.lineTo(pt[0], pt[1]); }); c.stroke(); });
      c.shadowBlur = 0;
      for (let e = 0; e < 60; e++) { const ex = (e * 91) % w, ey = (e * 149) % h, er = (2 + (e % 3) * 1.5) * (w / 1000); c.fillStyle = e % 2 === 0 ? '#f97316' : '#facc15'; c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fill(); }
    }
  }

  function render2D() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.pattern !== 'none') drawPattern(state.pattern, ctx, canvas.width, canvas.height);

    const sc = canvas.width / CANON;
    state.items.forEach((item, index) => {
      ctx.save();
      ctx.translate(item.x * sc, item.y * sc);
      ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
      ctx.scale((item.scale || 1) * sc, (item.scale || 1) * sc);

      if (item.type === 'text') {
        ctx.font = `${item.fontWeight || 'bold'} ${item.fontSize}px "${item.fontFamily}", sans-serif`;
        ctx.fillStyle = item.color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
        ctx.fillText(item.text, 0, 0);
        const metrics = ctx.measureText(item.text);
        item.width = metrics.width / sc; item.height = item.fontSize;
      } else if (item.type === 'image' && item.imgElement) {
        const iw = item.width, ih = item.height;
        ctx.drawImage(item.imgElement, -iw / 2, -ih / 2, iw, ih);
      } else if (item.type === 'icon') {
        ctx.font = `900 ${item.fontSize}px "Font Awesome 6 Free"`;
        ctx.fillStyle = item.color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
        ctx.fillText(item.unicode, 0, 0);
        item.width = item.fontSize; item.height = item.fontSize;
      }

      if (index === state.selectedItemIndex) {
        ctx.restore(); ctx.save();
        ctx.translate(item.x * sc, item.y * sc);
        ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        const boundW = ((item.width || 100) * (item.scale || 1) + 20) * sc;
        const boundH = ((item.height || 40) * (item.scale || 1) + 20) * sc;
        ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.strokeRect(-boundW / 2, -boundH / 2, boundW, boundH);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-boundW / 2 - 4, -boundH / 2 - 4, 8, 8);
        ctx.fillRect(boundW / 2 - 4, -boundH / 2 - 4, 8, 8);
        ctx.fillRect(-boundW / 2 - 4, boundH / 2 - 4, 8, 8);
        ctx.fillRect(boundW / 2 - 4, boundH / 2 - 4, 8, 8);
      }
      ctx.restore();
    });

    if (buffTexture) buffTexture.needsUpdate = true;
  }

  /* ---------- THREE.JS 3D nahlad ---------- */
  function initThreeScene() {
    scene = new THREE.Scene();
    const aspect = container3D.clientWidth / container3D.clientHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.set(0, 5, 26);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container3D.clientWidth, container3D.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container3D.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.minDistance = 14; controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * 0.85; controls.minPolarAngle = Math.PI * 0.15;
    controls.autoRotate = state.autoRotate; controls.autoRotateSpeed = 2.0;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.9));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.55); keyLight.position.set(12, 18, 15); scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xf8fafc, 0.35); fillLight.position.set(-12, 8, 10); scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.25); backLight.position.set(0, 6, -15); scene.add(backLight);

    const radius = 4.2, height = 11.5;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 72, 40, true);
    geometry.rotateY(-Math.PI / 2);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const angle = Math.atan2(z, x);
      const fold = Math.sin(y * 1.5 + angle * 2) * 0.12 + Math.cos(angle * 4) * 0.08;
      const radiusModifier = 1.0 - 0.04 * Math.cos((y / height) * Math.PI) + fold * 0.5;
      pos.setX(i, x * radiusModifier); pos.setZ(i, z * radiusModifier);
    }
    geometry.computeVertexNormals();

    buffTexture = new THREE.CanvasTexture(canvas);
    buffTexture.wrapS = THREE.RepeatWrapping;
    buffTexture.wrapT = THREE.ClampToEdgeWrapping;
    buffTexture.flipY = true;

    const material = new THREE.MeshStandardMaterial({ map: buffTexture, roughness: 0.98, metalness: 0.0, side: THREE.DoubleSide });
    buffMesh = new THREE.Mesh(geometry, material);
    scene.add(buffMesh);

    createSeamIndicators(radius, height);

    const shadowGeo = new THREE.PlaneGeometry(30, 30);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = -height / 2 - 0.5;
    scene.add(shadowPlane);

    on(window, 'resize', onWindowResize);
    rafId = requestAnimationFrame(animateThree);
  }

  function createSeamIndicators(radius, height) {
    const seamGeo = new THREE.CylinderGeometry(0.04, 0.04, height * 1.02, 16);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    seamLine1 = new THREE.Mesh(seamGeo, seamMat); seamLine1.position.set(radius * 1.01, 0, 0); buffMesh.add(seamLine1);
    seamLine2 = new THREE.Mesh(seamGeo, seamMat); seamLine2.position.set(-radius * 1.01, 0, 0); buffMesh.add(seamLine2);
    addSeamBadge('SPOJ', radius * 1.02, height * 0.45);
    addSeamBadge('SPOJ', -radius * 1.02, height * 0.45);
  }

  function addSeamBadge(text, x, y) {
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 128; badgeCanvas.height = 48;
    const bCtx = badgeCanvas.getContext('2d');
    bCtx.fillStyle = '#f43f5e';
    bCtx.beginPath();
    bCtx.roundRect ? bCtx.roundRect(0, 0, 128, 48, 12) : bCtx.rect(0, 0, 128, 48);
    bCtx.fill();
    bCtx.fillStyle = '#ffffff'; bCtx.font = 'bold 22px sans-serif'; bCtx.textAlign = 'center'; bCtx.textBaseline = 'middle';
    bCtx.fillText(text, 64, 24);
    const bTex = new THREE.CanvasTexture(badgeCanvas);
    const bMat = new THREE.SpriteMaterial({ map: bTex, depthTest: false });
    const sprite = new THREE.Sprite(bMat);
    sprite.position.set(x * 1.12, y, 0);
    sprite.scale.set(1.4, 0.55, 1);
    buffMesh.add(sprite);
  }

  function onWindowResize() {
    if (!container3D || !renderer || !camera) return;
    const width = container3D.clientWidth, height = container3D.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animateThree() {
    rafId = requestAnimationFrame(animateThree);
    controls.update();
    renderer.render(scene, camera);
  }

  /* ---------- 2D drag interakcia (len presun, ako v povodnom navrhu) ---------- */
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANON / rect.width, scaleY = CANON / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function onCanvasDown(e) {
    const { x, y } = getCanvasCoords(e);
    let clickedIndex = -1;
    for (let i = state.items.length - 1; i >= 0; i--) {
      const item = state.items[i];
      const halfW = ((item.width || 80) * (item.scale || 1)) / 2 + 10;
      const halfH = ((item.height || 40) * (item.scale || 1)) / 2 + 10;
      if (x >= item.x - halfW && x <= item.x + halfW && y >= item.y - halfH && y <= item.y + halfH) {
        clickedIndex = i; state.dragOffsetX = x - item.x; state.dragOffsetY = y - item.y; break;
      }
    }
    state.selectedItemIndex = clickedIndex;
    state.isDragging = clickedIndex !== -1;
    updateSelectedLabel();
    render2D();
  }

  function onCanvasMove(e) {
    if (!state.isDragging || state.selectedItemIndex === -1) return;
    const { x, y } = getCanvasCoords(e);
    const item = state.items[state.selectedItemIndex];
    item.x = Math.max(20, Math.min(CANON - 20, x - state.dragOffsetX));
    item.y = Math.max(20, Math.min(CANON - 20, y - state.dragOffsetY));
    render2D();
  }

  function onCanvasUp() { state.isDragging = false; }

  function updateSelectedLabel() {
    const label = q('#selectedItemLabel');
    if (!label) return;
    if (state.selectedItemIndex === -1) {
      label.textContent = 'Žiadny vybratý';
      label.className = 'font-bold text-slate-500';
    } else {
      const item = state.items[state.selectedItemIndex];
      const side = item.x < 500 ? 'Predná (A)' : 'Zadná (B)';
      label.textContent = `${item.type.toUpperCase()}: ${item.text || 'Grafika'} [${side}]`;
      label.className = 'font-bold text-cyan-400';
    }
  }

  /* ---------- UI ovladacie prvky ---------- */
  function setupControls() {
    qa('#toolTabs .tab-btn').forEach(btn => on(btn, 'click', () => {
      qa('#toolTabs .tab-btn').forEach(b => { b.classList.remove('bg-cyan-600', 'text-white'); b.classList.add('text-slate-400'); });
      btn.classList.add('bg-cyan-600', 'text-white'); btn.classList.remove('text-slate-400');
      const tabName = btn.dataset.tab;
      qa('.tab-content').forEach(c => c.classList.add('hidden'));
      q(`#tabContent-${tabName}`).classList.remove('hidden');
    }));

    const bgColorPicker = q('#bgColorPicker');
    on(bgColorPicker, 'input', (e) => { state.backgroundColor = e.target.value; state.pattern = 'none'; render2D(); });

    qa('.quick-color').forEach(btn => on(btn, 'click', () => {
      state.backgroundColor = btn.dataset.color; bgColorPicker.value = btn.dataset.color; state.pattern = 'none';
      render2D(); toast('Farba podkladu nastavená');
    }));

    qa('.pattern-btn').forEach(btn => on(btn, 'click', () => {
      state.pattern = btn.dataset.pattern; render2D(); toast(`Aplikovaný motív: ${btn.textContent.trim()}`);
    }));

    const textInput = q('#textInput'), fontSelect = q('#fontSelect'), textColorPicker = q('#textColorPicker');
    on(q('#btnAddTextFront'), 'click', () => {
      const txt = textInput.value.trim() || 'BUFFKA ADVENTURE';
      state.items.push({ type: 'text', text: txt, x: 250, y: 500, fontSize: 48, fontFamily: fontSelect.value, fontWeight: 'bold', color: textColorPicker.value, scale: 1, rotation: 0 });
      state.selectedItemIndex = state.items.length - 1; updateSelectedLabel(); render2D(); toast('Text pridaný na Prednú stranu (A)');
    });
    on(q('#btnAddTextBack'), 'click', () => {
      const txt = textInput.value.trim() || 'SLOVAKIA OUTDOOR';
      state.items.push({ type: 'text', text: txt, x: 750, y: 500, fontSize: 48, fontFamily: fontSelect.value, fontWeight: 'bold', color: textColorPicker.value, scale: 1, rotation: 0 });
      state.selectedItemIndex = state.items.length - 1; updateSelectedLabel(); render2D(); toast('Text pridaný na Zadnú stranu (B)');
    });

    qa('.add-icon-btn').forEach(btn => on(btn, 'click', () => {
      const iconKey = btn.dataset.icon;
      state.items.push({ type: 'icon', unicode: ICON_UNICODE[iconKey], iconName: iconKey, x: 250, y: 350, fontSize: 70, color: '#38bdf8', scale: 1, rotation: 0 });
      state.selectedItemIndex = state.items.length - 1; updateSelectedLabel(); render2D(); toast('Ikona vložená do návrhu');
    }));

    on(q('#imageUpload'), 'change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const maxDim = 260;
          if (w > maxDim || h > maxDim) { if (w > h) { h = (h / w) * maxDim; w = maxDim; } else { w = (w / h) * maxDim; h = maxDim; } }
          state.items.push({ type: 'image', imgElement: img, width: w, height: h, x: 250, y: 500, scale: 1, rotation: 0 });
          state.selectedItemIndex = state.items.length - 1; updateSelectedLabel(); render2D(); toast('Logo bolo úspešne nahraté');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    on(q('#btnLayerUp'), 'click', () => {
      const idx = state.selectedItemIndex;
      if (idx !== -1 && idx < state.items.length - 1) { const t = state.items[idx]; state.items[idx] = state.items[idx + 1]; state.items[idx + 1] = t; state.selectedItemIndex = idx + 1; render2D(); }
    });
    on(q('#btnLayerDown'), 'click', () => {
      const idx = state.selectedItemIndex;
      if (idx > 0) { const t = state.items[idx]; state.items[idx] = state.items[idx - 1]; state.items[idx - 1] = t; state.selectedItemIndex = idx - 1; render2D(); }
    });
    on(q('#btnDuplicate'), 'click', () => {
      const idx = state.selectedItemIndex;
      if (idx !== -1) {
        const { imgElement, ...rest } = state.items[idx];
        const copy = JSON.parse(JSON.stringify(rest));
        if (imgElement) copy.imgElement = imgElement;
        copy.x = Math.min(CANON - 50, copy.x + 30); copy.y = Math.min(CANON - 50, copy.y + 30);
        state.items.push(copy); state.selectedItemIndex = state.items.length - 1; render2D(); toast('Prvok bol duplikovaný');
      }
    });
    on(q('#btnDeleteSelected'), 'click', () => {
      const idx = state.selectedItemIndex;
      if (idx !== -1) { state.items.splice(idx, 1); state.selectedItemIndex = -1; updateSelectedLabel(); render2D(); toast('Prvok bol odstránený'); }
    });

    on(q('#btnClearCanvas'), 'click', () => {
      state.items = []; state.selectedItemIndex = -1; state.pattern = 'none';
      updateSelectedLabel(); render2D(); toast('Návrh bol vyčistený');
    });

    const toggleGuidesBtn = q('#toggleGuidesBtn'), guidesOverlay = q('#guidesOverlay');
    on(toggleGuidesBtn, 'click', () => {
      state.showGuides = !state.showGuides;
      guidesOverlay.style.opacity = state.showGuides ? '1' : '0';
      toggleGuidesBtn.classList.toggle('text-rose-400', state.showGuides);
      toast(state.showGuides ? 'Línie spojov zapnuté' : 'Línie spojov skryté');
    });

    const btnToggleRotate = q('#btnToggleRotate');
    on(btnToggleRotate, 'click', () => {
      state.autoRotate = !state.autoRotate; controls.autoRotate = state.autoRotate;
      btnToggleRotate.classList.toggle('text-cyan-400', state.autoRotate);
      btnToggleRotate.classList.toggle('text-slate-500', !state.autoRotate);
    });

    const btnToggle3DSeams = q('#btnToggle3DSeams');
    on(btnToggle3DSeams, 'click', () => {
      state.show3DSeams = !state.show3DSeams;
      seamLine1.visible = state.show3DSeams; seamLine2.visible = state.show3DSeams;
      btnToggle3DSeams.classList.toggle('text-rose-400', state.show3DSeams);
      btnToggle3DSeams.classList.toggle('text-slate-500', !state.show3DSeams);
      toast(state.show3DSeams ? '3D Spoj zobrazený' : '3D Spoj skrytý');
    });

    on(q('#btnResetView'), 'click', () => { controls.reset(); camera.position.set(0, 5, 26); });

    qa('.cam-preset-btn').forEach(btn => on(btn, 'click', () => {
      controls.autoRotate = false; state.autoRotate = false;
      btnToggleRotate.classList.remove('text-cyan-400'); btnToggleRotate.classList.add('text-slate-500');
      const deg = parseFloat(btn.dataset.angle), rad = (deg * Math.PI) / 180, dist = 26;
      camera.position.set(Math.sin(rad) * dist, 4, Math.cos(rad) * dist);
      controls.target.set(0, 0, 0); controls.update();
    }));

    on(canvas, 'mousedown', onCanvasDown);
    on(window, 'mousemove', onCanvasMove);
    on(window, 'mouseup', onCanvasUp);
    on(canvas, 'touchstart', (e) => { if (e.touches.length === 1) onCanvasDown(e); }, { passive: true });
    on(canvas, 'touchmove', (e) => { if (e.touches.length === 1 && state.isDragging) { onCanvasMove(e); } }, { passive: true });
    on(canvas, 'touchend', onCanvasUp);
  }

  /* ---------- Bootstrap ---------- */
  initThreeScene();
  setupControls();
  render2D();
  updateSelectedLabel();

  /* ---------- Verejne API pre React komponent ---------- */
  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      cleanupFns.forEach(fn => fn());
      if (controls) controls.dispose();
      if (renderer) { renderer.dispose(); renderer.domElement?.remove(); }
    },
    hasContent() { return state.items.length > 0; },
    getLowResPreviewDataUrl() { return canvas.toDataURL('image/png'); },
    getDesignJson() {
      return JSON.stringify({
        backgroundColor: state.backgroundColor,
        pattern: state.pattern,
        items: state.items.map(({ imgElement, ...rest }) => rest), // obrazky (logo) nie su JSON-serializovatelne
      });
    },
    // Tlacovy (produkcny) render — 300 DPI pri 50x50cm = 5906x5906 px. NIKDY sa nevystavuje
    // zakaznikovi (ziadne <a download>/verejna URL) — vraca sa len ako Blob priamo volajucemu.
    async getProductionBlob() {
      const PROD = 5906;
      const prod = document.createElement('canvas');
      prod.width = PROD; prod.height = PROD;
      const pctx = prod.getContext('2d');
      const savedSelected = state.selectedItemIndex;
      state.selectedItemIndex = -1;

      pctx.fillStyle = state.backgroundColor;
      pctx.fillRect(0, 0, PROD, PROD);
      if (state.pattern !== 'none') drawPattern(state.pattern, pctx, PROD, PROD);
      const sc = PROD / CANON;
      state.items.forEach((item) => {
        pctx.save();
        pctx.translate(item.x * sc, item.y * sc);
        pctx.rotate(((item.rotation || 0) * Math.PI) / 180);
        pctx.scale((item.scale || 1) * sc, (item.scale || 1) * sc);
        if (item.type === 'text') {
          pctx.font = `${item.fontWeight || 'bold'} ${item.fontSize}px "${item.fontFamily}", sans-serif`;
          pctx.fillStyle = item.color; pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
          pctx.fillText(item.text, 0, 0);
        } else if (item.type === 'image' && item.imgElement) {
          pctx.drawImage(item.imgElement, -item.width / 2, -item.height / 2, item.width, item.height);
        } else if (item.type === 'icon') {
          pctx.font = `900 ${item.fontSize}px "Font Awesome 6 Free"`;
          pctx.fillStyle = item.color; pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
          pctx.fillText(item.unicode, 0, 0);
        }
        pctx.restore();
      });

      state.selectedItemIndex = savedSelected;
      return await new Promise((resolve) => prod.toBlob(resolve, 'image/png'));
    },
  };
}
