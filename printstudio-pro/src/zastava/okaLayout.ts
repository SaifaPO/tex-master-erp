// Pravidlá rozmiestnenia kovových očiek (priechodiek) a karabínok na zástave. JEDNO miesto pravdy — rovnaký kód je skopírovaný aj do
// edge funkcií zastava-price-preview a zastava-create-draft-order (musia byť samostatné súbory), aby počet kusov v cene vždy sedel s náhľadom.
//
// Pravidlá:
//  1) Body na strane idú rovnomerne od okraja po okraj, prvý a posledný v ROHU (2 kusy = oba konce strany).
//  2) Na strane s tunelom sa očká ani karabínky nedajú (strana sa preskočí). Na susedných stranách začínajú HNEĎ VEDĽA tunela, nie v rohu cez tunel.
//  3) Ak je na strane spevňujúci popruh, body idú CEZ popruh (stred popruhu), rovnaké pozdĺž strany ako bez popruhu.
//  4) Jeden kus na strane: zákazník volí, na ktorom konci strany ('start' = vľavo/hore, 'end' = vpravo/dole).
//  5) Roh, ktorý patrí dvom stranám, sa počíta len raz (jeden fyzický kus).
export type Strana = 'top' | 'right' | 'bottom' | 'left';
export interface SkupinaBodov { side: string; count?: number; poz?: string }
export interface KontextBodov {
  w?: number; h?: number;                 // rozmer plátna (ľubovoľná jednotka — pre počítanie kusov nie je dôležitá)
  tunelSides: Set<string>;                // strany s tunelom
  popruhy?: Record<string, boolean>;      // strany so spevňujúcim popruhom
  okraj?: number;                         // odstup stredu bodu od okraja, ak na strane nie je popruh
  tunelT?: number;                        // hrúbka tunela
  strapT?: number;                        // hrúbka popruhu
  medzera?: number;                       // medzera medzi tunelom a prvým bodom
}
export interface Bod { id: string; x: number; y: number; side: Strana }

const STRANY: Strana[] = ['top', 'right', 'bottom', 'left'];
// susedná strana na začiatku [0] a na konci [1] danej strany (začiatok = vľavo/hore)
const SUSED: Record<Strana, [Strana, Strana]> = { top: ['left', 'right'], bottom: ['left', 'right'], left: ['top', 'bottom'], right: ['top', 'bottom'] };
const ROHY: Record<string, string> = { 'top|left': 'TL', 'top|right': 'TR', 'bottom|left': 'BL', 'bottom|right': 'BR' };
const rohId = (a: Strana, b: Strana) => ROHY[`${a}|${b}`] || ROHY[`${b}|${a}`];
// 4 rohy: [strana, koniec] dvojice stráv, ktoré roh tvoria
const ROHY_SKUPINA: [[Strana, 0 | 1], [Strana, 0 | 1]][] = [
  [['top', 0], ['left', 0]], [['top', 1], ['right', 0]], [['bottom', 0], ['left', 1]], [['bottom', 1], ['right', 1]],
];

export function rozlozBody(skupiny: SkupinaBodov[], k: KontextBodov): Bod[] {
  const w = k.w ?? 100;
  const h = k.h ?? 100;
  const okraj = k.okraj ?? 3;
  const tunelT = k.tunelT ?? 8;
  const strapT = k.strapT ?? 4;
  const medzera = k.medzera ?? 2;
  const popruhy = k.popruhy || {};
  const jeTunel = (s: Strana) => k.tunelSides.has(s);
  const inset = (s: Strana) => (popruhy[s] ? strapT / 2 : okraj);
  const vodorovna = (s: Strana) => s === 'top' || s === 'bottom';
  const dlzka = (s: Strana) => (vodorovna(s) ? w : h);
  // súradnica na osi strany pre jej koniec (0 = začiatok, 1 = koniec): v rohu, alebo hneď vedľa tunela na susednej strane
  const koniec = (s: Strana, e: 0 | 1) => {
    const sused = SUSED[s][e];
    const p = jeTunel(sused) ? tunelT + medzera : inset(sused);
    return e === 0 ? p : dlzka(s) - p;
  };
  const koniecId = (s: Strana, e: 0 | 1) => {
    const sused = SUSED[s][e];
    return jeTunel(sused) ? `${s}:${e === 0 ? 'start' : 'end'}` : rohId(s, sused);
  };
  const bod = (s: Strana, a: number, id: string): Bod => (vodorovna(s)
    ? { id, x: a, y: s === 'top' ? inset('top') : h - inset('bottom'), side: s }
    : { id, x: s === 'left' ? inset('left') : w - inset('right'), y: a, side: s });

  const vysledok = new Map<string, Bod>();
  const pridaj = (b: Bod) => { if (!vysledok.has(b.id)) vysledok.set(b.id, b); };
  const naStrane = (s: Strana, n: number, poz: string) => {
    if (jeTunel(s) || n < 1) return;
    if (n === 1) {
      const e: 0 | 1 = poz === 'end' ? 1 : 0;
      pridaj(bod(s, koniec(s, e), koniecId(s, e)));
      return;
    }
    const a0 = koniec(s, 0);
    const a1 = koniec(s, 1);
    for (let i = 0; i < n; i++) {
      const id = i === 0 ? koniecId(s, 0) : i === n - 1 ? koniecId(s, 1) : `${s}:${i}`;
      pridaj(bod(s, a0 + ((a1 - a0) * i) / (n - 1), id));
    }
  };

  for (const g of skupiny || []) {
    const n = Math.max(0, Math.floor(Number(g.count) || 0));
    if (g.side === 'corners') {
      for (const [[sa, ea], [sb, eb]] of ROHY_SKUPINA) {
        const aT = jeTunel(sa);
        const bT = jeTunel(sb);
        if (aT && bT) continue;                                       // roh leží v tuneli oboch strán
        const [s, e]: [Strana, 0 | 1] = aT ? [sb, eb] : [sa, ea];     // ak je tunel na jednej strane, kus ide hneď vedľa neho na druhej
        pridaj(bod(s, koniec(s, e), koniecId(s, e)));
      }
    } else {
      const strany = g.side === 'all' ? STRANY : STRANY.filter((s) => s === g.side);
      for (const s of strany) naStrane(s, n, g.poz || 'start');
    }
  }
  return [...vysledok.values()];
}
