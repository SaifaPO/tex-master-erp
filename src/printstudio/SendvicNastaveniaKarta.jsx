import React, { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import NumberInput from '../NumberInput';

// Nakladove sadzby obojstrannej (sendvicovej) vlajky — jeden riadok sendvic_nastavenia, spolocny pre
// Beachvlajky aj Zastavy. Tabulka je sukroma (anon ju necita), cena sa pocita na serveri v Edge Function.
export default function SendvicNastaveniaKarta({ supabase }) {
  const [n, setN] = useState(null);
  const [chyba, setChyba] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('sendvic_nastavenia').select('*').eq('id', 1).maybeSingle();
      if (error) { setChyba('Tabuľka sendvic_nastavenia zatiaľ neexistuje — spusti migration_sendvic_vlajky.sql v Supabase.'); return; }
      setN(data);
    })();
  }, [supabase]);

  const uloz = async (patch) => {
    setN(x => ({ ...x, ...patch }));
    await supabase.from('sendvic_nastavenia').update(patch).eq('id', 1);
  };

  if (chyba) return <p className="text-xs text-amber-400">{chyba}</p>;
  if (!n) return null;
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-400" /> Obojstranná sendvičová vlajka — náklady</h3>
      <p className="text-[11px] text-slate-400">
        Sendvič = 2 potlačené vonkajšie látky (náklad €/m² materiálu sa počíta 2×, vrátane sublimácie) + vnútorná zatmavovacia vrstva + spojenie.
        Dierkovaný (mesh) materiál sa na sendvič nepoužíva — označ ho pri materiáli políčkom „dierkovaný (mesh)“. Odporúčané veľkosti Beachvlajok: S, M (väčšie sú ťažké).
      </p>
      <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-400">
        <label>Vnútorná vrstva (blackout) €/m²
          <NumberInput step="0.1" value={n.vlozka_naklad_m2} onChange={(v) => uloz({ vlozka_naklad_m2: v })} fallback={0} className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </label>
        <label>Spojenie vrstiev (práca navyše) €/m²
          <NumberInput step="0.1" value={n.praca_naklad_m2} onChange={(v) => uloz({ praca_naklad_m2: v })} fallback={0} className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </label>
        <label>Násobok času šitia (3 vrstvy)
          <NumberInput step="0.1" value={n.sitie_koef} onChange={(v) => uloz({ sitie_koef: v })} fallback={1} className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white" />
        </label>
      </div>
    </div>
  );
}
