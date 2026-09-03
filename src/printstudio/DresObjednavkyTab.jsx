import React, { useEffect, useState } from 'react';
import { ClipboardList, Check, X } from 'lucide-react';

const STAV_LABEL = {
  na_schvalenie: { text: 'Na schválenie', cls: 'bg-amber-950/60 text-amber-400' },
  schvalene: { text: 'Schválené', cls: 'bg-emerald-950/60 text-emerald-400' },
  zamietnute: { text: 'Zamietnuté', cls: 'bg-rose-950/60 text-rose-400' },
};

export default function DresObjednavkyTab({ supabase }) {
  const [objednavky, setObjednavky] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStav, setFilterStav] = useState('na_schvalenie');

  const nacitaj = async () => {
    setIsLoading(true);
    let q = supabase.from('dres_objednavky').select('*').order('created_at', { ascending: false });
    if (filterStav !== 'vsetky') q = q.eq('status', filterStav);
    const { data } = await q;
    setObjednavky(data || []);
    setIsLoading(false);
  };

  useEffect(() => { nacitaj(); }, [filterStav]); // eslint-disable-line react-hooks/exhaustive-deps

  const zmenStav = async (o, status) => {
    const patch = { status };
    if (status === 'schvalene') patch.schvalene_at = new Date().toISOString();
    await supabase.from('dres_objednavky').update(patch).eq('id', o.id);
    nacitaj();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardList className="text-indigo-400 h-5 w-5" /> Objednávky 3D dresov</h2>
          <p className="text-xs text-slate-400 mt-1">Objednávky zo Shopify pristávajú tu na schválenie. Po schválení si výrobnú zákazku vytvor ručne rovnako ako pri bežnej objednávke.</p>
        </div>
        <select value={filterStav} onChange={(e) => setFilterStav(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
          <option value="na_schvalenie">Na schválenie</option>
          <option value="schvalene">Schválené</option>
          <option value="zamietnute">Zamietnuté</option>
          <option value="vsetky">Všetky</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Načítavam…</p>
      ) : objednavky.length === 0 ? (
        <p className="text-sm text-slate-500">Žiadne objednávky v tomto filtri.</p>
      ) : (
        <div className="space-y-3">
          {objednavky.map(o => {
            const stav = STAV_LABEL[o.status] || STAV_LABEL.na_schvalenie;
            const roster = Array.isArray(o.roster) ? o.roster : [];
            return (
              <div key={o.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col sm:flex-row gap-4">
                {o.nahlad_url && (
                  <img src={o.nahlad_url} alt="Náhľad dresu" className="w-24 h-24 object-cover rounded-lg border border-slate-800 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stav.cls}`}>{stav.text}</span>
                    {o.shopify_order_number && <span className="text-xs text-slate-500 font-mono">{o.shopify_order_number}</span>}
                    <span className="text-xs text-slate-500">{o.created_at ? new Date(o.created_at).toLocaleString('sk-SK') : ''}</span>
                  </div>
                  <div className="text-sm text-white font-semibold">
                    {o.produkt_nazov || 'Dres 3D'} · {o.pocet_ks} ks
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    Vzor: {o.vzor_kod || '—'} · Golier: {o.golier_typ || '—'} · Materiál: {o.material_nazov || 'Štandard'}
                    {o.farba_zakladna && <span className="inline-flex items-center gap-1">· <span className="inline-block w-3 h-3 rounded-sm border border-slate-700" style={{ background: o.farba_zakladna }} /></span>}
                  </div>
                  {o.tim_text && <div className="text-xs text-slate-500 mt-0.5">Tímový text: "{o.tim_text}"</div>}
                  {roster.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1.5">
                      <span className="text-slate-400 font-semibold">Súpiska:</span>{' '}
                      {roster.map((h, i) => `${h.cislo} ${h.meno} (${h.velkost})`).join(', ')}
                    </div>
                  )}
                  {(o.zakaznik_meno || o.zakaznik_email) && (
                    <div className="text-xs text-slate-500 mt-0.5">Zákazník: {o.zakaznik_meno} {o.zakaznik_email && `(${o.zakaznik_email})`}</div>
                  )}
                  {o.poznamka && <div className="text-xs text-slate-500 mt-0.5">Poznámka: {o.poznamka}</div>}
                </div>
                <div className="flex flex-col items-end justify-between shrink-0 gap-2">
                  <div className="text-lg font-black text-emerald-400">{Number(o.cena_spolu || 0).toFixed(2)} €</div>
                  {o.status === 'na_schvalenie' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => zmenStav(o, 'schvalene')} className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg" title="Schváliť"><Check className="w-4 h-4" /></button>
                      <button onClick={() => zmenStav(o, 'zamietnute')} className="bg-rose-600 hover:bg-rose-700 text-white p-1.5 rounded-lg" title="Zamietnuť"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
