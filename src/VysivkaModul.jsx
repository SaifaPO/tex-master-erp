/**
 * VysivkaModul – výšivkový editor (Stitch Editor) vložený do TEX-MASTER ERP.
 *
 * Editor je samostatná stránka v /public/apps/vysivka/index.html (beží celý v prehliadači).
 * Tento komponent ho zobrazí v iframe a cez postMessage:
 *   - pošle mu logo/predlohu zákazky alebo naposledy uložený projekt,
 *   - prijme hotový výsledok (DST, náhľad PNG, výrobný list, projekt, súpiska) a uloží ho
 *     do Supabase Storage (bucket "vysivky") + záznam do tabuľky public.vysivky.
 *
 * Použitie:
 *   <VysivkaModul supabase={supabase} zakazka={{ id, cislo, zakaznik, predlohaPath }} onUlozene={row => ...} />
 *   zakazka je voliteľná – bez nej editor funguje ako samostatný nástroj (Export pre stroj).
 *
 * Prispôsobené pre ERP: zákazka = riadok z tabuľky orders (id je text); logo zákazky sa berie z verejného odkazu predlohaUrl
 * (príloha/rozpis položky zákazky), prípadne z cesty v Storage (predlohaPath + predlohaBucket).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const BUCKET = 'vysivky';
const TABLE = 'vysivky';

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const asBlob = (data, type) => (data instanceof Blob ? data : new Blob([data], { type }));

export default function VysivkaModul({ supabase, zakazka = null, onUlozene, vyska = 'calc(100vh - 120px)' }) {
  const frameRef = useRef(null);
  const [autoVyska, setAutoVyska] = useState(640);
  const [stav, setStav] = useState('');
  const [historia, setHistoria] = useState([]);

  const src = '/apps/vysivka/index.html?embed=1'
    + (zakazka ? `&order=${encodeURIComponent(zakazka.id)}&label=${encodeURIComponent(`${zakazka.cislo ?? ''} · ${zakazka.zakaznik ?? ''}`)}` : '');

  const post = useCallback(msg => frameRef.current?.contentWindow?.postMessage(msg, window.location.origin), []);

  const nacitajHistoriu = useCallback(async () => {
    if (!zakazka) return;
    const { data, error } = await supabase.from(TABLE).select('*').eq('zakazka_id', zakazka.id).order('created_at', { ascending: false });
    if (!error) setHistoria(data || []);
  }, [supabase, zakazka]);

  const stiahni = useCallback(async path => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    return error ? null : data; // Blob
  }, [supabase]);

  // Otvorí uložený dizajn (projekt + predlohu) v editore
  const otvorDizajn = useCallback(async row => {
    setStav('Otváram uložený dizajn…');
    const projektBlob = await stiahni(row.subory?.projekt);
    if (!projektBlob) { setStav('Projekt sa nepodarilo stiahnuť.'); return; }
    const project = JSON.parse(await projektBlob.text());
    const image = await stiahni(row.subory?.predloha);
    post({ type: 'stitch:load', project, image, orderId: zakazka?.id, orderLabel: zakazka ? `${zakazka.cislo ?? ''} · ${zakazka.zakaznik ?? ''}` : undefined });
    setStav('');
  }, [post, stiahni, zakazka]);

  // Uloženie výsledku z editora do Storage + DB
  const uloz = useCallback(async m => {
    if (!zakazka) return;
    setStav('Ukladám výšivku do zákazky…');
    try {
      const base = `${zakazka.id}/${stamp()}_${m.fileBase}`;
      const up = async (path, data, type) => {
        const { error } = await supabase.storage.from(BUCKET).upload(path, asBlob(data, type), { contentType: type, upsert: false });
        if (error) throw error;
        return path;
      };
      const subory = {
        dst: await up(`${base}.dst`, m.files.dst, 'application/octet-stream'),
        nahlad: await up(`${base}_nahlad.png`, m.files.png, 'image/png'),
        vyrobny_list: await up(`${base}_vyrobny_list.html`, m.files.sheet, 'text/html'),
        projekt: await up(`${base}_projekt.json`, JSON.stringify(m.files.project), 'application/json'),
        predloha: m.files.source ? await up(`${base}_predloha${m.files.source.type === 'image/jpeg' ? '.jpg' : '.png'}`, m.files.source, m.files.source.type || 'image/png') : null,
      };
      let supiska = null;
      if (m.roster?.length) {
        supiska = [];
        for (const r of m.roster) {
          const path = await up(`${base}_supiska/${r.file}`, r.dst, 'application/octet-stream');
          supiska.push({ cislo: r.num, meno: r.name, subor: path, stehov: r.stitches, minut: r.minutes });
        }
      }
      const row = {
        zakazka_id: zakazka.id,
        nazov: m.name,
        stehov: m.stats.stitches,
        minut: m.stats.minutes,
        rychlost: m.stats.speed,
        farieb: m.stats.colors,
        vymen_niti: m.stats.colorChanges,
        strihov: m.stats.trims,
        sirka_mm: m.stats.widthMM,
        vyska_mm: m.stats.heightMM,
        spotreba_nite_m: m.stats.threadMeters,
        nite: m.threads,
        subory,
        supiska,
      };
      const { data, error } = await supabase.from(TABLE).insert(row).select().single();
      if (error) throw error;
      setStav(`Uložené: ${m.name} · ${m.stats.stitches.toLocaleString('sk-SK')} stehov`);
      nacitajHistoriu();
      onUlozene?.(data);
    } catch (e) {
      console.error(e);
      setStav('Uloženie zlyhalo: ' + (e.message || e));
    }
  }, [supabase, zakazka, nacitajHistoriu, onUlozene]);

  useEffect(() => { nacitajHistoriu(); }, [nacitajHistoriu]);

  // vyska="auto": editor vyplní presne zvyšok okna a stránka okolo sa nescrolluje (žiadny vonkajší posuvník, scrolluje sa len v editore)
  useEffect(() => {
    if (vyska !== 'auto') return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    const prepocitaj = () => {
      const r = frameRef.current?.getBoundingClientRect();
      if (!r) return;
      setAutoVyska(Math.max(420, Math.floor(window.innerHeight - (r.top + window.scrollY) - 56)));
    };
    prepocitaj();
    const t = setTimeout(prepocitaj, 400);
    window.addEventListener('resize', prepocitaj);
    return () => { clearTimeout(t); window.removeEventListener('resize', prepocitaj); document.documentElement.style.overflow = prev; };
  }, [vyska, historia.length, stav]);

  useEffect(() => {
    const onMsg = async e => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const m = e.data || {};
      if (m.type === 'stitch:ready') {
        if (!zakazka) return;
        // 1) posledný uložený dizajn zákazky, 2) predloha/logo zo zákazky, 3) nič (grafik nahrá sám)
        const { data } = await supabase.from(TABLE).select('*').eq('zakazka_id', zakazka.id).order('created_at', { ascending: false }).limit(1);
        if (data?.length) return otvorDizajn(data[0]);
        if (zakazka.predlohaUrl) {
          try {
            const odp = await fetch(zakazka.predlohaUrl);
            if (odp.ok) post({ type: 'stitch:load', image: await odp.blob(), name: zakazka.zakaznik || 'Vysivka', orderId: zakazka.id });
          } catch { /* logo sa nepodarilo načítať — grafik ho nahrá priamo v editore */ }
        } else if (zakazka.predlohaPath) {
          const { data: img } = await supabase.storage.from(zakazka.predlohaBucket || 'zakazky').download(zakazka.predlohaPath);
          if (img) post({ type: 'stitch:load', image: img, name: zakazka.zakaznik || 'Vysivka', orderId: zakazka.id });
        }
      }
      if (m.type === 'stitch:save') uloz(m);
      if (m.type === 'stitch:error') setStav('Editor: ' + m.message);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [supabase, zakazka, otvorDizajn, uloz, post]);

  const odkaz = async path => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <div className="flex flex-col gap-2">
      {zakazka && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">Výšivky zákazky {zakazka.cislo}</span>
          {historia.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">
              <button className="font-medium hover:underline" onClick={() => otvorDizajn(r)} title="Otvoriť v editore">
                {r.nazov} · {Number(r.stehov).toLocaleString('sk-SK')} st · {Math.round(r.minut)} min
              </button>
              <button className="text-xs text-teal-400 hover:underline" onClick={() => odkaz(r.subory.dst)}>DST</button>
              <button className="text-xs text-teal-400 hover:underline" onClick={() => odkaz(r.subory.vyrobny_list)}>list</button>
            </span>
          ))}
          {stav && <span className="text-slate-400">{stav}</span>}
        </div>
      )}
      <iframe
        ref={frameRef}
        src={src}
        title="Výšivka – Stitch Editor"
        style={{ width: '100%', height: vyska === 'auto' ? autoVyska : vyska, border: 0, borderRadius: 12, background: '#e9e7e3', display: 'block' }}
      />
    </div>
  );
}
