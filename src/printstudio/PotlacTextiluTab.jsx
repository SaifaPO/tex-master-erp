import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Shirt, AlertTriangle, Plus, Trash2, RefreshCw, ExternalLink, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import NumberInput from '../NumberInput';
import { Pole, Karta, ObchodneNastavenia, useErpProdukty, useNastavenia } from './AdminPomocky';

// POTLAČ TEXTILU (verejná stránka ?typ=potlac): zákazník vyberie produkt (tričko, mikina…), farbu, technológiu (DTF / rezaný transfer / sieťotlač),
// navrhne potlače na fotke produktu a zaplatí. Cenu potlače počíta server z Kostry cien (Potlače); tu sa spravujú PRODUKTY: fotky, farby, veľkosti,
// predajná cena textilu a pozície potlače na fotke. Jedna biela fotka stačí — farby sa prefarbujú automaticky.
const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const BUCKET = 'potlac-produkty';
const KATEGORIE = [['tricko', 'Tričko'], ['mikina', 'Mikina'], ['polokosela', 'Polokošeľa'], ['siltovka', 'Šiltovka'], ['ine', 'Iné']];
const TECH = [['dtf', 'DTF'], ['rezany', 'Rezaný transfer'], ['sietotlac', 'Sieťotlač']];
const eur = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(2)} €`);
const fotoUrl = (u) => (!u ? '' : u.startsWith('/') ? PRINTSTUDIO_BASE_URL + u : u);
const vstup = 'w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs';
const cislo = 'w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-white font-mono text-xs';

function FotoPole({ supabase, produkt, strana, hodnota, onZmena }) {
  const ref = useRef(null);
  const [bezi, setBezi] = useState(false);
  const nahraj = async (f) => {
    if (!f) return;
    setBezi(true);
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cesta = `${produkt.id}/${strana}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(cesta, f, { contentType: f.type || undefined, upsert: true });
      if (error) throw error;
      onZmena(supabase.storage.from(BUCKET).getPublicUrl(cesta).data.publicUrl);
    } catch (e) { window.alert('Nahratie fotky zlyhalo: ' + (e.message || e)); }
    setBezi(false);
  };
  return (
    <div className="space-y-1.5">
      <div className="text-slate-400 text-xs">{{ predok: 'Fotka spredu (povinná)', zadok: 'Fotka zozadu (voliteľná)', lavy: 'Fotka zľava (šiltovka)', pravy: 'Fotka sprava (šiltovka)' }[strana]}</div>
      <div className="aspect-[9/10] w-28 rounded-lg border border-slate-700 bg-white overflow-hidden flex items-center justify-center">
        {hodnota ? <img src={fotoUrl(hodnota)} alt="" className="w-full h-full object-contain" /> : <span className="text-[10px] text-slate-400 px-2 text-center">bez fotky</span>}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { nahraj(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex gap-1.5">
        <button type="button" onClick={() => ref.current?.click()} disabled={bezi} className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1"><Upload className="w-3 h-3" /> {bezi ? 'Nahrávam…' : 'Nahrať'}</button>
        {hodnota && strana !== 'predok' && <button type="button" onClick={() => onZmena(null)} className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-300 text-[11px]">Odstrániť</button>}
      </div>
    </div>
  );
}

function ProduktKarta({ supabase, p, umiestnenia, zmen, zmaz, otvoreny, prepni }) {
  const farby = Array.isArray(p.farby) ? p.farby : [];
  const poz = p.pozicie || {};
  const nastavPoz = (kod, pohlad, patch) => {
    const novy = { ...poz, [kod]: { ...(poz[kod] || {}) } };
    if (patch === null) { delete novy[kod][pohlad]; if (!novy[kod].predok && !novy[kod].zadok && !novy[kod].lavy && !novy[kod].pravy) delete novy[kod]; }
    else novy[kod][pohlad] = { x: 0.5, y: 0.2, kotva: 'stred', rot: 0, ...(poz[kod]?.[pohlad] || {}), ...patch };
    zmen(p.id, { pozicie: novy });
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <button type="button" onClick={prepni} className="w-full flex items-center gap-3 p-3 text-left">
        {otvoreny ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        <div className="w-10 h-11 rounded bg-white overflow-hidden shrink-0 flex items-center justify-center">{p.foto_predok_url ? <img src={fotoUrl(p.foto_predok_url)} alt="" className="w-full h-full object-contain" /> : <Shirt className="w-5 h-5 text-slate-300" />}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{p.nazov}</div>
          <div className="text-[11px] text-slate-400">textil {eur(p.cena_textilu_eur)} bez DPH · {farby.length} farieb · {(p.velkosti || []).length} veľkostí · {(p.technologie || []).map((t) => TECH.find((x) => x[0] === t)?.[1] || t).join(', ')}</div>
        </div>
        {!p.foto_predok_url && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">chýba fotka</span>}
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.aktivny ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{p.aktivny ? 'Zapnutý' : 'Vypnutý'}</span>
      </button>
      {otvoreny && (
        <div className="border-t border-slate-800 p-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 text-xs">Názov produktu</label>
              <input value={p.nazov} onChange={(e) => zmen(p.id, { nazov: e.target.value })} className={vstup} />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 text-xs">Kategória</label>
              <select value={p.kategoria} onChange={(e) => zmen(p.id, { kategoria: e.target.value })} className={vstup}>{KATEGORIE.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-slate-400 mb-1 text-xs">Popis pre zákazníka (voliteľný)</label>
              <input value={p.popis || ''} onChange={(e) => zmen(p.id, { popis: e.target.value })} className={vstup} />
              {/FIKT[ÍI]VN/i.test(p.popis || '') && <p className="text-[10px] text-amber-400 mt-0.5">Text obsahuje „FIKTÍVNA CENA“ — po doplnení skutočnej ceny ho zmažte (zákazník ho vtedy nevidí, ale nech tam nezostane).</p>}
            </div>
            <Pole label="Predajná cena textilu za kus" jednotka="€ bez DPH" value={p.cena_textilu_eur} onChange={(v) => zmen(p.id, { cena_textilu_eur: v })} pomoc="Platí, keď si zákazník objedná textil od nás." />
            <div>
              <label className="block text-slate-400 mb-1 text-xs">Materiál</label>
              <select value={p.material} onChange={(e) => zmen(p.id, { material: e.target.value })} className={vstup}><option value="bavlna">Bavlna</option><option value="polyester">Polyester (príplatok pri sieťotlači)</option></select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 text-xs">Veľkosti (oddelené čiarkou)</label>
              <input value={(p.velkosti || []).join(', ')} onChange={(e) => zmen(p.id, { velkosti: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} className={vstup} />
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-xs mb-1.5">Technológie dostupné pre tento produkt</div>
            <div className="flex flex-wrap gap-2">
              {TECH.map(([k, n]) => (
                <label key={k} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={(p.technologie || []).includes(k)} onChange={(e) => zmen(p.id, { technologie: e.target.checked ? [...(p.technologie || []), k] : (p.technologie || []).filter((x) => x !== k) })} /> {n}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-xs mb-1.5">Farby — fotka je biela a prefarbuje sa automaticky, nemusíte nahrávať fotku pre každú farbu</div>
            <div className="flex flex-wrap gap-2">
              {farby.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900">
                  <input type="color" value={f.hex} onChange={(e) => zmen(p.id, { farby: farby.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })} className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                  <input value={f.nazov} onChange={(e) => zmen(p.id, { farby: farby.map((x, j) => (j === i ? { ...x, nazov: e.target.value } : x)) })} className="w-24 px-1 py-0.5 bg-transparent text-white text-xs border-b border-slate-700" />
                  <button type="button" onClick={() => zmen(p.id, { farby: farby.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => zmen(p.id, { farby: [...farby, { nazov: 'Nová farba', hex: '#888888' }] })} className="px-2.5 py-1.5 rounded-lg border border-dashed border-slate-600 text-xs text-slate-300 hover:text-white flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať farbu</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <FotoPole supabase={supabase} produkt={p} strana="predok" hodnota={p.foto_predok_url} onZmena={(u) => zmen(p.id, { foto_predok_url: u })} />
            <FotoPole supabase={supabase} produkt={p} strana="zadok" hodnota={p.foto_zadok_url} onZmena={(u) => zmen(p.id, { foto_zadok_url: u })} />
            {(p.kategoria === 'siltovka' || p.foto_lavy_url || p.foto_pravy_url) && <>
              <FotoPole supabase={supabase} produkt={p} strana="lavy" hodnota={p.foto_lavy_url} onZmena={(u) => zmen(p.id, { foto_lavy_url: u })} />
              <FotoPole supabase={supabase} produkt={p} strana="pravy" hodnota={p.foto_pravy_url} onZmena={(u) => zmen(p.id, { foto_pravy_url: u })} />
            </>}
            <div className="flex-1 min-w-[16rem] space-y-2">
              <p className="text-[11px] text-slate-500 leading-snug">Fotka: produkt rozložený rovno na <strong>čisto bielom pozadí</strong> (bez modelky), celý v zábere. Odporúčané od dodávateľa produktu. Zadná fotka sa použije pri umiestneniach na chrbte.</p>
              <Pole label="Šírka fotky v skutočnosti" jednotka="cm" value={p.foto_sirka_cm} onChange={(v) => zmen(p.id, { foto_sirka_cm: v })} pomoc="Koľko cm reálne zodpovedá celej šírke fotky (nastavuje mierku potlače). Pri tričku M s telom ~52 cm je to približne 102." />
            </div>
          </div>

          <div>
            <div className="text-slate-400 text-xs mb-1">Kde sa potlač na fotke zobrazí</div>
            <p className="text-[11px] text-slate-500 mb-2">Poloha stredu (alebo horného okraja) potlače v % šírky/výšky fotky a natočenie. Prázdne umiestnenie = zákazník ho pri tomto produkte nedostane.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/60 text-slate-500"><tr><th className="text-left p-2">Umiestnenie</th><th className="text-left p-2">Pohľad</th><th className="p-2">Použiť</th><th className="p-2">X %</th><th className="p-2">Y %</th><th className="p-2">Natočenie °</th><th className="p-2">Kotva</th></tr></thead>
                <tbody>
                  {umiestnenia.flatMap((u) => ['predok', 'zadok', ...(p.foto_lavy_url ? ['lavy'] : []), ...(p.foto_pravy_url ? ['pravy'] : [])].map((pohlad, pi) => {
                    const z = poz[u.kod]?.[pohlad];
                    return (
                      <tr key={u.kod + pohlad} className="border-t border-slate-800 text-slate-300">
                        <td className="p-2">{pi === 0 ? u.nazov : ''}</td>
                        <td className="p-2 text-slate-500">{{ predok: 'spredu', zadok: 'zozadu', lavy: 'zľava', pravy: 'sprava' }[pohlad]}</td>
                        <td className="p-2 text-center"><input type="checkbox" checked={!!z} onChange={(e) => nastavPoz(u.kod, pohlad, e.target.checked ? {} : null)} /></td>
                        <td className="p-2 w-20"><NumberInput step="0.5" value={z ? Math.round(z.x * 1000) / 10 : ''} disabled={!z} onChange={(v) => nastavPoz(u.kod, pohlad, { x: v / 100 })} fallback={50} className={cislo} /></td>
                        <td className="p-2 w-20"><NumberInput step="0.5" value={z ? Math.round(z.y * 1000) / 10 : ''} disabled={!z} onChange={(v) => nastavPoz(u.kod, pohlad, { y: v / 100 })} fallback={20} className={cislo} /></td>
                        <td className="p-2 w-20"><NumberInput step="1" value={z ? z.rot || 0 : ''} disabled={!z} onChange={(v) => nastavPoz(u.kod, pohlad, { rot: v })} fallback={0} className={cislo} /></td>
                        <td className="p-2"><select disabled={!z} value={z?.kotva || 'stred'} onChange={(e) => nastavPoz(u.kod, pohlad, { kotva: e.target.value })} className="px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white"><option value="stred">stred</option><option value="hore">horný okraj</option></select></td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer"><input type="checkbox" checked={!!p.aktivny} onChange={(e) => zmen(p.id, { aktivny: e.target.checked })} /> Produkt je zapnutý (zákazník ho vidí — potrebuje fotku spredu)</label>
            <button type="button" onClick={zmaz} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Zmazať produkt</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PotlacTextiluTab({ supabase }) {
  const { nast, zmen, chyba, ulozene } = useNastavenia(supabase, 'potlac_nastavenia');
  const erp = useErpProdukty(supabase);
  const [produkty, setProdukty] = useState([]);
  const [umiestnenia, setUmiestnenia] = useState([]);
  const [objednavky, setObjednavky] = useState([]);
  const [otvoreny, setOtvoreny] = useState(null);
  const casovace = useRef({});

  const nacitaj = useCallback(async () => {
    const [p, um, ob] = await Promise.all([
      supabase.from('potlac_produkty').select('*').order('poradie'),
      supabase.from('sietotlac_umiestnenia').select('kod, nazov, poradie').eq('aktivny', true).order('poradie'),
      supabase.from('potlac_objednavky').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setProdukty(p.data || []); setUmiestnenia(um.data || []); setObjednavky(ob.data || []);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  // zmena produktu: okamžite v zozname, do databázy s malým oneskorením (písanie do textových polí)
  const zmenProdukt = (id, patch) => {
    setProdukty((rows) => rows.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    // viac zmien po sebe sa zlúči do jedného zápisu
    casovace.current[id + '_patch'] = { ...(casovace.current[id + '_patch'] || {}), ...patch };
    clearTimeout(casovace.current[id]);
    casovace.current[id] = setTimeout(async () => {
      const celok = casovace.current[id + '_patch']; casovace.current[id + '_patch'] = {};
      const { error } = await supabase.from('potlac_produkty').update(celok).eq('id', id);
      if (error) window.alert('Uloženie zlyhalo: ' + error.message);
    }, 600);
  };
  const pridajProdukt = async () => {
    const nazov = window.prompt('Názov nového produktu (napr. Mikina s kapucňou):');
    if (!nazov) return;
    const kod = nazov.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `produkt-${Date.now()}`;
    const vzor = produkty.find((x) => (x.farby || []).length) || {};
    const novy = { kod: `${kod}-${Date.now().toString(36).slice(-3)}`, nazov, kategoria: 'tricko', farby: vzor.farby || [], velkosti: ['S', 'M', 'L', 'XL', 'XXL'], poradie: produkty.reduce((m, x) => Math.max(m, x.poradie || 0), 0) + 1, aktivny: false };
    const { data, error } = await supabase.from('potlac_produkty').insert(novy).select().single();
    if (error) { window.alert('Pridanie zlyhalo: ' + error.message); return; }
    setProdukty((p) => [...p, data]); setOtvoreny(data.id);
  };
  const zmazProdukt = async (p) => {
    if (!window.confirm(`Naozaj zmazať produkt „${p.nazov}“? Radšej ho len vypnite.`)) return;
    const { error } = await supabase.from('potlac_produkty').delete().eq('id', p.id);
    if (error) { window.alert('Zmazanie zlyhalo: ' + error.message); return; }
    setProdukty((rows) => rows.filter((x) => x.id !== p.id));
  };
  const zmenObjednavku = async (id, patch) => {
    setObjednavky((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('potlac_objednavky').update(patch).eq('id', id);
    if (error) window.alert('Uloženie zlyhalo: ' + error.message);
  };
  const otvorSubor = async (cesta) => {
    const { data, error } = await supabase.storage.from('print-designs').createSignedUrl(cesta, 600);
    if (error || !data?.signedUrl) { window.alert('Súbor sa nepodarilo otvoriť: ' + (error?.message || 'chýba')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> Tabuľky ešte neexistujú — migrácia migration_potlac_textilu.sql (priečinok printstudio-pro) nebola spustená.</p>;
  if (!nast) return <p className="text-sm text-slate-500">Načítavam…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="text-indigo-400 h-5 w-5" /> Potlač textilu — produkty, farby a fotky</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">Zákazník si vyberie produkt a farbu, technológiu (DTF, rezaný transfer, sieťotlač), navrhne potlače na fotke a zaplatí. Cena <strong>potlače</strong> sa počíta z Kostry cien (Potlače) a maržového modulu, <strong>cena textilu</strong> je tu pri každom produkte. Sieťotlač (min. kusy, efekty, polyester) a umiestnenia sa nastavujú v karte Sieťotlač.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href={`${PRINTSTUDIO_BASE_URL}/?typ=potlac`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Otvoriť appku</a>
          <span className={ulozene ? 'text-emerald-400' : 'text-amber-400'}>{ulozene ? '✓ Uložené' : 'Ukladám…'}</span>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => zmen({ aktivny: e.target.checked })} /> Appka zapnutá</label>
        </div>
      </div>

      <Karta nadpis="Nastavenia appky">
        <Pole label="Maximálny počet" jednotka="ks" step="1" value={nast.max_ks} onChange={(v) => zmen({ max_ks: Math.max(1, Math.round(v)) })} pomoc="Nad toto číslo appka vyzve zákazníka, aby napísal." />
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-slate-400 mb-1 text-xs">E-mail pre upozornenia (voliteľné)</label>
          <input type="email" value={nast.email_notifikacie || ''} onChange={(e) => zmen({ email_notifikacie: e.target.value })} placeholder="napr. objednavky@pbtprint.sk" className={vstup} />
          <p className="text-[10px] text-slate-600 mt-0.5">Zaplatené objednávky chodia do zákaziek automaticky.</p>
        </div>
      </Karta>

      <ObchodneNastavenia nast={nast} zmen={zmen} supabase={supabase} {...erp} />

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-white">Produkty</h3>
            <p className="text-[11px] text-slate-500">Ceny textilu označené „FIKTÍVNA CENA“ v popise doplňte skutočnými. Produkty bez fotky zákazník nevidí, kým ich nenahráte.</p>
          </div>
          <button onClick={pridajProdukt} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Pridať produkt</button>
        </div>
        <div className="space-y-2">
          {produkty.map((p) => (
            <ProduktKarta key={p.id} supabase={supabase} p={p} umiestnenia={umiestnenia} zmen={zmenProdukt} zmaz={() => zmazProdukt(p)} otvoreny={otvoreny === p.id} prepni={() => setOtvoreny(otvoreny === p.id ? null : p.id)} />
          ))}
          {produkty.length === 0 && <p className="text-xs text-slate-500">Zatiaľ žiadne produkty.</p>}
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Zaplatené a vytvorené objednávky</h3>
          <button onClick={nacitaj} className="text-slate-400 hover:text-white text-xs flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Obnoviť</button>
        </div>
        {objednavky.length === 0 ? <p className="text-xs text-slate-500">Zatiaľ žiadne objednávky. Zákazky v ERP vzniknú automaticky po zaplatení v Shopify.</p> : (
          <div className="space-y-2">
            {objednavky.map((o) => (
              <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-indigo-300">{o.cislo_objednavky}</span>
                  <span>{TECH.find((t) => t[0] === o.technologia)?.[1] || o.technologia} · {o.pocet_ks} ks · {o.vlastny_textil ? 'vlastný textil' : `${o.produkt_nazov}, ${o.farba_nazov}`}</span>
                  {!o.vlastny_textil && o.velkosti && <span className="text-slate-400">{Object.entries(o.velkosti).map(([k, q]) => `${k}×${q}`).join(' ')}</span>}
                  <span>{eur(o.cena_spolu)} s DPH{o.b2b_kod ? ` · B2B ${o.b2b_kod}` : ''}</span>
                  {o.erp_cislo ? <span className="text-emerald-300">zákazka {o.erp_cislo}</span> : <span className="text-amber-300">čaká na zaplatenie</span>}
                  <span className="text-slate-500 ml-auto">{new Date(o.created_at).toLocaleString('sk-SK')}</span>
                  <select value={o.stav} onChange={(e) => zmenObjednavku(o.id, { stav: e.target.value })} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white">
                    {[['nova', 'Nová'], ['v_tlaci', 'V tlači'], ['odoslana', 'Odoslaná'], ['zrusena', 'Zrušená']].map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(o.polozky || []).map((p, i) => (
                    <button key={i} onClick={() => p.suborCesta && otvorSubor(p.suborCesta)} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-left">
                      <span className="text-white font-medium">{p.nazov}</span> · {p.sirkaCm}×{p.vyskaCm} cm{o.technologia !== 'dtf' ? ` · ${p.farby} f.` : ''}{p.suborCesta ? ' · ⬇ grafika' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
