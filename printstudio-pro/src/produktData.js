const ZONE_KEYS = ['predok', 'chrbat', 'lavy_rukav', 'pravy_rukav'];
const TECHNOLOGIA_PORADIE = ['sublimacia', 'dtf', 'sietotlac', 'rezany'];

export async function nacitajKategorieAProdukty(supabase) {
  const [{ data: kategorie }, { data: produkty }] = await Promise.all([
    supabase.from('kategorie').select('*').order('poradie').order('id'),
    supabase.from('produkty').select('*').eq('aktivny', true).order('id'),
  ]);
  return { kategorie: kategorie || [], produkty: produkty || [] };
}

// Načíta plný detail produktu — farby, veľkosti a ich max. rozmery potlače pre každú zónu.
export async function nacitajDetailProduktu(supabase, produktId) {
  const [{ data: produkt }, { data: farbyLinks }, { data: velkosti }, { data: technologieLinks }, { data: mockupyData }] = await Promise.all([
    supabase.from('produkty').select('*').eq('id', produktId).single(),
    supabase.from('produkt_farby').select('farby(id, nazov, hex, je_tmava)').eq('produkt_id', produktId),
    supabase.from('produkt_velkosti').select('*, produkt_velkost_zony(*)').eq('produkt_id', produktId).order('poradie'),
    supabase.from('produkt_technologie').select('technologia').eq('produkt_id', produktId),
    supabase.from('produkt_mockupy').select('*').eq('produkt_id', produktId),
  ]);

  const colors = (farbyLinks || []).map(l => l.farby).filter(Boolean);
  const zonySet = new Set();
  const sizes = (velkosti || []).map(v => {
    const zony = {};
    (v.produkt_velkost_zony || []).forEach(z => {
      zony[z.zona] = { w: Number(z.max_sirka_cm), h: Number(z.max_vyska_cm) };
      zonySet.add(z.zona);
    });
    return { velkost: v.velkost, zony };
  });
  const zony = ZONE_KEYS.filter(z => zonySet.has(z));

  const technologieSet = new Set((technologieLinks || []).map(t => t.technologia));
  if (technologieSet.size === 0 && produkt?.technologia) technologieSet.add(produkt.technologia);
  const technologie = TECHNOLOGIA_PORADIE.filter(t => technologieSet.has(t));

  // mockupy[farbaId][zona] = { fotoUrl, x, y, w, h } — reálna fotka + kalibrovaná poloha tlačovej zóny na nej
  const mockupy = {};
  (mockupyData || []).forEach(m => {
    if (!mockupy[m.farba_id]) mockupy[m.farba_id] = {};
    mockupy[m.farba_id][m.zona] = {
      fotoUrl: m.foto_url,
      x: Number(m.zona_x_percent), y: Number(m.zona_y_percent),
      w: Number(m.zona_sirka_percent), h: Number(m.zona_vyska_percent),
    };
  });

  return { ...produkt, colors, sizes, zony, technologie, mockupy };
}
