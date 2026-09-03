import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Check } from 'lucide-react';

const ZONE_KEYS = ['predok', 'chrbat', 'lavy_rukav', 'pravy_rukav', 'stitok_golier'];
const NAZVY_ZON = { predok: 'Predok', chrbat: 'Chrbát', lavy_rukav: 'Ľavý rukáv', pravy_rukav: 'Pravý rukáv', stitok_golier: 'Štítok (golier)' };
const BUCKET = 'produkt-fotky';
const predvolenyRect = () => ({ x: 30, y: 15, w: 40, h: 50 });
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export default function MockupyTab({ supabase }) {
  const [produkty, setProdukty] = useState([]);
  const [produktId, setProduktId] = useState('');
  const [farby, setFarby] = useState([]);
  const [zony, setZony] = useState([]);
  const [mockupy, setMockupy] = useState([]);

  const [farbaId, setFarbaId] = useState('');
  const [zona, setZona] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [rect, setRect] = useState(predvolenyRect());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProdukt, setIsLoadingProdukt] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('produkty').select('id, nazov').order('nazov');
      setProdukty(data || []);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nacitajProdukt = async (id) => {
    setProduktId(id);
    setIsLoadingProdukt(true);
    setFarbaId(''); setZona(''); setFotoUrl(''); setFotoFile(null); setRect(predvolenyRect()); setError('');
    if (!id) { setFarby([]); setZony([]); setMockupy([]); setIsLoadingProdukt(false); return; }

    const [{ data: farbyLinks }, { data: velkosti }, { data: mockupyData }] = await Promise.all([
      supabase.from('produkt_farby').select('farby(id, nazov, hex)').eq('produkt_id', id),
      supabase.from('produkt_velkosti').select('produkt_velkost_zony(zona)').eq('produkt_id', id),
      supabase.from('produkt_mockupy').select('*').eq('produkt_id', id),
    ]);
    const farbyList = (farbyLinks || []).map(l => l.farby).filter(Boolean);
    const zonySet = new Set();
    (velkosti || []).forEach(v => (v.produkt_velkost_zony || []).forEach(z => zonySet.add(z.zona)));
    setFarby(farbyList);
    setZony(ZONE_KEYS.filter(z => zonySet.has(z)));
    setMockupy(mockupyData || []);
    if (farbyList.length > 0) setFarbaId(farbyList[0].id);
    setIsLoadingProdukt(false);
  };

  const nacitajKombinaciu = (fId, z) => {
    setFarbaId(fId);
    setZona(z);
    setFotoFile(null);
    setError('');
    const existujuci = mockupy.find(m => m.farba_id === fId && m.zona === z);
    if (existujuci) {
      setFotoUrl(existujuci.foto_url);
      setRect({ x: Number(existujuci.zona_x_percent), y: Number(existujuci.zona_y_percent), w: Number(existujuci.zona_sirka_percent), h: Number(existujuci.zona_vyska_percent) });
    } else {
      setFotoUrl('');
      setRect(predvolenyRect());
    }
  };

  const handleFotoChange = (file) => {
    if (!file) return;
    setFotoFile(file);
    setFotoUrl(URL.createObjectURL(file));
  };

  const uloz = async () => {
    if (!produktId || !farbaId || !zona) { setError('Vyber produkt, farbu aj zónu.'); return; }
    if (!fotoUrl) { setError('Nahraj fotku.'); return; }
    setIsSaving(true);
    setError('');

    let url = fotoUrl;
    if (fotoFile) {
      const pripona = fotoFile.name.split('.').pop() || 'jpg';
      const cesta = `${produktId}/${farbaId}/${zona}-${Date.now()}.${pripona}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(cesta, fotoFile);
      if (uploadErr) { setError('Nahratie zlyhalo: ' + uploadErr.message); setIsSaving(false); return; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(cesta);
      url = pub.publicUrl;
    }

    const { error: err } = await supabase.from('produkt_mockupy').upsert({
      produkt_id: produktId,
      farba_id: farbaId,
      zona,
      foto_url: url,
      zona_x_percent: rect.x,
      zona_y_percent: rect.y,
      zona_sirka_percent: rect.w,
      zona_vyska_percent: rect.h,
    }, { onConflict: 'produkt_id,farba_id,zona' });

    setIsSaving(false);
    if (err) { setError(err.message); return; }
    setFotoFile(null);
    setFotoUrl(url);
    const { data: mockupyData } = await supabase.from('produkt_mockupy').select('*').eq('produkt_id', produktId);
    setMockupy(mockupyData || []);
  };

  const zmaz = async () => {
    const existujuci = mockupy.find(m => m.farba_id === farbaId && m.zona === zona);
    if (!existujuci) return;
    if (!window.confirm('Zmazať túto fotku a kalibráciu?')) return;
    await supabase.from('produkt_mockupy').delete().eq('id', existujuci.id);
    setMockupy(m => m.filter(x => x.id !== existujuci.id));
    setFotoUrl(''); setRect(predvolenyRect()); setFotoFile(null);
  };

  const jeUlozeny = (fId, z) => mockupy.some(m => m.farba_id === fId && m.zona === z);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Camera className="text-indigo-400 h-5 w-5" /> Fotky produktov</h2>
        <p className="text-xs text-slate-400 mt-1">Nahraj reálnu fotku pre každú kombináciu produkt × farba × zóna a nastav presnú polohu tlačovej zóny na fotke — zákazník to uvidí v konfigurátore namiesto farebného obdĺžnika.</p>
      </div>

      <div className="max-w-md">
        <label className="text-xs text-slate-400 font-medium">Produkt</label>
        <select value={produktId} onChange={(e) => nacitajProdukt(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
          <option value="">— vyber produkt —</option>
          {produkty.map(p => <option key={p.id} value={p.id}>{p.nazov}</option>)}
        </select>
      </div>

      {isLoadingProdukt && <p className="text-sm text-slate-500">Načítavam…</p>}

      {produktId && !isLoadingProdukt && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Farba</label>
              <div className="flex flex-wrap gap-2">
                {farby.map(f => (
                  <button key={f.id} onClick={() => nacitajKombinaciu(f.id, zona || zony[0])} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border-2 transition ${farbaId === f.id ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-800 text-slate-400'}`}>
                    <span className="w-3 h-3 rounded-full inline-block border border-slate-600" style={{ background: f.hex }} /> {f.nazov}
                  </button>
                ))}
                {farby.length === 0 && <p className="text-xs text-slate-500">Tento produkt nemá nastavené farby.</p>}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Zóna</label>
              <div className="flex flex-wrap gap-2">
                {zony.map(z => (
                  <button key={z} onClick={() => nacitajKombinaciu(farbaId || farby[0]?.id, z)} className={`px-2.5 py-1.5 rounded-lg text-xs border-2 transition flex items-center gap-1 ${zona === z ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-800 text-slate-400'}`}>
                    {NAZVY_ZON[z]}
                    {farbaId && jeUlozeny(farbaId, z) && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
                {zony.length === 0 && <p className="text-xs text-slate-500">Tento produkt nemá nastavené zóny.</p>}
              </div>
            </div>

            {farbaId && zona && (
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Fotka ({NAZVY_ZON[zona]})</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFotoChange(e.target.files[0])} className="text-xs text-slate-300" />
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={uloz} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Uložiť
                  </button>
                  {jeUlozeny(farbaId, zona) && (
                    <button onClick={zmaz} className="border border-slate-700 text-rose-400 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {farbaId && zona ? (
              fotoUrl ? (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Potiahni obdĺžnik alebo jeho roh (bod vpravo dole), aby presne sedel na tlačovú zónu na fotke.</p>
                  <KalibraciaZony fotoUrl={fotoUrl} hodnota={rect} onChange={setRect} />
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">x:{rect.x.toFixed(1)}% y:{rect.y.toFixed(1)}% š:{rect.w.toFixed(1)}% v:{rect.h.toFixed(1)}%</p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-800 rounded-xl h-80 flex items-center justify-center text-sm text-slate-500">Nahraj fotku vľavo, potom tu nastavíš polohu tlačovej zóny.</div>
              )
            ) : (
              <div className="border-2 border-dashed border-slate-800 rounded-xl h-80 flex items-center justify-center text-sm text-slate-500">Vyber farbu a zónu.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KalibraciaZony({ fotoUrl, hodnota, onChange }) {
  const containerRef = useRef(null);
  const [drag, setDrag] = useState(null); // { mode, startClientX, startClientY, startVal }

  const zacniDrag = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ mode, startClientX: e.clientX, startClientY: e.clientY, startVal: { ...hodnota } });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const rectPx = containerRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startClientX) / rectPx.width) * 100;
      const dyPct = ((e.clientY - drag.startClientY) / rectPx.height) * 100;
      if (drag.mode === 'move') {
        const x = clamp(drag.startVal.x + dxPct, 0, 100 - drag.startVal.w);
        const y = clamp(drag.startVal.y + dyPct, 0, 100 - drag.startVal.h);
        onChange({ ...drag.startVal, x, y });
      } else {
        const w = clamp(drag.startVal.w + dxPct, 3, 100 - drag.startVal.x);
        const h = clamp(drag.startVal.h + dyPct, 3, 100 - drag.startVal.y);
        onChange({ ...drag.startVal, w, h });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, onChange]);

  return (
    <div ref={containerRef} className="relative w-full select-none rounded-lg overflow-hidden bg-slate-950" style={{ maxWidth: 420 }}>
      <img src={fotoUrl} draggable={false} className="w-full h-auto block" alt="Fotka produktu" />
      <div
        onMouseDown={(e) => zacniDrag(e, 'move')}
        className="absolute border-2 border-dashed border-indigo-400 bg-indigo-500/20 cursor-move"
        style={{ left: `${hodnota.x}%`, top: `${hodnota.y}%`, width: `${hodnota.w}%`, height: `${hodnota.h}%` }}
      >
        <div
          onMouseDown={(e) => zacniDrag(e, 'resize')}
          className="absolute -right-2 -bottom-2 w-5 h-5 bg-indigo-600 rounded-full border-2 border-white cursor-nwse-resize"
        />
      </div>
    </div>
  );
}
