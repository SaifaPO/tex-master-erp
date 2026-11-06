// Tlačová karta pre DTF / DTG: čo sa tlačí, kam na tričko a v akom rozmere. Zobrazí sa po naskenovaní QR kódu v Čítačke QR,
// a umiestnenie/rozmer zadáva grafik pri položke zákazky (printSpec). QR kód pre DTF fóliu sa stiahne ako PNG (300 DPI) a vloží sa k motívu mimo potlače.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, Save } from 'lucide-react';

export const TECHNOLOGIE = { dtf: 'DTF (transfer fólia)', dtg: 'DTG (priama tlač)' };
export const ZONY = {
  predok: 'Predná strana (stred)',
  zadok: 'Zadná strana (stred)',
  hrud_lava: 'Ľavá strana hrude (srdce)',
  hrud_prava: 'Pravá strana hrude',
  rukav: 'Rukáv',
};

const ZONA_VYHLAD = { predok: 'hrudník', zadok: 'chrbát', hrud_lava: 'ľavá hruď', hrud_prava: 'pravá hruď', rukav: 'rukáv' };
export const popisUmiestnenia = (s) => {
  if (!s) return '';
  const z = ZONA_VYHLAD[s.zona] || '';
  const g = Number(s.odGolierCm) > 0 ? `${Number(s.odGolierCm)} cm pod golierom` : '';
  return [z, g].filter(Boolean).join(', ');
};

// Jednoduché tričko (pohľad spredu/zozadu) s vyznačeným motívom v mierke: 1 cm = 5.5 jednotky
function TricoSchema({ spec }) {
  const K = 5.5;
  const w = Math.max(1, Number(spec.sirkaCm) || 0) * K;
  const h = Math.max(1, Number(spec.vyskaCm) || 0) * K;
  const zadok = spec.zona === 'zadok';
  const stredX = spec.zona === 'hrud_lava' ? 262 : spec.zona === 'hrud_prava' ? 138 : 200;
  const x = spec.zona === 'rukav' ? 336 : stredX - w / 2;
  const y = spec.zona === 'rukav' ? 78 : 22 + (Number(spec.odGolierCm) || 0) * K;
  return (
    <svg viewBox="0 0 400 450" className="w-full max-w-[260px] mx-auto" role="img" aria-label="Schéma trička s umiestnením motívu">
      <path d={`M100 18 L150 18 Q200 ${zadok ? 34 : 62} 250 18 L300 18 L392 82 L352 142 L310 116 L310 436 L90 436 L90 116 L48 142 L8 82 Z`} fill="#e2e8f0" stroke="#64748b" strokeWidth="3" />
      <rect x={x} y={y} width={w} height={h} fill="#6366f1" fillOpacity="0.35" stroke="#4338ca" strokeWidth="2.5" strokeDasharray="6 4" />
      <text x="200" y="446" textAnchor="middle" fontSize="15" fill="#475569" fontWeight="700">{zadok ? 'ZADNÁ STRANA' : spec.zona === 'rukav' ? 'RUKÁV (pohľad spredu)' : 'PREDNÁ STRANA'}</text>
    </svg>
  );
}

// Editor umiestnenia a rozmeru (zadáva grafik pri položke zákazky)
export function PrintSpecEditor({ item, moze, onSave }) {
  const [spec, setSpec] = useState(item.printSpec || { technologia: 'dtf', zona: 'predok', sirkaCm: '', vyskaCm: '', odGolierCm: '', farbaTricka: '', poznamka: '' });
  const [uloz, setUloz] = useState(false);
  const pole = (k, p = {}) => ({ value: spec[k] ?? '', onChange: (e) => setSpec((s) => ({ ...s, [k]: e.target.value })), disabled: !moze, ...p });
  const trieda = 'w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-100 disabled:opacity-60';
  return (
    <details className="print:hidden bg-slate-900/60 border border-slate-800 rounded-xl p-3" open={!!item.printSpec}>
      <summary className="text-xs font-bold text-indigo-300 cursor-pointer">🖨️ Tlač: umiestnenie a rozmer (DTF / DTG){item.printSpec ? ` — ${item.printSpec.sirkaCm}×${item.printSpec.vyskaCm} cm` : ''}</summary>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
        <label className="col-span-2 md:col-span-1"><span className="text-slate-400 block mb-0.5">Technológia</span>
          <select {...pole('technologia')} className={trieda}>{Object.entries(TECHNOLOGIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="col-span-2 md:col-span-1"><span className="text-slate-400 block mb-0.5">Kde na tričku</span>
          <select {...pole('zona')} className={trieda}>{Object.entries(ZONY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span className="text-slate-400 block mb-0.5">Šírka motívu (cm)</span><input type="number" min="0" step="0.1" {...pole('sirkaCm')} className={trieda} /></label>
        <label><span className="text-slate-400 block mb-0.5">Výška motívu (cm)</span><input type="number" min="0" step="0.1" {...pole('vyskaCm')} className={trieda} /></label>
        <label><span className="text-slate-400 block mb-0.5">Od goliera (cm)</span><input type="number" min="0" step="0.5" {...pole('odGolierCm')} className={trieda} /></label>
        <label><span className="text-slate-400 block mb-0.5">Farba trička</span><input type="text" {...pole('farbaTricka')} className={trieda} placeholder="napr. čierne" /></label>
        <label className="col-span-2"><span className="text-slate-400 block mb-0.5">Poznámka pre tlač (podklad, profil…)</span><input type="text" {...pole('poznamka')} className={trieda} placeholder="napr. biely podklad, jemný raster" /></label>
      </div>
      {Number(spec.sirkaCm) > 0 && Number(spec.vyskaCm) > 0 && <div className="mt-3"><TricoSchema spec={spec} /></div>}
      {moze && (
        <button type="button" disabled={uloz} onClick={async () => { setUloz(true); await onSave({ ...spec, sirkaCm: Number(spec.sirkaCm) || 0, vyskaCm: Number(spec.vyskaCm) || 0, odGolierCm: Number(spec.odGolierCm) || 0 }); setUloz(false); }}
          className="mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Uložiť údaje pre tlač</button>
      )}
    </details>
  );
}

// QR štítok pre DTF fóliu (PNG, 300 DPI, 52 × 25 mm): vloží sa do súboru mimo motívu, aby sa vytlačil na okraji fólie.
export async function stiahnutQrFolie(order, item, qrUrl) {
  const PX = (mm) => Math.round((mm / 25.4) * 300);
  const W = PX(52), H = PX(25), QR = PX(21);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<QRCodeCanvas value={qrUrl} size={QR} level="M" marginSize={0} />);
  await new Promise((r) => setTimeout(r, 60));
  const qrCanvas = host.querySelector('canvas');
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (qrCanvas) { g.imageSmoothingEnabled = false; g.drawImage(qrCanvas, PX(2), Math.round((H - QR) / 2), QR, QR); } // canvas z QRCodeCanvas je pri vyššom DPR väčší než "size"
  g.fillStyle = '#000'; g.textBaseline = 'top';
  const tx = PX(2) + QR + PX(2);
  g.font = `bold ${PX(3.5)}px Arial`; g.fillText(String(order.orderNumber || order.id).slice(0, 14), tx, PX(2.5));
  g.font = `bold ${PX(3.2)}px Arial`; g.fillText(`${item.qty} ks`, tx, PX(8));
  g.font = `${PX(2.6)}px Arial`; g.fillText(String(item.itemId).slice(-12), tx, PX(12.5));
  g.fillText(String(order.customer || '').slice(0, 14), tx, PX(16));
  g.fillText((item.printSpec?.technologia || 'dtf').toUpperCase(), tx, PX(19.5));
  root.unmount(); host.remove();
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `QR-folia-${order.orderNumber || order.id}-${item.itemId}.png`;
  a.click();
}

// Karta, ktorá sa ukáže po naskenovaní QR kódu: čo ide do tlače a kam
export function PrintKarta({ order, item, qrUrl, onStiahnut, onZavriet }) {
  const spec = item.printSpec;
  const suborUrl = item.rozpisUrl || item.imageUrl;
  const jeObrazok = item.rozpisUrl ? String(item.rozpisMimeType || '').startsWith('image/') : !!item.imageUrl;
  return (
    <div className="bg-slate-950 border-2 border-emerald-500/60 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Naskenované — čo ide do tlače</div>
          <h3 className="text-xl font-extrabold text-white">{order.orderNumber || order.id} · {order.customer}</h3>
          <p className="text-sm text-slate-300">{item.productName} <span className="text-slate-500 font-mono text-xs">[{item.itemId}]</span> — <strong className="text-white">{item.qty} ks</strong></p>
          {item.notes && <p className="text-xs text-slate-400 italic mt-1">Poznámka: {item.notes}</p>}
        </div>
        {onZavriet && <button onClick={onZavriet} className="text-slate-500 hover:text-white text-xs font-bold">Zavrieť</button>}
      </div>

      {spec ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="space-y-2 text-sm">
            <span className="inline-block bg-indigo-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full">{TECHNOLOGIE[spec.technologia] || spec.technologia}</span>
            <div className="text-3xl font-black text-white">{spec.sirkaCm} × {spec.vyskaCm} cm</div>
            <div className="text-slate-200"><span className="text-slate-500">Kde: </span><strong>{ZONY[spec.zona] || spec.zona}</strong>{Number(spec.odGolierCm) > 0 && <>, <strong>{spec.odGolierCm} cm</strong> pod golierom</>}</div>
            {spec.farbaTricka && <div className="text-slate-200"><span className="text-slate-500">Farba trička: </span><strong>{spec.farbaTricka}</strong></div>}
            {spec.poznamka && <div className="text-amber-300 text-xs">⚠ {spec.poznamka}</div>}
          </div>
          <TricoSchema spec={spec} />
        </div>
      ) : (
        <p className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">Grafik ešte nezadal rozmer a umiestnenie motívu (v detaile zákazky → „Tlač: umiestnenie a rozmer“). Súbor je nižšie.</p>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        {suborUrl && jeObrazok && <img src={suborUrl} alt="Motív" className="sm:w-1/2 max-h-72 object-contain bg-white rounded-xl border border-slate-300" />}
        <div className="flex-1 space-y-2">
          {suborUrl && <a href={suborUrl} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2"><Download className="h-4 w-4" /> Otvoriť / stiahnuť tlačový súbor</a>}
          {onStiahnut && <button onClick={onStiahnut} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2"><Printer className="h-4 w-4" /> QR štítok pre DTF fóliu (PNG)</button>}
          <p className="text-[11px] text-slate-500">QR odkaz: <span className="font-mono">{qrUrl}</span></p>
        </div>
      </div>
    </div>
  );
}
