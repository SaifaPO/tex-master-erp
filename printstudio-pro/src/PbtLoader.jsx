import { useId } from 'react';

// PBT loading screen (logo s atramentom stúpajúcim v písmenách P → B → T). Pôvodný súbor: pbt-loader.liquid.
// Animácie sú SKLADANÉ NA GRAFICKEJ KARTE (len transform / opacity na HTML prvkoch, statické clip-path / mask) — bežia aj vtedy,
// keď je hlavné vlákno prehliadača na pár sekúnd zablokované (načítanie a spracovanie 3D modelu), takže loader sa nikdy nezasekne.
// progress = 0..1 (voliteľne): hladina atramentu sa k nemu plynulo dotiahne; bez neho atrament stúpa dokola.
// absolute = true -> prekryje len rodica (position: relative), inak celú obrazovku.
const VB = { x: -8, y: -8, w: 426, h: 468 };
const CLIPY = {
  p: 'M142.5 78.8 L50.8 133.0 L45.8 136.5 L45.8 316.5 L46.8 317.8 L77.0 335.5 L77.8 335.2 L78.0 250.8 L90.8 243.0 L137.0 216.5 L142.8 212.8 L143.0 79.5ZM109.5 128.8 L110.0 129.2 L110.0 198.5 L108.2 200.0 L94.8 207.0 L93.5 207.0 L84.0 203.0 L80.5 202.0 L77.8 200.2 L77.8 148.2 L82.8 144.8Z',
  b: 'M204.5 42.8 L159.8 69.0 L156.2 71.5 L156.2 380.5 L157.5 381.8 L160.2 383.0 L203.8 409.0 L205.2 409.5 L251.2 382.5 L253.8 380.2 L253.8 234.8 L252.5 233.2 L234.8 224.5 L233.8 223.5 L253.5 211.5 L253.5 71.2 L206.0 43.0ZM204.5 240.5 L206.0 240.8 L220.2 249.5 L221.2 250.8 L221.2 364.5 L220.0 366.2 L205.8 375.0 L204.2 375.0 L188.8 365.2 L188.8 250.5 L190.8 248.8ZM204.5 76.0 L205.5 76.0 L220.2 84.8 L221.2 86.2 L221.2 196.5 L220.2 198.0 L205.5 206.8 L204.5 206.8 L199.0 203.2 L197.5 202.8 L188.8 197.0 L188.8 85.8 L191.2 83.8Z',
  t: 'M267.5 79.2 L267.0 79.8 L267.0 111.5 L271.8 114.8 L296.8 129.0 L299.5 131.2 L299.2 353.0 L299.8 353.8 L300.8 353.8 L303.8 351.8 L328.8 338.8 L331.8 336.5 L331.8 150.5 L332.8 150.0 L353.5 162.5 L355.0 163.0 L363.0 168.0 L363.8 168.0 L364.2 167.2 L364.2 136.5 L363.8 135.5Z',
};
const DUCH = ['M204.8 0.8 L197.5 1.2 L191.5 2.2 L182.8 5.0 L175.5 8.5 L161.8 16.2 L155.0 20.5 L30.0 92.0 L24.8 95.5 L18.2 101.0 L13.0 107.0 L9.0 112.8 L5.0 120.8 L4.5 123.2 L3.0 126.8 L1.0 138.0 L1.0 314.2 L3.0 325.2 L4.5 328.8 L5.0 331.2 L9.0 339.2 L13.8 346.0 L17.5 350.2 L24.8 356.5 L32.8 361.8 L51.2 372.0 L174.5 443.0 L181.5 446.5 L190.2 449.5 L195.8 450.2 L196.8 450.8 L203.5 451.0 L205.0 451.8 L206.5 451.0 L213.2 450.8 L215.5 450.0 L219.8 449.5 L228.5 446.5 L248.2 435.8 L330.8 388.0 L332.2 387.5 L379.2 360.5 L385.2 356.5 L390.0 352.5 L396.8 345.2 L399.8 341.0 L404.5 332.2 L407.2 324.2 L408.8 316.2 L409.0 141.5 L408.8 135.5 L408.0 133.2 L407.5 128.8 L404.8 120.5 L401.0 113.0 L396.5 106.5 L392.8 102.2 L388.0 97.8 L382.2 93.5 L234.0 8.2 L227.8 5.2 L224.5 4.5 L221.2 3.0 L212.5 1.2ZM201.0 26.0 L209.0 26.0 L210.8 26.8 L213.2 27.0 L220.2 30.0 L371.0 116.8 L376.0 121.5 L379.8 126.8 L382.8 134.8 L383.2 139.5 L383.2 312.5 L382.8 317.5 L379.5 325.8 L376.8 329.8 L372.2 334.2 L365.0 339.0 L353.5 345.2 L340.2 353.2 L223.0 420.5 L216.0 424.0 L208.5 426.0 L199.5 425.8 L193.8 424.0 L189.5 422.0 L41.5 337.0 L36.5 333.2 L32.0 328.2 L28.8 322.5 L26.8 314.8 L26.8 137.2 L27.8 132.5 L31.0 125.2 L34.8 120.5 L38.2 117.2 L46.2 112.2 L67.2 100.5 L70.5 98.2 L76.0 95.5 L84.5 90.2 L90.0 87.5 L93.2 85.2 L152.2 51.8 L187.8 31.0 L194.8 27.8Z', 'M142.5 78.8 L50.8 133.0 L45.8 136.5 L45.8 316.5 L46.8 317.8 L77.0 335.5 L77.8 335.2 L78.0 250.8 L90.8 243.0 L137.0 216.5 L142.8 212.8 L143.0 79.5ZM109.5 128.8 L110.0 129.2 L110.0 198.5 L108.2 200.0 L94.8 207.0 L93.5 207.0 L84.0 203.0 L80.5 202.0 L77.8 200.2 L77.8 148.2 L82.8 144.8ZM204.5 42.8 L159.8 69.0 L156.2 71.5 L156.2 380.5 L157.5 381.8 L160.2 383.0 L203.8 409.0 L205.2 409.5 L251.2 382.5 L253.8 380.2 L253.8 234.8 L252.5 233.2 L234.8 224.5 L233.8 223.5 L253.5 211.5 L253.5 71.2 L206.0 43.0ZM204.5 240.5 L206.0 240.8 L220.2 249.5 L221.2 250.8 L221.2 364.5 L220.0 366.2 L205.8 375.0 L204.2 375.0 L188.8 365.2 L188.8 250.5 L190.8 248.8ZM204.5 76.0 L205.5 76.0 L220.2 84.8 L221.2 86.2 L221.2 196.5 L220.2 198.0 L205.5 206.8 L204.5 206.8 L199.0 203.2 L197.5 202.8 L188.8 197.0 L188.8 85.8 L191.2 83.8ZM267.5 79.2 L267.0 79.8 L267.0 111.5 L271.8 114.8 L296.8 129.0 L299.5 131.2 L299.2 353.0 L299.8 353.8 L300.8 353.8 L303.8 351.8 L328.8 338.8 L331.8 336.5 L331.8 150.5 L332.8 150.0 L353.5 162.5 L355.0 163.0 L363.0 168.0 L363.8 168.0 L364.2 167.2 L364.2 136.5 L363.8 135.5Z'];
const TRASA = 'M204.8 0.8 L197.5 1.2 L191.5 2.2 L182.8 5.0 L175.5 8.5 L161.8 16.2 L155.0 20.5 L30.0 92.0 L24.8 95.5 L18.2 101.0 L13.0 107.0 L9.0 112.8 L5.0 120.8 L4.5 123.2 L3.0 126.8 L1.0 138.0 L1.0 314.2 L3.0 325.2 L4.5 328.8 L5.0 331.2 L9.0 339.2 L13.8 346.0 L17.5 350.2 L24.8 356.5 L32.8 361.8 L51.2 372.0 L174.5 443.0 L181.5 446.5 L190.2 449.5 L195.8 450.2 L196.8 450.8 L203.5 451.0 L205.0 451.8 L206.5 451.0 L213.2 450.8 L215.5 450.0 L219.8 449.5 L228.5 446.5 L248.2 435.8 L330.8 388.0 L332.2 387.5 L379.2 360.5 L385.2 356.5 L390.0 352.5 L396.8 345.2 L399.8 341.0 L404.5 332.2 L407.2 324.2 L408.8 316.2 L409.0 141.5 L408.8 135.5 L408.0 133.2 L407.5 128.8 L404.8 120.5 L401.0 113.0 L396.5 106.5 L392.8 102.2 L388.0 97.8 L382.2 93.5 L234.0 8.2 L227.8 5.2 L224.5 4.5 L221.2 3.0 L212.5 1.2Z';
const VLNA = 'M-410 30 Q-358.75 0 -307.5 30 T-205 30 T-102.5 30 T0 30 T102.5 30 T205 30 T307.5 30 T410 30 T512.5 30 T615 30 T717.5 30 T820 30 V900 H-410 Z';

// obrys loga ako maska pre bežiaci lúč (biely obrys na priehľadnom pozadí)
const MASKA_OBRYS = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${VB.x} ${VB.y} ${VB.w} ${VB.h}'><path d='${TRASA}' fill='none' stroke='white' stroke-width='7' stroke-linejoin='round' stroke-linecap='round'/></svg>`)}")`;

const CSS = `
  .pbt-loader{
    --pbt-bg:#000000; --pbt-fg:#ffffff; --pbt-size:clamp(72px,14vmin,120px);
    position:fixed; inset:0; z-index:2147483000; display:grid; place-items:center; background:var(--pbt-bg);
  }
  .pbt-loader--light{ --pbt-bg:#ffffff; --pbt-fg:#000000; }
  .pbt-loader--abs{ position:absolute; z-index:30; }
  .pbt-stage{ position:relative; width:var(--pbt-size); aspect-ratio:${VB.w} / ${VB.h}; }
  .pbt-ghost{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
  .pbt-ghost path{ fill:var(--pbt-fg); opacity:.16; }
  .pbt-letter{ position:absolute; inset:0; overflow:hidden; }
  .pbt-level{ position:absolute; inset:0; will-change:transform,opacity; transform:translate3d(0,96.6%,0); }
  .pbt-wave{ position:absolute; top:0; left:${(-410 - VB.x) / VB.w * 100}%; width:${1230 / VB.w * 100}%; height:${900 / VB.h * 100}%; will-change:transform; animation:pbt-wave 1.3s linear infinite; }
  .pbt-wave path{ fill:var(--pbt-fg); }
  @keyframes pbt-wave{ from{ transform:translate3d(0,0,0); } to{ transform:translate3d(-16.667%,0,0); } }
  /* režim bez priebehu: atrament stúpa dokola */
  .pbt-loader:not(.is-progress) .pbt-level{ animation:pbt-rise 2.4s cubic-bezier(.45,0,.25,1) infinite backwards; }
  .pbt-loader:not(.is-progress) .pbt-letter--b .pbt-level{ animation-delay:.18s; }
  .pbt-loader:not(.is-progress) .pbt-letter--t .pbt-level{ animation-delay:.36s; }
  @keyframes pbt-rise{
    0%  { transform:translate3d(0,96.6%,0); opacity:1; }
    55% { transform:translate3d(0,-15%,0); opacity:1; }
    80% { transform:translate3d(0,-15%,0); opacity:1; }
    92% { transform:translate3d(0,-15%,0); opacity:0; }
    100%{ transform:translate3d(0,96.6%,0); opacity:0; }
  }
  .pbt-loader.is-progress .pbt-level{ transition:transform .9s cubic-bezier(.22,.8,.3,1); }
  /* bežiaci lúč po obryse: otáčajúci sa kužeľový prechod viditeľný len cez masku obrysu */
  .pbt-trace{ position:absolute; inset:0; -webkit-mask-image:${MASKA_OBRYS}; mask-image:${MASKA_OBRYS}; -webkit-mask-size:100% 100%; mask-size:100% 100%; overflow:hidden; }
  .pbt-trace-spin{ position:absolute; left:-50%; top:-50%; width:200%; height:200%; will-change:transform; animation:pbt-spin 1.6s linear infinite;
    background:conic-gradient(from 0deg, transparent 0deg, transparent 250deg, color-mix(in srgb, var(--pbt-fg) 35%, transparent) 300deg, var(--pbt-fg) 356deg, transparent 360deg); }
  @keyframes pbt-spin{ from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
  @media (prefers-reduced-motion:reduce){
    .pbt-trace, .pbt-wave{ display:none; }
    .pbt-loader .pbt-level{ animation:none !important; transform:translate3d(0,-15%,0) !important; }
    .pbt-stage{ animation:pbt-pulse 1.6s ease-in-out infinite; }
    @keyframes pbt-pulse{ 50%{ opacity:.55; } }
  }
`;

// vrstva atramentu v jednom písmene (P / B / T): statický výrez + hladina (transform) + vlnenie (transform)
function Pismeno({ k, clipId, uroven }) {
  return (
    <div className={`pbt-letter pbt-letter--${k}`} style={{ clipPath: `url(#${clipId})`, WebkitClipPath: `url(#${clipId})` }}>
      <div className="pbt-level" style={uroven != null ? { transform: `translate3d(0, ${uroven}%, 0)` } : undefined}>
        <svg className="pbt-wave" viewBox="-410 0 1230 900" preserveAspectRatio="none" aria-hidden="true"><path d={VLNA} /></svg>
      </div>
    </div>
  );
}

export default function PbtLoader({ progress = null, absolute = false, light = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const jePriebeh = typeof progress === 'number';
  const p = jePriebeh ? Math.max(0, Math.min(1, progress)) : 0;
  const uroven = jePriebeh ? 96.6 - p * 111.6 : null; // 96,6 % = prázdne, -15 % = plné
  const sx = 1 / VB.w, sy = 1 / VB.h;
  return (
    <div className={`pbt-loader${light ? ' pbt-loader--light' : ''}${absolute ? ' pbt-loader--abs' : ''}${jePriebeh ? ' is-progress' : ''}`} role="status" aria-live="polite" aria-label="Načítava sa">
      <style>{CSS}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          {Object.entries(CLIPY).map(([k, d]) => (
            <clipPath key={k} id={`pbt-clip-${k}-${uid}`} clipPathUnits="objectBoundingBox">
              <path clipRule="evenodd" transform={`scale(${sx} ${sy}) translate(${-VB.x} ${-VB.y})`} d={d} />
            </clipPath>
          ))}
        </defs>
      </svg>
      <div className="pbt-stage">
        <svg className="pbt-ghost" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} aria-hidden="true">
          <path fillRule="evenodd" d={DUCH[0]} />
          <path fillRule="evenodd" d={DUCH[1]} />
        </svg>
        {['p', 'b', 't'].map((k) => <Pismeno key={k} k={k} clipId={`pbt-clip-${k}-${uid}`} uroven={uroven} />)}
        <div className="pbt-trace"><div className="pbt-trace-spin" /></div>
      </div>
    </div>
  );
}
