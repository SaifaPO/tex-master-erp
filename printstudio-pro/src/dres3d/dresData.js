// Načítanie katalógu pre 3D konfigurátor dresov zo Supabase. Samostatný súbor —
// nezasahuje do produktData.js (2D konfigurátor), aby sa predišlo kolízii s rozrobenou prácou.

export async function nacitajDresKatalog(supabase, produktId) {
  const [
    { data: produkt },
    { data: nastavenia },
    { data: velkostiRiadky },
    { data: materialy },
    { data: farby },
    { data: fonty },
    { data: grafiky },
    { data: zlavy },
  ] = await Promise.all([
    supabase.from('produkty').select('*').eq('id', produktId).single(),
    supabase.from('produkt_dres_nastavenia').select('*').eq('produkt_id', produktId).maybeSingle(),
    supabase.from('produkt_velkosti').select('*').eq('produkt_id', produktId).order('poradie'),
    supabase.from('produkt_dres_materialy').select('*').eq('produkt_id', produktId).order('poradie'),
    supabase.from('farby').select('*').order('nazov'),
    supabase.from('fonty').select('*').in('pouzitie', ['vsetko', 'meno', 'cislo', 'text']),
    supabase.from('grafiky').select('*').order('nazov'),
    supabase.from('dres_mnozstevne_zlavy').select('*').order('min_pocet'),
  ]);

  if (!produkt) throw new Error('Produkt sa nenašiel.');

  return {
    produkt,
    nastavenia: nastavenia || null,
    velkosti: (velkostiRiadky || []).map(v => v.velkost),
    materialy: materialy || [],
    farby: farby || [],
    fonty: fonty || [],
    grafiky: grafiky || [],
    zlavy: zlavy || [],
  };
}
