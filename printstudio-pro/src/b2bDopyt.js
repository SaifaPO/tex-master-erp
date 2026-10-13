// B2B dopyt e-mailom: uloží návrh na server (číslo DOPYT-XXXXXXXX) a pripraví e-mail s predvyplneným textom.
// V ERP sa potom text e-mailu prilepí do "AI zadanie zákazky" a zákazka sa načíta presne podľa čísla dopytu.
const BUCKET = 'print-designs';
const FALLBACK_EMAIL = 'objednavky@example.sk';

const nahodnyKod = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const eur = (n) => `${(Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',')} €`;

export async function vytvorB2bDopyt(supabase, { typ, produktNazov, popisVarianty, pocetKs, cenaKusBezDph, cenaSpoluBezDph, expres, osobnyOdber, b2b, engine }) {
  const kod = nahodnyKod();
  let suborCesta = null;
  let dizajnJson = null;
  if (engine) {
    const blob = await engine.getProductionBlob();
    suborCesta = `b2b-dopyty/${kod}/navrh.png`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(suborCesta, blob, { contentType: 'image/png' });
    if (upErr) throw new Error('Nepodarilo sa uložiť návrh: ' + upErr.message);
    try { dizajnJson = JSON.parse(engine.getDesignJson()); } catch { dizajnJson = null; }
  }
  const { error } = await supabase.from('b2b_dopyty').insert({
    kod, produkt_typ: typ, produkt_nazov: produktNazov, popis_varianty: popisVarianty || null, pocet_ks: pocetKs,
    cena_kus_bez_dph: Math.round(cenaKusBezDph * 100) / 100, cena_spolu_bez_dph: Math.round(cenaSpoluBezDph * 100) / 100,
    expres: !!expres, osobny_odber: !!osobnyOdber, b2b_kod: b2b?.kod || null, agentura: b2b?.agentura || null,
    subor_cesta: suborCesta, dizajn_json: dizajnJson,
  });
  if (error) throw new Error(error.message.includes('b2b_dopyty') ? 'Dopyty e-mailom ešte nie sú zapnuté (migration_b2b_dopyty.sql).' : error.message);

  const { data: nast } = await supabase.from('b2b_dopyt_nastavenia').select('email').eq('id', 1).maybeSingle();
  const komu = (nast?.email || FALLBACK_EMAIL).trim();

  const predmet = `Dopyt DOPYT-${kod} – ${produktNazov} ${pocetKs} ks (B2B)`;
  const telo = [
    'Dobrý deň,',
    '',
    'prosím o cenovú ponuku a termín výroby podľa výberu v konfigurátore.',
    '',
    `--- DOPYT-${kod} (tieto riadky prosím nemeňte, slúžia na automatické spracovanie) ---`,
    `Produkt: ${produktNazov}${popisVarianty ? ` — ${popisVarianty}` : ''}`,
    `Počet kusov: ${pocetKs}`,
    `Orientačná cena: ${eur(cenaKusBezDph)}/ks bez DPH (spolu ${eur(cenaSpoluBezDph)} bez DPH${b2b?.zlavaPercent ? `, B2B zľava ${Number(b2b.zlavaPercent)} %` : ''})`,
    `Expres: ${expres ? 'áno' : 'nie'}`,
    `Osobný odber: ${osobnyOdber ? 'áno' : 'nie'}`,
    `B2B kód: ${b2b?.kod || '—'}${b2b?.agentura ? ` (${b2b.agentura})` : ''}`,
    '----------------------------------------------------------------',
    '',
    'Prosím doplňte:',
    'Firma / meno: ',
    'IČO: ',
    'Termín dodania (do kedy to potrebujete): ',
    'Poznámka: ',
    '',
    'Grafiku/logo (ak sa líši od návrhu v konfigurátore) prosím pripojte k tomuto e-mailu. Návrh z konfigurátora už máme uložený pod číslom dopytu.',
    '',
    'Ďakujem',
  ].join('\r\n');

  return { kod, komu, predmet, telo, mailto: `mailto:${komu}?subject=${encodeURIComponent(predmet)}&body=${encodeURIComponent(telo)}` };
}
