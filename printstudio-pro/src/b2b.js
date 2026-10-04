import { useCallback, useEffect, useState } from 'react';

// B2B kod pre reklamne agentury: zadany kod sa overi cez Edge Function b2b-kod-overit, ulozi sa do prehliadaca
// (localStorage) a posiela sa serveru pri vypocte ceny a objednavke. Kod sa da zadat aj odkazom ?b2b=KOD.
const KLUC = 'pbt_b2b_kod';

function nacitajUlozeny() {
  try {
    const z = new URLSearchParams(window.location.search).get('b2b');
    if (z) return z.trim().toUpperCase();
    return (window.localStorage.getItem(KLUC) || '').trim().toUpperCase();
  } catch { return ''; }
}
function uloz(k) { try { if (k) window.localStorage.setItem(KLUC, k); else window.localStorage.removeItem(KLUC); } catch { /* bez ukladania */ } }

export function useB2bKod(supabase) {
  const [info, setInfo] = useState(null); // { kod, zlavaPercent, agentura }
  const [overujem, setOverujem] = useState(false);
  const [chyba, setChyba] = useState('');

  const over = useCallback(async (kodVstup) => {
    const k = String(kodVstup || '').trim().toUpperCase();
    if (!k || !supabase) return false;
    setOverujem(true);
    setChyba('');
    try {
      const { data, error } = await supabase.functions.invoke('b2b-kod-overit', { body: { kod: k } });
      if (error || !data?.platny) { setInfo(null); uloz(''); setChyba('Tento kód nie je platný.'); return false; }
      setInfo({ kod: k, zlavaPercent: Number(data.zlavaPercent) || 0, agentura: data.agentura || '' });
      uloz(k);
      return true;
    } catch {
      setChyba('Kód sa nepodarilo overiť, skúste to prosím znova.');
      return false;
    } finally {
      setOverujem(false);
    }
  }, [supabase]);

  const zrus = useCallback(() => { setInfo(null); setChyba(''); uloz(''); }, []);

  // Pri nacitani appky over kod z odkazu alebo z predchadzajucej navstevy (ticho — bez chybovej hlasky).
  useEffect(() => {
    const k = nacitajUlozeny();
    if (!k) return;
    (async () => { const ok = await over(k); if (!ok) setChyba(''); })();
  }, [over]);

  return {
    kod: info?.kod || '',
    zlavaPercent: info?.zlavaPercent || 0,
    agentura: info?.agentura || '',
    overujem, chyba, over, zrus,
  };
}
