// Zdielana pomocna funkcia na nahratie fotky doplnku (podstavec/prut/opracovanie/prislusenstvo/
// material) do Supabase Storage — pouziva sa v admin tabuloch Beachvlajok, aby zakaznik videl
// realnu fotku namiesto len textu/ikony.
const BUCKET = 'grafiky';
const PREFIX = 'vlajka-doplnky';

export async function nahrajObrazokDoplnku(supabase, subor) {
  const cesta = `${PREFIX}/${Date.now()}-${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from(BUCKET).upload(cesta, subor);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(cesta);
  return data.publicUrl;
}
