import React from 'react';
import { Ruler } from 'lucide-react';

// Referencna vyska postavy pouzivana ako vseobecne znamy odkaz na skutocnu velkost ("priemerny
// dospely clovek") — rovnaka hodnota, akou sa oddavna meria vyska nabytku/dveri v katalogoch.
const POSTAVA_VYSKA_CM = 180;
// Rezerva navyse hore/dole v SVG, aby sa zmestili popisky aj nad najvyssiu moznu vlajku (XL) a
// pod zem (zakladna podstavca).
const PADDING_HORE = 34;
const PADDING_DOLE = 22;

const DEFAULT_VIEWBOX = { w: 200, h: 420 };

// Rovnaky parser ako v BeachflagApp.jsx — cut_path/viewbox su ulozene v DB per tvar+velkost
// (vlajka_tvar_rozmery), toto je PRESNE ten isty strih, aky kresli zivy nahlad (fabric.js platno).
function parseViewbox(vb) {
  const parts = (vb || '0 0 200 420').split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) return { w: parts[2], h: parts[3] };
  return DEFAULT_VIEWBOX;
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

export default function VelkostnePorovnanie({ rozmer, velkost, velkosti, bgColor, kompaktny = false, nahladUrl = null }) {
  if (!velkost || !rozmer?.cut_path) return null;
  const fabricRozmer = parsujRozmerPopis(velkost.rozmer_popis);
  const celkovaVyskaCm = Number(velkost.vyska_cm) || 0;
  if (!fabricRozmer || !celkovaVyskaCm) return null;

  const maxVyskaCm = Math.max(POSTAVA_VYSKA_CM, ...(velkosti || []).map(v => Number(v.vyska_cm) || 0), celkovaVyskaCm);
  const viewH = PADDING_HORE + maxVyskaCm + PADDING_DOLE;
  const groundY = PADDING_HORE + maxVyskaCm;

  const clovekY = groundY - POSTAVA_VYSKA_CM;
  const tyckaY = groundY - celkovaVyskaCm;
  const vlajkaY = tyckaY; // vlajka je uchytena na vrchu tycky
  const vlajkaVyskaPx = Math.min(fabricRozmer.vyskaCm, celkovaVyskaCm);

  // Presne ten isty cut_path (strih), aky kresli zivy nahlad (fabric.js platno) — ziadny vlastny
  // priblizny tvar. Skaluje sa ROVNAKO na oboch osiach (rovnaky princip ako canvas.setZoom v
  // BeachflagApp.jsx), aby strih nebol skreseny — realny pomer strany/vyska tejto velkosti sa
  // ukazuje len cez cislo v kotovani, nie deformaciou tvaru.
  const { w: vbW, h: vbH } = parseViewbox(rozmer.viewbox);
  const drawScale = vlajkaVyskaPx / vbH;
  const shapeWidthPx = vbW * drawScale;

  // Vodorovne pozicie prvkov (v cm-like jednotkach SVG, nie skutocne cm) — clovek vlavo, tycka s
  // vlajkou vpravo od neho, s dostatocnym odstupom na obe vertikalne kotovacie znacky.
  const xClovek = 26;
  const xTycka = 74;
  const viewW = xTycka + shapeWidthPx + 24;

  const obsah = (
    <>
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
          <text x={xClovek - 22} y={(clovekY + groundY) / 2} fontSize="11" fill="#64748b" textAnchor="middle" transform={`rotate(-90 ${xClovek - 22} ${(clovekY + groundY) / 2})`}>180 cm</text>

          {/* Podstavec */}
          <path d={`M ${xTycka - 14},${groundY} L ${xTycka + 14},${groundY} L ${xTycka + 8},${groundY - 6} L ${xTycka - 8},${groundY - 6} Z`} fill="#475569" />
          {/* Tycka / prút / konštrukcia */}
          <line x1={xTycka} y1={groundY} x2={xTycka} y2={tyckaY} stroke="#94a3b8" strokeWidth="2.5" />

          {/* Vlajka na vrchu tycky — presne ten isty cut_path ako zivy nahlad, rovnomerne
              skalovany (ziadne skreslenie tvaru), farba podla vybraneho podkladu */}
          <g transform={`translate(${xTycka}, ${vlajkaY}) scale(${drawScale})`}>
            <path d={rozmer.cut_path} fill={bgColor || '#4f46e5'} stroke="#1e293b" strokeWidth={0.75 / drawScale} opacity="0.92" />
            {nahladUrl && (
              <>
                <clipPath id="vlajka-strih-clip"><path d={rozmer.cut_path} /></clipPath>
                <image href={nahladUrl} x="0" y="0" width={vbW} height={vbH} preserveAspectRatio="none" clipPath="url(#vlajka-strih-clip)" />
                <path d={rozmer.cut_path} fill="none" stroke="#1e293b" strokeWidth={0.75 / drawScale} />
              </>
            )}
          </g>
          {/* Kotovanie samotnej vlajky (bocne, pri fabric-portion) */}
          <g stroke="#4f46e5" strokeWidth="1">
            <line x1={xTycka + shapeWidthPx + 10} y1={vlajkaY} x2={xTycka + shapeWidthPx + 10} y2={vlajkaY + vlajkaVyskaPx} />
            <line x1={xTycka + shapeWidthPx + 6} y1={vlajkaY} x2={xTycka + shapeWidthPx + 14} y2={vlajkaY} />
            <line x1={xTycka + shapeWidthPx + 6} y1={vlajkaY + vlajkaVyskaPx} x2={xTycka + shapeWidthPx + 14} y2={vlajkaY + vlajkaVyskaPx} />
          </g>
          <text x={xTycka + shapeWidthPx + 10} y={vlajkaY + vlajkaVyskaPx / 2} fontSize="11" fill="#4f46e5" fontWeight="700" textAnchor="middle" transform={`rotate(-90 ${xTycka + shapeWidthPx + 10} ${vlajkaY + vlajkaVyskaPx / 2})`}>{Math.round(fabricRozmer.vyskaCm)} cm</text>

          {/* Popisok celkovej vysky nad tyckou */}
          <text x={xTycka} y={tyckaY - 6} fontSize="11" fill="#475569" fontWeight="700" textAnchor="middle">{celkovaVyskaCm} cm</text>
    </>
  );

  if (kompaktny) {
    return <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full h-full">{obsah}</svg>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2"><Ruler className="w-4 h-4 text-indigo-600" /> Porovnanie veľkosti</h3>
        <span className="text-[11px] text-slate-500">{velkost.rozmer_popis} · celkovo {celkovaVyskaCm} cm</span>
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-3">
        <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full max-w-[260px] h-auto" style={{ maxHeight: 420 }}>
          {obsah}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Ilustračné porovnanie so vzrastom dospelého človeka (180 cm) — schematické, nie presný náhľad grafiky.</p>
    </div>
  );
}
