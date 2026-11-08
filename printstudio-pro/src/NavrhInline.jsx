import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import PlochaEditor from './fabricEditor/PlochaEditor';

// Návrh motívu PRIAMO na stránke (nie v samostatnom okne): plocha má veľkosť maxima pre dané umiestnenie, nič sa neoseká a rozmer potlače sa
// určí automaticky podľa motívu. Počas kreslenia sa motív hneď zobrazuje aj na náhľade produktu (tričko). Tlačový PNG (priehľadné pozadie,
// orezaný na motív) sa pripraví automaticky; pred objednávkou ho vie rodič dožiadať cez registruj(id, flush).
const MAX_PX = 4096;

export default function NavrhInline({ supabase, id, maxSirkaCm, maxVyskaCm, podkladFarba, upozornenie, povodnyJson, onZmena, registruj, onZavri }) {
  const editorRef = useRef(null);
  const [d, setD] = useState({ fonty: [], grafiky: [] });
  const casZivy = useRef(null);
  const casFinal = useRef(null);
  const onZmenaRef = useRef(onZmena);
  useEffect(() => { onZmenaRef.current = onZmena; }, [onZmena]);
  const sirkaMm = Math.max(10, Math.round(maxSirkaCm * 10)), vyskaMm = Math.max(10, Math.round(maxVyskaCm * 10));
  const ppm = Math.max(sirkaMm, vyskaMm) > 300 ? 1 : 2;

  useEffect(() => {
    let zrusene = false;
    (async () => {
      const [f, g] = await Promise.all([
        supabase.from('fonty').select('*').order('id'),
        supabase.from('grafiky').select('id, nazov, url, kategoria').order('nazov'),
      ]);
      if (!zrusene) setD({ fonty: f.data || [], grafiky: g.data || [] });
    })();
    return () => { zrusene = true; };
  }, [supabase]);

  const cm = (mm) => Math.max(1, Math.round(mm) / 10);

  const zivy = useCallback(() => {
    const e = editorRef.current; if (!e) return;
    const z = e.zivyNahlad(360);
    if (!z) { onZmenaRef.current?.({ nahlad: null, subor: null, navrhJson: null }); return; }
    onZmenaRef.current?.({ nahlad: z.nahlad, sirka: cm(z.sirkaMm), vyska: cm(z.vyskaMm), navrhJson: z.json });
  }, []);

  const finalny = useCallback(async () => {
    const e = editorRef.current; if (!e) return null;
    const r = await e.exportujOrezane({ maxPx: MAX_PX });
    if (!r) return null;
    const subor = new File([r.blob], `navrh_${Date.now()}.png`, { type: 'image/png' });
    const patch = { subor, sirka: cm(r.sirkaMm), vyska: cm(r.vyskaMm), navrhJson: r.json };
    onZmenaRef.current?.(patch);
    return patch;
  }, []);

  useEffect(() => { registruj?.(id, finalny); return () => registruj?.(id, null); }, [id, finalny, registruj]);

  const naZmenu = useCallback(() => {
    clearTimeout(casZivy.current); clearTimeout(casFinal.current);
    casZivy.current = setTimeout(zivy, 180);
    casFinal.current = setTimeout(finalny, 1300);
  }, [zivy, finalny]);
  useEffect(() => () => { clearTimeout(casZivy.current); clearTimeout(casFinal.current); }, []);

  // opätovné otvorenie návrhu — načítaj uložený stav
  useEffect(() => {
    if (!povodnyJson) return undefined;
    const t = setTimeout(() => editorRef.current?.nacitajFront(povodnyJson), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-2 sm:p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-slate-600 leading-snug">Kreslite priamo tu — motív sa hneď zobrazuje na náhľade produktu. Plocha je maximum pre toto umiestnenie (<strong>{maxSirkaCm} × {maxVyskaCm} cm</strong>), nič sa neoseká. <strong>Rozmer potlače sa určí automaticky podľa motívu.</strong></p>
        <button type="button" onClick={onZavri} className="shrink-0 text-xs font-semibold text-indigo-700 hover:text-indigo-600 flex items-center gap-1"><ChevronUp className="w-3.5 h-3.5" /> Zavrieť</button>
      </div>
      {upozornenie && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-snug">{upozornenie}</p>}
      <PlochaEditor ref={editorRef} sirkaMm={sirkaMm} vyskaMm={vyskaMm} ppm={ppm} jednaStrana priehladne podkladFarba={podkladFarba} fonty={d.fonty} grafiky={d.grafiky} onZmena={naZmenu} maxVyskaVh={0.4}>
        {({ nastroje, plocha }) => (
          <div className="space-y-3">
            {plocha}
            <div>{nastroje}</div>
          </div>
        )}
      </PlochaEditor>
    </div>
  );
}
