// Preklad rozhrania verejných appiek (SK -> EN / DE) bez zásahu do jednotlivých appiek: prehliadač sleduje DOM a slovenské texty / atribúty
// (placeholder, title, aria-label, alt) nahrádza prekladom zo slovníka. Slovník = (1) predpreložené texty zabalené v appke (slovnik-*.json),
// (2) cache v prehliadači, (3) chýbajúce texty si vyžiada od edge funkcie `preklad` (Claude + tabuľka `preklady`). Slovenčina = pôvodné texty, nič sa nemení.
import { supabase } from '../supabaseClient';
import { normalizuj, jePrekladatelny, dosad } from './normalizuj';

export const JAZYKY = ['sk', 'en', 'de'];
const ATRIBUTY = ['placeholder', 'title', 'aria-label', 'alt'];
const PRESKOC = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

let jazyk = 'sk';
let slovnik = new Map();
const zlyhane = new Set(); // kľúče, ktoré server nepreložil (limit…) — nepýtame ich opakovane
const cakajuce = new Set();
const neprelozene = new Set(); // všetko, čo sa za behu nenašlo v slovníku (na kontrolu / doplnenie slovníka)
if (typeof window !== 'undefined') window.__pbtNeprelozene = () => [...neprelozene];
let casovac = null;
let beziPocet = 0;
let spustene = false;
let pripraveny = false; // preklad sa zapne až keď je v appke zabalený predpreložený slovník (slovnik-en.json)
export const jePripraveny = () => pripraveny;
const zaznamy = new WeakMap(); // textový uzol -> { sk, pouzite }
const zaznamyAtr = new WeakMap(); // element -> { atribút: { sk, pouzite } }

export function zistiJazyk() {
  const uloz = (l) => { try { localStorage.setItem('pbt_lang', l); } catch { /* bez ukladania */ } };
  try {
    const z = new URLSearchParams(window.location.search).get('lang');
    if (JAZYKY.includes(z)) { uloz(z); return z; }
  } catch { /* ignoruj */ }
  try { const u = localStorage.getItem('pbt_lang'); if (JAZYKY.includes(u)) return u; } catch { /* ignoruj */ }
  // prišiel zákazník z anglickej / nemeckej verzie obchodu (pbtprint.sk/en/…, /de/…)?
  try {
    if (document.referrer) {
      const m = /^\/(en|de)(\/|$)/.exec(new URL(document.referrer).pathname);
      if (m) return m[1];
    }
  } catch { /* ignoruj */ }
  // jazyk prehliadača (čeština = slovenčina); angličtina v prehliadači u človeka v SK/CZ časovom pásme = slovenčina
  const zoznam = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'sk']).map((x) => String(x).slice(0, 2).toLowerCase());
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignoruj */ }
  const vSkCz = /^Europe\/(Bratislava|Prague)$/.test(tz);
  for (const l of zoznam) {
    if (l === 'sk' || l === 'cs') return 'sk';
    if (l === 'de') return 'de';
    if (l === 'en') return vSkCz ? 'sk' : 'en';
  }
  return vSkCz ? 'sk' : 'en';
}

export const aktualnyJazyk = () => jazyk;

function preskocit(el) { return PRESKOC.has(el.tagName) || (el.closest && el.closest('[translate="no"]')); }

function prelozText(sk) {
  if (jazyk === 'sk' || !/\S/.test(sk)) return sk;
  const { kluc, cisla, predok, za } = normalizuj(sk);
  if (!jePrekladatelny(kluc)) return sk;
  const tr = slovnik.get(kluc);
  if (tr === undefined) { neprelozene.add(kluc); if (!zlyhane.has(kluc)) { cakajuce.add(kluc); planuj(); } return sk; }
  return predok + dosad(tr, cisla) + za;
}

// funkcia pre window.alert / confirm (synchrónne — použije len už známy preklad)
export const prelozRychlo = (t) => (typeof t === 'string' ? prelozText(t) : t);

function spracujText(n) {
  const p = n.parentElement; if (p && preskocit(p)) return;
  const rec = zaznamy.get(n);
  let sk;
  if (rec && n.nodeValue === rec.pouzite) sk = rec.sk;
  else { sk = n.nodeValue; if (rec) { rec.sk = sk; rec.pouzite = null; } }
  const novy = prelozText(sk);
  zaznamy.set(n, { sk, pouzite: novy === sk ? null : novy });
  if (novy !== n.nodeValue) n.nodeValue = novy;
}

function spracujAtributy(el) {
  for (const a of ATRIBUTY) {
    if (!el.hasAttribute(a)) continue;
    let mapa = zaznamyAtr.get(el); if (!mapa) { mapa = {}; zaznamyAtr.set(el, mapa); }
    const rec = mapa[a];
    const hodnota = el.getAttribute(a);
    let sk;
    if (rec && hodnota === rec.pouzite) sk = rec.sk; else sk = hodnota;
    const novy = prelozText(sk);
    mapa[a] = { sk, pouzite: novy === sk ? null : novy };
    if (novy !== hodnota) el.setAttribute(a, novy);
  }
}

function spracujUzol(n) {
  if (n.nodeType === 3) { spracujText(n); return; }
  if (n.nodeType !== 1 || preskocit(n)) return;
  spracujAtributy(n);
  for (let c = n.firstChild; c; c = c.nextSibling) spracujUzol(c);
}

function spracujTitulok() {
  const sk = document.documentElement.getAttribute('data-sk-title') || document.title;
  if (!document.documentElement.hasAttribute('data-sk-title')) document.documentElement.setAttribute('data-sk-title', sk);
  const novy = prelozText(sk);
  if (document.title !== novy) document.title = novy;
}

function spracujVsetko() { if (document.body) spracujUzol(document.body); spracujTitulok(); }

function planuj() { clearTimeout(casovac); casovac = setTimeout(posliDavku, 250); }

function ulozLokalne() {
  try {
    const obj = {}; slovnik.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(`pbt_tr_${jazyk}`, JSON.stringify(obj));
  } catch { /* plné úložisko — nevadí */ }
}

function posliDavku() {
  if (jazyk === 'sk' || !supabase) return;
  while (beziPocet < 3 && cakajuce.size) odosli();
}

async function odosli() {
  beziPocet++;
  const lang = jazyk;
  const davka = [...cakajuce].slice(0, 50);
  davka.forEach((k) => cakajuce.delete(k));
  try {
    const { data } = await supabase.functions.invoke('preklad', { body: { lang, texts: davka } });
    if (lang === jazyk) {
      const pr = (data && data.ok && data.preklady) || {};
      davka.forEach((k) => { if (typeof pr[k] === 'string') slovnik.set(k, pr[k]); else zlyhane.add(k); });
      ulozLokalne();
      spracujVsetko();
    }
  } catch { davka.forEach((k) => zlyhane.add(k)); }
  beziPocet--;
  if (cakajuce.size) planuj();
}

async function nacitajSlovnik(lang) {
  slovnik = new Map(); zlyhane.clear(); cakajuce.clear();
  if (lang === 'sk') return;
  try {
    const lok = JSON.parse(localStorage.getItem(`pbt_tr_${lang}`) || '{}');
    Object.entries(lok).forEach(([k, v]) => slovnik.set(k, v));
  } catch { /* bez cache */ }
  try {
    const mod = lang === 'en' ? await import('./slovnik-en.json') : await import('./slovnik-de.json');
    Object.entries(mod.default || {}).forEach(([k, v]) => slovnik.set(k, v));
  } catch { /* slovník nie je zabalený */ }
}

export async function nastavJazyk(lang, ulozit = true) {
  if (!JAZYKY.includes(lang)) return;
  if (ulozit) { try { localStorage.setItem('pbt_lang', lang); } catch { /* ignoruj */ } }
  jazyk = lang;
  document.documentElement.lang = lang;
  await nacitajSlovnik(lang);
  spracujVsetko();
  window.dispatchEvent(new CustomEvent('pbt-jazyk', { detail: lang }));
}

export async function spustiPreklad() {
  if (spustene) return;
  spustene = true;
  try {
    const en = await import('./slovnik-en.json');
    pripraveny = Object.keys(en.default || {}).length > 100;
  } catch { pripraveny = false; }
  if (!pripraveny) return;
  window.dispatchEvent(new CustomEvent('pbt-preklad-pripraveny'));
  const pocet = (muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => spracujUzol(n));
      else if (m.type === 'characterData') spracujText(m.target);
      else if (m.type === 'attributes') spracujAtributy(m.target);
    }
  };
  const obs = new MutationObserver(pocet);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTY });
  const alertPovodny = window.alert.bind(window), confirmPovodny = window.confirm.bind(window);
  window.alert = (m) => alertPovodny(prelozRychlo(m));
  window.confirm = (m) => confirmPovodny(prelozRychlo(m));
  await nastavJazyk(zistiJazyk(), false);
}
