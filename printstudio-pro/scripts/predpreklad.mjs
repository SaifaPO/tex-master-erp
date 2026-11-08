// Predpreklad rozhrania appiek: zo zdrojových súborov (src/**/*.jsx|js) vyberie slovenské texty, necháva ich preložiť edge funkciou `preklad`
// (uloží sa aj do tabuľky `preklady`) a zapíše zabalené slovníky src/i18n/slovnik-en.json a slovnik-de.json.
// Použitie:  node scripts/predpreklad.mjs            (extrakcia + preklad chýbajúcich + export)
//            node scripts/predpreklad.mjs export     (len export všetkého z databázy do slovníkov — po ručnej oprave alebo behu crawlera)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizuj, jePrekladatelny } from '../src/i18n/normalizuj.js';

const korenAppky = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(korenAppky, '.env'), 'utf8').split(/\r?\n/).filter((r) => r.includes('=')).map((r) => [r.slice(0, r.indexOf('=')).trim(), r.slice(r.indexOf('=') + 1).trim()]));
const URL_FN = `${env.VITE_SUPABASE_URL}/functions/v1/preklad`;
const KLUC = env.VITE_SUPABASE_ANON_KEY;

async function volaj(telo) {
  for (let pokus = 0; pokus < 3; pokus++) {
    try {
      const r = await fetch(URL_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KLUC}`, apikey: KLUC }, body: JSON.stringify(telo) });
      const d = await r.json();
      if (d.ok) return d;
    } catch { /* skúsime znova */ }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { ok: false, preklady: {} };
}

function subory(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['assets', 'i18n'].includes(f.name)) subory(p, out); } else if (/\.(jsx|js)$/.test(f.name)) out.push(p);
  }
  return out;
}

const jeKod = (t) => {
  const x = t.trim();
  if (/^[,.:;@<)/'+\-#]/.test(x) && !/^[.,]?\s*\p{L}{3,}.*\s/u.test(x)) return true;
  if (/[`$]|=>|<\w|data-|class=|t\.\w+|\w+\.\w+\(|\w+\[|\?\s*$|^\)|@keyframes|\.pbt/.test(x)) return true;
  if (/^[A-Za-z_]+:\s*$/.test(x)) return true;
  return false;
};
const DIAKRITIKA = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/;
const ATRIBUTY = 'placeholder|title|aria-label|alt|label|podtext|popis|nazov|text|hint|nadpis|titulok|upozornenie|poznamka\\w*|chyba\\w*|msg|message';

function extrahuj(kod) {
  const najdene = new Set();
  const pridaj = (t) => { if (typeof t === 'string' && t.trim()) najdene.add(t); };
  // 1) JSX texty (medzi značkami a výrazmi)
  for (const m of kod.matchAll(/(?<=[>}])([^<>{}]*\p{L}[^<>{}]*)(?=[<{])/gu)) {
    const t = m[1];
    if (/[;=]|&&|\|\||\w\(|\/\/|=>|\bconst\b|\breturn\b/.test(t)) continue;
    pridaj(t);
  }
  // 2) textové atribúty JSX / vlastnosti objektov s reťazcom
  for (const m of kod.matchAll(new RegExp(`\\b(?:${ATRIBUTY})\\s*[=:]\\s*(?:"([^"\\n]+)"|'([^'\\n]+)'|\`([^\`\\n]+)\`)`, 'g'))) pridaj(m[1] ?? m[2] ?? m[3]);
  // 3) ľubovoľné reťazce s diakritikou (chyby, popisy, polia…); template literály: ${…} -> {0}, {1}…
  for (const m of kod.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    let t = m[2];
    if (!DIAKRITIKA.test(t) || t.length < 3 || t.length > 500) continue;
    if (m[1] === '`') { let i = 0; t = t.replace(/\$\{[^}]*\}/g, () => `{${i++}}`); }
    t = t.replace(/\\n/g, ' ').replace(/\\(['"`\\])/g, '$1');
    if (/^[\w\-./:#\[\]%]+$/.test(t)) continue;
    pridaj(t);
  }
  return najdene;
}

async function exportuj() {
  for (const lang of ['en', 'de']) {
    const d = await volaj({ lang, akcia: 'export' });
    const kluce = Object.keys(d.preklady || {}).sort();
    const obj = {}; kluce.forEach((k) => { obj[k] = d.preklady[k]; });
    fs.writeFileSync(path.join(korenAppky, `src/i18n/slovnik-${lang}.json`), JSON.stringify(obj, null, 0) + '\n');
    console.log(`slovnik-${lang}.json: ${kluce.length} textov`);
  }
}

async function hlavne() {
  if (process.argv[2] === 'export') { await exportuj(); return; }
  const vsetky = new Set();
  for (const f of subory(path.join(korenAppky, 'src'))) {
    for (const t of extrahuj(fs.readFileSync(f, 'utf8'))) {
      const { kluc } = normalizuj(t);
      if (jePrekladatelny(kluc) && !jeKod(kluc)) vsetky.add(kluc);
    }
  }
  const zoznam = [...vsetky].sort();
  console.log(`Zdrojové texty: ${zoznam.length}`);
  if (process.argv[2] === 'pocet') { fs.writeFileSync(path.join(korenAppky, 'scripts/_texty.json'), JSON.stringify(zoznam, null, 1)); return; }
  for (const lang of ['en', 'de']) {
    let hotovo = 0;
    const davky = [];
    for (let i = 0; i < zoznam.length; i += 50) davky.push(zoznam.slice(i, i + 50));
    let idx = 0;
    const pracovnik = async () => {
      while (idx < davky.length) {
        const mojeIdx = idx++;
        const d = await volaj({ lang, texts: davky[mojeIdx] });
        await new Promise((res) => setTimeout(res, 9000));
        hotovo += Object.keys(d.preklady || {}).length;
        if (mojeIdx % 10 === 0) console.log(`${lang}: dávka ${mojeIdx + 1}/${davky.length}, preložených ${hotovo}`);
      }
    };
    await pracovnik();
    console.log(`${lang}: hotovo, ${hotovo} textov`);
  }
  await exportuj();
}
hlavne();
