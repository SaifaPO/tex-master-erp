// Výpočet ceny ponuky dresov — JEDNA logika pre klienta (okamžitá odozva) aj server (Edge Function ponuka-dresy ju má vloženú ako kópiu,
// súbor supabase/functions/ponuka-dresy/index.ts sa generuje zo scratch šablóny — pri zmene tohto súboru ho treba pregenerovať).
// cfg = verejný cenník z funkcie (ceny s DPH za kus), S = výber zákazníka, roster = súpiska [{m, c, s, g}].
//
// SKLAD:  jednotka = sklad[šport][položka]; dres += dotlač(meno/číslo/logo) + aplikácie; trenírky += číslo na trenírky; brankári sa nerozlišujú.
// CELOPOTLAČ: základ = ceny[šport][položka][úroveň] (hokejové štulpne: verzia); dres hráč = základ + rukáv* + strih + golier + (meno&číslo) + aplikácie;
//             dres brankár = základ + strih + golier + (meno&číslo) + aplikácie + brankársky strih + (futbal ? dlhý rukáv : rukáv*) + (futbal && lakte);
//             trenírky brankár += boky (futbal). *príplatok za rukáv len ak šport ponúka viac ako 1 rukáv.
// Zľavy: množstevná zo hrubej ceny, B2B z (hrubá − množstevná), termín z (hrubá − množstevná − B2B); celková zľava je zastropená (cfg.maxZlavaPercent).

export const POLOZKY = { dres: 'Dres', trenirky: 'Trenírky', stulpne: 'Štulpne' };
export const STULP_HOKEJ = ['Simple', 'Pletené', 'Profesionálne'];
export const VELKOSTI = ['128', '134', '140', '146', '152', '158', '164', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
export const maSklad = (cfg, sport) => !!(cfg.stock?.[sport] && Object.keys(cfg.stock[sport]).length);
export const dostupnePolozky = (cfg, S) => Object.keys(((S.mode === 'stock' ? cfg.stock : cfg.items) || {})[S.sport] || {});
export const brankariZapnuty = (cfg, S) => S.mode === 'custom' && !!cfg.sporty?.[S.sport] && cfg.sporty[S.sport].brankari !== 'none';

// Opraví výber tak, aby bol platný pre šport a režim (rovnako ako pri prekreslení v prototype)
export function normalizujVyber(cfg, S) {
  const sp = cfg.sporty?.[S.sport];
  if (!sp) return S;
  if (S.mode === 'stock' && !maSklad(cfg, S.sport)) S.mode = 'custom';
  if (!sp.rukavy.includes(S.sleeve)) S.sleeve = sp.rukavy.includes('kratky') ? 'kratky' : sp.rukavy[0];
  if (!sp.goliere.includes(S.collar)) S.collar = sp.goliere[0];
  const av = dostupnePolozky(cfg, S);
  S.comps = S.comps || {};
  Object.keys(S.comps).forEach((k) => { if (!av.includes(k)) S.comps[k] = false; });
  if (!Object.keys(S.comps).some((k) => S.comps[k]) && av.length) S.comps[av[0]] = true;
  return S;
}

export function spocitaj(cfg, S, roster = []) {
  const sp = cfg.sporty[S.sport];
  const stock = S.mode === 'stock';
  const chosen = dostupnePolozky(cfg, S).filter((k) => S.comps?.[k]);
  const appsSum = Object.keys(cfg.apps || {}).filter((k) => S.apps?.[k]).reduce((a, k) => a + num(cfg.apps[k]), 0);
  const gkOn = brankariZapnuty(cfg, S);
  let players, gk;
  if (S.pmode === 'roster') { players = roster.length; gk = gkOn ? roster.filter((r) => r.g).length : 0; }
  else { players = Math.max(0, Math.floor(num(S.players))); gk = gkOn ? Math.min(Math.max(0, Math.floor(num(S.gk))), players) : 0; }
  const field = players - gk;
  const unit = {}, unitGk = {};
  chosen.forEach((k) => {
    let p;
    if (stock) {
      p = num(cfg.stock[S.sport][k]);
      if (k === 'dres') p += ['meno', 'cislo', 'logo'].reduce((a, x) => a + (S.prints?.[x] ? num(cfg.dotlac[x]) : 0), 0) + appsSum;
      if (k === 'trenirky' && S.prints?.cisloTren) p += num(cfg.dotlac.cisloTren);
      unit[k] = unitGk[k] = p;
      return;
    }
    const arr = cfg.items[S.sport][k];
    p = k === 'stulpne' && S.sport === 'hokej' ? num(arr[S.stulpVer]) : num(arr[S.tier]);
    let g = p;
    if (k === 'dres') {
      const slv = sp.rukavy.length > 1 ? num(cfg.sleeve[S.sleeve]) : 0;
      const add = num(cfg.fit[S.fit]) + num(cfg.collar[S.collar]) + (S.nn ? num(cfg.nameNum) : 0) + appsSum;
      p += slv + add;
      g += add + num(cfg.gk.cut) + (sp.brankari === 'futbal' ? num(cfg.sleeve.dlhy) : slv) + (sp.brankari === 'futbal' && S.gkElbow ? num(cfg.gk.lakte) : 0);
    }
    if (k === 'trenirky' && sp.brankari === 'futbal' && S.gkHip) g += num(cfg.gk.boky);
    unit[k] = p; unitGk[k] = g;
  });
  const pcs = players * chosen.length;
  const gross = chosen.reduce((a, k) => a + unit[k] * field + unitGk[k] * gk, 0);
  const volume = [...(cfg.volume || [])].sort((a, b) => a[0] - b[0]).map(([min, p]) => ({ min: num(min), p: num(p) }));
  if (!volume.length || volume[0].min > 1) volume.unshift({ min: 1, p: 0 });
  const vt = [...volume].reverse().find((t) => pcs >= t.min) || volume[0];
  const vol = gross * vt.p / 100;
  const b2bP = S.b2b ? num(S.b2b.p) : 0;
  const b2bAmt = (gross - vol) * b2bP / 100;
  const dp = num(cfg.delivery[S.del]);
  const delAmt = (gross - vol - b2bAmt) * dp / 100;
  let total = gross - vol - b2bAmt + delAmt;
  // strop celkovej zľavy
  let capped = false;
  const cap = num(cfg.maxZlavaPercent);
  if (cap > 0 && gross > 0 && (gross - total) / gross * 100 > cap) { total = gross * (1 - cap / 100); capped = true; }
  const vat = 1 + num(cfg.vat) / 100;
  const show = (v) => (S.b2b ? v / vat : v); // B2B vidí ceny bez DPH
  return { sp, stock, players, gk, chosen, pcs, gross, vt, volume, vol, b2bAmt, b2bP, delAmt, total, capped, vat, show, unit, unitGk, gkOn, appsSum };
}

// Normalizácia veľkostí z Excelu (XXL → 2XL, XXXL → 3XL)
export function normVelkost(v) {
  const x = String(v || '').trim().toUpperCase().replace('XXXL', '3XL').replace('XXL', '2XL');
  return VELKOSTI.includes(x) ? x : 'M';
}

// Import riadkov súpisky (Excel/CSV/vložený text): hlavička sa rozpozná podľa názvov stĺpcov (meno, číslo, veľkosť, brankár)
export function importujRiadky(rows) {
  rows = rows.filter((r) => r && r.some((c) => String(c).trim() !== ''));
  if (!rows.length) return [];
  let iM = 0, iC = 1, iS = 2, iG = -1;
  const h = rows[0].map((c) => String(c).toLowerCase());
  if (h.some((c) => /meno|name|priezv|číslo|cislo|veľk|velk|size|brank/.test(c))) {
    h.forEach((c, i) => {
      if (/meno|name|priezv/.test(c)) iM = i; else if (/čís|cis|num|#/.test(c)) iC = i; else if (/veľk|velk|size/.test(c)) iS = i; else if (/brank|gk|post/.test(c)) iG = i;
    });
    rows = rows.slice(1);
  }
  return rows.map((r) => ({
    m: String(r[iM] ?? '').trim(), c: String(r[iC] ?? '').trim(), s: normVelkost(r[iS]),
    g: iG >= 0 && /^(a|áno|ano|x|1|b|brankár|brankar|gk|yes)$/i.test(String(r[iG]).trim()),
  }));
}
