// Pomocné funkcie pre nahrávané obrázky (logá, grafiky) v 3D generátore dresov.

export const nacitajObrazok = (src, crossOrigin = false) => new Promise((resolve) => {
  const img = new Image();
  if (crossOrigin) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

export const nacitajZoSuboru = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (ev) => nacitajObrazok(ev.target.result).then(resolve);
  reader.onerror = () => resolve(null);
  reader.readAsDataURL(file);
});

// Odstráni biele (svetlé) pozadie obrázka — len súvislú plochu napojenú na okraj, takže biele časti vo vnútri loga ostanú.
// Hodí sa na logá z ChatGPT/Gemini, ktoré často nevedia vygenerovať priehľadné pozadie. Vráti nový obrázok (PNG).
export async function odstranBielePozadie(img, tolerancia = 28) {
  const maxRozmer = 1024;
  const k = Math.min(1, maxRozmer / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  const prah = 255 - tolerancia;
  const jeBiely = (i) => px[i + 3] > 0 && px[i] >= prah && px[i + 1] >= prah && px[i + 2] >= prah;
  const navstivene = new Uint8Array(w * h);
  const zasobnik = [];
  const pridaj = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const idx = y * w + x; if (navstivene[idx] || !jeBiely(idx * 4)) return; navstivene[idx] = 1; zasobnik.push(idx); };
  for (let x = 0; x < w; x++) { pridaj(x, 0); pridaj(x, h - 1); }
  for (let y = 0; y < h; y++) { pridaj(0, y); pridaj(w - 1, y); }
  while (zasobnik.length) {
    const idx = zasobnik.pop();
    px[idx * 4 + 3] = 0;
    const x = idx % w, y = (idx - x) / w;
    pridaj(x + 1, y); pridaj(x - 1, y); pridaj(x, y + 1); pridaj(x, y - 1);
  }
  g.putImageData(data, 0, 0);
  return nacitajObrazok(c.toDataURL('image/png'));
}
