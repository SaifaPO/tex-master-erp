// Edge Function: sos-stanica — SOS tlačidlo na stanici (fyzické Wi-Fi tlačidlo alebo iné zariadenie).
// Volanie (POST JSON alebo GET s parametrami v URL — kvôli jednoduchým tlačidlám ako Shelly):
//   ?akcia=stlacenie&t=<TOKEN>&typ=pomoc|material|stroj|grafika   -> vytvorí žiadosť o pomoc (help_requests) pre grafika zákazky, ktorá je práve na stanici
//   ?akcia=stav&t=<TOKEN>                                           -> stav poslednej žiadosti z tejto stanice (open | ack | resolved) — na zelenú LED na tlačidle
//   ?akcia=ping&t=<TOKEN>                                           -> len zapíše, že tlačidlo žije
// Token tlačidla sa vytvára v ERP (PrintStudio → Nastavenia → SOS tlačidlá) a overuje tabuľka sos_tlacidla.
// DÔLEŽITÉ pri nasadení: v Supabase pri tejto funkcii vypni „Verify JWT / Enforce JWT Verification“ (tlačidlo nemá prihlásenie, overuje ho token).
// Súbor je samostatný (žiadne importy z ../_shared/).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const odpoved = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const STANICE: Record<string, string> = { grafik: 'Grafika', strihanie: 'Strihanie & Kompletáž', laser: 'Laser', sublimacia: 'Sublimácia', transfer: 'Transfer tlač', sietotlac: 'Sieťotlač', sitie: 'Šitie', balenie: 'Balenie' };
// Stav položky na stanici, ktorý znamená „práve sa na nej pracuje“ (rovnaké ako pri skenovaní QR v ERP)
const AKTIVNE: Record<string, string[]> = { grafik: ['priprava', 'export'], strihanie: ['strihanie'], laser: ['rezanie'], sublimacia: ['tlac'], transfer: ['tlac'], sietotlac: ['tlac'], sitie: ['sije'], balenie: ['prebieha'] };
const TYPY: Record<string, { ikona: string; popis: string }> = {
  pomoc: { ikona: '🆘', popis: 'Potrebujem pomoc' },
  grafika: { ikona: '🎨', popis: 'Chyba v grafike / podkladoch' },
  material: { ikona: '📦', popis: 'Chýba materiál' },
  stroj: { ikona: '🔧', popis: 'Nefunguje stroj' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const url = new URL(req.url);
    let b: Record<string, unknown> = Object.fromEntries(url.searchParams.entries());
    if (req.method === 'POST') { try { b = { ...b, ...(await req.json()) }; } catch { /* bez tela */ } }
    const token = String(b.t || b.token || '').trim();
    const akcia = String(b.akcia || 'stlacenie');
    if (token.length < 12) return odpoved({ ok: false, error: 'Neplatný token.' }, 401);

    const { data: tl } = await supabase.from('sos_tlacidla').select('*').eq('token', token).eq('aktivne', true).maybeSingle();
    if (!tl) return odpoved({ ok: false, error: 'Neznáme alebo vypnuté tlačidlo.' }, 401);
    const teraz = new Date().toISOString();
    await supabase.from('sos_tlacidla').update({ posledny_ping: teraz }).eq('id', tl.id);
    if (akcia === 'ping') return odpoved({ ok: true });

    if (akcia === 'stav') {
      const od = new Date(Date.now() - 30 * 60000).toISOString();
      const { data } = await supabase.from('help_requests').select('id, status, acked_at, acked_by_name').eq('station_id', tl.stanica).eq('zdroj', 'tlacidlo').gte('created_at', od).order('created_at', { ascending: false }).limit(1);
      const h = data?.[0];
      if (!h) return odpoved({ ok: true, stav: 'ziadna' });
      const stav = h.status === 'resolved' ? 'resolved' : h.acked_at ? 'ack' : 'open';
      return odpoved({ ok: true, stav, id: h.id, idem: h.acked_by_name || '' });
    }

    // ---- stlačenie ----
    const typKod = TYPY[String(b.typ)] ? String(b.typ) : (String(b.typ) === 'double' ? 'material' : String(b.typ) === 'long' ? 'stroj' : 'pomoc');
    const typ = TYPY[typKod];
    const od3 = new Date(Date.now() - 3 * 60000).toISOString();
    const { data: dup } = await supabase.from('help_requests').select('id, status, acked_at').eq('station_id', tl.stanica).eq('zdroj', 'tlacidlo').eq('typ', typKod).neq('status', 'resolved').gte('created_at', od3).limit(1);
    if (dup?.length) return odpoved({ ok: true, duplicita: true, id: dup[0].id, stav: dup[0].acked_at ? 'ack' : 'open' });

    // zákazka, ktorá je práve rozrobená na tejto stanici (najnovšie spustená)
    const { data: orders } = await supabase.from('orders').select('id, customer, order_number, items').order('created_at', { ascending: false }).limit(400);
    let najdena: { order: any; item: any; start: string } | null = null;
    for (const o of orders || []) {
      for (const it of (o.items || [])) {
        const st = it?.stationStatuses?.[tl.stanica];
        if (!st || !(AKTIVNE[tl.stanica] || []).includes(st)) continue;
        const start = String(it.stationMeta?.[tl.stanica]?.startedAt || '');
        if (!najdena || start > najdena.start) najdena = { order: o, item: it, start };
      }
    }

    // komu zavolať: grafik, ktorý zákazku robil; potom priradený grafik; inak supervízor
    let empId = '', empMeno = '';
    if (najdena) {
      empId = String(najdena.item.stationMeta?.grafik?.assignedEmployeeId || najdena.item.assignedDesignerId || '');
      if (empId) {
        const { data: e } = await supabase.from('employees').select('id, first_name, last_name').eq('id', empId).maybeSingle();
        if (e) empMeno = `${e.first_name} ${e.last_name}`; else empId = '';
      }
    }
    const cislo = najdena ? (najdena.order.order_number || najdena.order.id) : '';
    const sprava = `${typ.ikona} ${STANICE[tl.stanica] || tl.stanica}: ${typ.popis}` + (najdena ? ` — zákazka ${cislo} (${najdena.order.customer}, ${najdena.item.productName || ''})` : ' — na stanici nie je rozrobená žiadna zákazka');
    const id = `hr-${Date.now()}`;
    const { error } = await supabase.from('help_requests').insert({
      id, order_id: najdena ? najdena.order.id : '-', item_id: najdena ? najdena.item.itemId : '-', station_id: tl.stanica,
      raised_by_id: null, raised_by_name: `Tlačidlo: ${tl.nazov}`, target_role: empId ? null : 'supervisor',
      target_employee_id: empId || null, target_employee_name: empMeno || null, message: sprava, status: 'open', replies: [], zdroj: 'tlacidlo', typ: typKod,
    });
    if (error) throw error;
    await supabase.from('sos_tlacidla').update({ posledne_stlacenie: teraz }).eq('id', tl.id);
    return odpoved({ ok: true, id, komu: empMeno || 'supervízor', zakazka: cislo, stav: 'open' });
  } catch (e) {
    return odpoved({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
