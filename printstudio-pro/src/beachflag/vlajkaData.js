// Načíta celý katalóg pre konfigurátor beachvlajok — vzor podľa produktData.js.
export async function nacitajVlajkaKatalog(supabase) {
  const [
    { data: tvary },
    { data: materialy },
    { data: velkosti },
    { data: dokoncenie },
    { data: stoziare },
    { data: doplnky },
    { data: podstavce },
    { data: pantone },
    { data: nastaveniaRow },
  ] = await Promise.all([
    supabase.from('vlajka_tvary').select('*, vlajka_tvar_rozmery(*)').eq('aktivny', true).order('poradie').order('id'),
    // Verejný pohľad (bez naklad_m2) — surová cena materiálu ide len cez beachflag-price-preview.
    supabase.from('vlajka_materialy_verejny').select('*'),
    supabase.from('vlajka_velkosti').select('*').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_dokoncenie').select('id, kod, nazov, popis, obrazok_url, poradie, aktivny').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_stoziare').select('id, kod, nazov, popis, obrazok_url, poradie, aktivny').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_doplnky').select('id, kod, nazov, popis, obrazok_url, max_mnozstvo, poradie, aktivny').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_podstavce').select('id, kod, nazov, popis, obrazok_url, poradie, aktivny, vlajka_podstavce_ceny(velkost, vhodny, poznamka)').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_pantone').select('*').order('poradie').order('id'),
    supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
  ]);

  return {
    tvary: (tvary || []).map(t => ({
      ...t,
      rozmery: Object.fromEntries((t.vlajka_tvar_rozmery || []).map(r => [r.velkost, r])),
    })),
    materialy: materialy || [],
    velkosti: velkosti || [],
    dokoncenie: dokoncenie || [],
    stoziare: stoziare || [],
    doplnky: doplnky || [],
    podstavce: (podstavce || []).map(p => ({
      ...p,
      ceny: Object.fromEntries((p.vlajka_podstavce_ceny || []).map(c => [c.velkost, { vhodny: c.vhodny !== false, poznamka: c.poznamka || '' }])),
    })),
    pantone: pantone || [],
    nastavenia: nastaveniaRow || { dph_percent: 23, expresny_priplatok_percent: 10 },
  };
}
