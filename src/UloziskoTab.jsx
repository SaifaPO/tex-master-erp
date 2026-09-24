import React, { useState, useEffect } from 'react';
import { Database, HardDrive, RefreshCw } from 'lucide-react';

// Zname buckety pouzivane naprieč appkou (src/App.jsx, CenovePonukyTab.jsx, PredajnyCennikTab.jsx,
// printstudio-pro Edge Functions) — ak pribudne novy bucket, staci ho pridat sem.
const BUCKETY = ['item-images', 'item-attachments', 'backups', 'print-designs', 'ai-full', 'ai-previews'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

// Rekurzivne prejde cely bucket (subory aj priecinky) a sposcita velkost — Supabase Storage
// list() vracia priecinky ako polozky BEZ metadata (id=null), subory MAJU metadata.size.
async function velkostBucketu(supabase, bucket, cesta = '') {
  const { data, error } = await supabase.storage.from(bucket).list(cesta, { limit: 1000 });
  if (error) return { bytes: 0, pocetSuborov: 0, chyba: error.message };
  if (!data) return { bytes: 0, pocetSuborov: 0 };
  let bytes = 0, pocetSuborov = 0;
  for (const item of data) {
    if (item.id === null) {
      const sub = await velkostBucketu(supabase, bucket, cesta ? `${cesta}/${item.name}` : item.name);
      bytes += sub.bytes;
      pocetSuborov += sub.pocetSuborov;
    } else {
      bytes += item.metadata?.size || 0;
      pocetSuborov += 1;
    }
  }
  return { bytes, pocetSuborov };
}

const GB = 1024 ** 3;

// Progres-bar zaplnenia — farba podla blizkosti k limitu (zelena/zltá/cervena), nezobrazi sa
// vobec, ak limit este nie je zadany (limitGb <= 0), aby nemyslelo 0% miesto "neznamy limit".
function BarZaplnenia({ bytes, limitGb }) {
  if (!limitGb || limitGb <= 0) return null;
  const limitBytes = limitGb * GB;
  const percent = Math.min(100, (bytes / limitBytes) * 100);
  const farba = percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-2">
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${farba} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[11px] text-slate-500">{percent.toFixed(1)}% z {limitGb} GB</span>
    </div>
  );
}

// Orientacny prehlad vyuzitia Supabase projektu (databaza + storage buckety) — nie je to presna
// kopia fakturacneho dashboardu Supabase (ten pocita aj zalohy/indexy/WAL navyse), ale da sa z toho
// vidiet, ci sa nieco blizi k limitu a KTORY bucket/tabulka realne zabera miesto.
export default function UloziskoTab({ supabase }) {
  const [dbBytes, setDbBytes] = useState(null);
  const [buckety, setBuckety] = useState(null); // { [nazov]: {bytes, pocetSuborov, chyba?} }
  const [isLoading, setIsLoading] = useState(false);
  const [chyba, setChyba] = useState('');
  const [naposledy, setNaposledy] = useState(null);
  const [limity, setLimity] = useState({ limit_db_gb: 0, limit_storage_gb: 0 });

  useEffect(() => {
    supabase.from('ulozisko_limity').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setLimity({ limit_db_gb: data.limit_db_gb || 0, limit_storage_gb: data.limit_storage_gb || 0 });
    });
  }, [supabase]);

  const ulozLimit = async (patch) => {
    const next = { ...limity, ...patch };
    setLimity(next);
    await supabase.from('ulozisko_limity').upsert({ id: 1, ...next });
  };

  const prepocitaj = async () => {
    setIsLoading(true);
    setChyba('');
    try {
      const { data: dbSize, error: dbErr } = await supabase.rpc('get_database_size');
      if (dbErr) throw dbErr;
      setDbBytes(Number(dbSize));

      const vysledky = {};
      for (const bucket of BUCKETY) {
        vysledky[bucket] = await velkostBucketu(supabase, bucket);
      }
      setBuckety(vysledky);
      setNaposledy(new Date());
    } catch (e) {
      setChyba(e.message || 'Nepodarilo sa zistiť veľkosť úložiska.');
    }
    setIsLoading(false);
  };

  const celkovyStorageBytes = buckety ? Object.values(buckety).reduce((s, b) => s + (b.bytes || 0), 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><HardDrive className="text-indigo-400 h-5 w-5" /> Úložisko (Supabase)</h2>
          <p className="text-xs text-slate-400 mt-1">Orientačný prehľad — databáza + úložisko súborov. Nemusí presne sedieť s fakturačným dashboardom Supabase (ten počíta aj zálohy/indexy navyše), ale ukáže, či sa niečo blíži k limitu a kde presne pribúda miesto.</p>
        </div>
        <button onClick={prepocitaj} disabled={isLoading} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition shrink-0">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> {isLoading ? 'Počítam…' : 'Prepočítať'}
        </button>
      </div>

      {chyba && <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg p-3">{chyba}</p>}

      {dbBytes === null && !isLoading && !chyba && (
        <p className="text-sm text-slate-500">Klikni na „Prepočítať" — prejde databázu a všetky úložné priečinky (pri veľkom počte súborov to môže chvíľu trvať).</p>
      )}

      {dbBytes !== null && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Databáza (tabuľky, dáta)</span>
              <div className="text-3xl font-extrabold text-white mt-1">{formatBytes(dbBytes)}</div>
              <BarZaplnenia bytes={dbBytes} limitGb={limity.limit_db_gb} />
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500">Limit planu (GB):</span>
                <input key={limity.limit_db_gb} type="number" step="0.1" defaultValue={limity.limit_db_gb || ''} onBlur={(e) => ulozLimit({ limit_db_gb: parseFloat(e.target.value) || 0 })} placeholder="napr. 8" className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white" />
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Úložisko súborov (spolu)</span>
              <div className="text-3xl font-extrabold text-white mt-1">{formatBytes(celkovyStorageBytes)}</div>
              <BarZaplnenia bytes={celkovyStorageBytes} limitGb={limity.limit_storage_gb} />
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-500">Limit planu (GB):</span>
                <input key={limity.limit_storage_gb} type="number" step="0.1" defaultValue={limity.limit_storage_gb || ''} onBlur={(e) => ulozLimit({ limit_storage_gb: parseFloat(e.target.value) || 0 })} placeholder="napr. 100" className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white" />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 -mt-2">Limit planu nájdeš v Supabase Dashboarde → Settings → Billing (alebo Usage) — zadaj ho raz, appka si ho odteraz pamätá.</p>

          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5">
            <h3 className="font-bold text-sm text-white mb-3">Rozpis podľa priečinka (bucket)</h3>
            <div className="space-y-2">
              {BUCKETY.map(bucket => {
                const b = buckety?.[bucket];
                return (
                  <div key={bucket} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5">
                    <span className="text-sm text-slate-300 font-mono">{bucket}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">{b ? formatBytes(b.bytes) : '—'}</span>
                      {b && !b.chyba && <span className="text-[11px] text-slate-500 ml-2">({b.pocetSuborov} súborov)</span>}
                      {b?.chyba && <span className="text-[11px] text-rose-400 block">{b.chyba}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {naposledy && <p className="text-[11px] text-slate-600">Naposledy prepočítané: {naposledy.toLocaleString('sk-SK')}</p>}
        </>
      )}
    </div>
  );
}
