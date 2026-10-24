import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Shirt, AlertTriangle, Trash2, Plus, Download, RefreshCw, ExternalLink } from 'lucide-react';
import NumberInput from '../NumberInput';
import ErpProduktVyber from './ErpProduktVyber';
import { priceAt, mapConfigFromDb, DEFAULT_PRICING_CONFIG } from './pricingEngine';

// PONUKA DRESOV pre kluby (verejná stránka ?typ=ponuka): cenník, príplatky, zľavy, termíny, rozmerová tabuľka a zoznam dopytov.
// Predajná cena každej položky = výrobná cena (produkt z Katalógu alebo ručný náklad) cez maržový modul (Cenotvorba) + DPH, alebo ručný prepis.
const PRINTSTUDIO_BASE_URL = 'https://printstudio-pro.vercel.app';
const eur = (v, d = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(d)} €`);
const POLOZKY = { dres: 'Dres', trenirky: 'Trenírky', stulpne: 'Štulpne' };
const UROVNE = ['Základ', 'Premium', 'Pro'];
const STULP = ['Simple', 'Pletené', 'Profesionálne'];
const STAVY = { novy: 'Nový', spracovany: 'Spracovaný', ponuka: 'Ponuka poslaná', objednavka: 'Objednávka', zrusene: 'Zrušený' };
const RUKAVY = ['bez', 'kratky', 'dlhy'], GOLIERE = ['okruhly', 'v', 'polo', 'snur', 'v_vsuvka', 'snur_retro', 'snur_hexa', 'hexa'];
const STRIHY = ['standard', 'raglan', 'klasik', 'sedlo', 'lacrosse', 'box'];
const ROZ_ZAKLAD = ['dotlac', 'strih', 'rukav', 'golier', 'aplikacie', 'vysivka', 'stulpne', 'brankari'];

const nazovUrovne = (r) => (r.rezim === 'stock' ? 'sklad' : r.polozka === 'stulpne' && r.sport_kod === 'hokej' ? STULP[r.uroven] : UROVNE[r.uroven]);

function Cislo({ value, onChange, step = '0.01', placeholder, className = '' }) {
  return <NumberInput step={step} value={value} onChange={onChange} fallback={0} placeholder={placeholder} className={`w-20 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs text-right ${className}`} />;
}
// Prázdny prepis ceny: pole, ktoré sa dá vymazať (NumberInput nepustí prázdnu hodnotu)
function Prepis({ value, onChange, placeholder }) {
  return <input type="text" inputMode="decimal" value={value ?? ''} placeholder={placeholder} onChange={(e) => { const t = e.target.value.replace(',', '.'); if (t === '') onChange(null); else if (!Number.isNaN(Number(t))) onChange(t); }} className="w-20 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs text-right placeholder-slate-600" />;
}

export default function PonukaDresovTab({ supabase }) {
  const [sekcia, setSekcia] = useState('cennik');
  const [nast, setNast] = useState(null);
  const [sporty, setSporty] = useState([]);
  const [polozky, setPolozky] = useState([]);
  const [pripl, setPripl] = useState([]);
  const [zlavy, setZlavy] = useState([]);
  const [terminy, setTerminy] = useState([]);
  const [velkosti, setVelkosti] = useState([]);
  const [dopyty, setDopyty] = useState([]);
  const [produkty, setProdukty] = useState([]);
  const [erpProdukty, setErpProdukty] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(DEFAULT_PRICING_CONFIG);
  const [maxB2b, setMaxB2b] = useState(0);
  const [chyba, setChyba] = useState('');
  const [nacitava, setNacitava] = useState(true);

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const [n, s, p, pr, z, t, v, d, pc, prd, erp, b2b] = await Promise.all([
      supabase.from('ponuka_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('ponuka_sporty').select('*').order('poradie'),
      supabase.from('ponuka_polozky').select('*').order('id'),
      supabase.from('ponuka_priplatky').select('*').order('skupina').order('poradie'),
      supabase.from('ponuka_zlavy_mnozstvo').select('*').order('min_ks'),
      supabase.from('ponuka_terminy').select('*').order('poradie'),
      supabase.from('ponuka_velkosti').select('*').order('poradie'),
      supabase.from('ponuka_dopyty').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('produkty').select('id, nazov, zakladna_cena, aktivny, erp_produkt_id').eq('aktivny', true).order('nazov'),
      supabase.from('products').select('id, name, custom_code, production_cost').order('name'),
      supabase.from('b2b_kody').select('zlava_percent').eq('aktivny', true),
    ]);
    if (n.error || !n.data) { setChyba('Tabuľky ponuky dresov ešte neexistujú — spusti v Supabase SQL Editore migráciu migration_ponuka_dresy.sql (priečinok printstudio-pro).'); setNacitava(false); return; }
    setChyba('');
    setNast(n.data); setSporty(s.data || []); setPolozky(p.data || []); setPripl(pr.data || []); setZlavy(z.data || []); setTerminy(t.data || []); setVelkosti(v.data || []); setDopyty(d.data || []);
    if (pc.data) setPricingConfig(mapConfigFromDb(pc.data));
    setProdukty(prd.data || []); setErpProdukty(erp.data || []);
    setMaxB2b((b2b.data || []).reduce((m, x) => Math.max(m, Number(x.zlava_percent) || 0), 0));
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const vat = Number(nast?.dph_percent) || 23;
  const maxVol = zlavy.reduce((m, x) => Math.max(m, Number(x.zlava_percent) || 0), 0);
  const minDel = terminy.reduce((m, x) => Math.min(m, Number(x.uprava_percent) || 0), 0);

  // Cena riadku: ručný prepis (s DPH) > výrobná cena cez maržový modul > nedostupné
  const ocen = (r) => {
    const blank = r.produkt_id != null ? produkty.find((x) => x.id === r.produkt_id) : null;
    const naklad = blank ? Number(blank.zakladna_cena) || 0 : Number(r.naklad_eur) || 0;
    const zoZdroja = naklad > 0 ? Math.round(priceAt(naklad, 1, pricingConfig) * (1 + vat / 100) * 100) / 100 : null;
    const cena = r.predajna_s_dph != null && r.predajna_s_dph !== '' ? Number(r.predajna_s_dph) : zoZdroja;
    const bezDph = cena != null ? cena / (1 + vat / 100) : null;
    const marza = naklad > 0 && bezDph != null ? (bezDph / naklad - 1) * 100 : null;
    const cap = Number(nast?.max_zlava_percent) || 0;
    let faktor = (1 - maxVol / 100) * (1 - maxB2b / 100) * (1 + minDel / 100);
    if (cap > 0) faktor = Math.max(faktor, 1 - cap / 100);
    const marzaPoZlavach = naklad > 0 && bezDph != null ? (bezDph * faktor / naklad - 1) * 100 : null;
    return { naklad, zdrojProdukt: !!blank, cena, zoZdroja, marza, marzaPoZlavach };
  };
  const minMarza = Number(nast?.min_marza_percent) || 0;

  const ulozNast = async (patch) => { const next = { ...nast, ...patch, updated_at: new Date().toISOString() }; setNast(next); await supabase.from('ponuka_nastavenia').upsert({ ...next, id: 1 }); };
  const zmenPolozku = async (id, patch) => { setPolozky((rows) => rows.map((x) => (x.id === id ? { ...x, ...patch } : x))); await supabase.from('ponuka_polozky').update(patch).eq('id', id); await supabase.from('ponuka_nastavenia').update({ updated_at: new Date().toISOString() }).eq('id', 1); };
  const zmazPolozku = async (id) => { if (!window.confirm('Zmazať túto cenu? Položka sa prestane ponúkať.')) return; setPolozky((rows) => rows.filter((x) => x.id !== id)); await supabase.from('ponuka_polozky').delete().eq('id', id); };
  const zmenPripl = async (kod, patch) => { setPripl((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x))); await supabase.from('ponuka_priplatky').update(patch).eq('kod', kod); await supabase.from('ponuka_nastavenia').update({ updated_at: new Date().toISOString() }).eq('id', 1); };
  const zmenSport = async (kod, patch) => { setSporty((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x))); await supabase.from('ponuka_sporty').update(patch).eq('kod', kod); };
  const zmenTermin = async (kod, patch) => { setTerminy((rows) => rows.map((x) => (x.kod === kod ? { ...x, ...patch } : x))); await supabase.from('ponuka_terminy').update(patch).eq('kod', kod); };
  const zmenZlavu = async (minKs, patch) => { setZlavy((rows) => rows.map((x) => (x.min_ks === minKs ? { ...x, ...patch } : x))); await supabase.from('ponuka_zlavy_mnozstvo').update(patch).eq('min_ks', minKs); };
  const pridajZlavu = async () => { const minKs = Number(window.prompt('Od koľkých kusov?')); if (!minKs || zlavy.some((z) => z.min_ks === minKs)) return; const riadok = { min_ks: minKs, zlava_percent: 0 }; await supabase.from('ponuka_zlavy_mnozstvo').insert(riadok); setZlavy((rows) => [...rows, riadok].sort((a, b) => a.min_ks - b.min_ks)); };
  const zmazZlavu = async (minKs) => { await supabase.from('ponuka_zlavy_mnozstvo').delete().eq('min_ks', minKs); setZlavy((rows) => rows.filter((x) => x.min_ks !== minKs)); };
  const zmenVelkost = async (v, patch) => { setVelkosti((rows) => rows.map((x) => (x.velkost === v ? { ...x, ...patch } : x))); await supabase.from('ponuka_velkosti').update(patch).eq('velkost', v); };

  const [novaPol, setNovaPol] = useState({ sport_kod: 'futbal', polozka: 'dres', rezim: 'custom', uroven: 0 });
  const pridajPolozku = async () => {
    const riadok = { ...novaPol, uroven: novaPol.rezim === 'stock' ? 0 : Number(novaPol.uroven) };
    const { data, error } = await supabase.from('ponuka_polozky').insert(riadok).select().single();
    if (error) { window.alert(error.message.includes('duplicate') ? 'Táto kombinácia už existuje.' : error.message); return; }
    setPolozky((rows) => [...rows, data]);
  };

  // ---- Export / import cenníka vo formáte prototypu (JSON) ----
  const exportJson = () => {
    const o = { items: {}, stock: {}, dotlac: {}, fit: {}, sleeve: {}, collar: {}, apps: {}, gk: {}, volume: zlavy.map((z) => [z.min_ks, Number(z.zlava_percent)]), delivery: {}, vat, nameNum: 0, sizeChart: {} };
    polozky.forEach((r) => { const c = ocen(r).cena; if (c == null) return; if (r.rezim === 'stock') { (o.stock[r.sport_kod] ||= {})[r.polozka] = c; } else { ((o.items[r.sport_kod] ||= {})[r.polozka] ||= [null, null, null])[r.uroven] = c; } });
    pripl.forEach((p) => { const c = ocen(p).cena ?? 0; if (p.kod === 'nameNum') o.nameNum = c; else { const [g, k] = p.kod.split('.'); (o[g] ||= {})[k] = c; } });
    terminy.forEach((t) => { o.delivery[t.kod] = Number(t.uprava_percent); });
    velkosti.forEach((v) => { o.sizeChart[v.velkost] = [v.hrudnik_klasik, v.hrudnik_slim, v.hrudnik_obtiahnuty, v.dlzka]; });
    const blob = new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cennik-ponuka-dresy.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
  const importJson = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o.items || !o.volume || !o.delivery) throw new Error('Súbor musí obsahovať aspoň items, volume a delivery.');
      if (!window.confirm('Importom sa prepíšu ručné predajné ceny (s DPH), príplatky, množstevné zľavy, termíny a rozmerová tabuľka hodnotami zo súboru. Pokračovať?')) return;
      const upsertPol = async (sport, polozka, rezim, uroven, cena) => {
        await supabase.from('ponuka_polozky').upsert({ sport_kod: sport, polozka, rezim, uroven, predajna_s_dph: cena }, { onConflict: 'sport_kod,polozka,rezim,uroven' });
      };
      for (const [sport, its] of Object.entries(o.items)) for (const [pol, arr] of Object.entries(its)) for (let i = 0; i < arr.length; i++) await upsertPol(sport, pol, 'custom', i, arr[i]);
      for (const [sport, its] of Object.entries(o.stock || {})) for (const [pol, c] of Object.entries(its)) await upsertPol(sport, pol, 'stock', 0, c);
      const mapa = { dotlac: o.dotlac, fit: o.fit, sleeve: o.sleeve, collar: o.collar, apps: o.apps, gk: o.gk };
      for (const [g, vals] of Object.entries(mapa)) for (const [k, c] of Object.entries(vals || {})) await supabase.from('ponuka_priplatky').update({ predajna_s_dph: c }).eq('kod', `${g}.${k}`);
      if (o.nameNum != null) await supabase.from('ponuka_priplatky').update({ predajna_s_dph: o.nameNum }).eq('kod', 'nameNum');
      await supabase.from('ponuka_zlavy_mnozstvo').delete().gte('min_ks', 0);
      await supabase.from('ponuka_zlavy_mnozstvo').insert(o.volume.map(([m, p]) => ({ min_ks: m, zlava_percent: p })));
      for (const [k, p] of Object.entries(o.delivery)) await supabase.from('ponuka_terminy').update({ uprava_percent: p }).eq('kod', k);
      for (const [v, a] of Object.entries(o.sizeChart || {})) await supabase.from('ponuka_velkosti').update({ hrudnik_klasik: a[0], hrudnik_slim: a[1], hrudnik_obtiahnuty: a[2], dlzka: a[3] }).eq('velkost', v);
      if (o.vat != null) await ulozNast({ dph_percent: o.vat });
      await nacitaj(); window.alert('Cenník bol importovaný.');
    } catch (err) { window.alert('Import zlyhal: ' + err.message); }
  };

  // ---- Dopyty ----
  const [vybranyDopyt, setVybranyDopyt] = useState(null);
  const zmenStav = async (id, stav) => { setDopyty((rows) => rows.map((x) => (x.id === id ? { ...x, stav } : x))); setVybranyDopyt((v) => (v && v.id === id ? { ...v, stav } : v)); await supabase.from('ponuka_dopyty').update({ stav }).eq('id', id); };
  const zmazDopyt = async (id) => { if (!window.confirm('Zmazať dopyt?')) return; await supabase.from('ponuka_dopyty').delete().eq('id', id); setDopyty((rows) => rows.filter((x) => x.id !== id)); setVybranyDopyt(null); };
  const exportSupisky = (d) => {
    const rows = (d.supiska || []).map((x, i) => ({ '#': i + 1, Meno: x.m, 'Číslo': x.c, 'Veľkosť': x.s, 'Brankár': x.g ? 'áno' : '' }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Poznámka: 'Dopyt nemá súpisku — len počet hráčov.' }]), 'Súpiska');
    XLSX.writeFile(wb, `supiska_${d.cislo || d.id.slice(0, 8)}.xlsx`);
  };

  const [vytvaram, setVytvaram] = useState(false);
  const vytvorZakazku = async (d) => {
    if (d.erp_zakazka_id) { window.alert(`Zákazka už existuje: ${d.erp_cislo || d.erp_zakazka_id}`); return; }
    if (!window.confirm('Vytvoriť zákazku v ERP z tohto dopytu? Súpiska sa prenesie do poznámok zákazky.')) return;
    setVytvaram(true);
    try {
      const S = d.konfig || {};
      const stock = S.mode === 'stock';
      const chosen = Object.keys(S.comps || {}).filter((k) => S.comps[k]);
      // produkt z Katalógu cez blank → ERP produkt
      const poloziek = [];
      for (const pol of chosen) {
        const uroven = stock ? 0 : (pol === 'stulpne' && S.sport === 'hokej' ? Number(S.stulpVer) || 0 : Number(S.tier) || 0);
        const r = polozky.find((x) => x.sport_kod === S.sport && x.polozka === pol && x.rezim === (stock ? 'stock' : 'custom') && x.uroven === uroven);
        const blank = r?.produkt_id != null ? produkty.find((x) => x.id === r.produkt_id) : null;
        const erp = blank?.erp_produkt_id ? erpProdukty.find((x) => x.id === blank.erp_produkt_id) : null;
        poloziek.push({ pol, erp });
      }
      const rok = new Date().getFullYear();
      const { data: poc } = await supabase.from('order_number_counters').select('*').eq('company', 'PBT').eq('year', rok).maybeSingle();
      const dalsie = poc?.next_number || 1;
      const cislo = `PBT-${String(rok).slice(-2)}-${String(dalsie).padStart(4, '0')}`;
      await supabase.from('order_number_counters').upsert({ company: 'PBT', year: rok, next_number: dalsie + 1 }, { onConflict: 'company,year' });
      const dniDopredu = { slow: stock ? 21 : 42, std: stock ? 7 : 14, exp: stock ? 3 : 7 }[S.del] || 14;
      const termin = new Date(Date.now() + dniDopredu * 86400000).toISOString().slice(0, 10);
      const stanice = stock ? ['grafik', 'transfer', 'balenie'] : ['grafik', 'sublimacia', 'strihanie', 'sitie', 'balenie'];
      const stat = {}, dat = {}; stanice.forEach((s) => { stat[s] = 'caka'; dat[s] = termin; });
      const supText = (d.supiska || []).map((x, i) => `${i + 1}. ${x.m || '–'} #${x.c || '–'} ${x.s}${x.g ? ' BRANKÁR' : ''}`).join('\n');
      const popisCfg = [S.sport, stock ? 'sklad + dotlač' : `celopotlač ${UROVNE[Number(S.tier) || 0]}`, !stock ? `strih ${S.fit}, rukáv ${S.sleeve}, golier ${S.collar}` : '', Object.keys(S.apps || {}).filter((k) => S.apps[k]).join(', '), Object.keys(S.vys || {}).filter((k) => S.vys[k]).map((k) => 'vyšívané ' + k).join(', '), S.vysSponzorov ? `${S.vysSponzorov}× vyšívané logo sponzora` : '', S.comps?.stulpne ? `štulpne ${S.stulpTyp === 'bezponozkove' ? 'bezponožkové' : 'ponožkové'}` : '', (S.doplnky || []).length || S.doplnkyIne ? 'DOPYT NA DOPLNKY: ' + [...(S.doplnky || []), S.doplnkyIne].filter(Boolean).join(', ') : '', S.nn && !stock ? 'meno+číslo' : ''].filter(Boolean).join(' · ');
      const poznamka = [`Dopyt ${d.cislo} z ponuky dresov`, popisCfg, `Termín: ${S.del}`, d.poznamka ? `Poznámka zákazníka: ${d.poznamka}` : '', `Kontakt: ${[d.kontakt, d.telefon, d.email].filter(Boolean).join(', ')}`, d.b2b_kod ? `B2B kód ${d.b2b_kod} (${d.agentura})` : ''].filter(Boolean).join(' | ');
      const orderId = `ZAK-${Date.now()}`;
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true });
      const t = new Date(); const casNow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      const { error } = await supabase.from('orders').insert({
        id: orderId, customer: d.klub || d.kontakt || d.email || `Dopyt ${d.cislo}`, created_at: casNow, scheduled_day: termin, drive_link: '', notes: poznamka + (supText ? `\nSÚPISKA:\n${supText}` : ''), payment_type: 'faktura',
        items: poloziek.map((x, i) => ({
          itemId: `${orderId}-${i + 1}`, productId: x.erp?.id || null, productName: x.erp?.name || `${POLOZKY[x.pol]} ${S.sport}`, customCode: x.erp?.custom_code || '', qualityTier: '', gender: 'neutral', qty: d.hracov || 0,
          notes: `${popisCfg}${i === 0 && supText ? `\nSÚPISKA:\n${supText}` : ''}${x.erp ? '' : '\n⚠️ Položka nie je prepojená na produkt v Katalógu (PrintStudio → Ponuka dresov → Cenník).'}`,
          imageUrl: '', assignedDesignerId: '', addons: [], rozpisUrl: '', rozpisFileName: '', rozpisMimeType: '', materialsNeeded: [], threadQtyM: 0, priority: (count || 0) + 1 + i, productionDate: termin,
          stationDates: dat, stationStatuses: stat, materialDeducted: false,
        })),
        order_log: [{ date: casNow, author: 'Ponuka dresov', text: `Zákazka založená z dopytu ${d.cislo}.` }],
        legacy_order_number: null, company_brand: 'PBT', order_number: cislo, accounting_status: null,
        variable_symbol: orderId.replace(/\D/g, '').slice(-10), expected_amount: Number(d.cena_spolu_s_dph) || null, variable_symbol_confirmed: false,
      });
      if (error) throw error;
      await supabase.from('ponuka_dopyty').update({ erp_zakazka_id: orderId, erp_cislo: cislo, stav: 'objednavka' }).eq('id', d.id);
      const upd = { erp_zakazka_id: orderId, erp_cislo: cislo, stav: 'objednavka' };
      setDopyty((rows) => rows.map((x) => (x.id === d.id ? { ...x, ...upd } : x))); setVybranyDopyt((v) => (v ? { ...v, ...upd } : v));
      window.alert(`Zákazka ${cislo} bola vytvorená.${poloziek.some((x) => !x.erp) ? ' Niektoré položky nemajú produkt z Katalógu — doplň ich v zákazke.' : ''}`);
    } catch (e) { window.alert('Zákazku sa nepodarilo vytvoriť: ' + e.message); }
    setVytvaram(false);
  };

  const polozkySkupiny = useMemo(() => {
    const m = new Map();
    polozky.forEach((r) => { const k = `${r.sport_kod}|${r.rezim}`; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()].sort((a, b) => (sporty.findIndex((s) => s.kod === a[0].split('|')[0]) - sporty.findIndex((s) => s.kod === b[0].split('|')[0])) || a[0].localeCompare(b[0]));
  }, [polozky, sporty]);

  if (chyba) return <p className="text-sm text-amber-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {chyba}</p>;
  if (nacitava || !nast) return <p className="text-sm text-slate-500">Načítavam…</p>;

  const erpPom = { produkty, erpProdukty, onBlankVytvoreny: (b) => setProdukty((p) => [...p, b]) };
  // Riadky sú obyčajné funkcie (nie komponenty), aby sa polia pri písaní neprerenderovali od nuly a nestrácali fokus
  const bunka = (r, nazov, onZmena, tabulka) => {
    const o = ocen(r);
    const slabaMarza = o.marzaPoZlavach != null && o.marzaPoZlavach < minMarza;
    return (
      <tr key={r.id} className="border-t border-slate-800 align-top">
        <td className="px-2 py-1.5 text-slate-200 font-semibold whitespace-nowrap">{nazov}</td>
        <td className="px-2 py-1.5 w-56">
          <ErpProduktVyber supabase={supabase} blankId={r.produkt_id} blanky={produkty} erpProdukty={erpProdukty} onZmena={(id) => onZmena({ produkt_id: id })} onBlankVytvoreny={erpPom.onBlankVytvoreny} />
        </td>
        <td className="px-2 py-1.5 text-right">{o.zdrojProdukt ? <span className="font-mono text-xs text-slate-300">{eur(o.naklad)}</span> : <Cislo value={r.naklad_eur ?? 0} onChange={(v) => onZmena({ naklad_eur: v })} />}<div className="text-[10px] text-slate-600">{o.zdrojProdukt ? 'z katalógu' : 'ručne'}</div></td>
        <td className="px-2 py-1.5 text-right"><Prepis value={r.predajna_s_dph} placeholder={o.zoZdroja != null ? o.zoZdroja.toFixed(2) : '—'} onChange={(v) => onZmena({ predajna_s_dph: v })} /><div className="text-[10px] text-slate-600">{r.predajna_s_dph != null && r.predajna_s_dph !== '' ? 'ručný prepis' : 'z nákladu'}</div></td>
        <td className="px-2 py-1.5 text-right font-mono text-sm font-bold text-white">{eur(o.cena)}</td>
        <td className="px-2 py-1.5 text-right font-mono text-xs">{o.marza != null ? <span className={o.marza < minMarza ? 'text-amber-400' : 'text-emerald-400'}>{o.marza.toFixed(0)} %</span> : <span className="text-slate-600">—</span>}</td>
        <td className="px-2 py-1.5 text-right font-mono text-xs">{o.marzaPoZlavach != null ? <span className={slabaMarza ? 'text-rose-400' : 'text-slate-300'} title="Marža po najväčšej množstevnej + B2B zľave a termínovej zľave (so stropom zľavy)">{o.marzaPoZlavach.toFixed(0)} %{slabaMarza ? ' ⚠' : ''}</span> : <span className="text-slate-600">—</span>}</td>
        {tabulka}
      </tr>
    );
  };
  const Hlavicka = ({ extra }) => <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]"><tr>{extra}<th className="px-2 py-2 text-left">Produkt z Katalógu</th><th className="px-2 py-2 text-right">Výrobná cena</th><th className="px-2 py-2 text-right">Predaj s DPH (prepis)</th><th className="px-2 py-2 text-right">Cena s DPH</th><th className="px-2 py-2 text-right">Marža</th><th className="px-2 py-2 text-right">Po zľavách</th><th className="px-2 py-2" /></tr></thead>;

  const nazovSportu = (k) => sporty.find((s) => s.kod === k)?.nazov || k;
  const SEKCIE = [['cennik', 'Cenník položiek'], ['priplatky', 'Príplatky'], ['zlavy', 'Zľavy, termíny, DPH'], ['sporty', 'Športy'], ['velkosti', 'Rozmerová tabuľka'], ['dopyty', `Dopyty (${dopyty.filter((d) => d.stav === 'novy').length} nových)`], ['import', 'Import / export']];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shirt className="text-indigo-400 h-5 w-5" /> Ponuka dresov pre kluby a agentúry</h2>
          <p className="text-xs text-slate-400 mt-1">Verejný konfigurátor s cenou hneď a odoslaním dopytu. Cena = výrobná cena (produkt z Katalógu alebo ručne) cez maržový modul + DPH, alebo ručný prepis. B2B kódy sa spravujú v karte „B2B kódy (agentúry)".</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input type="checkbox" checked={nast.aktivny !== false} onChange={(e) => ulozNast({ aktivny: e.target.checked })} /> Ponuka zapnutá</label>
          <a href={`${PRINTSTUDIO_BASE_URL}/?typ=ponuka`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold"><ExternalLink className="h-3.5 w-3.5" /> Otvoriť ponuku</a>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">{SEKCIE.map(([id, n]) => <button key={id} onClick={() => setSekcia(id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${sekcia === id ? 'bg-slate-800 text-white border-indigo-500' : 'text-slate-400 border-slate-800 hover:bg-slate-800'}`}>{n}</button>)}</div>

      {sekcia === 'cennik' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Prázdny „Predaj s DPH (prepis)" = cena sa počíta z výrobnej ceny. <strong className="text-slate-200">Po zľavách</strong> je marža pri najvyššej množstevnej a B2B zľave a termínovej zľave (so stropom {nast.max_zlava_percent} %); pod {minMarza} % sa zobrazí upozornenie. Hodnoty z prototypu sú v ručnom prepise (okrem overených cien z e-shopu sú to ODHADY).</p>
          {polozkySkupiny.map(([kluc, rows]) => {
            const [sport, rezim] = kluc.split('|');
            return (
              <div key={kluc} className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
                <div className="px-4 py-2.5 font-bold text-sm text-white">{nazovSportu(sport)} — {rezim === 'stock' ? 'sklad + dotlač' : 'zákazková celopotlač'}</div>
                <table className="w-full text-xs">
                  <Hlavicka extra={<th className="px-2 py-2 text-left">Položka / úroveň</th>} />
                  <tbody>
                    {rows.map((r) => (
                      bunka(r, `${POLOZKY[r.polozka]} · ${nazovUrovne(r)}`, (patch) => zmenPolozku(r.id, patch), <td className="px-2 py-1.5"><button onClick={() => zmazPolozku(r.id)} title="Zmazať" className="p-1 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>)
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 flex flex-wrap items-end gap-3 text-xs">
            <span className="font-bold text-white w-full">Pridať cenu (šport × položka × úroveň)</span>
            <select value={novaPol.sport_kod} onChange={(e) => setNovaPol({ ...novaPol, sport_kod: e.target.value })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white">{sporty.map((s) => <option key={s.kod} value={s.kod}>{s.nazov}</option>)}</select>
            <select value={novaPol.polozka} onChange={(e) => setNovaPol({ ...novaPol, polozka: e.target.value })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white">{Object.entries(POLOZKY).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            <select value={novaPol.rezim} onChange={(e) => setNovaPol({ ...novaPol, rezim: e.target.value })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white"><option value="custom">Celopotlač</option><option value="stock">Sklad + dotlač</option></select>
            {novaPol.rezim === 'custom' && <select value={novaPol.uroven} onChange={(e) => setNovaPol({ ...novaPol, uroven: e.target.value })} className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white">{UROVNE.map((u, i) => <option key={u} value={i}>{u} (hokejové štulpne: {STULP[i]})</option>)}</select>}
            <button onClick={pridajPolozku} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button>
          </div>
        </div>
      )}

      {sekcia === 'priplatky' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Príplatky a dotlače za kus (s DPH). Môžu byť záporné (napr. rukáv „bez" je lacnejší). Ak je vybraný produkt z Katalógu alebo ručný náklad a prepis je prázdny, cena sa dopočíta cez maržový modul.</p>
          {ROZ_ZAKLAD.map((sk) => {
            const rows = pripl.filter((p) => p.skupina === sk);
            if (!rows.length) return null;
            return (
              <div key={sk} className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
                <div className="px-4 py-2.5 font-bold text-sm text-white capitalize">{{ dotlac: 'Dotlač a meno + číslo', strih: 'Strih (štandardný, raglan, sedlo, lacrosse…)', rukav: 'Rukáv', golier: 'Golier', aplikacie: 'Doplnkové aplikácie', vysivka: 'Vyšívané aplikácie (hokej)', stulpne: 'Štulpne — ponožkové / bezponožkové', brankari: 'Brankári' }[sk]}</div>
                <table className="w-full text-xs">
                  <Hlavicka extra={<th className="px-2 py-2 text-left">Príplatok</th>} />
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.kod} className="border-t border-slate-800 align-top">
                        <td className="px-2 py-2 text-slate-200 font-semibold w-48">{p.nazov}</td>
                        <td colSpan={6} className="p-0">
                          <table className="w-full"><tbody>{bunkaPripl(p)}</tbody></table>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {sekcia === 'zlavy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
            <h3 className="font-bold text-sm text-white">Všeobecné nastavenia</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="text-slate-400">DPH (%)<NumberInput step="0.1" value={Number(nast.dph_percent)} onChange={(v) => ulozNast({ dph_percent: v })} fallback={23} className="mt-1 w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /></label>
              <label className="text-slate-400">Minimálna marža (upozornenie, %)<NumberInput step="1" value={Number(nast.min_marza_percent)} onChange={(v) => ulozNast({ min_marza_percent: v })} fallback={25} className="mt-1 w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /></label>
              <label className="text-slate-400">Strop celkovej zľavy (%)<NumberInput step="1" value={Number(nast.max_zlava_percent)} onChange={(v) => ulozNast({ max_zlava_percent: v })} fallback={40} className="mt-1 w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono" /></label>
              <label className="text-slate-400 col-span-2">E-mail na upozornenie o novom dopyte<input type="text" value={nast.email_notifikacie || ''} onChange={(e) => ulozNast({ email_notifikacie: e.target.value })} placeholder="pbtprint@pbtprint.sk" className="mt-1 w-full px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white" /></label>
            </div>
            <p className="text-[11px] text-slate-500">E-maily zákazníkovi a firme sa posielajú cez rovnaký odosielací účet ako upomienky (ERP → Upomienky → Odosielateľ) a vyžadujú secret RESEND_API_KEY v Supabase. Bez toho sa dopyt uloží, ale e-mail sa neodošle.</p>
          </div>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-bold text-sm text-white">Množstevné zľavy</h3><button onClick={pridajZlavu} className="text-xs font-bold text-indigo-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Pridať</button></div>
            {zlavy.map((z) => <div key={z.min_ks} className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-16">od {z.min_ks} ks</span><Cislo step="0.5" value={Number(z.zlava_percent)} onChange={(v) => zmenZlavu(z.min_ks, { zlava_percent: v })} /> <span className="text-slate-500">%</span>{z.min_ks > 1 && <button onClick={() => zmazZlavu(z.min_ks)} className="p-1 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div>)}
          </div>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 lg:col-span-2">
            <h3 className="font-bold text-sm text-white">Termíny dodania</h3>
            <p className="text-[11px] text-slate-500">Úprava v %: záporné číslo = zľava, kladné = príplatok. Termín podľa kapacity výroby sa dá doplniť neskôr.</p>
            {terminy.map((t) => (
              <div key={t.kod} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs items-end">
                <label className="text-slate-400">Názov<input type="text" value={t.nazov} onChange={(e) => zmenTermin(t.kod, { nazov: e.target.value })} className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></label>
                <label className="text-slate-400">Celopotlač<input type="text" value={t.text_custom} onChange={(e) => zmenTermin(t.kod, { text_custom: e.target.value })} className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></label>
                <label className="text-slate-400">Sklad<input type="text" value={t.text_sklad} onChange={(e) => zmenTermin(t.kod, { text_sklad: e.target.value })} className="mt-1 w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white" /></label>
                <div className="text-slate-400">Úprava %<div className="mt-1"><Cislo step="0.5" value={Number(t.uprava_percent)} onChange={(v) => zmenTermin(t.kod, { uprava_percent: v })} /></div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sekcia === 'sporty' && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]"><tr><th className="px-3 py-2 text-left">Šport</th><th className="px-3 py-2">Aktívny</th><th className="px-3 py-2 text-left">Strihy</th><th className="px-3 py-2 text-left">Rukávy</th><th className="px-3 py-2 text-left">Goliere</th><th className="px-3 py-2 text-left">Materiály</th><th className="px-3 py-2 text-left">Brankári</th><th className="px-3 py-2 text-left">Poznámka k skladu</th></tr></thead>
            <tbody>
              {sporty.map((s) => (
                <tr key={s.kod} className="border-t border-slate-800 align-top">
                  <td className="px-3 py-2"><input type="text" value={s.nazov} onChange={(e) => zmenSport(s.kod, { nazov: e.target.value })} className="w-28 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white font-bold" /></td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={s.aktivny} onChange={(e) => zmenSport(s.kod, { aktivny: e.target.checked })} /></td>
                  <td className="px-3 py-2">{STRIHY.map((x) => <label key={x} className="mr-2 text-slate-300 whitespace-nowrap"><input type="checkbox" checked={(s.strihy || []).includes(x)} onChange={(e) => zmenSport(s.kod, { strihy: e.target.checked ? [...(s.strihy || []), x] : (s.strihy || []).filter((y) => y !== x) })} /> {x}</label>)}</td>
                  <td className="px-3 py-2">{RUKAVY.map((x) => <label key={x} className="mr-2 text-slate-300"><input type="checkbox" checked={s.rukavy.includes(x)} onChange={(e) => zmenSport(s.kod, { rukavy: e.target.checked ? [...s.rukavy, x] : s.rukavy.filter((y) => y !== x) })} /> {x}</label>)}</td>
                  <td className="px-3 py-2">{GOLIERE.map((x) => <label key={x} className="mr-2 text-slate-300"><input type="checkbox" checked={s.goliere.includes(x)} onChange={(e) => zmenSport(s.kod, { goliere: e.target.checked ? [...s.goliere, x] : s.goliere.filter((y) => y !== x) })} /> {x}</label>)}</td>
                  <td className="px-3 py-2"><select value={s.brankari} onChange={(e) => zmenSport(s.kod, { brankari: e.target.value })} className="px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white"><option value="none">bez brankárov</option><option value="futbal">futbal</option><option value="hokej">hokej</option><option value="hadzana">hádzaná (mikina)</option></select></td>
                  <td className="px-3 py-2"><select value={s.kvality ?? 3} onChange={(e) => zmenSport(s.kod, { kvality: Number(e.target.value) })} className="px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white"><option value={3}>3 úrovne</option><option value={1}>1 štandardný</option></select></td>
                  <td className="px-3 py-2"><input type="text" value={s.sklad_poznamka || ''} onChange={(e) => zmenSport(s.kod, { sklad_poznamka: e.target.value })} placeholder="napr. len tréningové dresy" className="w-48 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-white" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 p-3">Šport sa zákazníkovi ukáže, len ak má aspoň jednu cenu (cenník položiek). Sklad pre šport sa zapne tým, že pridáte cenu v režime „sklad + dotlač".</p>
        </div>
      )}

      {sekcia === 'velkosti' && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]"><tr><th className="px-3 py-2 text-left">Veľkosť</th><th className="px-3 py-2">Hrudník klasik</th><th className="px-3 py-2">Slim</th><th className="px-3 py-2">Obtiahnutý</th><th className="px-3 py-2">Dĺžka</th></tr></thead>
            <tbody>
              {velkosti.map((v) => <tr key={v.velkost} className="border-t border-slate-800 text-center"><td className="px-3 py-1.5 text-left font-bold text-white">{v.velkost}</td>{['hrudnik_klasik', 'hrudnik_slim', 'hrudnik_obtiahnuty', 'dlzka'].map((c) => <td key={c} className="px-3 py-1.5"><Cislo step="0.5" value={Number(v[c])} onChange={(x) => zmenVelkost(v.velkost, { [c]: x })} /></td>)}</tr>)}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 p-3">Rozmery v cm. Neskôr sa dá rozmerová tabuľka viazať na konkrétny produkt alebo strih.</p>
        </div>
      )}

      {sekcia === 'dopyty' && (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={nacitaj} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg"><RefreshCw className="w-3.5 h-3.5" /> Obnoviť</button></div>
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950 text-slate-500 uppercase text-[10px]"><tr><th className="px-3 py-2 text-left">Dátum</th><th className="px-3 py-2 text-left">Číslo</th><th className="px-3 py-2 text-left">Klub / kontakt</th><th className="px-3 py-2 text-left">Šport</th><th className="px-3 py-2 text-right">Hráči</th><th className="px-3 py-2 text-right">Cena s DPH</th><th className="px-3 py-2 text-left">Stav</th><th className="px-3 py-2 text-left">ERP</th></tr></thead>
              <tbody>
                {dopyty.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Zatiaľ žiadne dopyty.</td></tr>}
                {dopyty.map((d) => (
                  <tr key={d.id} onClick={() => setVybranyDopyt(d)} className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer text-slate-300">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-400">{new Date(d.created_at).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-white">{d.cislo}</td>
                    <td className="px-3 py-2">{d.klub || d.kontakt || '—'}{d.agentura && <span className="ml-1.5 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">B2B</span>}</td>
                    <td className="px-3 py-2">{d.sport} · {d.rezim === 'stock' ? 'sklad' : 'celopotlač'}</td>
                    <td className="px-3 py-2 text-right">{d.hracov}{d.brankarov ? ` (${d.brankarov} GK)` : ''}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{eur(d.cena_spolu_s_dph)}</td>
                    <td className="px-3 py-2"><span className={d.stav === 'novy' ? 'text-amber-300 font-bold' : 'text-slate-300'}>{STAVY[d.stav]}</span></td>
                    <td className="px-3 py-2 font-mono text-emerald-300">{d.erp_cislo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vybranyDopyt && (
            <div className="fixed inset-0 z-[70] bg-slate-950/80 flex items-start justify-center overflow-y-auto p-4" onClick={(e) => { if (e.target === e.currentTarget) setVybranyDopyt(null); }}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl p-5 space-y-4 text-sm text-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-bold text-white">Dopyt {vybranyDopyt.cislo}</h3><p className="text-xs text-slate-500">{new Date(vybranyDopyt.created_at).toLocaleString('sk-SK')}</p></div>
                  <button onClick={() => setVybranyDopyt(null)} className="text-slate-400 hover:text-white text-xl">×</button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-slate-500 block">Klub / škola / firma</span>{vybranyDopyt.klub || '—'}</div>
                  <div><span className="text-slate-500 block">Kontakt</span>{[vybranyDopyt.kontakt, vybranyDopyt.telefon].filter(Boolean).join(', ') || '—'}<br /><a className="text-indigo-300" href={`mailto:${vybranyDopyt.email}`}>{vybranyDopyt.email}</a></div>
                  <div><span className="text-slate-500 block">Cena</span>bez zliav {eur(vybranyDopyt.cena_bez_zliav_s_dph)} → spolu <strong className="text-white">{eur(vybranyDopyt.cena_spolu_s_dph)}</strong> s DPH ({eur(vybranyDopyt.cena_spolu_bez_dph)} bez DPH){vybranyDopyt.b2b_kod && <><br />B2B kód {vybranyDopyt.b2b_kod} ({vybranyDopyt.agentura}, −{vybranyDopyt.zlava_b2b_percent} %)</>}</div>
                  <div><span className="text-slate-500 block">Hráči</span>{vybranyDopyt.hracov}{vybranyDopyt.brankarov ? `, z toho brankári ${vybranyDopyt.brankarov}` : ''} · kusov {vybranyDopyt.kusov}</div>
                </div>
                {vybranyDopyt.poznamka && <div className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-3"><span className="text-slate-500 block mb-1">Poznámka zákazníka</span>{vybranyDopyt.poznamka}</div>}
                <pre className="text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-400">{JSON.stringify(vybranyDopyt.konfig, null, 1)}</pre>
                {(vybranyDopyt.supiska || []).length > 0 && (
                  <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-1.5 text-left">#</th><th className="p-1.5 text-left">Meno</th><th className="p-1.5">Číslo</th><th className="p-1.5">Veľkosť</th><th className="p-1.5">GK</th></tr></thead>
                      <tbody>{vybranyDopyt.supiska.map((x, i) => <tr key={i} className="border-t border-slate-800 text-center"><td className="p-1.5 text-left text-slate-500">{i + 1}</td><td className="p-1.5 text-left">{x.m}</td><td className="p-1.5">{x.c}</td><td className="p-1.5">{x.s}</td><td className="p-1.5">{x.g ? '✓' : ''}</td></tr>)}</tbody></table>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select value={vybranyDopyt.stav} onChange={(e) => zmenStav(vybranyDopyt.id, e.target.value)} className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs">{Object.entries(STAVY).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                  <button onClick={() => exportSupisky(vybranyDopyt)} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Súpiska do Excelu</button>
                  <button onClick={() => vytvorZakazku(vybranyDopyt)} disabled={vytvaram || !!vybranyDopyt.erp_zakazka_id} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold">{vybranyDopyt.erp_zakazka_id ? `Zákazka ${vybranyDopyt.erp_cislo}` : vytvaram ? 'Vytváram…' : 'Vytvoriť zákazku v ERP'}</button>
                  <button onClick={() => zmazDopyt(vybranyDopyt.id)} className="ml-auto p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-900/60"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {sekcia === 'import' && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3 text-xs text-slate-300">
          <p>Export stiahne aktuálny cenník (s DPH) vo formáte prototypu <code>ponuka-dresy.html</code>. Import načíta cenník v tomto formáte a uloží ho ako ručné predajné ceny, príplatky, zľavy, termíny a rozmerovú tabuľku (B2B kódy sa neprenášajú — majú vlastnú kartu).</p>
          <div className="flex gap-2">
            <button onClick={exportJson} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Exportovať cenník (JSON)</button>
            <label className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">Importovať cenník (JSON)<input type="file" accept=".json,application/json" onChange={importJson} className="hidden" /></label>
          </div>
        </div>
      )}
    </div>
  );

  // Riadok príplatku (samostatne, aby sa dal použiť v tabuľke vyššie)
  function bunkaPripl(p) {
    const o = ocen(p);
    return (
      <tr key={p.kod} className="align-top">
        <td className="px-2 py-1.5 w-56"><ErpProduktVyber supabase={supabase} blankId={p.produkt_id} blanky={produkty} erpProdukty={erpProdukty} onZmena={(id) => zmenPripl(p.kod, { produkt_id: id })} onBlankVytvoreny={erpPom.onBlankVytvoreny} /></td>
        <td className="px-2 py-1.5 text-right">{o.zdrojProdukt ? <span className="font-mono text-xs text-slate-300">{eur(o.naklad)}</span> : <Cislo value={p.naklad_eur ?? 0} onChange={(v) => zmenPripl(p.kod, { naklad_eur: v })} />}<div className="text-[10px] text-slate-600">{o.zdrojProdukt ? 'z katalógu' : 'ručne'}</div></td>
        <td className="px-2 py-1.5 text-right"><Prepis value={p.predajna_s_dph} placeholder={o.zoZdroja != null ? o.zoZdroja.toFixed(2) : '—'} onChange={(v) => zmenPripl(p.kod, { predajna_s_dph: v })} /></td>
        <td className="px-2 py-1.5 text-right font-mono text-sm font-bold text-white">{eur(o.cena ?? 0)}</td>
        <td className="px-2 py-1.5 text-right font-mono text-xs">{o.marza != null ? `${o.marza.toFixed(0)} %` : '—'}</td>
        <td className="px-2 py-1.5" />
      </tr>
    );
  }
}
