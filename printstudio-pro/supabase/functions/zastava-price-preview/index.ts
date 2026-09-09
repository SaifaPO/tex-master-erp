// Zivy nahlad ceny pre konfigurator zastav — bezi so servisnym klucom, aby klient (anon)
// nikdy nevidel surove vyrobne naklady (zastava_materialy.naklad_m2, zastava_nastavenia)
// ani marzove koeficienty (pricing_config) priamo — vidi len hotovu cenu z tejto odpovede.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { vypocitajCenuZastavy, vypocitajHardwareRozmery } from '../_shared/zastavaCena.ts';

function odpoved(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const {
      materialKod, sirkaCm, vyskaCm, vyhotovenie,
      tunely = [], ocka = [], karabinky = [], popruhy = {},
      pocetKs = 1, expresne = false,
    } = body;

    if (!materialKod) throw new Error('Chýba materiál.');
    if (!sirkaCm || !vyskaCm) throw new Error('Chýbajú rozmery vlajky.');
    if (vyhotovenie !== 'obsite' && vyhotovenie !== 'laser') throw new Error('Neplatné vyhotovenie okrajov.');

    const [{ data: material }, { data: naklady }, { data: cfg }] = await Promise.all([
      supabase.from('zastava_materialy').select('naklad_m2').eq('kod', materialKod).eq('aktivny', true).maybeSingle(),
      supabase.from('zastava_nastavenia').select('*').eq('id', 1).maybeSingle(),
      supabase.from('pricing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (!material) throw new Error(`Materiál "${materialKod}" sa nenašiel.`);
    if (!naklady) throw new Error('Nákladové sadzby (zastava_nastavenia) nie sú nastavené.');

    const pricingConfig = cfg
      ? { coefA: Number(cfg.coef_a), coefB: Number(cfg.coef_b), marginFloor: Number(cfg.margin_floor), coefP: Number(cfg.coef_p), qtyAtFloor: Number(cfg.qty_at_floor) }
      : { coefA: 300, coefB: 54, marginFloor: 30, coefP: 1.3, qtyAtFloor: 1000 };

    const { tunelyBm, ockaPocet, karabinkyPocet, popruhBm } = vypocitajHardwareRozmery(Number(sirkaCm), Number(vyskaCm), tunely, ocka, karabinky, popruhy);

    const cena = vypocitajCenuZastavy({
      sirkaCm: Number(sirkaCm), vyskaCm: Number(vyskaCm),
      materialNakladM2: Number(material.naklad_m2),
      vyhotovenie,
      tunelyBm, ockaPocet, karabinkyPocet, popruhBm,
      pocetKs: Number(pocetKs) || 1,
      expresne: !!expresne,
      naklady,
      pricingConfig,
    });

    return odpoved({ cena });
  } catch (e) {
    return odpoved({ error: e instanceof Error ? e.message : String(e) });
  }
});
