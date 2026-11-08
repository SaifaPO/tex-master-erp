import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import PlochaEditor from './fabricEditor/PlochaEditor';
import { pripravFotkuCache, vyfarbiFotku } from './trickoFarba';

// Editor motívov PRIAMO NA PRODUKTE (tričko): zákazník vkladá text a logá rovno na fotku trička, ťahá ich, otáča, duplikuje, maže, mení poradie vrstiev,
// magneticky ich centruje a vidí skutočné rozmery v mm. Potlačové plochy (zóny: hruď, chrbát, rukávy…) sú vyznačené prerušovane; objekt patrí do zóny,
// do ktorej bol vložený. Z obsahu každej zóny sa robí tlač (veľkosť potlače = veľkosť motívu, orezané, bez skreslenia rotácie rukáva).
const cm = (mm) => Math.max(1, Math.round(mm) / 10);

const TrickoEditor = forwardRef(function TrickoEditor({ supabase, produkt, farbaHex, umiestnenia, tlace, aktivnaId, onZivy, children }, ref) {
  const edRef = useRef(null);
  const [fotky, setFotky] = useState({ front: null, back: null, w: 900, h: 1017 });
  const [d, setD] = useState({ fonty: [], grafiky: [] });
  const tlaceRef = useRef(tlace);
  useEffect(() => { tlaceRef.current = tlace; }, [tlace]);
  const onZivyRef = useRef(onZivy);
  useEffect(() => { onZivyRef.current = onZivy; }, [onZivy]);
  const cas = useRef(null);

  // fotky produktu (biele) -> prefarbenie na zvolenú farbu textilu
  useEffect(() => {
    let zrusene = false;
    (async () => {
      try {
        const pf = await pripravFotkuCache(produkt.fotoPredok);
        const pb = produkt.fotoZadok ? await pripravFotkuCache(produkt.fotoZadok) : null;
        if (zrusene) return;
        setFotky({ front: vyfarbiFotku(pf, farbaHex), back: pb ? vyfarbiFotku(pb, farbaHex) : null, w: pf.w, h: pf.h });
      } catch { /* fotka sa nenačítala */ }
    })();
    return () => { zrusene = true; };
  }, [produkt.fotoPredok, produkt.fotoZadok, farbaHex]);

  useEffect(() => {
    let zrusene = false;
    (async () => {
      const [f, g] = await Promise.all([supabase.from('fonty').select('*').order('id'), supabase.from('grafiky').select('id, nazov, url, kategoria').order('nazov')]);
      if (!zrusene) setD({ fonty: f.data || [], grafiky: g.data || [] });
    })();
    return () => { zrusene = true; };
  }, [supabase]);

  const sirkaMm = produkt.fotoSirkaCm * 10;
  const ppm = fotky.w / sirkaMm; // px plátna na mm
  const vyskaMm = fotky.h / ppm;

  const zony = useMemo(() => tlace.map((t) => {
    const poz = produkt.pozicie?.[t.umiestnenie]; const u = umiestnenia.find((x) => x.kod === t.umiestnenie);
    if (!poz || !u) return null;
    const jePredok = !!poz.predok; const v = poz.predok || poz.zadok; if (!v) return null;
    const sleeve = /^rukav/.test(t.umiestnenie);
    const w = u.maxSirkaCm * 10 * ppm, h = Math.min(u.maxVyskaCm, sleeve ? 12 : u.maxVyskaCm) * 10 * ppm;
    return { kod: t.umiestnenie, strana: jePredok ? 'front' : 'back', cx: v.x * fotky.w, cy: v.kotva === 'hore' ? v.y * fotky.h + h / 2 : v.y * fotky.h, w, h, rot: v.rot || 0, popis: `${u.nazov} · max ${u.maxSirkaCm} × ${Math.min(u.maxVyskaCm, sleeve ? 12 : u.maxVyskaCm)} cm`, nazov: u.nazov };
  }).filter(Boolean), [tlace.map((t) => t.umiestnenie).join('|'), umiestnenia, produkt, ppm, fotky.w, fotky.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const aktivna = tlace.find((t) => t.id === aktivnaId);
  const aktivnaKod = aktivna && zony.some((z) => z.kod === aktivna.umiestnenie) ? aktivna.umiestnenie : null;
  const aktivnaZonaObj = zony.find((z) => z.kod === aktivnaKod);

  // živý náhľad: rozmer a miniatúra motívu v každej zóne
  const prepocitaj = useCallback(async () => {
    const ed = edRef.current; if (!ed) return;
    const out = {};
    for (const t of tlaceRef.current) {
      const r = await ed.zona(t.umiestnenie, { malyPx: 240 });
      out[t.id] = r ? { nahlad: r.url, sirka: cm(r.sirkaMm), vyska: cm(r.vyskaMm), maNavrh: true, presah: !!r.presah } : { maNavrh: false };
    }
    onZivyRef.current?.(out);
  }, []);
  const naZmenu = useCallback(() => { clearTimeout(cas.current); cas.current = setTimeout(prepocitaj, 220); }, [prepocitaj]);
  useEffect(() => () => clearTimeout(cas.current), []);

  useImperativeHandle(ref, () => ({
    // tlačové PNG všetkých zón s motívom (pred objednávkou)
    async dokonci() {
      const ed = edRef.current; const out = {};
      if (!ed) return out;
      for (const t of tlaceRef.current) {
        const r = await ed.zona(t.umiestnenie, { maxPx: 4096 });
        if (!r) continue;
        const blob = await fetch(r.url).then((x) => x.blob());
        out[t.id] = { subor: new File([blob], `navrh_${t.umiestnenie}.png`, { type: 'image/png' }), sirka: cm(r.sirkaMm), vyska: cm(r.vyskaMm), maNavrh: true };
      }
      return out;
    },
    pridajObrazok: (file) => edRef.current?.pridajObrazok?.(file),
    odstranZonu: (kod) => edRef.current?.odstranZonu?.(kod),
    presunZonu: (a, b) => edRef.current?.presunZonu?.(a, b),
  }), []);

  if (!fotky.front) return <div className="h-48 flex items-center justify-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Načítavam produkt…</div>;

  return (
    <PlochaEditor ref={edRef} sirkaMm={sirkaMm} vyskaMm={vyskaMm} ppm={ppm} priehladne jedenPohlad podkladUrl={{ front: fotky.front, back: fotky.back || fotky.front }}
      podkladFarba="#ffffff" zony={zony} aktivnaZona={aktivnaKod} nazvyStran={['Spredu', 'Zozadu']} fonty={d.fonty} grafiky={d.grafiky}
      popisVkladania={aktivnaZonaObj ? aktivnaZonaObj.nazov : null} onZmena={naZmenu} maxVyskaVh={0.4}>
      {children}
    </PlochaEditor>
  );
});

export default TrickoEditor;
