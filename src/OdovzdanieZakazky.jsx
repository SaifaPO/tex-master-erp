import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine, Printer, X, Check, Loader2, Eraser } from 'lucide-react';

// ODOVZDANIE ZAKAZKY ZAKAZNIKOVI S PODPISOM: pri osobnom odbere (alebo pri kuriérovi) sa na tablete/mobile ukáže zoznam odovzdávaného tovaru,
// preberajúci napíše meno/priezvisko a podpíše sa prstom. Uloží sa dátum a čas, podpis a presný zoznam tovaru (poistka, že tovar bol prevzatý)
// a vytlačí sa dodací list s podpisom.

const SPOSOBY = [{ id: 'osobny_odber', label: 'Osobný odber' }, { id: 'kurier', label: 'Kuriér' }, { id: 'ine', label: 'Iné' }];
const skDatumCas = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function tlacDodaciList(h, firmaNazov) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { window.alert('Prehliadač zablokoval okno na tlač — povoľ vyskakovacie okná.'); return; }
  const riadky = (h.polozky || []).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nazov)}${p.poznamka ? `<div class="pozn">${esc(p.poznamka)}</div>` : ''}</td><td class="r">${esc(p.qty)} ks</td></tr>`).join('');
  w.document.write(`<html><head><title>Dodací list ${esc(h.order_number || h.order_id)}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:760px;margin:auto}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#555;font-size:13px;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;margin:14px 0} th,td{border:1px solid #bbb;padding:7px 9px;font-size:13px;text-align:left}
    th{background:#f1f5f9} .r{text-align:right;white-space:nowrap} .pozn{font-size:11px;color:#666}
    .box{border:1px solid #bbb;border-radius:6px;padding:12px;margin-top:16px;font-size:13px}
    .sig{margin-top:8px;border-bottom:1px solid #111;height:110px;display:flex;align-items:flex-end} .sig img{max-height:100px}
    .meta td{border:none;padding:3px 0;font-size:13px}
  </style></head><body>
    <h1>Dodací list — odovzdanie tovaru</h1>
    <div class="sub">${esc(firmaNazov || h.company_brand || '')} • zákazka <b>${esc(h.order_number || h.order_id)}</b></div>
    <table class="meta"><tr><td>Odberateľ:</td><td><b>${esc(h.customer)}</b></td></tr>
    <tr><td>Spôsob prevzatia:</td><td>${esc((SPOSOBY.find(s => s.id === h.sposob) || {}).label || h.sposob)}</td></tr>
    <tr><td>Dátum a čas prevzatia:</td><td><b>${esc(skDatumCas(h.signed_at))}</b></td></tr>
    <tr><td>Prevzal (meno, priezvisko):</td><td><b>${esc(h.prevzal_meno)}</b></td></tr></table>
    <table><thead><tr><th>#</th><th>Tovar</th><th class="r">Množstvo</th></tr></thead><tbody>${riadky}</tbody></table>
    ${h.poznamka ? `<div class="box"><b>Poznámka:</b> ${esc(h.poznamka)}</div>` : ''}
    <div class="box">Svojím podpisom potvrdzujem, že som vyššie uvedený tovar v uvedenom množstve prevzal a že bol odovzdaný v poriadku.
      <div class="sig">${h.podpis_png ? `<img src="${h.podpis_png}" alt="podpis">` : ''}</div>
      <div style="font-size:11px;color:#666;margin-top:4px">Podpis preberajúceho — ${esc(h.prevzal_meno)}</div></div>
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => w.print(), 400);
}

function PodpisPlatno({ onZmena }) {
  const ref = useRef(null);
  const kresli = useRef(false);
  const maTah = useRef(false);

  useEffect(() => {
    const c = ref.current;
    const dpr = window.devicePixelRatio || 1;
    const nastav = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0f172a';
    };
    nastav();
  }, []);

  const bod = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const dole = (e) => { e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); kresli.current = true; const g = ref.current.getContext('2d'); const [x, y] = bod(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.01, y + 0.01); g.stroke(); };
  const pohyb = (e) => { if (!kresli.current) return; e.preventDefault(); const g = ref.current.getContext('2d'); const [x, y] = bod(e); g.lineTo(x, y); g.stroke(); g.beginPath(); g.moveTo(x, y); if (!maTah.current) { maTah.current = true; onZmena(true); } };
  const hore = () => { kresli.current = false; };
  const zmaz = () => { const c = ref.current; const g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.restore(); maTah.current = false; onZmena(false); };

  PodpisPlatno.zmaz = zmaz;
  PodpisPlatno.png = () => { const c = ref.current; const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const g = t.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, t.width, t.height); g.drawImage(c, 0, 0); return t.toDataURL('image/png'); };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <canvas ref={ref} onPointerDown={dole} onPointerMove={pohyb} onPointerUp={hore} onPointerLeave={hore} onPointerCancel={hore}
          className="w-full h-44 bg-white rounded-xl border-2 border-dashed border-slate-500 touch-none cursor-crosshair" style={{ touchAction: 'none' }} />
        <span className="absolute left-3 bottom-2 text-[10px] text-slate-400 pointer-events-none">Podpíšte sa prstom alebo myšou</span>
      </div>
      <button type="button" onClick={zmaz} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"><Eraser className="h-3 w-3" /> Zmazať podpis</button>
    </div>
  );
}

export default function OdovzdanieZakazky({ supabase, order, currentUser, firmaNazov = '', pridajLog, triggerNotification = () => {} }) {
  const [odovzdania, setOdovzdania] = useState([]);
  const [chyba, setChyba] = useState('');
  const [otvorene, setOtvorene] = useState(false);

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('order_handovers').select('*').eq('order_id', order.id).order('signed_at', { ascending: false });
    if (error) { setChyba(error.message.includes('order_handovers') ? 'Odovzdávanie s podpisom ešte nie je zapnuté — spusti v Supabase SQL migráciu migration_odovzdanie_zakazky.sql.' : error.message); setOdovzdania([]); }
    else { setChyba(''); setOdovzdania(data || []); }
  }, [supabase, order.id]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 print:hidden space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-white flex items-center gap-1.5"><PenLine className="h-4 w-4 text-emerald-400" /> Odovzdanie zákazníkovi (podpis)</div>
        <button onClick={() => setOtvorene(true)} disabled={!!chyba} className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" /> Odovzdať tovar a podpísať</button>
      </div>
      {chyba && <p className="text-[11px] text-amber-300">{chyba}</p>}
      {odovzdania.map(h => (
        <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
          <span className="text-emerald-400 font-bold">✓ Prevzal: {h.prevzal_meno}</span>
          <span className="text-slate-400">{skDatumCas(h.signed_at)}</span>
          <span className="text-slate-500">{(h.polozky || []).reduce((s, p) => s + (Number(p.qty) || 0), 0)} ks • {(SPOSOBY.find(s => s.id === h.sposob) || {}).label}</span>
          <button onClick={() => tlacDodaciList(h, firmaNazov)} className="ml-auto text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"><Printer className="h-3.5 w-3.5" /> Dodací list</button>
        </div>
      ))}
      {!chyba && odovzdania.length === 0 && <p className="text-[11px] text-slate-500">Zatiaľ nebolo nič odovzdané.</p>}

      {otvorene && (
        <PodpisModal
          supabase={supabase} order={order} currentUser={currentUser} firmaNazov={firmaNazov}
          onClose={() => setOtvorene(false)}
          onHotovo={async (h) => { setOtvorene(false); await nacitaj(); pridajLog?.(`Tovar odovzdaný: prevzal ${h.prevzal_meno} (${skDatumCas(h.signed_at)})`); triggerNotification('success', 'Odovzdanie je uložené s podpisom.'); tlacDodaciList(h, firmaNazov); }}
        />
      )}
    </div>
  );
}

function PodpisModal({ supabase, order, currentUser, firmaNazov, onClose, onHotovo }) {
  const [polozky, setPolozky] = useState((order.items || []).map(it => ({ id: it.itemId, nazov: it.productName, qty: Number(it.qty) || 0, max: Number(it.qty) || 0, poznamka: it.notes || '', zahrnut: true })));
  const [meno, setMeno] = useState('');
  const [sposob, setSposob] = useState('osobny_odber');
  const [poznamka, setPoznamka] = useState('');
  const [maPodpis, setMaPodpis] = useState(false);
  const [uklada, setUklada] = useState(false);
  const [chyba, setChyba] = useState('');
  const [teraz, setTeraz] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTeraz(new Date()), 15000); return () => clearInterval(t); }, []);

  const potvrd = async () => {
    setChyba('');
    const zahrnute = polozky.filter(p => p.zahrnut && p.qty > 0);
    if (zahrnute.length === 0) { setChyba('Vyber aspoň jednu položku, ktorá sa odovzdáva.'); return; }
    if (!meno.trim()) { setChyba('Napíš meno a priezvisko preberajúceho.'); return; }
    if (!maPodpis) { setChyba('Zákazník sa musí podpísať.'); return; }
    setUklada(true);
    const podpis = PodpisPlatno.png();
    const row = {
      order_id: order.id, order_number: order.orderNumber || null, customer: order.customer, company_brand: order.companyBrand || null,
      prevzal_meno: meno.trim(), sposob, polozky: zahrnute.map(p => ({ nazov: p.nazov, qty: p.qty, poznamka: p.poznamka || '' })),
      podpis_png: podpis, poznamka: poznamka.trim() || null, signed_at: new Date().toISOString(),
      created_by: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || null,
    };
    const { error } = await supabase.from('order_handovers').insert(row);
    setUklada(false);
    if (error) { setChyba('Uloženie zlyhalo: ' + error.message); return; }
    onHotovo(row);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full sm:max-w-xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Dodací list — odovzdanie tovaru</h3>
            <p className="text-xs text-slate-400">{firmaNazov || order.companyBrand} • zákazka <b className="text-slate-200">{order.orderNumber || order.id}</b> • {order.customer}</p>
            <p className="text-xs text-emerald-400 mt-0.5">Dátum a čas prevzatia: <b>{skDatumCas(teraz.toISOString())}</b> (uloží sa pri potvrdení)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Odovzdávaný tovar</span>
          {polozky.map((p, i) => (
            <div key={p.id || i} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
              <input type="checkbox" checked={p.zahrnut} onChange={(e) => setPolozky(l => l.map((x, k) => k === i ? { ...x, zahrnut: e.target.checked } : x))} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{p.nazov}</div>
                {p.poznamka && <div className="text-[10px] text-slate-500 truncate">{p.poznamka}</div>}
              </div>
              <input type="number" min="0" max={p.max} value={p.qty} onChange={(e) => setPolozky(l => l.map((x, k) => k === i ? { ...x, qty: Math.max(0, Math.min(p.max, parseInt(e.target.value) || 0)) } : x))} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-right" />
              <span className="text-xs text-slate-400">ks <span className="text-slate-600">/ {p.max}</span></span>
            </div>
          ))}
          <p className="text-[10px] text-slate-500">Pri čiastočnom odovzdaní zníž množstvo alebo odškrtni položku.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Meno a priezvisko preberajúceho *</label>
            <input type="text" value={meno} onChange={(e) => setMeno(e.target.value)} placeholder="napr. Ján Novák" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Spôsob prevzatia</label>
            <div className="grid grid-cols-3 gap-1">
              {SPOSOBY.map(s => (<button key={s.id} type="button" onClick={() => setSposob(s.id)} className={`py-2 rounded-lg text-xs font-bold ${sposob === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 border border-slate-700 text-slate-400'}`}>{s.label}</button>))}
            </div>
          </div>
        </div>
        <input type="text" value={poznamka} onChange={(e) => setPoznamka(e.target.value)} placeholder="Poznámka (voliteľné) — napr. kuriér DPD, prevzatý bez výhrad" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />

        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">Podpis preberajúceho *</label>
          <p className="text-[11px] text-slate-500 mb-1.5">Svojím podpisom potvrdzujem, že som vyššie uvedený tovar v uvedenom množstve prevzal.</p>
          <PodpisPlatno onZmena={setMaPodpis} />
        </div>

        {chyba && <p className="text-xs text-rose-400">{chyba}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-bold">Zrušiť</button>
          <button onClick={potvrd} disabled={uklada} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2">
            {uklada ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Potvrdiť odovzdanie a vytlačiť dodací list
          </button>
        </div>
      </div>
    </div>
  );
}
