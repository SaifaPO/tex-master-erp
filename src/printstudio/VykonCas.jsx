import React, { useState } from 'react';
import { Timer, Plus, Trash2 } from 'lucide-react';
import NumberInput from '../NumberInput';

const inputCls = 'w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white';
const labelCls = 'text-xs text-slate-400 font-medium';

// Technologie, pre ktore sa eviduje vykon. "farby" = vykon zavisi od poctu farieb (sietotlac: cim viac farieb, tym pomalsie).
export const TECHNOLOGIE_VYKON = [
  { key: 'sietotlac', label: 'Sieťotlač (karusel Excalibur)', zariadenie: 'karusel', zariadeniaMn: 'karusely', farby: true },
  { key: 'dtf', label: 'DTF transfer — nažehlenie', zariadenie: 'žehlička', zariadeniaMn: 'žehličky' },
  { key: 'sublimacia', label: 'Sublimácia — nažehlenie', zariadenie: 'žehlička', zariadeniaMn: 'žehličky' },
  { key: 'rezany', label: 'Rezaný transfer — nažehlenie', zariadenie: 'žehlička', zariadeniaMn: 'žehličky' },
];
const techPodlaKluca = (k) => TECHNOLOGIE_VYKON.find(t => t.key === k);

// 90 -> "1 h 30 min", 0.5 -> "30 s", 45 -> "45 min"
export function fmtCas(min) {
  if (!Number.isFinite(min) || min <= 0) return '—';
  if (min < 1) return `${Math.max(1, Math.round(min * 60))} s`;
  const celkom = Math.round(min);
  if (celkom < 60) return `${celkom} min`;
  const h = Math.floor(celkom / 60);
  const m = celkom % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const fmtCislo = (n, d = 1) => Number(n).toLocaleString('sk-SK', { minimumFractionDigits: 0, maximumFractionDigits: d });

// Blok "Cas a vykon" pod cenou: kolko ks za minutu / hodinu a ako dlho to potrva pri 1, 2 a 3 zariadeniach.
// nastav = riadok z vykon_nastavenia; odhadKsHod = zaloha z Kostra cien (60 / cas na ks), ak vykon nie je zmeraný.
export function VykonCasBlok({ techKey, nastav, ks, farby = 1, tmavy = false, odhadKsHod = 0 }) {
  const tech = techPodlaKluca(techKey);
  if (!tech) return null;
  const zmerane = Number(nastav?.ks_hod_zariadenie) || 0;
  const rate = zmerane || Number(odhadKsHod) || 0;
  const jeOdhad = !zmerane && rate > 0;
  // Sieťotlač: čas NEZÁVISÍ od počtu farieb (karusel tlačí všetky farby v jednom kole, každá farba má svoju stanicu).
  // Závisí od textilu: svetlý = 1 prechod, tmavý = 2 prechody (podklad + farba) = 2x dlhšie. Nameraný priemer platí pre textil podľa nastavenia (merane_na_tmavom).
  const naTmavom = !!nastav?.merane_na_tmavom;
  const skala = tech.farby ? (naTmavom ? 2 : 1) / (tmavy ? 2 : 1) : 1;
  // špička sa meria na rovnakom textile ako priemer (merane_na_tmavom), preto sa škáluje rovnako
  const spicka = (Number(nastav?.ks_hod_spicka) || 0) * skala;
  const jednotka = nastav?.jednotka ? ` (namerané na: ${nastav.jednotka})` : '';

  if (rate <= 0) {
    return (
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Timer className="w-3.5 h-3.5" /> Čas výroby: výkon tejto technológie ešte nie je zmeraný. Doplň ho nižšie v časti „Namerané výkony a spotreba“.
      </div>
    );
  }
  const riadky = [1, 2, 3].map(n => {
    const ksHod = rate * skala * n;
    return { n, ksHod, ksMin: ksHod / 60, minut: (ks / ksHod) * 60 };
  });
  return (
    <div className="mt-3 rounded-xl border border-teal-900/50 bg-teal-950/15 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <span className="font-bold text-teal-300 flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Čas výroby pre {ks} ks</span>
        <span className="text-[10px] text-slate-500">{jeOdhad ? 'odhad z Kostra cien (výkon nezmeraný)' : `reálny priemer${jednotka}`}{tech.farby ? ` · ${tmavy ? 'tmavý textil (2 prechody)' : 'svetlý textil (1 prechod)'}, počet farieb čas nemení` : ''}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-slate-500 text-[10px] text-left">
            <th className="font-medium pb-1">Zariadení ({tech.zariadeniaMn})</th>
            <th className="font-medium pb-1 text-right">ks / min</th>
            <th className="font-medium pb-1 text-right">ks / hod</th>
            <th className="font-medium pb-1 text-right">Celá zákazka</th>
          </tr>
        </thead>
        <tbody>
          {riadky.map(r => (
            <tr key={r.n} className="border-t border-slate-800/80">
              <td className="py-1 text-slate-300">{r.n}× {r.n === 1 ? tech.zariadenie : tech.zariadeniaMn}</td>
              <td className="py-1 text-right font-mono text-slate-300">{fmtCislo(r.ksMin, 2)}</td>
              <td className="py-1 text-right font-mono text-slate-300">{fmtCislo(r.ksHod, 0)}</td>
              <td className="py-1 text-right font-mono font-bold text-teal-300">{fmtCas(r.minut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {spicka > 0 && <p className="text-[10px] text-slate-500 mt-1.5">Najlepší výkon (špička): {fmtCislo(spicka, 0)} ks/hod na 1 zariadení → {fmtCas((ks / spicka) * 60)}. Reálne bývajú prestávky, výmena textilu a čistenie.</p>}
      <p className="text-[10px] text-slate-600 mt-0.5">{tech.farby ? 'Bez prípravy (sitá, nastavenie stroja, čistenie po zákazke).' : 'Bez prípravy a nastavenia zákazky.'}</p>
    </div>
  );
}

const prazdnyFormular = { technologia: 'sietotlac', popis: '', produkt: '', ks: '', hod: '', min: '', pocet_zariadeni: 1, farby: '', spotreba_kg: '', poznamka: '' };

// Panel s referencnymi vykonmi, spotrebou farby a historiou nameranych zakaziek.
export default function VykonPanel({ supabase, nast, setNast, merania, setMerania, cenaFarbyKgNastavena, onPouzitCenuFarby }) {
  const [form, setForm] = useState(prazdnyFormular);
  const [chyba, setChyba] = useState('');

  const ulozNast = async (key, patch) => {
    const next = { technologia: key, referencne_farby: 1, ...(nast[key] || {}), ...patch };
    setNast(n => ({ ...n, [key]: next }));
    const { error } = await supabase.from('vykon_nastavenia').upsert({ ...next, updated_at: new Date().toISOString() });
    if (error) setChyba('Uloženie zlyhalo: ' + error.message);
  };

  const pridaj = async (e) => {
    e.preventDefault();
    setChyba('');
    const cas = (Number(form.hod) || 0) * 60 + (Number(form.min) || 0);
    if (!form.popis.trim()) return setChyba('Napíš, čo sa merali (popis).');
    const riadok = {
      technologia: form.technologia,
      popis: form.popis.trim(),
      produkt: form.produkt.trim() || null,
      ks: form.ks === '' ? null : Math.round(Number(form.ks)),
      cas_min: cas > 0 ? cas : null,
      pocet_zariadeni: Math.max(1, Math.round(Number(form.pocet_zariadeni) || 1)),
      farby: form.farby === '' ? null : Math.round(Number(form.farby)),
      spotreba_kg: form.spotreba_kg === '' ? null : Number(form.spotreba_kg),
      poznamka: form.poznamka.trim() || null,
    };
    const { data, error } = await supabase.from('vykon_merania').insert(riadok).select().single();
    if (error) return setChyba('Uloženie zlyhalo: ' + error.message);
    setMerania(m => [data, ...m]);
    setForm(prazdnyFormular);
  };

  const zmaz = async (id) => {
    if (!window.confirm('Zmazať toto meranie?')) return;
    const { error } = await supabase.from('vykon_merania').delete().eq('id', id);
    if (error) return setChyba('Zmazanie zlyhalo: ' + error.message);
    setMerania(m => m.filter(x => x.id !== id));
  };

  const plast = nast.sietotlac || {};
  const cenaKg = Number(plast.hmotnost_balenia_kg) > 0 ? (Number(plast.cena_balenia_eur) || 0) / Number(plast.hmotnost_balenia_kg) : 0;
  const farbaNaKs = cenaKg * (Number(plast.spotreba_g_ks) || 0) / 1000;
  const rozdielCeny = cenaKg > 0 && Math.abs(cenaKg - (Number(cenaFarbyKgNastavena) || 0)) > 0.005;

  return (
    <div className="bg-slate-900/60 rounded-2xl border border-teal-900/40 p-5 space-y-5">
      <div>
        <h3 className="font-bold text-sm text-white flex items-center gap-1.5"><Timer className="w-4 h-4 text-teal-400" /> Namerané výkony a spotreba</h3>
        <p className="text-xs text-slate-400 mt-1">Skutočné merania z výroby. Podľa „reálneho priemeru“ sa v kalkulačkách vyššie ukazuje, ako dlho potrvá celá zákazka pri 1, 2 alebo 3 zariadeniach. Ceny sa tým <strong className="text-slate-200">nemenia</strong>.</p>
      </div>

      {/* Referencne vykony */}
      <div>
        <p className="text-xs font-bold text-slate-300 mb-2">Výkon jedného zariadenia</p>
        <div className="space-y-3">
          {TECHNOLOGIE_VYKON.map(t => {
            const r = nast[t.key] || {};
            return (
              <div key={t.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-xs font-semibold text-white mb-2">{t.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className={labelCls}>Reálny priemer (ks/hod na 1 {t.zariadenie === 'karusel' ? 'karusel' : 'žehličku'})</label><NumberInput step="0.1" min="0" value={r.ks_hod_zariadenie ?? 0} onChange={(v) => ulozNast(t.key, { ks_hod_zariadenie: v > 0 ? v : null })} fallback={0} className={inputCls} /></div>
                  <div><label className={labelCls}>Špička (ks/hod, najlepší výkon)</label><NumberInput step="0.1" min="0" value={r.ks_hod_spicka ?? 0} onChange={(v) => ulozNast(t.key, { ks_hod_spicka: v > 0 ? v : null })} fallback={0} className={inputCls} /></div>
                  {t.farby && <div><label className={labelCls}>Nameraný výkon platí pre textil</label>
                    <select value={r.merane_na_tmavom ? 'tmavy' : 'svetly'} onChange={(e) => ulozNast(t.key, { merane_na_tmavom: e.target.value === 'tmavy' })} className={inputCls}>
                      <option value="svetly">Svetlý (1 prechod)</option>
                      <option value="tmavy">Tmavý (2 prechody)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Počet farieb čas nemení. Tmavý textil = 2× dlhšie.</p></div>}
                  <div><label className={labelCls}>Namerané na (napr. tričko, ruksak)</label><input value={r.jednotka || ''} onChange={(e) => setNast(n => ({ ...n, [t.key]: { technologia: t.key, referencne_farby: 1, ...(n[t.key] || {}), jednotka: e.target.value } }))} onBlur={(e) => ulozNast(t.key, { jednotka: e.target.value.trim() || null })} className={inputCls} /></div>
                </div>
                {r.poznamka && <p className="text-[11px] text-slate-500 mt-2">{r.poznamka}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Plastisol */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <p className="text-xs font-bold text-slate-300 mb-2">Plastisol — cena a spotreba</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Cena balenia / galónu (€ bez DPH)</label><NumberInput step="0.01" min="0" value={plast.cena_balenia_eur ?? 0} onChange={(v) => ulozNast('sietotlac', { cena_balenia_eur: v })} fallback={0} className={inputCls} /></div>
          <div><label className={labelCls}>Hmotnosť balenia (kg)</label><NumberInput step="0.1" min="0" value={plast.hmotnost_balenia_kg ?? 0} onChange={(v) => ulozNast('sietotlac', { hmotnost_balenia_kg: v })} fallback={0} className={inputCls} /></div>
          <div><label className={labelCls}>Spotreba na 1 ks (g)</label><NumberInput step="0.1" min="0" value={plast.spotreba_g_ks ?? 0} onChange={(v) => ulozNast('sietotlac', { spotreba_g_ks: v })} fallback={0} className={inputCls} /></div>
        </div>
        {plast.spotreba_popis && <p className="text-[11px] text-slate-500 mt-2">{plast.spotreba_popis}</p>}
        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
          <div className="rounded-lg bg-slate-900 border border-slate-800 p-2"><span className="text-slate-500 block">Cena farby</span><span className="text-white font-bold">{cenaKg > 0 ? `${fmtCislo(cenaKg, 2)} €/kg` : '—'}</span></div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 p-2"><span className="text-slate-500 block">Farba na 1 ks (podľa spotreby)</span><span className="text-white font-bold">{farbaNaKs > 0 ? `${fmtCislo(farbaNaKs, 3)} €` : '—'}</span></div>
        </div>
        {rozdielCeny && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-300 bg-amber-950/25 border border-amber-900/40 rounded-lg px-3 py-2">
            <span>V Kostre cien je cena farby {fmtCislo(Number(cenaFarbyKgNastavena) || 0, 2)} €/kg, podľa nákupu vychádza {fmtCislo(cenaKg, 2)} €/kg.</span>
            <button type="button" onClick={() => onPouzitCenuFarby(Number(cenaKg.toFixed(2)))} className="shrink-0 font-bold underline underline-offset-2 hover:text-amber-200">Nastaviť {fmtCislo(cenaKg, 2)} €/kg</button>
          </div>
        )}
        <p className="text-[11px] text-slate-600 mt-2">Spotreba je dnes v Kostre cien zadaná po formátoch (A4, A3…). Tu je len skutočný priemer na tričko ako kontrola; ceny sa podľa neho samé nemenia.</p>
      </div>

      {/* Historia */}
      <div>
        <p className="text-xs font-bold text-slate-300 mb-2">Zapísané merania ({merania.length})</p>
        {merania.length === 0 ? <p className="text-xs text-slate-500">Zatiaľ nič. Pridaj prvé meranie nižšie.</p> : (
          <div className="space-y-2">
            {merania.map(m => {
              const tech = techPodlaKluca(m.technologia);
              const ksHod = m.ks && m.cas_min ? (m.ks / m.cas_min) * 60 : 0;
              const zar = Math.max(1, m.pocet_zariadeni || 1);
              const gKs = m.spotreba_kg && m.ks ? (m.spotreba_kg * 1000) / m.ks : 0;
              return (
                <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold break-words">{m.popis}</p>
                      <p className="text-[10px] text-slate-500">{new Date(m.datum).toLocaleDateString('sk-SK')} · {tech ? tech.label : m.technologia}{m.produkt ? ` · ${m.produkt}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => zmaz(m.id)} className="shrink-0 text-slate-600 hover:text-rose-400" title="Zmazať"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-slate-300">
                    {m.ks != null && <span>{m.ks} ks</span>}
                    {m.cas_min != null && <span>čas {fmtCas(Number(m.cas_min))}</span>}
                    {m.cas_min != null && <span>{zar} {zar === 1 ? 'zariadenie' : 'zariadenia'}</span>}
                    {ksHod > 0 && <span className="text-teal-300 font-semibold">{fmtCislo(ksHod, 0)} ks/hod · {fmtCislo(ksHod / 60, 2)} ks/min</span>}
                    {ksHod > 0 && zar > 1 && <span className="text-teal-300">{fmtCislo(ksHod / zar, 1)} ks/hod na 1 zariadenie</span>}
                    {m.farby != null && <span>{m.farby} farby</span>}
                    {m.spotreba_kg != null && <span>spotreba {fmtCislo(Number(m.spotreba_kg), 2)} kg{gKs > 0 ? ` = ${fmtCislo(gKs, 1)} g/ks` : ''}</span>}
                  </div>
                  {m.poznamka && <p className="text-[11px] text-slate-500 mt-1">{m.poznamka}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pridat meranie */}
      <form onSubmit={pridaj} className="rounded-xl border border-dashed border-slate-700 p-3 space-y-3">
        <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Pridať meranie</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2"><label className={labelCls}>Technológia</label>
            <select id="vykon_technologia" value={form.technologia} onChange={(e) => setForm(f => ({ ...f, technologia: e.target.value }))} className={inputCls}>
              {TECHNOLOGIE_VYKON.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              <option value="ina">Iné</option>
            </select>
          </div>
          <div className="col-span-2"><label className={labelCls}>Čo sa merali (popis)</label><input id="vykon_popis" value={form.popis} onChange={(e) => setForm(f => ({ ...f, popis: e.target.value }))} placeholder="napr. 300 mikín, 1 farba" className={inputCls} /></div>
          <div><label className={labelCls}>Produkt</label><input id="vykon_produkt" value={form.produkt} onChange={(e) => setForm(f => ({ ...f, produkt: e.target.value }))} placeholder="tričko, ruksak…" className={inputCls} /></div>
          <div><label className={labelCls}>Počet ks</label><input id="vykon_ks" type="number" min="0" value={form.ks} onChange={(e) => setForm(f => ({ ...f, ks: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Čas — hodiny</label><input id="vykon_hod" type="number" min="0" value={form.hod} onChange={(e) => setForm(f => ({ ...f, hod: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Čas — minúty</label><input id="vykon_min" type="number" min="0" step="0.5" value={form.min} onChange={(e) => setForm(f => ({ ...f, min: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Počet zariadení</label><input id="vykon_zar" type="number" min="1" value={form.pocet_zariadeni} onChange={(e) => setForm(f => ({ ...f, pocet_zariadeni: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Počet farieb</label><input id="vykon_farby" type="number" min="1" value={form.farby} onChange={(e) => setForm(f => ({ ...f, farby: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Spotreba farby (kg)</label><input id="vykon_spotreba" type="number" min="0" step="0.01" value={form.spotreba_kg} onChange={(e) => setForm(f => ({ ...f, spotreba_kg: e.target.value }))} className={inputCls} /></div>
          <div><label className={labelCls}>Poznámka</label><input id="vykon_pozn" value={form.poznamka} onChange={(e) => setForm(f => ({ ...f, poznamka: e.target.value }))} className={inputCls} /></div>
        </div>
        {chyba && <p className="text-xs text-rose-400">{chyba}</p>}
        <button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-lg">Uložiť meranie</button>
      </form>
    </div>
  );
}
