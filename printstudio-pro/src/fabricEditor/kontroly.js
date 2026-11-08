import { fabric } from 'fabric';

// Tlačidlá priamo na vybranom objekte v náhľade: ⧉ duplikovať (vľavo hore) a ✕ zmazať (vpravo hore).
// Registrujú sa raz pre všetky Fabric plátna (stolové vlajky, šnúrky, návrhy, plážové vlajky, zástavy…).
const PRENOS = ['obrysHrubka', 'obrysPoloha', 'zona'];
let hotovo = false;

function kreslic(znak, farba) {
  return function render(ctx, left, top) {
    ctx.save();
    ctx.translate(left, top);
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = farba; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(znak, 0, 1);
    ctx.restore();
  };
}

export function zaregistrujKontrolyDupZmaz() {
  if (hotovo) return;
  hotovo = true;
  const ovl = fabric.Object.prototype.controls;
  ovl.zmazObjekt = new fabric.Control({
    x: 0.5, y: -0.5, offsetX: 22, offsetY: -22, cursorStyle: 'pointer', sizeX: 30, sizeY: 30, touchSizeX: 40, touchSizeY: 40,
    render: kreslic('\u2715', '#e11d48'),
    mouseUpHandler: (_e, transform) => {
      const o = transform.target; const c = o.canvas; if (!c) return false;
      c.remove(o); c.discardActiveObject(); c.requestRenderAll();
      return true;
    },
  });
  ovl.klonObjekt = new fabric.Control({
    x: -0.5, y: -0.5, offsetX: -22, offsetY: -22, cursorStyle: 'copy', sizeX: 30, sizeY: 30, touchSizeX: 40, touchSizeY: 40,
    render: kreslic('\u29C9', '#4f46e5'),
    mouseUpHandler: (_e, transform) => {
      const o = transform.target; const c = o.canvas; if (!c) return false;
      o.clone((k) => {
        k.set({ left: (o.left || 0) + 24, top: (o.top || 0) + 24, evented: true });
        c.add(k); c.setActiveObject(k); c.requestRenderAll();
      }, PRENOS);
      return true;
    },
  });
}

zaregistrujKontrolyDupZmaz();
