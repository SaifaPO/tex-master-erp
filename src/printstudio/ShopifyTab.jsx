import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingBag, Loader2, Save, RefreshCw } from 'lucide-react';

const FARBA_KEYWORDS = ['farba', 'color', 'colour'];
const VELKOST_KEYWORDS = ['veľk', 'velk', 'size'];

function hodnotaOptionu(variant, position) {
  if (position === 1) return variant.option1;
  if (position === 2) return variant.option2;
  return variant.option3;
}

export default function ShopifyTab({ supabase }) {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-indigo-400 h-5 w-5" /> Shopify prepojenie</h2>
        <p className="text-xs text-slate-400 mt-1">Skutočné Shopify Variant ID, aby "Pridať do košíka" v konfigurátore fungovalo naozaj — nájdeš ich v Shopify Admin → Products → tvoj produkt → klikni na konkrétny variant, ID je v URL adrese (napr. .../variants/<strong>44123456789</strong>).</p>
      </div>
      <PersonalizaciaSekcia supabase={supabase} />
      <BlankVariantySekcia supabase={supabase} />
    </div>
  );
}

function PersonalizaciaSekcia({ supabase }) {
  const [riadky, setRiadky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [novaCena, setNovaCena] = useState('');
  const [novyId, setNovyId] = useState('');
  const [error, setError] = useState('');

  const nacitaj = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('cennik_personalizacia_varianty').select('*').order('cena_eur');
    setRiadky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pridaj = async () => {
    const cena = parseFloat(novaCena);
    if (!cena || cena <= 0) { setError('Zadaj platnú cenu (napr. 0.50).'); return; }
    if (!novyId.trim()) { setError('Zadaj Shopify Variant ID.'); return; }
    setError('');
    const { error: err } = await supabase.from('cennik_personalizacia_varianty').upsert({ cena_eur: cena, shopify_variant_id: novyId.trim() });
    if (err) { setError(err.message); return; }
    setNovaCena(''); setNovyId('');
    nacitaj();
  };

  const zmaz = async (cena) => {
    if (!window.confirm(`Zmazať cenový stupeň ${cena} €?`)) return;
    await supabase.from('cennik_personalizacia_varianty').delete().eq('cena_eur', cena);
    nacitaj();
  };

  return (
    <div>
      <h3 className="font-bold text-sm text-white mb-1">Personalizácia potlače — cenové stupne</h3>
      <p className="text-xs text-slate-400 mb-3">Vytvor v Shopify Admin produkt "Personalizácia potlače" a k nemu jeden variant pre každý cenový stupeň (0,50 €, 1,00 €, 1,50 € ...). Cena potlače vypočítaná v konfigurátore sa zaokrúhli na najbližší stupeň, ktorý tu máš nastavený — čím viac stupňov pridáš, tým presnejšie to sedí.</p>
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60 text-slate-500 text-xs uppercase tracking-wide">
            <tr><th className="text-left px-4 py-2.5">Cena (€)</th><th className="text-left px-4 py-2.5">Shopify Variant ID</th><th className="px-4 py-2.5"></th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">Načítavam…</td></tr>
            ) : riadky.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-slate-500 py-6 text-sm">Zatiaľ žiadne cenové stupne.</td></tr>
            ) : riadky.map(r => (
              <tr key={r.cena_eur} className="border-t border-slate-800">
                <td className="px-4 py-2 text-white font-semibold">{Number(r.cena_eur).toFixed(2)} €</td>
                <td className="px-4 py-2 text-slate-300 font-mono text-xs">{r.shopify_variant_id}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => zmaz(r.cena_eur)} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            <tr className="border-t border-slate-800 bg-slate-950/30">
              <td className="px-4 py-2"><input type="number" step="0.5" min="0.5" value={novaCena} onChange={(e) => setNovaCena(e.target.value)} placeholder="0.50" className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" /></td>
              <td className="px-4 py-2"><input type="text" value={novyId} onChange={(e) => setNovyId(e.target.value)} placeholder="44123456789" className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></td>
              <td className="px-4 py-2 text-right"><button onClick={pridaj} className="text-indigo-400 hover:text-indigo-300 p-1"><Plus className="w-4 h-4" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
    </div>
  );
}

function BlankVariantySekcia({ supabase }) {
  const [produkty, setProdukty] = useState([]);
  const [produktId, setProduktId] = useState('');
  const [aktualnyProdukt, setAktualnyProdukt] = useState(null);
  const [farby, setFarby] = useState([]);
  const [velkosti, setVelkosti] = useState([]);
  const [hodnoty, setHodnoty] = useState({}); // { `${farbaId}:${velkost}`: variantId }
  const [isLoadingProdukt, setIsLoadingProdukt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSprava, setSyncSprava] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('produkty').select('id, nazov, shopify_handle').order('nazov');
      setProdukty(data || []);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nacitajProdukt = async (id) => {
    setProduktId(id);
    setError('');
    setSyncSprava('');
    if (!id) { setAktualnyProdukt(null); setFarby([]); setVelkosti([]); setHodnoty({}); return; }
    setIsLoadingProdukt(true);
    const [{ data: farbyLinks }, { data: velkostiData }, { data: existujuce }] = await Promise.all([
      supabase.from('produkt_farby').select('farby(id, nazov, hex)').eq('produkt_id', id),
      supabase.from('produkt_velkosti').select('velkost, poradie').eq('produkt_id', id).order('poradie'),
      supabase.from('produkt_shopify_varianty').select('farba_id, velkost, shopify_variant_id').eq('produkt_id', id),
    ]);
    setAktualnyProdukt(produkty.find(p => p.id === id) || null);
    setFarby((farbyLinks || []).map(l => l.farby).filter(Boolean));
    setVelkosti((velkostiData || []).map(v => v.velkost));
    const map = {};
    (existujuce || []).forEach(e => { map[`${e.farba_id}:${e.velkost}`] = e.shopify_variant_id; });
    setHodnoty(map);
    setIsLoadingProdukt(false);
  };

  // Stiahne varianty tohto JEDNÉHO produktu zo Shopify (podľa handle) a spáruje ich s našimi
  // farbami/veľkosťami podľa názvu. Nespárované polia necháva prázdne na ručné doplnenie.
  const synchronizuj = async () => {
    if (!aktualnyProdukt?.shopify_handle) { setError('Tento produkt nemá v karte Produkty vyplnený Shopify handle.'); return; }
    setIsSyncing(true);
    setError('');
    setSyncSprava('');
    const { data, error: err } = await supabase.functions.invoke('shopify-sync-variants', { body: { handle: aktualnyProdukt.shopify_handle } });
    if (err) { setError(err.message); setIsSyncing(false); return; }
    if (data?.error) { setError(data.error); setIsSyncing(false); return; }

    const farbaOption = (data.options || []).find(o => FARBA_KEYWORDS.some(k => o.name.toLowerCase().includes(k)));
    const velkostOption = (data.options || []).find(o => VELKOST_KEYWORDS.some(k => o.name.toLowerCase().includes(k)));
    if (!farbaOption || !velkostOption) {
      setError('V Shopify produkte sa nenašli obe očakávané možnosti (Farba a Veľkosť) — over si názvy volieb variantov v Shopify.');
      setIsSyncing(false);
      return;
    }

    const norm = (s) => (s || '').trim().toLowerCase();
    let spárovane = 0;
    const nove = { ...hodnoty };
    const nesparovane = [];
    (data.variants || []).forEach(v => {
      const farbaNazov = hodnotaOptionu(v, farbaOption.position);
      const velkostNazov = hodnotaOptionu(v, velkostOption.position);
      const farba = farby.find(f => norm(f.nazov) === norm(farbaNazov));
      const velkost = velkosti.find(vel => norm(vel) === norm(velkostNazov));
      if (farba && velkost) {
        nove[`${farba.id}:${velkost}`] = String(v.id);
        spárovane++;
      } else {
        nesparovane.push(`${farbaNazov} / ${velkostNazov}`);
      }
    });
    setHodnoty(nove);
    setSyncSprava(
      `Spárovaných ${spárovane} z ${(data.variants || []).length} variantov.` +
      (nesparovane.length ? ` Nesparované (skontroluj názvy): ${nesparovane.join(', ')}.` : ' Skontroluj tabuľku nižšie a ulož.')
    );
    setIsSyncing(false);
  };

  const nastavHodnotu = (farbaId, velkost, value) => {
    setHodnoty(h => ({ ...h, [`${farbaId}:${velkost}`]: value }));
  };

  const uloz = async () => {
    setIsSaving(true);
    setError('');
    const riadky = [];
    farby.forEach(f => velkosti.forEach(v => {
      const id = (hodnoty[`${f.id}:${v}`] || '').trim();
      if (id) riadky.push({ produkt_id: produktId, farba_id: f.id, velkost: v, shopify_variant_id: id });
    }));
    await supabase.from('produkt_shopify_varianty').delete().eq('produkt_id', produktId);
    if (riadky.length > 0) {
      const { error: err } = await supabase.from('produkt_shopify_varianty').insert(riadky);
      if (err) { setError(err.message); setIsSaving(false); return; }
    }
    setIsSaving(false);
  };

  return (
    <div>
      <h3 className="font-bold text-sm text-white mb-1">Blank produkty — Shopify Variant ID podľa farby a veľkosti</h3>
      <p className="text-xs text-slate-400 mb-3">Vyber produkt a vyplň Variant ID pre každú kombináciu farba × veľkosť, ktorú tento produkt podporuje.</p>
      <div className="max-w-md mb-4">
        <select value={produktId} onChange={(e) => nacitajProdukt(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
          <option value="">— vyber produkt —</option>
          {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
        </select>
      </div>

      {isLoadingProdukt && <p className="text-sm text-slate-500">Načítavam…</p>}

      {produktId && !isLoadingProdukt && (
        farby.length === 0 || velkosti.length === 0 ? (
          <p className="text-sm text-slate-500">Tento produkt nemá nastavené farby alebo veľkosti (doplň ich v karte Produkty).</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={synchronizuj} disabled={isSyncing} className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Synchronizovať zo Shopify
              </button>
              {aktualnyProdukt && !aktualnyProdukt.shopify_handle && <span className="text-xs text-amber-400">Produkt nemá vyplnený Shopify handle.</span>}
            </div>
            {syncSprava && <p className="text-xs text-slate-400">{syncSprava}</p>}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/60 text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Farba \ Veľkosť</th>
                    {velkosti.map(v => <th key={v} className="text-left px-3 py-2">{v}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {farby.map(f => (
                    <tr key={f.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-white font-medium flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border border-slate-600" style={{ background: f.hex }} /> {f.nazov}</td>
                      {velkosti.map(v => (
                        <td key={v} className="px-3 py-1.5">
                          <input type="text" value={hodnoty[`${f.id}:${v}`] || ''} onChange={(e) => nastavHodnotu(f.id, v, e.target.value)} placeholder="Variant ID" className="w-32 px-2 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-white font-mono" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button onClick={uloz} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Uložiť varianty
            </button>
          </div>
        )
      )}
    </div>
  );
}
