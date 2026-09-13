// Kresliaci a 3D nahladovy engine pre konfigurator celeniek — povodne postaveny (Gemini)
// ako samostatna HTML stranka, tu upraveny na modul pouzitelny z React komponentu (Celenky.jsx):
//   - vsetky lookupy su naviazane na `root` element (nie globalny document), aby sa dalo
//     bezpecne pripojit/odpojit v ramci React zivotneho cyklu,
//   - kanonicky priestor kreslenia zmeneny z 960x180 (48:9) na 1020x180 (51:9), aby sedel
//     PRESNE s realnym vyrobnym formatom — inak by sa text/logo pri exporte anizotropicky
//     natiahli oproti tomu, co zakaznik vidi v nahlade,
//     a exportny (tlacovy) render je 300 DPI pri 51x9cm = presne 6024x1063 px,
//   - odstranene tlacidlo/moznost stiahnut tlacovy subor — zakaznik vidi LEN nizkorozlisenu
//     ukazku v editore (960px sirka na obrazovke), plnu kvalitu vidi az admin po objednani,
//   - "Do kosika"/cart modal (fake Shopify) odstranene — objednavaciu logiku (cena, DPH, odoslanie)
//     rieši React komponent Celenky.jsx, engine len kresli a hlasi hotovy navrh cez verejne API.
import * as THREE from 'three';

const CANON_W = 1020; // kanonicky priestor kreslenia — 51:9 pomer strán (51/9 * 180 = 1020)
const CANON_H = 180;
const CENTER_X = CANON_W / 2; // 510 — stred cela

export function initCelenkyEngine(root) {
  const STATE = {
    bgColor: '#0f172a',
    bgPattern: 'solid',
    showBleed: true,
    selectedId: 'elem_text_1',
    autoRotate: true,
    elements: [
      { id: 'elem_text_1', type: 'text', text: 'PUSH YOUR LIMITS', x: CENTER_X, y: 90, font: 'Bebas Neue', size: 64, scale: 1, rotation: 0, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, bold: false, italic: false },
    ],
  };

  let editorCanvas, ctx2d;
  let textureCanvas, textureCtx;
  let threeScene, threeCamera, threeRenderer, headbandGroup, canvasTexture;
  let targetRotationY = 0;
  let currentRotationY = 0;
  let isUserInteracting3D = false;
  let previousMouseX = 0;
  let rafId = null;
  const cleanupFns = [];
  const on = (el, ev, fn, opts) => { if (!el) return; el.addEventListener(ev, fn, opts); cleanupFns.push(() => el.removeEventListener(ev, fn, opts)); };
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));

  function toast(text) {
    const box = q('#toastBox');
    const msg = q('#toastMsg');
    if (!box || !msg) return;
    msg.innerText = text;
    box.classList.remove('translate-y-16', 'opacity-0');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => box.classList.add('translate-y-16', 'opacity-0'), 2200);
  }

  /* ---------- 2D ARTWORK RENDERING (kreslene v kanonickom priestore CANON_W x CANON_H) ---------- */
  function drawHeadbandArtwork(ctx, w, h) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const sx = w / CANON_W, sy = h / CANON_H;
    ctx.scale(sx, sy);

    if (STATE.bgPattern === 'solid') {
      ctx.fillStyle = STATE.bgColor;
      ctx.fillRect(0, 0, CANON_W, CANON_H);
    } else if (STATE.bgPattern === 'gradient-neon') {
      const grad = ctx.createLinearGradient(0, 0, CANON_W, 0);
      grad.addColorStop(0, '#4338ca'); grad.addColorStop(0.5, '#ec4899'); grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANON_W, CANON_H);
    } else if (STATE.bgPattern === 'gradient-fire') {
      const grad = ctx.createLinearGradient(0, 0, CANON_W, 0);
      grad.addColorStop(0, '#09090b'); grad.addColorStop(0.3, '#dc2626'); grad.addColorStop(0.7, '#f59e0b'); grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANON_W, CANON_H);
    } else if (STATE.bgPattern === 'gradient-trail') {
      const grad = ctx.createLinearGradient(0, 0, CANON_W, 0);
      grad.addColorStop(0, '#059669'); grad.addColorStop(0.5, '#0f766e'); grad.addColorStop(1, '#022c22');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, CANON_W, CANON_H);
    } else if (STATE.bgPattern.startsWith('template-')) {
      drawStockTemplatePattern(ctx, CANON_W, CANON_H, STATE.bgPattern);
    }

    STATE.elements.forEach(el => {
      ctx.save();
      if (el.type === 'stripes') {
        ctx.fillStyle = el.colorTop; ctx.fillRect(0, CANON_H * el.topY, CANON_W, el.height);
        ctx.fillStyle = el.colorBottom; ctx.fillRect(0, CANON_H * el.bottomY, CANON_W, el.height);
      } else {
        ctx.translate(el.x, el.y);
        ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
        const sc = el.scale || 1;
        ctx.scale(sc, sc);

        if (el.type === 'flag') {
          const stripeW = 18;
          ctx.rotate((-15 * Math.PI) / 180);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(-stripeW * 1.5, -180, stripeW, 360);
          ctx.fillStyle = '#2563eb'; ctx.fillRect(-stripeW * 0.5, -180, stripeW, 360);
          ctx.fillStyle = '#dc2626'; ctx.fillRect(stripeW * 0.5, -180, stripeW, 360);
        } else if (el.type === 'text') {
          ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? '900 ' : 'bold '}${el.size}px '${el.font}', sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (el.strokeWidth > 0) {
            ctx.strokeStyle = el.strokeColor; ctx.lineWidth = el.strokeWidth * 2; ctx.lineJoin = 'round';
            ctx.strokeText(el.text, 0, 0);
          }
          ctx.fillStyle = el.color;
          ctx.fillText(el.text, 0, 0);
        } else if (el.type === 'icon') {
          drawVectorIcon(ctx, el.icon, 0, 0, el.size, el.color);
        } else if (el.type === 'image' && el.img) {
          ctx.drawImage(el.img, -el.width / 2, -el.height / 2, el.width, el.height);
        }
      }
      ctx.restore();
    });

    ctx.restore();
  }

  function render2D() {
    if (!ctx2d || !editorCanvas) return;
    const w = editorCanvas.width, h = editorCanvas.height;

    if (textureCtx && textureCanvas) {
      drawHeadbandArtwork(textureCtx, textureCanvas.width, textureCanvas.height);
      if (canvasTexture) canvasTexture.needsUpdate = true;
    }

    ctx2d.clearRect(0, 0, w, h);
    drawHeadbandArtwork(ctx2d, w, h);

    const active = STATE.elements.find(e => e.id === STATE.selectedId);
    if (active && active.type !== 'stripes') drawTransformHandles(active, w, h);

    if (STATE.showBleed) {
      ctx2d.save();
      const bleedH = h * (12 / CANON_H);
      ctx2d.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx2d.fillRect(0, 0, w, bleedH);
      ctx2d.strokeStyle = 'rgba(239, 68, 68, 0.6)'; ctx2d.lineWidth = 1; ctx2d.setLineDash([6, 5]);
      ctx2d.beginPath(); ctx2d.moveTo(0, bleedH); ctx2d.lineTo(w, bleedH); ctx2d.stroke();
      ctx2d.fillRect(0, h - bleedH, w, bleedH);
      ctx2d.beginPath(); ctx2d.moveTo(0, h - bleedH); ctx2d.lineTo(w, h - bleedH); ctx2d.stroke();
      ctx2d.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx2d.beginPath(); ctx2d.moveTo(w / 2, 0); ctx2d.lineTo(w / 2, h); ctx2d.stroke();
      ctx2d.restore();
    }
  }

  function getBaseDimensions(el) {
    if (el.type === 'text') {
      ctx2d.save();
      ctx2d.font = `${el.italic ? 'italic ' : ''}${el.bold ? '900 ' : 'bold '}${el.size}px '${el.font}', sans-serif`;
      const m = ctx2d.measureText(el.text);
      ctx2d.restore();
      return { w: Math.max(m.width, 24), h: el.size * 0.95 };
    } else if (el.type === 'image') return { w: el.width, h: el.height };
    else if (el.type === 'icon') return { w: el.size, h: el.size };
    else if (el.type === 'flag') return { w: 70, h: 140 };
    return { w: 60, h: 60 };
  }

  function drawTransformHandles(el, canvasW, canvasH) {
    const scaleFactor = canvasW / CANON_W; // handle sizes su kreslene priamo v pixeloch editora, nie v kanonickom priestore
    const dim = getBaseDimensions(el);
    const sc = el.scale || 1;
    const hw = (dim.w * sc * scaleFactor) / 2;
    const hh = (dim.h * sc * scaleFactor) / 2;
    const ex = el.x * scaleFactor, ey = el.y * (canvasH / CANON_H);

    ctx2d.save();
    ctx2d.translate(ex, ey);
    ctx2d.rotate(((el.rotation || 0) * Math.PI) / 180);

    ctx2d.strokeStyle = '#6366f1'; ctx2d.lineWidth = 1.5; ctx2d.setLineDash([5, 4]);
    ctx2d.strokeRect(-hw - 5, -hh - 5, (hw + 5) * 2, (hh + 5) * 2);
    ctx2d.setLineDash([]);

    const rotStemY = -hh - 26;
    ctx2d.beginPath(); ctx2d.moveTo(0, -hh - 5); ctx2d.lineTo(0, rotStemY);
    ctx2d.strokeStyle = '#6366f1'; ctx2d.lineWidth = 1.5; ctx2d.stroke();

    ctx2d.beginPath(); ctx2d.arc(0, rotStemY, 8, 0, Math.PI * 2);
    ctx2d.fillStyle = '#4f46e5'; ctx2d.fill();
    ctx2d.strokeStyle = '#ffffff'; ctx2d.lineWidth = 1.5; ctx2d.stroke();

    ctx2d.fillStyle = '#ffffff'; ctx2d.font = '9px system-ui, sans-serif';
    ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
    ctx2d.fillText('↻', 0, rotStemY);

    const corners = [[-hw - 5, -hh - 5], [hw + 5, -hh - 5], [hw + 5, hh + 5], [-hw - 5, hh + 5]];
    corners.forEach(([cx, cy]) => {
      ctx2d.fillStyle = '#ffffff'; ctx2d.strokeStyle = '#4f46e5'; ctx2d.lineWidth = 1.5;
      ctx2d.fillRect(cx - 4.5, cy - 4.5, 9, 9); ctx2d.strokeRect(cx - 4.5, cy - 4.5, 9, 9);
    });
    ctx2d.restore();
  }

  function drawVectorIcon(c, icon, x, y, size, color) {
    c.save(); c.translate(x, y);
    const s = size / 24; c.scale(s, s); c.translate(-12, -12);
    c.fillStyle = color;
    let p = new Path2D();
    if (icon === 'runner') p = new Path2D('M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.8-1.6 8.1-4.9-.9-.4 2 6.3 1.2z');
    else if (icon === 'mountains') p = new Path2D('M14 6l-3.75 5 2.85 3.8L11.5 16H20l-6-10zm-6 4L3 18h10L8 10z');
    else if (icon === 'bike') p = new Path2D('M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm14-8.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm-8.2-7.2l2.3-3.8h3.9v2h-2.6l-1.5 2.5 2.3 2.5H19v2h-4.6l-3.6-4.2z');
    else if (icon === 'pulse') p = new Path2D('M3 13h3.5l2-5 4 10 3-7 1.5 2H21v-2h-5.5l-2 5-4-10-3 7-1.5-2H3v2z');
    c.fill(p); c.restore();
  }

  /* ---------- 10 sablonovych vzorov (identicke s povodnym navrhom, generovane podla w/h) ---------- */
  function drawStockTemplatePattern(ctx, w, h, tId) {
    ctx.save();
    if (tId === 'template-1') {
      ctx.fillStyle = '#0f1418'; ctx.fillRect(0, 0, w, h);
      const slashes = [{ x: -40, w: 90, color: '#ccff00' }, { x: 90, w: 45, color: '#27272a' }, { x: 160, w: 110, color: '#d9f99d' }, { x: 300, w: 140, color: '#bef264' }, { x: 470, w: 70, color: '#27272a' }, { x: 570, w: 130, color: '#a3e635' }, { x: 730, w: 85, color: '#3f3f46' }, { x: 840, w: 140, color: '#bef264' }];
      slashes.forEach(s => { ctx.fillStyle = s.color; ctx.beginPath(); ctx.moveTo(s.x, h); ctx.lineTo(s.x + s.w, h); ctx.lineTo(s.x + s.w + 130, 0); ctx.lineTo(s.x + 130, 0); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(15, 20, 26, 0.85)';
      ctx.beginPath(); ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.72, 0); ctx.lineTo(w * 0.66, h); ctx.lineTo(w * 0.22, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ccff00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.22, h); ctx.moveTo(w * 0.72, 0); ctx.lineTo(w * 0.66, h); ctx.stroke();
    } else if (tId === 'template-2') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1e3a8a'); skyGrad.addColorStop(0.5, '#60a5fa'); skyGrad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.45, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.38 + Math.sin(x * 0.018) * 22 + Math.cos(x * 0.045) * 14);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      const peaks = [{ x: w * 0.06, y: h * 0.12, base: 140 }, { x: w * 0.18, y: h * 0.06, base: 160 }, { x: w * 0.32, y: h * 0.15, base: 170 }, { x: w * 0.5, y: h * 0.08, base: 210 }, { x: w * 0.66, y: h * 0.14, base: 160 }, { x: w * 0.82, y: h * 0.05, base: 180 }, { x: w * 0.95, y: h * 0.16, base: 150 }];
      peaks.forEach(p => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.base / 2, h); ctx.lineTo(p.x, h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.base / 2, h); ctx.lineTo(p.x, h); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = '#090d16';
      for (let tx = 10; tx < w; tx += 22) { const treeH = 26 + (tx % 20); ctx.beginPath(); ctx.moveTo(tx, h); ctx.lineTo(tx + 7, h - treeH); ctx.lineTo(tx + 14, h); ctx.closePath(); ctx.fill(); }
    } else if (tId === 'template-3') {
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, w, h);
      const splatters = [{ x: -30, w: 130, col: '#f43f5e' }, { x: 120, w: 140, col: '#06b6d4' }, { x: 280, w: 160, col: '#ec4899' }, { x: 460, w: 150, col: '#0284c7' }, { x: 630, w: 150, col: '#f43f5e' }, { x: 800, w: 160, col: '#06b6d4' }];
      splatters.forEach(sp => {
        ctx.fillStyle = sp.col;
        ctx.beginPath(); ctx.moveTo(sp.x, h); ctx.lineTo(sp.x + sp.w, h); ctx.lineTo(sp.x + sp.w + 110, 0); ctx.lineTo(sp.x + 110, 0); ctx.closePath(); ctx.fill();
        for (let k = 0; k < 15; k++) { ctx.beginPath(); const px = sp.x + ((k * 31) % (sp.w + 40)) + 20; const py = (k * 41) % h; ctx.arc(px, py, (k % 4) + 1.5, 0, Math.PI * 2); ctx.fill(); }
      });
    } else if (tId === 'template-4') {
      ctx.fillStyle = '#0c0a09'; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1.8;
      for (let l = 0; l < 11; l++) {
        ctx.beginPath(); const baseY = (h / 11) * l;
        ctx.strokeStyle = l % 2 === 0 ? 'rgba(249, 115, 22, 0.9)' : 'rgba(251, 146, 60, 0.4)';
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, baseY + Math.sin(x * 0.015 + l * 0.8) * 16 + Math.cos(x * 0.035 - l * 0.4) * 9);
        ctx.stroke();
      }
    } else if (tId === 'template-5') {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
      const n = 8;
      const shardsColors = ['#0f172a', '#334155', '#020617', '#94a3b8', '#1e293b', '#0f172a', '#475569', '#020617'];
      let px0 = 0;
      for (let i = 0; i < n; i++) {
        const px1 = Math.round((w / n) * (i + 1));
        const midTopX = Math.round((px0 + px1) / 2);
        ctx.fillStyle = shardsColors[i % shardsColors.length];
        ctx.beginPath();
        if (i % 2 === 0) { ctx.moveTo(px0, h); ctx.lineTo(midTopX, 0); ctx.lineTo(px1, h); }
        else { ctx.moveTo(px0, 0); ctx.lineTo(px1, 0); ctx.lineTo(midTopX, h); }
        ctx.closePath(); ctx.fill();
        px0 = px1;
      }
    } else if (tId === 'template-6') {
      ctx.fillStyle = '#061a29'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0d9488';
      const leafCount = Math.round(w / 87);
      for (let i = 0; i < leafCount; i++) {
        ctx.save();
        ctx.translate((i * (w / leafCount)) + 15, (i % 2) * (h * 0.55) + 20);
        ctx.rotate((i * 38 * Math.PI) / 180);
        ctx.beginPath(); ctx.ellipse(0, 0, 48, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const flowers = [w * 0.17, w * 0.5, w * 0.83];
      flowers.forEach(fx => {
        ctx.fillStyle = '#f43f5e';
        for (let p = 0; p < 5; p++) {
          ctx.save(); ctx.translate(fx, h * 0.5); ctx.rotate((p * 72 * Math.PI) / 180);
          ctx.beginPath(); ctx.ellipse(0, 22, 14, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(fx, h * 0.5, 9, 0, Math.PI * 2); ctx.fill();
      });
    } else if (tId === 'template-7') {
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, w, h);
      for (let gx = 0; gx < w; gx += 18) for (let gy = 0; gy < h; gy += 18) {
        const seed = (gx * 17 + gy * 31) % 100;
        if (seed > 65) { ctx.fillStyle = seed > 85 ? '#84cc16' : '#27272a'; ctx.fillRect(gx, gy, 17, 17); }
      }
      ctx.fillStyle = '#a3e635';
      const bandCount = Math.round(w / 190);
      for (let i = 0; i < bandCount; i++) {
        const bx = (i * (w / bandCount)) + w * 0.08;
        ctx.beginPath(); ctx.moveTo(bx, h); ctx.lineTo(bx + 35, h); ctx.lineTo(bx + 95, 0); ctx.lineTo(bx + 60, 0); ctx.closePath(); ctx.fill();
      }
    } else if (tId === 'template-8') {
      ctx.fillStyle = '#030712'; ctx.fillRect(0, 0, w, h);
      const waveColors = ['#1d4ed8', '#0284c7', '#38bdf8', '#ffffff'];
      waveColors.forEach((wc, idx) => {
        ctx.strokeStyle = wc; ctx.lineWidth = 14 - idx * 2.8;
        ctx.beginPath(); ctx.moveTo(0, h * 0.8 - idx * 6);
        ctx.bezierCurveTo(w * 0.25, h * 0.1 - idx * 10, w * 0.65, h * 0.95 + idx * 5, w, h * 0.3);
        ctx.stroke();
      });
    } else if (tId === 'template-9') {
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
      ctx.beginPath(); ctx.moveTo(0, h * 0.2);
      ctx.bezierCurveTo(w * 0.3, h * 0.9, w * 0.7, 0, w, h * 0.6);
      ctx.lineTo(w, h * 0.85);
      ctx.bezierCurveTo(w * 0.65, h * 0.2, w * 0.25, h, 0, h * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d97706'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.bezierCurveTo(w * 0.32, h * 0.88, w * 0.68, h * 0.05, w, h * 0.7); ctx.stroke();
      ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, h * 0.28); ctx.bezierCurveTo(w * 0.32, h * 0.86, w * 0.68, h * 0.03, w, h * 0.68); ctx.stroke();
    } else if (tId === 'template-10') {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);
      const n = 11;
      const facetColors = ['#991b1b', '#dc2626', '#b91c1c', '#ef4444', '#7f1d1d', '#dc2626', '#b91c1c', '#ef4444', '#991b1b', '#dc2626', '#7f1d1d'];
      let px0 = 0;
      for (let i = 0; i < n; i++) {
        const px1 = Math.round((w / n) * (i + 1));
        const midTopX = Math.round((px0 + px1) / 2);
        ctx.fillStyle = facetColors[i % facetColors.length];
        ctx.beginPath();
        if (i % 2 === 0) { ctx.moveTo(px0, 0); ctx.lineTo(px1, 0); ctx.lineTo(midTopX, h); }
        else { ctx.moveTo(px0, h); ctx.lineTo(midTopX, 0); ctx.lineTo(px1, h); }
        ctx.closePath(); ctx.fill();
        px0 = px1;
      }
    }
    ctx.restore();
  }

  function applyStockTemplate(num) {
    STATE.bgPattern = `template-${num}`;
    const cx = CENTER_X;
    if (num === '1') STATE.elements = [{ id: 't1', type: 'text', text: 'PUSH YOUR LIMITS', x: cx, y: 90, font: 'Montserrat', size: 30, scale: 1, rotation: 0, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '2') STATE.elements = [{ id: 't2_i', type: 'icon', icon: 'mountains', x: cx, y: 62, size: 48, scale: 1, rotation: 0, color: '#ffffff' }, { id: 't2_t', type: 'text', text: 'MOUNTAINS ARE CALLING', x: cx, y: 118, font: 'Montserrat', size: 20, scale: 1, rotation: 0, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '3') STATE.elements = [{ id: 't3', type: 'text', text: 'Run More', x: cx, y: 90, font: 'Bebas Neue', size: 72, scale: 1, rotation: -4, color: '#ffffff', strokeColor: '#f43f5e', strokeWidth: 3, bold: true, italic: true }];
    else if (num === '4') STATE.elements = [{ id: 't4', type: 'text', text: 'EXPLORE TRAIN REPEAT', x: cx, y: 90, font: 'Montserrat', size: 24, scale: 1, rotation: 0, color: '#f97316', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '5') STATE.elements = [{ id: 't5', type: 'text', text: 'STRONGER EVERYDAY', x: cx, y: 90, font: 'Montserrat', size: 26, scale: 1, rotation: 0, color: '#0f172a', strokeColor: '#ffffff', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '6') STATE.elements = [{ id: 't6', type: 'text', text: 'Good Energy ♡', x: cx, y: 90, font: 'Montserrat', size: 36, scale: 1, rotation: -2, color: '#fda4af', strokeColor: '#061a29', strokeWidth: 2, bold: true, italic: true }];
    else if (num === '7') STATE.elements = [{ id: 't7', type: 'text', text: 'FASTER HIGHER STRONGER', x: cx, y: 90, font: 'Oswald', size: 28, scale: 1, rotation: 0, color: '#bef264', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '8') STATE.elements = [{ id: 't8', type: 'text', text: 'RUN BIKE HIKE REPEAT', x: cx, y: 90, font: 'Montserrat', size: 24, scale: 1, rotation: 0, color: '#38bdf8', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];
    else if (num === '9') STATE.elements = [{ id: 't9', type: 'text', text: 'Limitless —', x: cx, y: 90, font: 'Montserrat', size: 40, scale: 1, rotation: -2, color: '#fbbf24', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: true }];
    else if (num === '10') STATE.elements = [{ id: 't10_i', type: 'icon', icon: 'mountains', x: cx, y: 62, size: 44, scale: 1, rotation: 0, color: '#ef4444' }, { id: 't10_t', type: 'text', text: 'NEVER GIVE UP', x: cx, y: 118, font: 'Montserrat', size: 22, scale: 1, rotation: 0, color: '#ffffff', strokeColor: '#000000', strokeWidth: 2, bold: true, italic: false }];

    STATE.selectedId = STATE.elements[0] ? STATE.elements[0].id : null;
    render2D(); updateLayersUI(); syncTransformPanel();
    toast(`Načítaný dizajn #${num}`);
  }

  /* ---------- THREE.JS 3D nahlad ---------- */
  function initThreeEngine() {
    const container = q('#threeContainer');
    if (!container) return;
    const w = container.clientWidth || 400, h = container.clientHeight || 300;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    threeCamera.position.set(0, 0, 3.8);

    threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    threeRenderer.setSize(w, h);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(threeRenderer.domElement);

    threeScene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); dirLight.position.set(5, 5, 5); threeScene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.8); dirLight2.position.set(-5, -3, -5); threeScene.add(dirLight2);

    buildHeadbandMesh();
    setup3DInteraction(container);
    rafId = requestAnimationFrame(animate3D);

    on(window, 'resize', handleThreeResize);
  }

  function buildHeadbandMesh() {
    if (headbandGroup) threeScene.remove(headbandGroup);
    headbandGroup = new THREE.Group();

    const sourceCanvas = textureCanvas || editorCanvas;
    canvasTexture = new THREE.CanvasTexture(sourceCanvas);
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;
    canvasTexture.generateMipmaps = false;
    canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;

    const widthCm = 51, heightCm = 9;
    const radius = 1.22;
    const circumference = 2 * Math.PI * radius;
    const height3D = circumference / (widthCm / heightCm);

    const outerGeo = new THREE.CylinderGeometry(radius, radius, height3D, 128, 1, true);
    outerGeo.rotateY(Math.PI);
    const outerMat = new THREE.MeshStandardMaterial({ map: canvasTexture, roughness: 0.72, metalness: 0.04, side: THREE.FrontSide });
    headbandGroup.add(new THREE.Mesh(outerGeo, outerMat));

    const innerGeo = new THREE.CylinderGeometry(radius - 0.012, radius - 0.012, height3D, 128, 1, true);
    innerGeo.rotateY(Math.PI);
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, side: THREE.BackSide });
    headbandGroup.add(new THREE.Mesh(innerGeo, innerMat));

    headbandGroup.scale.set(1.04, 1.0, 0.96);
    headbandGroup.rotation.x = 0.15;
    threeScene.add(headbandGroup);
    canvasTexture.needsUpdate = true;
  }

  function animate3D() {
    rafId = requestAnimationFrame(animate3D);
    if (headbandGroup) {
      if (STATE.autoRotate && !isUserInteracting3D) targetRotationY += 0.005;
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      headbandGroup.rotation.y = currentRotationY;
    }
    threeRenderer.render(threeScene, threeCamera);
  }

  function handleThreeResize() {
    const container = q('#threeContainer');
    if (!container || !threeRenderer || !threeCamera) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    threeCamera.aspect = w / h; threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(w, h);
  }

  function setup3DInteraction(container) {
    const onPointerDown = (clientX) => { isUserInteracting3D = true; previousMouseX = clientX; };
    const onPointerMove = (clientX) => { if (!isUserInteracting3D) return; const dx = clientX - previousMouseX; previousMouseX = clientX; targetRotationY += dx * 0.012; };
    const onPointerUp = () => { isUserInteracting3D = false; };

    on(container, 'mousedown', (e) => onPointerDown(e.clientX));
    on(window, 'mousemove', (e) => onPointerMove(e.clientX));
    on(window, 'mouseup', onPointerUp);
    on(container, 'touchstart', (e) => { if (e.touches.length === 1) onPointerDown(e.touches[0].clientX); }, { passive: true });
    on(window, 'touchmove', (e) => { if (isUserInteracting3D && e.touches.length === 1) onPointerMove(e.touches[0].clientX); }, { passive: true });
    on(window, 'touchend', onPointerUp);
  }

  /* ---------- 2D interaktivne transformacie (drag/rotate/scale) ---------- */
  let interactionMode = null;
  let dragOffset = { x: 0, y: 0 };
  let initialElementScale = 1, initialElementRotation = 0, initialPointerAngle = 0, initialPointerDist = 0;

  function toLocalCoords(el, worldX, worldY) {
    const dx = worldX - el.x, dy = worldY - el.y;
    const rad = -((el.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  function hitTestHandle(el, worldX, worldY) {
    const dim = getBaseDimensions(el);
    const sc = el.scale || 1;
    const hw = (dim.w * sc) / 2, hh = (dim.h * sc) / 2;
    const local = toLocalCoords(el, worldX, worldY);
    const rotY = -hh - 26;
    if (Math.hypot(local.x - 0, local.y - rotY) <= 14) return 'rotate';
    const corners = [[-hw - 5, -hh - 5], [hw + 5, -hh - 5], [hw + 5, hh + 5], [-hw - 5, hh + 5]];
    for (let i = 0; i < corners.length; i++) if (Math.hypot(local.x - corners[i][0], local.y - corners[i][1]) <= 12) return 'scale';
    if (Math.abs(local.x) <= hw + 6 && Math.abs(local.y) <= hh + 6) return 'move';
    return null;
  }

  function getCanvasPointerPos(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width, scaleY = editorCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // canvas pixely -> kanonicky priestor (elementy su ulozene v kanonickych suradniciach)
    return { x: (clientX - rect.left) * scaleX * (CANON_W / editorCanvas.width), y: (clientY - rect.top) * scaleY * (CANON_H / editorCanvas.height) };
  }

  function onCanvasDown(e) {
    const pos = getCanvasPointerPos(e);
    const currentActive = STATE.elements.find(i => i.id === STATE.selectedId);
    if (currentActive && currentActive.type !== 'stripes') {
      const handleHit = hitTestHandle(currentActive, pos.x, pos.y);
      if (handleHit) {
        interactionMode = handleHit;
        initialElementScale = currentActive.scale || 1;
        initialElementRotation = currentActive.rotation || 0;
        initialPointerAngle = Math.atan2(pos.y - currentActive.y, pos.x - currentActive.x);
        initialPointerDist = Math.hypot(pos.x - currentActive.x, pos.y - currentActive.y);
        dragOffset.x = pos.x - currentActive.x; dragOffset.y = pos.y - currentActive.y;
        editorCanvas.classList.add('dragging');
        return;
      }
    }
    let found = null;
    for (let i = STATE.elements.length - 1; i >= 0; i--) {
      const el = STATE.elements[i];
      if (el.type === 'stripes') continue;
      if (hitTestHandle(el, pos.x, pos.y)) { found = el; break; }
    }
    if (found) {
      STATE.selectedId = found.id;
      interactionMode = 'move';
      dragOffset.x = pos.x - found.x; dragOffset.y = pos.y - found.y;
      editorCanvas.classList.add('dragging');
      syncSelectedInputs();
    } else {
      STATE.selectedId = null; interactionMode = null;
    }
    render2D(); updateLayersUI(); syncTransformPanel();
  }

  function onCanvasMove(e) {
    const pos = getCanvasPointerPos(e);
    const active = STATE.elements.find(i => i.id === STATE.selectedId);
    if (!interactionMode && active && active.type !== 'stripes') {
      const h = hitTestHandle(active, pos.x, pos.y);
      editorCanvas.style.cursor = h === 'rotate' ? 'grab' : h === 'scale' ? 'nwse-resize' : h === 'move' ? 'move' : 'crosshair';
    }
    if (!interactionMode || !active) return;
    if (interactionMode === 'move') {
      active.x = Math.round(pos.x - dragOffset.x);
      active.y = Math.round(pos.y - dragOffset.y);
    } else if (interactionMode === 'rotate') {
      editorCanvas.style.cursor = 'grabbing';
      const curAngle = Math.atan2(pos.y - active.y, pos.x - active.x);
      const deltaAngle = curAngle - initialPointerAngle;
      let newRot = initialElementRotation + (deltaAngle * 180) / Math.PI;
      newRot = Math.round(((newRot + 180) % 360) - 180);
      active.rotation = newRot;
      syncTransformPanel();
    } else if (interactionMode === 'scale') {
      const curDist = Math.hypot(pos.x - active.x, pos.y - active.y);
      const ratio = curDist / Math.max(initialPointerDist, 10);
      active.scale = parseFloat(Math.max(0.25, Math.min(3.5, initialElementScale * ratio)).toFixed(2));
      syncTransformPanel();
    }
    render2D();
  }

  function onCanvasUp() {
    interactionMode = null;
    editorCanvas.classList.remove('dragging');
    editorCanvas.style.cursor = 'crosshair';
  }

  /* ---------- UI ovladacie prvky ---------- */
  function setupControls() {
    qa('.tab-btn').forEach(btn => on(btn, 'click', () => {
      const tabId = btn.getAttribute('data-tab');
      qa('.tab-btn').forEach(b => { b.classList.remove('bg-white', 'text-indigo-600', 'shadow-xs'); b.classList.add('text-slate-600'); });
      btn.classList.add('bg-white', 'text-indigo-600', 'shadow-xs'); btn.classList.remove('text-slate-600');
      qa('.tab-content').forEach(c => c.classList.add('hidden'));
      q(`#${tabId}`).classList.remove('hidden');
    }));

    qa('.template-card').forEach(card => on(card, 'click', () => applyStockTemplate(card.getAttribute('data-template'))));

    qa('.color-swatch-btn').forEach(btn => on(btn, 'click', () => setHeadbandColor(btn.getAttribute('data-color'))));

    const customPicker = q('#customColorPicker');
    on(customPicker, 'input', (e) => setHeadbandColor(e.target.value));

    qa('.pattern-btn').forEach(btn => on(btn, 'click', () => {
      STATE.bgPattern = btn.getAttribute('data-pattern');
      qa('.pattern-btn').forEach(b => { b.classList.remove('border-indigo-500', 'bg-indigo-50/50'); b.classList.add('border-slate-200'); });
      btn.classList.add('border-indigo-500', 'bg-indigo-50/50'); btn.classList.remove('border-slate-200');
      render2D(); toast('Vzor pozadia zmenený');
    }));

    on(q('#addTextBtn'), 'click', addTextElement);
    on(q('#textInput'), 'keydown', (e) => { if (e.key === 'Enter') addTextElement(); });
    on(q('#textInput'), 'input', (e) => {
      const active = STATE.elements.find(i => i.id === STATE.selectedId);
      if (active && active.type === 'text') { active.text = e.target.value; render2D(); syncTransformPanel(); }
    });
    on(q('#fontFamilySelect'), 'change', (e) => { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (a && a.type === 'text') { a.font = e.target.value; render2D(); } });
    on(q('#fontSizeSlider'), 'input', (e) => {
      const sz = parseInt(e.target.value, 10);
      q('#fontSizeVal').innerText = `${sz} px`;
      const a = STATE.elements.find(i => i.id === STATE.selectedId);
      if (a && a.type === 'text') { a.size = sz; render2D(); }
    });
    on(q('#textColorPicker'), 'input', (e) => {
      q('#textColorHex').innerText = e.target.value.toUpperCase();
      const a = STATE.elements.find(i => i.id === STATE.selectedId);
      if (a && a.type === 'text') { a.color = e.target.value; render2D(); }
    });
    on(q('#strokeColorPicker'), 'input', (e) => { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (a && a.type === 'text') { a.strokeColor = e.target.value; render2D(); } });
    on(q('#strokeWidthSelect'), 'change', (e) => { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (a && a.type === 'text') { a.strokeWidth = parseInt(e.target.value, 10); render2D(); } });
    on(q('#boldToggleBtn'), 'click', () => { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (a && a.type === 'text') { a.bold = !a.bold; render2D(); } });
    on(q('#italicToggleBtn'), 'click', () => { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (a && a.type === 'text') { a.italic = !a.italic; render2D(); } });
    on(q('#centerTextBtn'), 'click', centerActiveElement);

    on(q('#logoUploadInput'), 'change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxH = CANON_H * 0.65;
          const scale = Math.min(maxH / img.height, 240 / img.width, 1);
          const newImg = { id: 'elem_img_' + Date.now(), type: 'image', img, x: CENTER_X, y: CANON_H / 2, width: img.width * scale, height: img.height * scale, scale: 1, rotation: 0 };
          STATE.elements.push(newImg); STATE.selectedId = newImg.id;
          render2D(); updateLayersUI(); syncTransformPanel();
          toast('Logo vložené na čelenku');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    let currentActiveIconColor = '#facc15';
    const iconColPicker = q('#iconColorPicker'), iconColHex = q('#iconColorHex');
    const inspIconColPicker = q('#inspectorIconColorPicker'), inspIconColHex = q('#inspectorIconColorHex');
    function updateIconColorState(newColor) {
      currentActiveIconColor = newColor;
      if (iconColPicker) iconColPicker.value = newColor;
      if (iconColHex) iconColHex.innerText = newColor.toUpperCase();
      if (inspIconColPicker) inspIconColPicker.value = newColor;
      if (inspIconColHex) inspIconColHex.innerText = newColor.toUpperCase();
      const active = STATE.elements.find(i => i.id === STATE.selectedId);
      if (active && active.type === 'icon') { active.color = newColor; render2D(); }
    }
    on(iconColPicker, 'input', (e) => updateIconColorState(e.target.value));
    on(inspIconColPicker, 'input', (e) => updateIconColorState(e.target.value));
    qa('.quick-icon-col').forEach(btn => on(btn, 'click', () => updateIconColorState(btn.getAttribute('data-icon-color'))));

    qa('.icon-add-btn').forEach(btn => on(btn, 'click', () => {
      const icon = btn.getAttribute('data-icon');
      const newIcon = { id: 'elem_icon_' + Date.now(), type: 'icon', icon, x: CENTER_X, y: CANON_H / 2, size: 60, scale: 1, rotation: 0, color: currentActiveIconColor };
      STATE.elements.push(newIcon); STATE.selectedId = newIcon.id;
      render2D(); updateLayersUI(); syncTransformPanel();
      toast('Ikona pridaná na čelenku');
    }));

    on(q('#addStripesBtn'), 'click', () => {
      STATE.elements.unshift({ id: 'elem_stripes_' + Date.now(), type: 'stripes', topY: 0.18, bottomY: 0.82, colorTop: '#ef4444', colorBottom: '#38bdf8', height: 6 });
      render2D(); updateLayersUI(); toast('Pretekárske pruhy pridané');
    });
    on(q('#addFlagBtn'), 'click', () => {
      const flag = { id: 'elem_flag_' + Date.now(), type: 'flag', x: CANON_W * 0.82, y: CANON_H / 2, scale: 1, rotation: 0 };
      STATE.elements.push(flag); STATE.selectedId = flag.id;
      render2D(); updateLayersUI(); syncTransformPanel();
      toast('Slovenská trikolóra pridaná');
    });

    on(q('#rotationSlider'), 'input', (e) => {
      const active = STATE.elements.find(i => i.id === STATE.selectedId);
      if (active) { active.rotation = parseInt(e.target.value, 10); q('#rotationValBadge').innerText = `${active.rotation}°`; render2D(); }
    });
    on(q('#scaleSlider'), 'input', (e) => {
      const active = STATE.elements.find(i => i.id === STATE.selectedId);
      if (active) { const pct = parseInt(e.target.value, 10); active.scale = parseFloat((pct / 100).toFixed(2)); q('#scaleValBadge').innerText = `${pct}%`; render2D(); }
    });
    on(q('#rotResetBtn'), 'click', () => setRotation(0));
    on(q('#rotMinus45Btn'), 'click', () => adjustRotation(-45));
    on(q('#rotMinus15Btn'), 'click', () => adjustRotation(-15));
    on(q('#rotPlus15Btn'), 'click', () => adjustRotation(15));
    on(q('#rotPlus45Btn'), 'click', () => adjustRotation(45));
    on(q('#scaleDownBtn'), 'click', () => adjustScale(-0.1));
    on(q('#scaleUpBtn'), 'click', () => adjustScale(0.1));
    on(q('#centerActiveObjBtn'), 'click', centerActiveElement);
    on(q('#resetTransformBtn'), 'click', () => {
      const active = STATE.elements.find(i => i.id === STATE.selectedId);
      if (active) { active.scale = 1; active.rotation = 0; render2D(); syncTransformPanel(); toast('Transformácia resetovaná'); }
    });

    const btnFront = q('#viewFrontBtn'), btnAngle = q('#viewAngleBtn'), btnBack = q('#viewBackBtn');
    function setViewBtnActive(activeBtn) {
      [btnFront, btnAngle, btnBack].forEach(b => { if (!b) return; b.classList.remove('bg-white', 'text-indigo-950', 'font-bold', 'shadow-xs'); b.classList.add('text-white/80'); });
      if (activeBtn) { activeBtn.classList.add('bg-white', 'text-indigo-950', 'font-bold', 'shadow-xs'); activeBtn.classList.remove('text-white/80'); }
    }
    on(btnFront, 'click', () => { STATE.autoRotate = false; targetRotationY = 0; setViewBtnActive(btnFront); });
    on(btnAngle, 'click', () => { STATE.autoRotate = false; targetRotationY = 0.75; setViewBtnActive(btnAngle); });
    on(btnBack, 'click', () => { STATE.autoRotate = false; targetRotationY = Math.PI; setViewBtnActive(btnBack); });
    on(q('#toggleAutoRotateBtn'), 'click', () => { STATE.autoRotate = !STATE.autoRotate; toast(STATE.autoRotate ? 'Rotácia spustená' : 'Rotácia pozastavená'); });

    on(q('#bleedGuideCheckbox'), 'change', (e) => { STATE.showBleed = e.target.checked; render2D(); });

    on(q('#layerDeleteBtn'), 'click', deleteActiveElement);
    on(q('#layerUpBtn'), 'click', () => shiftLayer(1));
    on(q('#layerDownBtn'), 'click', () => shiftLayer(-1));

    on(q('#resetDesignBtn'), 'click', () => {
      STATE.elements = []; STATE.selectedId = null;
      setHeadbandColor('#0f172a');
      render2D(); updateLayersUI(); syncTransformPanel();
      toast('Dizajn bol vyčistený');
    });

    on(editorCanvas, 'mousedown', onCanvasDown);
    on(window, 'mousemove', onCanvasMove);
    on(window, 'mouseup', onCanvasUp);
    on(editorCanvas, 'touchstart', onCanvasDown, { passive: true });
    on(window, 'touchmove', onCanvasMove, { passive: true });
    on(window, 'touchend', onCanvasUp);
  }

  function setRotation(deg) { const a = STATE.elements.find(i => i.id === STATE.selectedId); if (!a) return; a.rotation = deg; render2D(); syncTransformPanel(); }
  function adjustRotation(delta) {
    const a = STATE.elements.find(i => i.id === STATE.selectedId); if (!a) return;
    let rot = ((a.rotation || 0) + delta + 180) % 360 - 180; a.rotation = Math.round(rot);
    render2D(); syncTransformPanel();
  }
  function adjustScale(delta) {
    const a = STATE.elements.find(i => i.id === STATE.selectedId); if (!a) return;
    a.scale = parseFloat(Math.max(0.2, Math.min(3.5, (a.scale || 1) + delta)).toFixed(2));
    render2D(); syncTransformPanel();
  }
  function centerActiveElement() {
    const a = STATE.elements.find(i => i.id === STATE.selectedId);
    if (a) { a.x = CENTER_X; a.y = CANON_H / 2; render2D(); toast('Vycentrované na stred čela'); }
  }

  function syncTransformPanel() {
    const panel = q('#transformInspector');
    const iconColorRow = q('#inspectorIconColorRow');
    const active = STATE.elements.find(i => i.id === STATE.selectedId);
    if (!panel) return;
    if (!active || active.type === 'stripes') {
      panel.classList.add('opacity-50', 'pointer-events-none');
      if (iconColorRow) iconColorRow.classList.add('hidden');
      q('#selectedItemLabel').innerText = 'Žiadny objekt nevybraný';
      q('#rotationValBadge').innerText = '0°'; q('#scaleValBadge').innerText = '100%';
      q('#rotationSlider').value = 0; q('#scaleSlider').value = 100;
      return;
    }
    panel.classList.remove('opacity-50', 'pointer-events-none');
    let label = 'Objekt';
    if (active.type === 'text') { label = `Text: "${active.text.substring(0, 10)}"`; if (iconColorRow) iconColorRow.classList.add('hidden'); }
    else if (active.type === 'icon') {
      label = `Ikona (${active.icon})`;
      if (iconColorRow) {
        iconColorRow.classList.remove('hidden');
        const hex = active.color || '#facc15';
        q('#inspectorIconColorPicker').value = hex; q('#inspectorIconColorHex').innerText = hex.toUpperCase();
        q('#iconColorPicker').value = hex; q('#iconColorHex').innerText = hex.toUpperCase();
      }
    } else if (active.type === 'image') { label = 'Vložené Logo'; if (iconColorRow) iconColorRow.classList.add('hidden'); }
    else if (active.type === 'flag') { label = 'Trikolóra'; if (iconColorRow) iconColorRow.classList.add('hidden'); }

    q('#selectedItemLabel').innerText = label;
    const rot = active.rotation || 0, scPct = Math.round((active.scale || 1) * 100);
    q('#rotationSlider').value = rot; q('#rotationValBadge').innerText = `${rot}°`;
    q('#scaleSlider').value = scPct; q('#scaleValBadge').innerText = `${scPct}%`;
  }

  function setHeadbandColor(hex) {
    STATE.bgColor = hex; STATE.bgPattern = 'solid';
    const cp = q('#customColorPicker'); if (cp) cp.value = hex;
    const hexLabel = q('#currentColorHex'); if (hexLabel) hexLabel.innerText = hex.toUpperCase();
    qa('.color-swatch-btn').forEach(b => {
      if (b.getAttribute('data-color').toLowerCase() === hex.toLowerCase()) b.classList.add('ring-2', 'ring-indigo-500');
      else b.classList.remove('ring-2', 'ring-indigo-500');
    });
    render2D(); toast(`Farba: ${hex.toUpperCase()}`);
  }

  function addTextElement() {
    const input = q('#textInput');
    const textVal = input.value.trim() || 'RUNNER';
    const font = q('#fontFamilySelect').value;
    const sz = parseInt(q('#fontSizeSlider').value, 10);
    const col = q('#textColorPicker').value;
    const strokeCol = q('#strokeColorPicker').value;
    const strokeW = parseInt(q('#strokeWidthSelect').value, 10);
    const newText = { id: 'elem_text_' + Date.now(), type: 'text', text: textVal, x: CENTER_X, y: CANON_H / 2, font, size: sz, scale: 1, rotation: 0, color: col, strokeColor: strokeCol, strokeWidth: strokeW, bold: false, italic: false };
    STATE.elements.push(newText); STATE.selectedId = newText.id;
    render2D(); updateLayersUI(); syncTransformPanel();
    toast('Text vložený do stredu');
  }

  function syncSelectedInputs() {
    const active = STATE.elements.find(i => i.id === STATE.selectedId);
    if (!active || active.type !== 'text') return;
    q('#textInput').value = active.text;
    q('#fontFamilySelect').value = active.font;
    q('#fontSizeSlider').value = active.size; q('#fontSizeVal').innerText = `${active.size} px`;
    q('#textColorPicker').value = active.color; q('#textColorHex').innerText = active.color.toUpperCase();
    q('#strokeColorPicker').value = active.strokeColor || '#000000';
    q('#strokeWidthSelect').value = active.strokeWidth || 0;
  }

  function deleteActiveElement() {
    if (!STATE.selectedId) return;
    STATE.elements = STATE.elements.filter(i => i.id !== STATE.selectedId);
    STATE.selectedId = null;
    render2D(); updateLayersUI(); syncTransformPanel();
    toast('Objekt odstránený');
  }

  function shiftLayer(dir) {
    if (!STATE.selectedId) return;
    const idx = STATE.elements.findIndex(i => i.id === STATE.selectedId);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx >= 0 && targetIdx < STATE.elements.length) {
      const item = STATE.elements.splice(idx, 1)[0];
      STATE.elements.splice(targetIdx, 0, item);
      render2D(); updateLayersUI();
    }
  }

  function updateLayersUI() {
    const container = q('#layersContainer');
    if (!container) return;
    const badge = q('#layersCountBadge'); if (badge) badge.innerText = STATE.elements.length;
    if (STATE.elements.length === 0) { container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">Žiadne prvky.</div>'; return; }
    container.innerHTML = '';
    [...STATE.elements].reverse().forEach(el => {
      const isSel = el.id === STATE.selectedId;
      const row = document.createElement('div');
      row.className = `flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition border ${isSel ? 'bg-indigo-50 border-indigo-400 font-bold text-indigo-950' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`;
      let name = 'Objekt';
      if (el.type === 'text') name = `🔤 "${el.text}"`;
      else if (el.type === 'image') name = '🖼️ Logo';
      else if (el.type === 'icon') name = `⚡ Ikona (${el.icon})`;
      else if (el.type === 'stripes') name = '📐 Pruhy';
      else if (el.type === 'flag') name = '🇸🇰 Trikolóra';
      row.innerHTML = `<span class="truncate pr-2">${name}</span><button class="delete-btn text-slate-400 hover:text-red-600 px-1 font-bold">✕</button>`;
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) { STATE.selectedId = el.id; deleteActiveElement(); }
        else { STATE.selectedId = el.id; syncSelectedInputs(); render2D(); updateLayersUI(); syncTransformPanel(); }
      });
      container.appendChild(row);
    });
  }

  /* ---------- Bootstrap ---------- */
  editorCanvas = q('#editorCanvas');
  ctx2d = editorCanvas.getContext('2d');
  textureCanvas = document.createElement('canvas');
  textureCanvas.width = CANON_W * 2; textureCanvas.height = CANON_H * 2;
  textureCtx = textureCanvas.getContext('2d');

  initThreeEngine();
  setupControls();
  render2D();
  updateLayersUI();
  syncTransformPanel();

  /* ---------- Verejne API pre React komponent ---------- */
  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      cleanupFns.forEach(fn => fn());
      if (threeRenderer) { threeRenderer.dispose(); threeRenderer.domElement?.remove(); }
    },
    hasContent() { return STATE.elements.length > 0; },
    getLowResPreviewDataUrl() { return editorCanvas.toDataURL('image/png'); },
    getDesignJson() {
      return JSON.stringify({
        bgColor: STATE.bgColor,
        bgPattern: STATE.bgPattern,
        elements: STATE.elements.map(({ img, ...rest }) => rest), // obrazky (logo) nie su JSON-serializovatelne, len metadata
      });
    },
    // Tlacovy (produkcny) render — 300 DPI pri 51x9cm = 6024x1063 px. NIKDY sa nevystavuje
    // zakaznikovi (ziadne <a download>/verejna URL) — vraca sa len ako Blob priamo volajucemu
    // (React komponent ho hned nahra do privatneho Storage a zahodi referenciu).
    async getProductionBlob() {
      const PROD_W = 6024, PROD_H = 1063;
      const prod = document.createElement('canvas');
      prod.width = PROD_W; prod.height = PROD_H;
      const pctx = prod.getContext('2d');
      const savedSelected = STATE.selectedId, savedBleed = STATE.showBleed;
      STATE.selectedId = null; STATE.showBleed = false;
      drawHeadbandArtwork(pctx, PROD_W, PROD_H);
      STATE.selectedId = savedSelected; STATE.showBleed = savedBleed;
      return await new Promise((resolve) => prod.toBlob(resolve, 'image/png'));
    },
  };
}
