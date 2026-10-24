import { useId } from 'react';

// PBT loading screen (logo s atramentom P → B → T). Pôvodný súbor: pbt-loader.liquid.
// progress = 0..1 (volitelne) zapne rezim priebehu, inak bezi plynula animacia.
// absolute = true -> prekryje len rodica (position: relative), inak celu obrazovku.
const CSS = `
  .pbt-loader{
    --pbt-bg:#000000; --pbt-fg:#ffffff; --pbt-size:clamp(72px,14vmin,120px); --pbt-p:0;
    position:fixed; inset:0; z-index:2147483000; display:grid; place-items:center;
    background:var(--pbt-bg); transition:opacity .45s ease, visibility .45s;
  }
  .pbt-loader--light{ --pbt-bg:#ffffff; --pbt-fg:#000000; }
  .pbt-loader__logo{ width:var(--pbt-size); height:auto; overflow:visible; transition:transform .45s cubic-bezier(.2,.8,.2,1); }
  .pbt-ghost{ fill:var(--pbt-fg); opacity:.16; }
  .pbt-trace{ fill:none; stroke:var(--pbt-fg); stroke-linecap:round; stroke-linejoin:round;
    animation:pbt-trace 1.6s linear infinite; }
  .pbt-trace--head{ stroke-width:7; stroke-dasharray:10 90; filter:drop-shadow(0 0 6px var(--pbt-fg)); }
  .pbt-trace--tail{ stroke-width:5; stroke-dasharray:26 74; stroke-dashoffset:16; opacity:.35; animation-name:pbt-trace-tail; }
  @keyframes pbt-trace{ from{stroke-dashoffset:0} to{stroke-dashoffset:-100} }
  @keyframes pbt-trace-tail{ from{stroke-dashoffset:16} to{stroke-dashoffset:-84} }
  /* atrament stúpa v písmenách P → B → T */
  .pbt-ink{ fill:var(--pbt-fg); animation:pbt-ink 2.4s cubic-bezier(.45,0,.25,1) infinite backwards; }
    .pbt-ink--b{ animation-delay:.18s; }
    .pbt-ink--t{ animation-delay:.36s; }
  @keyframes pbt-ink{
    0%  { transform:translate(0px,482px); opacity:1; }
    55% { transform:translate(-205px,-40px); opacity:1; }
    80% { transform:translate(-300px,-40px); opacity:1; }
    92% { transform:translate(-330px,-40px); opacity:0; }
    100%{ transform:translate(-330px,482px); opacity:0; }
  }
  /* režim priebehu: PBTLoader.progress(0..1) */
  .pbt-loader.is-progress .pbt-ink{ animation:pbt-wave 1.2s linear infinite; opacity:1; }
  @keyframes pbt-wave{ from{ transform:translate(0px, calc((1 - var(--pbt-p)) * 492px - 40px)); } to{ transform:translate(-205px, calc((1 - var(--pbt-p)) * 492px - 40px)); } }
  /* koniec */
  .pbt-loader.is-done{ opacity:0; visibility:hidden; pointer-events:none; }
  .pbt-loader.is-done .pbt-loader__logo{ transform:scale(1.08); }
  @media (prefers-reduced-motion:reduce){
    .pbt-trace{ display:none; }
    .pbt-ink{ animation:none; transform:translate(-205px,-40px); }
    .pbt-loader__logo{ animation:pbt-pulse 1.6s ease-in-out infinite; }
    @keyframes pbt-pulse{ 50%{ opacity:.55; } }
  }

  .pbt-loader--abs{ position:absolute; z-index:30; }
`;

const CLIPY = {
  p: 'M142.5 78.8 L50.8 133.0 L45.8 136.5 L45.8 316.5 L46.8 317.8 L77.0 335.5 L77.8 335.2 L78.0 250.8 L90.8 243.0 L137.0 216.5 L142.8 212.8 L143.0 79.5ZM109.5 128.8 L110.0 129.2 L110.0 198.5 L108.2 200.0 L94.8 207.0 L93.5 207.0 L84.0 203.0 L80.5 202.0 L77.8 200.2 L77.8 148.2 L82.8 144.8Z',
  b: 'M204.5 42.8 L159.8 69.0 L156.2 71.5 L156.2 380.5 L157.5 381.8 L160.2 383.0 L203.8 409.0 L205.2 409.5 L251.2 382.5 L253.8 380.2 L253.8 234.8 L252.5 233.2 L234.8 224.5 L233.8 223.5 L253.5 211.5 L253.5 71.2 L206.0 43.0ZM204.5 240.5 L206.0 240.8 L220.2 249.5 L221.2 250.8 L221.2 364.5 L220.0 366.2 L205.8 375.0 L204.2 375.0 L188.8 365.2 L188.8 250.5 L190.8 248.8ZM204.5 76.0 L205.5 76.0 L220.2 84.8 L221.2 86.2 L221.2 196.5 L220.2 198.0 L205.5 206.8 L204.5 206.8 L199.0 203.2 L197.5 202.8 L188.8 197.0 L188.8 85.8 L191.2 83.8Z',
  t: 'M267.5 79.2 L267.0 79.8 L267.0 111.5 L271.8 114.8 L296.8 129.0 L299.5 131.2 L299.2 353.0 L299.8 353.8 L300.8 353.8 L303.8 351.8 L328.8 338.8 L331.8 336.5 L331.8 150.5 L332.8 150.0 L353.5 162.5 L355.0 163.0 L363.0 168.0 L363.8 168.0 L364.2 167.2 L364.2 136.5 L363.8 135.5Z',
};
const DUCH = ['M204.8 0.8 L197.5 1.2 L191.5 2.2 L182.8 5.0 L175.5 8.5 L161.8 16.2 L155.0 20.5 L30.0 92.0 L24.8 95.5 L18.2 101.0 L13.0 107.0 L9.0 112.8 L5.0 120.8 L4.5 123.2 L3.0 126.8 L1.0 138.0 L1.0 314.2 L3.0 325.2 L4.5 328.8 L5.0 331.2 L9.0 339.2 L13.8 346.0 L17.5 350.2 L24.8 356.5 L32.8 361.8 L51.2 372.0 L174.5 443.0 L181.5 446.5 L190.2 449.5 L195.8 450.2 L196.8 450.8 L203.5 451.0 L205.0 451.8 L206.5 451.0 L213.2 450.8 L215.5 450.0 L219.8 449.5 L228.5 446.5 L248.2 435.8 L330.8 388.0 L332.2 387.5 L379.2 360.5 L385.2 356.5 L390.0 352.5 L396.8 345.2 L399.8 341.0 L404.5 332.2 L407.2 324.2 L408.8 316.2 L409.0 141.5 L408.8 135.5 L408.0 133.2 L407.5 128.8 L404.8 120.5 L401.0 113.0 L396.5 106.5 L392.8 102.2 L388.0 97.8 L382.2 93.5 L234.0 8.2 L227.8 5.2 L224.5 4.5 L221.2 3.0 L212.5 1.2ZM201.0 26.0 L209.0 26.0 L210.8 26.8 L213.2 27.0 L220.2 30.0 L371.0 116.8 L376.0 121.5 L379.8 126.8 L382.8 134.8 L383.2 139.5 L383.2 312.5 L382.8 317.5 L379.5 325.8 L376.8 329.8 L372.2 334.2 L365.0 339.0 L353.5 345.2 L340.2 353.2 L223.0 420.5 L216.0 424.0 L208.5 426.0 L199.5 425.8 L193.8 424.0 L189.5 422.0 L41.5 337.0 L36.5 333.2 L32.0 328.2 L28.8 322.5 L26.8 314.8 L26.8 137.2 L27.8 132.5 L31.0 125.2 L34.8 120.5 L38.2 117.2 L46.2 112.2 L67.2 100.5 L70.5 98.2 L76.0 95.5 L84.5 90.2 L90.0 87.5 L93.2 85.2 L152.2 51.8 L187.8 31.0 L194.8 27.8Z', 'M142.5 78.8 L50.8 133.0 L45.8 136.5 L45.8 316.5 L46.8 317.8 L77.0 335.5 L77.8 335.2 L78.0 250.8 L90.8 243.0 L137.0 216.5 L142.8 212.8 L143.0 79.5ZM109.5 128.8 L110.0 129.2 L110.0 198.5 L108.2 200.0 L94.8 207.0 L93.5 207.0 L84.0 203.0 L80.5 202.0 L77.8 200.2 L77.8 148.2 L82.8 144.8ZM204.5 42.8 L159.8 69.0 L156.2 71.5 L156.2 380.5 L157.5 381.8 L160.2 383.0 L203.8 409.0 L205.2 409.5 L251.2 382.5 L253.8 380.2 L253.8 234.8 L252.5 233.2 L234.8 224.5 L233.8 223.5 L253.5 211.5 L253.5 71.2 L206.0 43.0ZM204.5 240.5 L206.0 240.8 L220.2 249.5 L221.2 250.8 L221.2 364.5 L220.0 366.2 L205.8 375.0 L204.2 375.0 L188.8 365.2 L188.8 250.5 L190.8 248.8ZM204.5 76.0 L205.5 76.0 L220.2 84.8 L221.2 86.2 L221.2 196.5 L220.2 198.0 L205.5 206.8 L204.5 206.8 L199.0 203.2 L197.5 202.8 L188.8 197.0 L188.8 85.8 L191.2 83.8ZM267.5 79.2 L267.0 79.8 L267.0 111.5 L271.8 114.8 L296.8 129.0 L299.5 131.2 L299.2 353.0 L299.8 353.8 L300.8 353.8 L303.8 351.8 L328.8 338.8 L331.8 336.5 L331.8 150.5 L332.8 150.0 L353.5 162.5 L355.0 163.0 L363.0 168.0 L363.8 168.0 L364.2 167.2 L364.2 136.5 L363.8 135.5Z'];
const TRASA = 'M204.8 0.8 L197.5 1.2 L191.5 2.2 L182.8 5.0 L175.5 8.5 L161.8 16.2 L155.0 20.5 L30.0 92.0 L24.8 95.5 L18.2 101.0 L13.0 107.0 L9.0 112.8 L5.0 120.8 L4.5 123.2 L3.0 126.8 L1.0 138.0 L1.0 314.2 L3.0 325.2 L4.5 328.8 L5.0 331.2 L9.0 339.2 L13.8 346.0 L17.5 350.2 L24.8 356.5 L32.8 361.8 L51.2 372.0 L174.5 443.0 L181.5 446.5 L190.2 449.5 L195.8 450.2 L196.8 450.8 L203.5 451.0 L205.0 451.8 L206.5 451.0 L213.2 450.8 L215.5 450.0 L219.8 449.5 L228.5 446.5 L248.2 435.8 L330.8 388.0 L332.2 387.5 L379.2 360.5 L385.2 356.5 L390.0 352.5 L396.8 345.2 L399.8 341.0 L404.5 332.2 L407.2 324.2 L408.8 316.2 L409.0 141.5 L408.8 135.5 L408.0 133.2 L407.5 128.8 L404.8 120.5 L401.0 113.0 L396.5 106.5 L392.8 102.2 L388.0 97.8 L382.2 93.5 L234.0 8.2 L227.8 5.2 L224.5 4.5 L221.2 3.0 L212.5 1.2Z';
const VLNA = 'M-410 30 Q-358.75 0 -307.5 30 T-205 30 T-102.5 30 T0 30 T102.5 30 T205 30 T307.5 30 T410 30 T512.5 30 T615 30 T717.5 30 T820 30 V900 H-410 Z';

export default function PbtLoader({ progress = null, absolute = false, light = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const jePriebeh = typeof progress === 'number';
  const p = jePriebeh ? Math.max(0, Math.min(1, progress)) : 0;
  return (
    <div className={`pbt-loader${light ? ' pbt-loader--light' : ''}${absolute ? ' pbt-loader--abs' : ''}${jePriebeh ? ' is-progress' : ''}`} style={{ '--pbt-p': p }} role="status" aria-live="polite" aria-label="Načítava sa">
      <style>{CSS}</style>
      <svg className="pbt-loader__logo" viewBox="-8 -8 426 468" aria-hidden="true">
        <defs>
          {Object.entries(CLIPY).map(([k, d]) => (
            <clipPath key={k} id={`pbt-clip-${k}-${uid}`}><path clipRule="evenodd" d={d} /></clipPath>
          ))}
        </defs>
        <path className="pbt-ghost" fillRule="evenodd" d={DUCH[0]} />
        <path className="pbt-ghost" fillRule="evenodd" d={DUCH[1]} />
        {['p', 'b', 't'].map((k) => (
          <g key={k} clipPath={`url(#pbt-clip-${k}-${uid})`}><path className={`pbt-ink pbt-ink--${k}`} d={VLNA} /></g>
        ))}
        <path className="pbt-trace pbt-trace--tail" pathLength="100" d={TRASA} />
        <path className="pbt-trace pbt-trace--head" pathLength="100" d={TRASA} />
      </svg>
    </div>
  );
}
