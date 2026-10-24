import React, { useId } from 'react';

// Ilustračný náhľad ukončenia okrajov stolovej vlajky: strapce alebo šnúrka dookola + šnúrka na zavesenie hore.
// Tvar vlajky je rovnaký ako v ikonách výberu tvaru (viewBox 40 × 58). Slúži len na predstavu — nie je to tlačový náhľad.
const TVARY = {
  shield: 'M 4 4 L 36 4 L 36 38 Q 20 52 4 38 Z',
  pentagon: 'M 4 4 L 36 4 L 36 38 L 20 50 L 4 38 Z',
  rectangle: 'M 4 4 L 36 4 L 36 40 Q 20 56 4 40 Z',
  triangle: 'M 4 4 L 36 4 L 20 50 Z',
};

// kod okraja -> druh + farby
const OKRAJE = {
  fringe_white: { druh: 'strapce', farby: ['#ffffff'] },
  fringe_gold: { druh: 'strapce', farby: ['#d9a521'] },
  cord_white: { druh: 'snurka', farby: ['#ffffff'] },
  cord_black: { druh: 'snurka', farby: ['#1f2937'] },
  cord_tri: { druh: 'snurka', farby: ['#ffffff', '#1d4ed8', '#dc2626'] },
};

export default function OkrajIlustracia({ tvar, okraj, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const o = OKRAJE[okraj];
  if (!o) return null;
  const d = TVARY[tvar] || TVARY.rectangle;
  const [hlavna, ...dalsie] = o.farby;
  const jeStrapce = o.druh === 'strapce';
  // šnúrka na zavesenie hore: slučka medzi hornými rohmi (rohy sú v súradniciach tvaru x=4 a x=36, y=4)
  const sluckaD = 'M 4 4 L 20 -10 L 36 4';

  const sirkaCary = (w, extra) => ({ strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', ...extra });

  return (
    <div className={`rounded-lg bg-gradient-to-b from-slate-200 to-slate-300 border border-slate-300 p-2 ${className}`}>
      <svg viewBox="-3 -12 46 68" className="w-full h-60" role="img" aria-label={jeStrapce ? 'Ilustrácia vlajky so strapcami' : 'Ilustrácia vlajky so šnúrkou dookola'}>
        <defs>
          <linearGradient id={`vl${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
          <filter id={`tien${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.7" floodColor="#0f172a" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* šnúrka na zavesenie (hore) — v tej istej farbe ako ukončenie */}
        <g filter={`url(#tien${uid})`}>
          <path d={sluckaD} {...sirkaCary(2.4, { stroke: '#64748b' })} />
          <path d={sluckaD} {...sirkaCary(1.6, { stroke: hlavna })} />
          {dalsie.map((f, i) => <path key={i} d={sluckaD} {...sirkaCary(1.6, { stroke: f, strokeDasharray: '2 4', strokeDashoffset: i * -2 })} />)}
        </g>

        {/* strapce = hustý prúžok „nitiek“ okolo vlajky */}
        {jeStrapce && (
          <g filter={`url(#tien${uid})`}>
            <path d={d} {...sirkaCary(7, { stroke: '#64748b', strokeDasharray: '0.9 0.7', strokeLinecap: 'butt' })} />
            <path d={d} {...sirkaCary(6.6, { stroke: hlavna, strokeDasharray: '0.6 1', strokeLinecap: 'butt' })} />
          </g>
        )}

        {/* vlajka */}
        <path d={d} fill={`url(#vl${uid})`} stroke="#312e81" strokeWidth="0.4" />
        <path d="M 11 14 L 29 14 M 11 20 L 29 20 M 11 26 L 23 26" stroke="#c7d2fe" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

        {/* šnúrka dookola */}
        {!jeStrapce && (
          <g filter={`url(#tien${uid})`}>
            <path d={d} {...sirkaCary(2.6, { stroke: '#64748b' })} />
            <path d={d} {...sirkaCary(1.8, { stroke: hlavna })} />
            {dalsie.map((f, i) => <path key={i} d={d} {...sirkaCary(1.8, { stroke: f, strokeLinecap: 'butt', strokeDasharray: '2.2 4.4', strokeDashoffset: i * -2.2 })} />)}
          </g>
        )}
      </svg>
      <p className="text-[10px] text-slate-500 text-center leading-tight">Ilustračný náhľad: {jeStrapce ? 'strapce okolo dokola' : 'šnúrka dookola'} a šnúrka na zavesenie hore</p>
    </div>
  );
}
