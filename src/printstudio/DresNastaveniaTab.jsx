import React, { useEffect, useState } from 'react';
import { Shirt, Plus, Trash2, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
// Orientacna spotreba latky na jeden dospely dres (predok+chrbat spolu), pri bezne pouzivanej
// 160cm sirokej rolke — 1,2 bm × 1,6 m ≈ 1,92 m². Pouziva sa LEN na dopocet priplatku pri
// prepojeni na sklad. material (Dres3D pouziva plochy priplatok €/ks, nie cenu €/m² priamo).
const REFERENCNA_SPOTREBA_M2 = 1.92;
function vypocitajPriplatokZoSkladu(skladMaterial) {
  if (!skladMaterial || !skladMaterial.width || skladMaterial.width <= 0) return null;
  const sirkaM = skladMaterial.width / 100;
  const cenaM2 = (Number(skladMaterial.price_per_m) || 0) / sirkaM;
  return Math.round(cenaM2 * REFERENCNA_SPOTREBA_M2 * 100) / 100;
}

// Rovnaké statické zoznamy vzorov/golierov ako v printstudio-pro/src/dres3d/dresPresets.js —
// duplikované zámerne (samostatný Vite projekt, iné node_modules), toto je len zoznam
// id/label pre admin checkboxy, nie kresliaca logika.
const VSETKY_VZORY = [
  { id: 'stripes', nazov: 'Zvislé Pruhy' },
  { id: 'hoops', nazov: 'Vodorovné Pásy' },
  { id: 'sash', nazov: 'Šikmý Pás' },
  { id: 'honeycomb', nazov: 'Hexagon Vzor' },
  { id: 'chevron', nazov: 'Modern Chevron' },
  { id: 'gradient', nazov: 'Gradient Fade' },
  { id: 'modern', nazov: 'Glitch / Digital' },
  { id: 'camo', nazov: 'Polygon Camo' },
  { id: 'plain', nazov: 'Hladký Minimal' },
];
const VSETKY_GOLIERE = [
  { id: 'round', nazov: 'Okrúhly' },
  { id: 'vneck', nazov: 'V-Výstrih' },
  { id: 'ribbed', nazov: 'Rebrovaný' },
];
const PREDVOLENE_FARBY = { farba_zakladna: '#1e3a8a', farba_vzor: '#dc2626', farba_akcent: '#f59e0b', farba_rukava: '#1e3a8a', farba_golier: '#ffffff' };

export default function DresNastaveniaTab({ supabase }) {
  const [produkty, setProdukty] = useState([]);
  const [vsetkyProdukty, setVsetkyProdukty] = useState([]);
  const [novyProduktId, setNovyProduktId] = useState('');
  const [vybranyId, setVybranyId] = useState(null);
  const [nastavenia, setNastavenia] = useState(null);
  const [materialy, setMaterialy] = useState([]);
  const [skladMaterialy, setSkladMaterialy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const nacitajZoznamProduktov = async () => {
    const [{ data: dresProdukty }, { data: vsetky }, { data: sm }] = await Promise.all([
      supabase.from('produkty').select('id, nazov, shopify_handle').eq('typ_konfiguratora', '3d_dres').order('nazov'),
      supabase.from('produkty').select('id, nazov, shopify_handle, typ_konfiguratora').order('nazov'),
      // Len materialy predavane na bezny meter (latky) — ostatne (ks, kg...) sa sem nehodia.
      supabase.from('materials').select('id, name, color, price_per_m, width, unit, qty').eq('unit', 'm').order('name'),
    ]);
    setProdukty(dresProdukty || []);
    setVsetkyProdukty(vsetky || []);
    setSkladMaterialy(sm || []);
    setVybranyId(prev => prev ?? (dresProdukty && dresProdukty.length > 0 ? dresProdukty[0].id : null));
    setIsLoading(false);
  };

  useEffect(() => { nacitajZoznamProduktov(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nastavAko3dDres = async () => {
    if (!novyProduktId) return;
    const { error } = await supabase.from('produkty').update({ typ_konfiguratora: '3d_dres' }).eq('id', Number(novyProduktId));
    if (error) { window.alert('Nepodarilo sa nastaviť: ' + error.message); return; }
    setNovyProduktId('');
    setVybranyId(Number(novyProduktId));
    await nacitajZoznamProduktov();
  };

  useEffect(() => {
    if (vybranyId == null) return;
    nacitajProdukt(vybranyId);
  }, [vybranyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nacitajProdukt = async (produktId) => {
    const [{ data: n }, { data: m }] = await Promise.all([
      supabase.from('produkt_dres_nastavenia').select('*').eq('produkt_id', produktId).maybeSingle(),
      supabase.from('produkt_dres_materialy').select('*').eq('produkt_id', produktId).order('poradie'),
    ]);
    if (n) {
      setNastavenia(n);
    } else {
      const novy = {
        produkt_id: produktId, ...PREDVOLENE_FARBY,
        dostupne_vzory: VSETKY_VZORY.map(v => v.id),
        dostupne_goliere: VSETKY_GOLIERE.map(g => g.id),
      };
      const { data } = await supabase.from('produkt_dres_nastavenia').insert(novy).select().single();
      setNastavenia(data || novy);
    }
    setMaterialy(m || []);
  };

  const uprav = async (patch) => {
    setNastavenia(n => ({ ...n, ...patch }));
    await supabase.from('produkt_dres_nastavenia').update(patch).eq('produkt_id', vybranyId);
  };

  const prepniVPoli = (pole, id) => {
    const aktualne = nastavenia[pole] || [];
    const nove = aktualne.includes(id) ? aktualne.filter(x => x !== id) : [...aktualne, id];
    uprav({ [pole]: nove });
  };

  const pridajMaterial = async () => {
    const patch = { produkt_id: vybranyId, kod: `material_${Date.now()}`, nazov: 'Nový materiál', priplatok_eur: 0, poradie: materialy.length };
    const { data, error } = await supabase.from('produkt_dres_materialy').insert(patch).select().single();
    if (!error && data) setMaterialy(m => [...m, data]);
  };

  const upravMaterial = async (id, patch) => {
    setMaterialy(m => m.map(x => x.id === id ? { ...x, ...patch } : x));
    await supabase.from('produkt_dres_materialy').update(patch).eq('id', id);
  };

  const zmazMaterial = async (id) => {
    if (!window.confirm('Zmazať tento materiál?')) return;
    setMaterialy(m => m.filter(x => x.id !== id));
    await supabase.from('produkt_dres_materialy').delete().eq('id', id);
  };

  // Prepojenie na sklad. material — hned dopocita a ulozi aj priplatok_eur, ak sa da (ma vyplnenu sirku).
  const pripojSklad = async (m, skladMaterialId) => {
    if (!skladMaterialId) { await upravMaterial(m.id, { sklad_material_id: null }); return; }
    const sklad = skladMaterialy.find(s => s.id === skladMaterialId);
    const vypocet = vypocitajPriplatokZoSkladu(sklad);
    const patch = vypocet != null ? { sklad_material_id: skladMaterialId, priplatok_eur: vypocet } : { sklad_material_id: skladMaterialId };
    await upravMaterial(m.id, patch);
  };
  const prepocitajZoSkladu = async (m) => {
    const sklad = skladMaterialy.find(s => s.id === m.sklad_material_id);
    const vypocet = vypocitajPriplatokZoSkladu(sklad);
    if (vypocet != null) await upravMaterial(m.id, { priplatok_eur: vypocet });
  };

  if (isLoading) return <p className="text-sm text-slate-500">Načítavam…</p>;

  const vybranyProdukt = produkty.find(p => p.id === vybranyId);
  const produktyNaVyber = vsetkyProdukty.filter(p => p.typ_konfiguratora !== '3d_dres');

  const pridajProduktBlok = (
    <div className="bg-slate-900/60 rounded-2xl border border-dashed border-slate-700 p-4 space-y-2">
      <h3 className="font-bold text-sm text-white">Pridať produkt ako 3D dres konfigurátor</h3>
      <p className="text-xs text-slate-400">Vyber existujúci produkt z katalógu (printstudio-pro) a appka mu nastaví typ konfigurátora — potom sa dá hneď skúšobne otvoriť nižšie.</p>
      <div className="flex flex-wrap gap-2">
        <select value={novyProduktId} onChange={(e) => setNovyProduktId(e.target.value)} className="flex-1 min-w-[200px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
          <option value="">Vyber produkt...</option>
          {produktyNaVyber.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
        </select>
        <button onClick={nastavAko3dDres} disabled={!novyProduktId} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-lg flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nastaviť</button>
      </div>
      {vsetkyProdukty.length === 0 && <p className="text-xs text-amber-400">V katalógu (printstudio-pro) zatiaľ nie je žiadny produkt — najprv ho pridaj v záložke "Produkty (Blanks)".</p>}
    </div>
  );

  if (produkty.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-slate-400">
          Zatiaľ žiadny produkt nemá nastavený 3D dres konfigurátor — preto tu nič nevidno. Pridaj ho nižšie.
        </div>
        {pridajProduktBlok}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pridajProduktBlok}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="text-indigo-400 h-5 w-5" /> Nastavenia 3D dresu</h2>
          <p className="text-xs text-slate-400 mt-1">Predvolené farby zón, dostupné vzory/goliere a materiály na produkt.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={vybranyId || ''} onChange={(e) => setVybranyId(Number(e.target.value))} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
            {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
          </select>
          {vybranyProdukt?.shopify_handle ? (
            <a href={`${PRINTSTUDIO_BASE_URL}/?produkt=${encodeURIComponent(vybranyProdukt.shopify_handle)}`} target="_blank" rel="noreferrer" className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-lg flex items-center gap-1.5"><ExternalLink className="h-4 w-4" /> Otvoriť na test</a>
          ) : (
            <span className="text-[11px] text-amber-400 max-w-[200px]">Produkt nemá vyplnený Shopify handle — test link nejde vygenerovať.</span>
          )}
        </div>
      </div>

      {nastavenia && (
        <>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
            <h3 className="font-bold text-sm text-white mb-3">Predvolené farby zón</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { key: 'farba_zakladna', label: 'Základná' },
                { key: 'farba_vzor', label: 'Vzor' },
                { key: 'farba_akcent', label: 'Akcent' },
                { key: 'farba_rukava', label: 'Rukávy' },
                { key: 'farba_golier', label: 'Golier' },
              ].map(z => (
                <div key={z.key} className="flex flex-col items-center gap-1.5">
                  <input type="color" value={nastavenia[z.key]} onChange={(e) => uprav({ [z.key]: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border border-slate-700" />
                  <span className="text-[11px] text-slate-400">{z.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
              <h3 className="font-bold text-sm text-white mb-3">Dostupné vzory</h3>
              <div className="space-y-1.5">
                {VSETKY_VZORY.map(v => (
                  <label key={v.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={(nastavenia.dostupne_vzory || []).includes(v.id)} onChange={() => prepniVPoli('dostupne_vzory', v.id)} className="rounded text-indigo-500 bg-slate-950 border-slate-700" />
                    {v.nazov}
                  </label>
                ))}
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4">
              <h3 className="font-bold text-sm text-white mb-3">Dostupné goliere</h3>
              <div className="space-y-1.5">
                {VSETKY_GOLIERE.map(g => (
                  <label key={g.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={(nastavenia.dostupne_goliere || []).includes(g.id)} onChange={() => prepniVPoli('dostupne_goliere', g.id)} className="rounded text-indigo-500 bg-slate-950 border-slate-700" />
                    {g.nazov}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-white">Materiály</h3>
              <button onClick={pridajMaterial} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať materiál</button>
            </div>
            <p className="text-xs text-slate-400 mb-1">Prvý materiál (najnižšie poradie) sa v konfigurátore ponúka ako štandard — príplatok 0 €.</p>
            <p className="text-xs text-slate-400 mb-3">
              Materiál sa dá prepojiť na skutočný sklad (Materiály v hlavnom ERP, položky predávané na bežný meter) —
              príplatok (€/ks) sa dopočíta z ceny €/bm a šírky rolky skladovej položky, orientačne pri spotrebe {REFERENCNA_SPOTREBA_M2} m² na dres,
              namiesto ručného zadávania. Ak sklad. materiál nemá vyplnenú šírku, prepočet sa nedá urobiť.
            </p>
            <div className="space-y-2">
              {materialy.map(m => {
                const sklad = skladMaterialy.find(s => s.id === m.sklad_material_id);
                const jePrepojeny = !!m.sklad_material_id;
                const chybaSirka = jePrepojeny && sklad && (!sklad.width || sklad.width <= 0);
                const skladNenajdeny = jePrepojeny && !sklad;
                return (
                  <div key={m.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="text" value={m.kod} onChange={(e) => upravMaterial(m.id, { kod: e.target.value })} placeholder="kód" className="w-28 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono" />
                      <input type="text" value={m.nazov} onChange={(e) => upravMaterial(m.id, { nazov: e.target.value })} placeholder="Názov" className="flex-1 min-w-[140px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
                      <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                        <input type="number" step="0.5" value={m.priplatok_eur} disabled={jePrepojeny && !chybaSirka} onChange={(e) => upravMaterial(m.id, { priplatok_eur: parseFloat(e.target.value) || 0 })} className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white disabled:opacity-60" /> € príplatok
                        {jePrepojeny && !chybaSirka && (
                          <button type="button" onClick={() => prepocitajZoSkladu(m)} title="Prepočítať zo skladu (ak sa zmenila cena/šírka)" className="text-slate-500 hover:text-indigo-400 p-1"><RefreshCw className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                      <input type="number" value={m.poradie} onChange={(e) => upravMaterial(m.id, { poradie: parseInt(e.target.value) || 0 })} title="Poradie" className="w-14 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white shrink-0" />
                      <button onClick={() => zmazMaterial(m.id)} className="text-slate-400 hover:text-rose-400 p-1 shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] text-slate-500 shrink-0">Materiál zo skladu:</label>
                      <select value={m.sklad_material_id || ''} onChange={(e) => pripojSklad(m, e.target.value || null)} className="flex-1 min-w-[200px] px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white">
                        <option value="">-- žiadny (zadať príplatok ručne) --</option>
                        {skladMaterialy.map(s => <option key={s.id} value={s.id}>{s.name}{s.color ? ` (${s.color})` : ''} — {Number(s.price_per_m).toFixed(2)} €/bm{s.width ? `, š.${s.width}cm` : ''} · sklad {s.qty}m</option>)}
                      </select>
                    </div>
                    {jePrepojeny && !chybaSirka && !skladNenajdeny && (
                      <p className="text-[10px] text-emerald-500">✓ Prepojené: {sklad.price_per_m} €/bm ÷ {(sklad.width / 100).toFixed(2)}m šírka × {REFERENCNA_SPOTREBA_M2} m² = {vypocitajPriplatokZoSkladu(sklad)?.toFixed(2)} € príplatok (na sklade {sklad.qty}m)</p>
                    )}
                    {chybaSirka && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Skladová položka "{sklad.name}" nemá vyplnenú šírku (cm) — doplň ju v Sklade (Materiály), potom sa dá prepočítať. Zatiaľ treba príplatok zadať ručne.</p>
                    )}
                    {skladNenajdeny && (
                      <p className="text-[10px] text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Prepojená skladová položka už neexistuje (zmazaná?) — vyber inú, alebo prepojenie zruš.</p>
                    )}
                    <input type="text" value={m.popis || ''} onChange={(e) => upravMaterial(m.id, { popis: e.target.value })} placeholder="Popis (zobrazí sa zákazníkovi)" className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300" />
                  </div>
                );
              })}
              {materialy.length === 0 && <p className="text-xs text-slate-500 italic">Zatiaľ žiadne materiály — konfigurátor ukáže len golier/vzor bez výberu materiálu.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
