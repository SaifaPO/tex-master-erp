// Načíta celý katalóg pre konfigurátor beachvlajok — vzor podľa produktData.js.
export async function nacitajVlajkaKatalog(supabase) {
  const [
    { data: tvary },
    { data: velkosti },
    { data: dokoncenie },
    { data: stoziare },
    { data: doplnky },
    { data: pantone },
    { data: nastaveniaRow },
  ] = await Promise.all([
    supabase.from('vlajka_tvary').select('*, vlajka_tvar_rozmery(*)').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_velkosti').select('*').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_dokoncenie').select('*').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_stoziare').select('*').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_doplnky').select('*').eq('aktivny', true).order('poradie').order('id'),
    supabase.from('vlajka_pantone').select('*').order('poradie').order('id'),
    supabase.from('vlajka_nastavenia').select('*').eq('id', 1).maybeSingle(),
  ]);

  return {
    tvary: (tvary || []).map(t => ({
      ...t,
      rozmery: Object.fromEntries((t.vlajka_tvar_rozmery || []).map(r => [r.velkost, r])),
    })),
    velkosti: velkosti || [],
    dokoncenie: dokoncenie || [],
    stoziare: stoziare || [],
    doplnky: doplnky || [],
    pantone: pantone || [],
    nastavenia: nastaveniaRow || { dph_percent: 23, expresny_priplatok_percent: 10 },
  };
}
