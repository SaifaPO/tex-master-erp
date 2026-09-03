import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Box, Loader2 } from 'lucide-react';

const ZONE_KEYS = ['predok', 'chrbat', 'lavy_rukav', 'pravy_rukav', 'stitok_golier'];
const NAZVY_ZON = { predok: 'Predok', chrbat: 'Chrbát', lavy_rukav: 'Ľ. rukáv', pravy_rukav: 'P. rukáv', stitok_golier: 'Štítok (golier)' };
const NAZVY_POHLAVIA = { muz: 'Muž', zena: 'Žena', dieta: 'Dieťa', unisex: 'Unisex' };
const TECHNOLOGIE = [
  { value: 'sublimacia', label: 'Sublimácia' },
  { value: 'dtf', label: 'DTF (digitálny transfer)' },
  { value: 'sietotlac', label: 'Sieťotlač' },
  { value: 'rezany', label: 'Rezaný transfer' },
];

const prazdnaZona = () => ({ w: '', h: '' });

export default function ProduktyTab({ supabase }) {
  const [produkty, setProdukty] = useState([]);
  const [kategorie, setKategorie] = useState([]);
  const [farby, setFarby] = useState([]);
  const [zonyPerProdukt, setZonyPerProdukt] = useState({}); // { produktId: Set(zona) }
  const [technologiePerProdukt, setTechnologiePerProdukt] = useState({}); // { produktId: [technologia,...] }
  const [isLoading, setIsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [kategoriaId, setKategoriaId] = useState('');
  const [nazov, setNazov] = useState('');
  const [shopifyHandle, setShopifyHandle] = useState('');
  const [pohlavie, setPohlavie] = useState('unisex');
  const [zakladnaCena, setZakladnaCena] = useState('');
  const [technologie, setTechnologie] = useState(['sublimacia']);
  const [dodavatel, setDodavatel] = useState('');
  const [aktivny, setAktivny] = useState(true);
  const [farbyIds, setFarbyIds] = useState([]);
  const [formZony, setFormZony] = useState({ predok: true, chrbat: true, lavy_rukav: false, pravy_rukav: false });
  const [formVelkosti, setFormVelkosti] = useState([]);

  const nacitajZoznam = async () => {
    setIsLoading(true);
    const [{ data: prod }, { data: kats }, { data: fb }, { data: pf }, { data: zony }, { data: tech }] = await Promise.all([
      supabase.from('produkty').select('*').order('id'),
      supabase.from('kategorie').select('*').order('poradie').order('id'),
      supabase.from('farby').select('*').order('id'),
      supabase.from('produkt_farby').select('produkt_id, farba_id'),
      supabase.from('produkt_velkost_zony').select('zona, produkt_velkosti!inner(produkt_id)'),
      supabase.from('produkt_technologie').select('produkt_id, technologia'),
    ]);
    setKategorie(kats || []);
    setFarby(fb || []);
    const farbyMap = {};
    (pf || []).forEach(r => { (farbyMap[r.produkt_id] = farbyMap[r.produkt_id] || []).push(r.farba_id); });
    setProdukty((prod || []).map(p => ({ ...p, farbyIds: farbyMap[p.id] || [] })));
    const zonyMap = {};
    (zony || []).forEach(r => {
      const pid = r.produkt_velkosti?.produkt_id;
      if (!pid) return;
      if (!zonyMap[pid]) zonyMap[pid] = new Set();
      zonyMap[pid].add(r.zona);
    });
    setZonyPerProdukt(zonyMap);
    const techMap = {};
    (tech || []).forEach(r => { (techMap[r.produkt_id] = techMap[r.produkt_id] || []).push(r.technologia); });
    setTechnologiePerProdukt(techMap);
    setIsLoading(false);
  };

  useEffect(() => { nacitajZoznam(); }, []);

  const resetForm = () => {
    setKategoriaId(kategorie[0]?.id || '');
    setNazov(''); setShopifyHandle(''); setPohlavie('unisex'); setZakladnaCena('');
    setTechnologie(['sublimacia']); setDodavatel(''); setAktivny(true); setFarbyIds([]);
    setFormZony({ predok: true, chrbat: true, lavy_rukav: false, pravy_rukav: false });
    setFormVelkosti([]);
    setError('');
  };

  const otvorNovy = () => { setEditId(null); resetForm(); setFormOpen(true); };

  const otvorUpravu = async (p) => {
    setEditId(p.id);
    setError('');
    setKategoriaId(p.kategoria_id || '');
    setNazov(p.nazov);
    setShopifyHandle(p.shopify_handle || '');
    setPohlavie(p.pohlavie);
    setZakladnaCena(p.zakladna_cena);
    setTechnologie(technologiePerProdukt[p.id]?.length ? technologiePerProdukt[p.id] : [p.technologia]);
    setDodavatel(p.dodavatel || '');
    setAktivny(p.aktivny);
    setFarbyIds(p.farbyIds || []);

    const { data: velkosti } = await supabase
      .from('produkt_velkosti')
      .select('*, produkt_velkost_zony(*)')
      .eq('produkt_id', p.id)
      .order('poradie');

    const zony = { predok: false, chrbat: false, lavy_rukav: false, pravy_rukav: false };
    (velkosti || []).forEach(v => (v.produkt_velkost_zony || []).forEach(z => { zony[z.zona] = true; }));
    setFormZony(zony);
    setFormVelkosti((velkosti || []).map(v => {
      const zonyObj = {};
      ZONE_KEYS.forEach(z => { if (zony[z]) zonyObj[z] = prazdnaZona(); });
      (v.produkt_velkost_zony || []).forEach(z => { zonyObj[z.zona] = { w: z.max_sirka_cm, h: z.max_vyska_cm }; });
      return { velkost: v.velkost, zony: zonyObj };
    }));
    setFormOpen(true);
  };

  const zavriForm = () => setFormOpen(false);

  const toggleZona = (zona) => {
    const next = { ...formZony, [zona]: !formZony[zona] };
    setFormZony(next);
    if (next[zona]) {
      setFormVelkosti(vs => vs.map(v => (v.zony[zona] ? v : { ...v, zony: { ...v.zony, [zona]: prazdnaZona() } })));
    }
  };

  const toggleFarba = (id) => {
    setFarbyIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const toggleTechnologia = (value) => {
    setTechnologie(ts => ts.includes(value) ? ts.filter(x => x !== value) : [...ts, value]);
  };

  const pridajVelkostRiadok = () => {
    const zony = {};
    ZONE_KEYS.forEach(z => { if (formZony[z]) zony[z] = prazdnaZona(); });
    setFormVelkosti(vs => [...vs, { velkost: '', zony }]);
  };
  const zmazVelkostRiadok = (idx) => setFormVelkosti(vs => vs.filter((_, i) => i !== idx));
  const updateVelkostNazov = (idx, value) => setFormVelkosti(vs => vs.map((v, i) => i === idx ? { ...v, velkost: value } : v));
  const updateZonaRozmer = (idx, zona, dim, value) => setFormVelkosti(vs => vs.map((v, i) => {
    if (i !== idx) return v;
    return { ...v, zony: { ...v.zony, [zona]: { ...(v.zony[zona] || prazdnaZona()), [dim]: value } } };
  }));

  const aktivneZony = ZONE_KEYS.filter(z => formZony[z]);

  const uloz = async () => {
    if (!nazov.trim()) { setError('Vyplň názov produktu.'); return; }
    if (!kategoriaId) { setError('Najprv vytvor aspoň jednu kategóriu.'); return; }
    if (technologie.length === 0) { setError('Zapni aspoň jednu technológiu potlače.'); return; }
    if (aktivneZony.length === 0) { setError('Zapni aspoň jednu zónu potlače (predok, chrbát, rukáv...).'); return; }
    if (formVelkosti.length === 0) { setError('Pridaj aspoň jednu veľkosť.'); return; }
    if (formVelkosti.some(v => !v.velkost.trim())) { setError('Každá veľkosť musí mať vyplnený názov (napr. S, M, XL).'); return; }

    setIsSaving(true);
    setError('');

    // produkty.technologia je DB stĺpec pre "predvolenú" technológiu (historický NOT NULL stĺpec) —
    // berieme prvú vybranú v kanonickom poradí, celý zoznam podporovaných technológií ide do produkt_technologie.
    const predvolenaTechnologia = TECHNOLOGIE.map(t => t.value).find(v => technologie.includes(v)) || technologie[0];

    const produktData = {
      kategoria_id: kategoriaId,
      nazov: nazov.trim(),
      shopify_handle: shopifyHandle.trim() || null,
      pohlavie,
      zakladna_cena: parseFloat(zakladnaCena) || 0,
      technologia: predvolenaTechnologia,
      dodavatel: dodavatel.trim() || null,
      aktivny,
    };

    let produktId = editId;
    if (editId) {
      const { error: err } = await supabase.from('produkty').update(produktData).eq('id', editId);
      if (err) { setError(err.message); setIsSaving(false); return; }
    } else {
      const { data, error: err } = await supabase.from('produkty').insert(produktData).select().single();
      if (err) { setError(err.message); setIsSaving(false); return; }
      produktId = data.id;
    }

    // Farby (M:N) — plné prepísanie
    await supabase.from('produkt_farby').delete().eq('produkt_id', produktId);
    if (farbyIds.length > 0) {
      await supabase.from('produkt_farby').insert(farbyIds.map(farba_id => ({ produkt_id: produktId, farba_id })));
    }

    // Podporované technológie potlače (M:N) — plné prepísanie
    await supabase.from('produkt_technologie').delete().eq('produkt_id', produktId);
    await supabase.from('produkt_technologie').insert(technologie.map(t => ({ produkt_id: produktId, technologia: t })));

    // Veľkosti + zóny — plné prepísanie (kaskádovo zmaže aj produkt_velkost_zony)
    await supabase.from('produkt_velkosti').delete().eq('produkt_id', produktId);
    for (let idx = 0; idx < formVelkosti.length; idx++) {
      const v = formVelkosti[idx];
      const { data: novaVelkost, error: velErr } = await supabase
        .from('produkt_velkosti')
        .insert({ produkt_id: produktId, velkost: v.velkost.trim(), poradie: idx })
        .select()
        .single();
      if (velErr) { setError(velErr.message); setIsSaving(false); return; }
      const zonyRiadky = aktivneZony
        .map(z => ({ zona: z, rozmer: v.zony[z] }))
        .filter(({ rozmer }) => rozmer && parseFloat(rozmer.w) > 0 && parseFloat(rozmer.h) > 0)
        .map(({ zona, rozmer }) => ({
          produkt_velkost_id: novaVelkost.id,
          zona,
          max_sirka_cm: parseFloat(rozmer.w),
          max_vyska_cm: parseFloat(rozmer.h),
        }));
      if (zonyRiadky.length > 0) {
        await supabase.from('produkt_velkost_zony').insert(zonyRiadky);
      }
    }

    setIsSaving(false);
    setFormOpen(false);
    nacitajZoznam();
  };

  const zmaz = async (p) => {
    if (!window.confirm(`Naozaj zmazať produkt "${p.nazov}"?`)) return;
    const { error: err } = await supabase.from('produkty').delete().eq('id', p.id);
    if (err) { window.alert(err.message); return; }
    nacitajZoznam();
  };

  const prepniAktivny = async (p) => {
    const { error: err } = await supabase.from('produkty').update({ aktivny: !p.aktivny }).eq('id', p.id);
    if (err) { window.alert(err.message); return; }
    nacitajZoznam();
  };

  const zoskupenePodlaKategorie = kategorie.map(k => ({
    kategoria: k,
    produkty: produkty.filter(p => p.kategoria_id === k.id),
  })).filter(g => g.produkty.length > 0);
  const bezKategorie = produkty.filter(p => !kategorie.some(k => k.id === p.kategoria_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Box className="text-indigo-400 h-5 w-5" /> Produkty (Blanks)</h2>
          <p className="text-xs text-slate-400 mt-1">Žiadne sledovanie skladových zásob — len definícia produktu, zón potlače a cien.</p>
        </div>
        <button onClick={otvorNovy} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition">
          <Plus className="w-4 h-4" /> Pridať produkt
        </button>
      </div>

      {formOpen && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="font-bold text-sm text-slate-200">{editId ? 'Upraviť produkt' : 'Nový produkt'}</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Kategória</label>
              <select value={kategoriaId} onChange={(e) => setKategoriaId(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
                <option value="">— vyber —</option>
                {kategorie.map(k => <option key={k.id} value={k.id}>{k.nazov}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Názov</label>
              <input value={nazov} onChange={(e) => setNazov(e.target.value)} type="text" placeholder="napr. Pánske tričko" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Pohlavie</label>
              <select value={pohlavie} onChange={(e) => setPohlavie(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
                <option value="muz">Muž</option>
                <option value="zena">Žena</option>
                <option value="dieta">Dieťa</option>
                <option value="unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Párovanie s produktom na eshope (Shopify handle)</label>
              <input value={shopifyHandle} onChange={(e) => setShopifyHandle(e.target.value)} type="text" placeholder="napr. panske-tricko" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium">Základná cena (€)</label>
              <input value={zakladnaCena} onChange={(e) => setZakladnaCena(e.target.value)} type="number" step="0.01" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium">Dodávateľ blanku</label>
              <input value={dodavatel} onChange={(e) => setDodavatel(e.target.value)} type="text" placeholder="napr. BlankWear SK" className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Technológie potlače — ktoré si zákazník môže vybrať pre tento produkt</label>
            <div className="flex flex-wrap gap-2">
              {TECHNOLOGIE.map(t => (
                <label key={t.value} className="flex items-center gap-1.5 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={technologie.includes(t.value)} onChange={() => toggleTechnologia(t.value)} className="rounded bg-slate-950 border-slate-700" /> {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Zóny potlače — ktoré strany tento produkt podporuje</label>
            <div className="flex flex-wrap gap-2">
              {ZONE_KEYS.map(z => (
                <label key={z} className="flex items-center gap-1.5 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={!!formZony[z]} onChange={() => toggleZona(z)} className="rounded bg-slate-950 border-slate-700" /> {NAZVY_ZON[z]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-400 font-medium">Veľkosti a maximálny rozmer potlače (cm) pre každú zónu</label>
              <button onClick={pridajVelkostRiadok} className="text-xs text-indigo-400 font-semibold hover:text-indigo-300">+ Pridať veľkosť</button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">Napr. pánske XL môže mať predok 39×49 cm, detské S len 22×28 cm — nastav to tu pre každú veľkosť zvlášť.</p>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/60 text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-2 py-2">Veľkosť</th>
                    {aktivneZony.map(z => <th key={z} className="text-left px-2 py-2">{NAZVY_ZON[z]} max (š×v cm)</th>)}
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {formVelkosti.length === 0 ? (
                    <tr><td colSpan={aktivneZony.length + 2} className="text-center text-slate-500 py-4 text-xs">Zatiaľ žiadne veľkosti — klikni na "+ Pridať veľkosť".</td></tr>
                  ) : formVelkosti.map((v, idx) => (
                    <tr key={idx} className="border-t border-slate-800">
                      <td className="px-2 py-1.5">
                        <input type="text" value={v.velkost} onChange={(e) => updateVelkostNazov(idx, e.target.value)} placeholder="S" className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-white" />
                      </td>
                      {aktivneZony.map(z => (
                        <td key={z} className="px-2 py-1.5">
                          <div className="flex items-center gap-1 text-slate-500">
                            <input type="number" value={v.zony[z]?.w ?? ''} onChange={(e) => updateZonaRozmer(idx, z, 'w', e.target.value)} placeholder="š" className="w-14 px-2 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-white" />
                            ×
                            <input type="number" value={v.zony[z]?.h ?? ''} onChange={(e) => updateZonaRozmer(idx, z, 'h', e.target.value)} placeholder="v" className="w-14 px-2 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-white" />
                          </div>
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right"><button onClick={() => zmazVelkostRiadok(idx)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Dostupné farby</label>
            <div className="flex flex-wrap gap-2">
              {farby.map(f => (
                <label key={f.id} className="flex items-center gap-1.5 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={farbyIds.includes(f.id)} onChange={() => toggleFarba(f.id)} className="rounded bg-slate-950 border-slate-700" />
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: f.hex }}></span> {f.nazov}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={aktivny} onChange={(e) => setAktivny(e.target.checked)} className="rounded bg-slate-950 border-slate-700" /> Produkt je aktívny (viditeľný v konfigurátore)
          </label>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={uloz} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Uložiť
            </button>
            <button onClick={zavriForm} className="border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800">Zrušiť</button>
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Názov</th>
              <th className="text-left px-4 py-3">Pohlavie</th>
              <th className="text-left px-4 py-3">Shopify handle</th>
              <th className="text-left px-4 py-3">Cena</th>
              <th className="text-left px-4 py-3">Technológie</th>
              <th className="text-left px-4 py-3">Zóny potlače</th>
              <th className="text-left px-4 py-3">Farby</th>
              <th className="text-left px-4 py-3">Stav</th>
              <th className="text-right px-4 py-3">Akcie</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center text-slate-500 py-8 text-sm">Načítavam…</td></tr>
            ) : produkty.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-slate-500 py-8 text-sm">Zatiaľ žiadne produkty.</td></tr>
            ) : (
              <>
                {zoskupenePodlaKategorie.map(({ kategoria, produkty: prods }) => (
                  <React.Fragment key={kategoria.id}>
                    <tr className="bg-slate-950/40"><td colSpan={9} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{kategoria.nazov}</td></tr>
                    {prods.map(p => (
                      <RiadokProduktu key={p.id} p={p} farby={farby} zony={zonyPerProdukt[p.id]} technologie={technologiePerProdukt[p.id]} onEdit={otvorUpravu} onDelete={zmaz} onToggleAktivny={prepniAktivny} />
                    ))}
                  </React.Fragment>
                ))}
                {bezKategorie.length > 0 && (
                  <React.Fragment>
                    <tr className="bg-slate-950/40"><td colSpan={9} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">Bez kategórie</td></tr>
                    {bezKategorie.map(p => (
                      <RiadokProduktu key={p.id} p={p} farby={farby} zony={zonyPerProdukt[p.id]} technologie={technologiePerProdukt[p.id]} onEdit={otvorUpravu} onDelete={zmaz} onToggleAktivny={prepniAktivny} />
                    ))}
                  </React.Fragment>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TECHNOLOGIA_LABEL = Object.fromEntries(TECHNOLOGIE.map(t => [t.value, t.label]));

function RiadokProduktu({ p, farby, zony, technologie, onEdit, onDelete, onToggleAktivny }) {
  const farbyNazvy = (p.farbyIds || []).map(fid => farby.find(f => f.id === fid)?.nazov).filter(Boolean).join(', ');
  const zonyNazvy = ZONE_KEYS.filter(z => zony?.has(z)).map(z => NAZVY_ZON[z]).join(', ');
  const technologieNazvy = (technologie?.length ? technologie : [p.technologia]).map(t => TECHNOLOGIA_LABEL[t] || t).join(', ');
  return (
    <tr className="border-t border-slate-800">
      <td className="px-4 py-3 font-medium text-white">{p.nazov}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{NAZVY_POHLAVIA[p.pohlavie] || '—'}</td>
      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.shopify_handle || '—'}</td>
      <td className="px-4 py-3 text-slate-200">{Number(p.zakladna_cena).toFixed(2)} €</td>
      <td className="px-4 py-3 text-xs text-slate-400">{technologieNazvy || '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{zonyNazvy || '—'}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{farbyNazvy || '—'}</td>
      <td className="px-4 py-3">
        <button onClick={() => onToggleAktivny(p)} className={`text-xs px-2 py-1 rounded-full font-semibold transition ${p.aktivny ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          {p.aktivny ? 'Aktívny' : 'Vypnutý'}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => onEdit(p)} className="text-slate-400 hover:text-indigo-400 p-1.5"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => onDelete(p)} className="text-slate-400 hover:text-rose-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
      </td>
    </tr>
  );
}
