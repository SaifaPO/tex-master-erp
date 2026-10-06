// Optimalizacia 3D modelu trenirok (CLO3D/RenderHub export, 46 MB) na ~1 MB pre web: odstrani prešívanie, ponechá len vonkajšiu vrstvu
// látky z každého strihového kusu, odstráni textúry (nahradí ich naša plátnová textúra), zjednoduší a skvantizuje geometriu.
// Použitie: v priečinku s balíčkami @gltf-transform/core, extensions, functions, meshoptimizer a sharp spusti `node optimize-shorts-glb.mjs "cesta/Men Soccer Athletic Shorts.glb"`.
// Výstup: shorts-base.glb (+ shorts-normal-2048.png, ktorý sa zmenší na 1024 px ako public/models/shorts-normal.png).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2] || 'Men Soccer Athletic Shorts.glb');
const root = doc.getRoot();

// 1) odstranit prešívanie (topstitch) — desiatky tisíc trojuholníkov, vizuálne nepodstatné
root.listNodes().forEach((n) => {
  const nm = n.getName();
  if (/BindedTrim|Topstitch/i.test(nm) || (n.getMesh() && /Topstitch/i.test(n.getMesh().getName()))) n.dispose();
});
root.listMeshes().forEach((m) => { if (/Topstitch/i.test(m.getName())) m.dispose(); });

// 2) z kazdej trojice (vonkajsia vrstva / vnutorna podsivka / bocny pasik) nechat len vonkajsiu
const cloth = root.listMeshes().find((m) => m.getName() === 'Cloth_mesh');
const prims = cloth.listPrimitives();
const centerAll = [0, 0, 0]; let total = 0;
prims.forEach((p) => { const pos = p.getAttribute('POSITION'); const v = [0, 0, 0]; for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); centerAll[0] += v[0]; centerAll[1] += v[1]; centerAll[2] += v[2]; } total += pos.getCount(); });
centerAll.forEach((_, i) => { centerAll[i] /= total; });
// stred modelu v XZ rovine pre kazdu nohavicu zvlast by bol presnejsi — pouzivame spolocny stred v Y, ale XZ podla polovice (lava/prava noha)
const groups = new Map();
prims.forEach((p) => {
  const uv = p.getAttribute('TEXCOORD_0'); const u = [0, 0];
  let a = [1e9, 1e9], b = [-1e9, -1e9];
  for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, u); a = [Math.min(a[0], u[0]), Math.min(a[1], u[1])]; b = [Math.max(b[0], u[0]), Math.max(b[1], u[1])]; }
  const key = p.getMaterial().getName() + '|' + a.map((x) => x.toFixed(2)) + '|' + b.map((x) => x.toFixed(2));
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
});
let kept = 0, removed = 0;
groups.forEach((g) => {
  if (g.length < 2) { kept += g.length; return; }
  let best = null, bestScore = -1e9;
  g.forEach((p) => {
    const pos = p.getAttribute('POSITION'); const nrm = p.getAttribute('NORMAL');
    const step = Math.max(1, Math.floor(pos.getCount() / 500));
    let s = 0, c = 0; const v = [0, 0, 0], nn = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i += step) {
      pos.getElement(i, v); nrm.getElement(i, nn);
      // vychadzame z osi nohy (x-stred nohavice ~ +-9, os Y), smer "von" od osi tela (x=0,z=-2)
      const dx = v[0] - 0, dz = v[2] + 2; const len = Math.hypot(dx, dz) || 1;
      s += (dx / len) * nn[0] + (dz / len) * nn[2]; c++;
    }
    s /= c;
    if (s > bestScore) { bestScore = s; best = p; }
  });
  g.forEach((p) => { if (p !== best) { cloth.removePrimitive(p); p.dispose(); removed++; } else kept++; });
});
console.log('prim kept', kept, 'removed', removed);

// 3) bez textur — nasa platenna textura ich nahradi (normalova mapa sa nacitava samostatne)
root.listMaterials().forEach((m) => {
  m.setBaseColorTexture(null); m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null);
});
root.listTextures().forEach((t, i) => { if (i === 1) fs.writeFileSync('shorts-normal-2048.png', t.getImage()); t.dispose(); });

await doc.transform(prune({ keepAttributes: true }), dedup(), weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.002, lockBorder: true }), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }), prune({ keepAttributes: true }));

await io.write('shorts-base.glb', doc);
const st = fs.statSync('shorts-base.glb');
let verts = 0, tris = 0;
doc.getRoot().listMeshes().forEach((m) => m.listPrimitives().forEach((p) => { verts += p.getAttribute('POSITION').getCount(); tris += (p.getIndices()?.getCount() || 0) / 3; }));
console.log('MB', (st.size / 1e6).toFixed(2), 'verts', verts, 'tris', tris);
