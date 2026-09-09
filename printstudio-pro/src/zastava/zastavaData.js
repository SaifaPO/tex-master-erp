// Nacita katalog pre konfigurator zastav — LEN verejne udaje (nazov/popis materialu cez view
// zastava_materialy_verejny, nikdy naklad_m2). Pantone kniznica sa zdiela s beachvlajkami
// (vlajka_pantone je vseobecna farebna vzorkovnica, nie beachflag-specificka).
export async function nacitajZastavaKatalog(supabase) {
  const [{ data: materialy }, { data: pantone }] = await Promise.all([
    supabase.from('zastava_materialy_verejny').select('*').order('poradie'),
    supabase.from('vlajka_pantone').select('*').order('poradie').order('id'),
  ]);
  return {
    materialy: materialy || [],
    pantone: pantone || [],
  };
}
