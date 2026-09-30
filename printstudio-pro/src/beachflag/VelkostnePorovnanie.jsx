import React from 'react';
import { Ruler } from 'lucide-react';

// Referencna vyska postavy pouzivana ako vseobecne znamy odkaz na skutocnu velkost ("priemerny
// dospely clovek") — rovnaka hodnota, akou sa oddavna meria vyska nabytku/dveri v katalogoch.
const POSTAVA_VYSKA_CM = 180;
// Rezerva navyse hore/dole v SVG, aby sa zmestili popisky aj nad najvyssiu moznu vlajku (XL) a
// pod zem (zakladna podstavca).
const PADDING_HORE = 34;
const PADDING_DOLE = 22;

// Zjednodusene, len ilustracne siluety tvaru vlajky (nie presne cut_path z DB — ten je zamerne
// oddeleny/interaktivny pre editor grafiky). Kreslene v LOKALNYCH suradniciach 0..sirkaCm (x)
// a 0..vyskaCm (y, zhora nadol), volajuci kod ich len posunie/roztiahne na spravne miesto.
function cestaTvaru(tvar, sirkaCm, vyskaCm) {
  const w = sirkaCm, h = vyskaCm;
  switch (tvar) {
    case 'kvapka': // teardrop — siroke hore, spicate dole
      return `M ${w * 0.5},0 C ${w},${h * 0.05} ${w},${h * 0.55} ${w * 0.5},${h * 0.62} C 0,${h * 0.55} 0,${h * 0.05} ${w * 0.5},0 Z`
        .replace('Z', `L ${w * 0.5},${h} Z`);
    case 'cepel': // blade — uzsie, zuzujuce sa smerom dole do hrotu
      return `M 0,0 L ${w},0 L ${w * 0.7},${h * 0.9} L ${w * 0.5},${h} L ${w * 0.3},${h * 0.9} Z`;
    case 'kridlo': // wing — zaobleny vykus na jednej strane (asymetricky)
      return `M 0,${h * 0.08} C ${w * 0.3},0 ${w},0 ${w},${h * 0.25} L ${w},${h * 0.95} C ${w * 0.5},${h} 0,${h} 0,${h * 0.9} Z`;
    case 'pierko': // feather — default, jemne zuzujuce sa pierko
    default:
      return `M 0,0 C ${w * 0.6},0 ${w},${h * 0.08} ${w},${h * 0.3} L ${w},${h * 0.92} C ${w * 0.5},${h} 0,${h * 0.95} 0,${h * 0.9} Z`;
  }
}

// Rozparsuje "65 x 290 cm" na { sirkaCm, vyskaCm } — text je zamerne volny (admin ho zadava
// rucne v karte Vlajky), preto pri neplatnom formate radsej vrat null nez zle cislo.
function parsujRozmerPopis(popis) {
  const m = /([\d.,]+)\s*x\s*([\d.,]+)/i.exec(popis || '');
  if (!m) return null;
  const sirkaCm = Number(m[1].replace(',', '.'));
  const vyskaCm = Number(m[2].replace(',', '.'));
  if (!sirkaCm || !vyskaCm) return null;
  return { sirkaCm, vyskaCm };
}

export default function VelkostnePorovnanie({ tvarKod, velkost, velkosti, bgColor }) {
  if (!velkost) return null;
  const fabricRozmer = parsujRozmerPopis(velkost.rozmer_popis);
  const celkovaVyskaCm = Number(velkost.vyska_cm) || 0;
  if (!fabricRozmer || !celkovaVyskaCm) return null;

  const maxVyskaCm = Math.max(POSTAVA_VYSKA_CM, ...(velkosti || []).map(v => Number(v.vyska_cm) || 0), celkovaVyskaCm);
  const viewH = PADDING_HORE + maxVyskaCm + PADDING_DOLE;
  const groundY = PADDING_HORE + maxVyskaCm;

  // Vodorovne pozicie prvkov (v cm-like jednotkach SVG, nie skutocne cm) — clovek vlavo, tycka s
  // vlajkou vpravo od neho, s dostatocnym odstupom na obe vertikalne kotovacie znacky.
  const xClovek = 34;
  const xTycka = 128;
  const sirkaVlajkyPx = Math.max(24, Math.min(60, fabricRozmer.sirkaCm * 0.55));
  const viewW = xTycka + sirkaVlajkyPx + 46;

  const clovekY = groundY - POSTAVA_VYSKA_CM;
  const tyckaY = groundY - celkovaVyskaCm;
  const vlajkaY = tyckaY; // vlajka je uchytena na vrchu tycky
  const vlajkaVyskaPx = Math.min(fabricRozmer.vyskaCm, celkovaVyskaCm);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Ruler className="w-4 h-4 text-indigo-600" /> Porovnanie veľkosti</h3>
        <span className="text-[11px] text-slate-500">{velkost.rozmer_popis} · celkovo {celkovaVyskaCm} cm</span>
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-3">
        <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full max-w-[260px] h-auto" style={{ maxHeight: 420 }}>
          {/* Zem */}
          <line x1="0" y1={groundY} x2={viewW} y2={groundY} stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Postava — schematicka silueta, hlava + telo, vzdy 180cm ako vseobecne znamy odkaz */}
          <g>
            <circle cx={xClovek} cy={clovekY + 11} r="9" fill="#64748b" />
            <path d={`M ${xClovek - 12},${clovekY + 24} C ${xClovek - 14},${clovekY + 60} ${xClovek - 10},${groundY - 10} ${xClovek - 7},${groundY} L ${xClovek + 7},${groundY} C ${xClovek + 10},${groundY - 10} ${xClovek + 14},${clovekY + 60} ${xClovek + 12},${clovekY + 24} Z`} fill="#94a3b8" />
          </g>
          {/* Kotovanie postavy (180 cm) */}
          <g stroke="#94a3b8" strokeWidth="1">
            <line x1={xClovek - 22} y1={clovekY} x2={xClovek - 22} y2={groundY} />
            <line x1={xClovek - 26} y1={clovekY} x2={xClovek - 18} y2={clovekY} />
            <line x1={xClovek - 26} y1={groundY} x2={xClovek - 18} y2={groundY} />
          </g>
          <text x={xClovek - 22} y={(clovekY + groundY) / 2} fontSize="8" fill="#64748b" textAnchor="middle" transform={`rotate(-90 ${xClovek - 22} ${(clovekY + groundY) / 2})`}>180 cm</text>

          {/* Podstavec */}
          <path d={`M ${xTycka - 14},${groundY} L ${xTycka + 14},${groundY} L ${xTycka + 8},${groundY - 6} L ${xTycka - 8},${groundY - 6} Z`} fill="#475569" />
          {/* Tycka / prút / konštrukcia */}
          <line x1={xTycka} y1={groundY} x2={xTycka} y2={tyckaY} stroke="#94a3b8" strokeWidth="2.5" />

          {/* Vlajka na vrchu tycky, farba podla vybraneho podkladu */}
          <g transform={`translate(${xTycka}, ${vlajkaY})`}>
            <path d={cestaTvaru(tvarKod, sirkaVlajkyPx, vlajkaVyskaPx)} fill={bgColor || '#4f46e5'} stroke="#1e293b" strokeWidth="0.75" opacity="0.92" />
          </g>
          {/* Kotovanie samotnej vlajky (bocne, pri fabric-portion) */}
          <g stroke="#4f46e5" strokeWidth="1">
            <line x1={xTycka + sirkaVlajkyPx + 10} y1={vlajkaY} x2={xTycka + sirkaVlajkyPx + 10} y2={vlajkaY + vlajkaVyskaPx} />
            <line x1={xTycka + sirkaVlajkyPx + 6} y1={vlajkaY} x2={xTycka + sirkaVlajkyPx + 14} y2={vlajkaY} />
            <line x1={xTycka + sirkaVlajkyPx + 6} y1={vlajkaY + vlajkaVyskaPx} x2={xTycka + sirkaVlajkyPx + 14} y2={vlajkaY + vlajkaVyskaPx} />
          </g>
          <text x={xTycka + sirkaVlajkyPx + 10} y={vlajkaY + vlajkaVyskaPx / 2} fontSize="8" fill="#4f46e5" fontWeight="700" textAnchor="middle" transform={`rotate(-90 ${xTycka + sirkaVlajkyPx + 10} ${vlajkaY + vlajkaVyskaPx / 2})`}>{Math.round(fabricRozmer.vyskaCm)} cm</text>

          {/* Popisok celkovej vysky nad tyckou */}
          <text x={xTycka} y={tyckaY - 6} fontSize="8" fill="#475569" fontWeight="700" textAnchor="middle">{celkovaVyskaCm} cm</text>
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Ilustračné porovnanie so vzrastom dospelého človeka (180 cm) — schematické, nie presný náhľad grafiky.</p>
    </div>
  );
}
