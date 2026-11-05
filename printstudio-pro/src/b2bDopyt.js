// B2B dopyt e-mailom: uloží návrh na server (číslo DOPYT-XXXXXXXX) a pripraví e-mail s predvyplneným textom.
// V ERP sa potom text e-mailu prilepí do "AI zadanie zákazky" a zákazka sa načíta presne podľa čísla dopytu.
const BUCKET = 'print-designs';
const FALLBACK_EMAIL = 'objednavky@example.sk';

const nahodnyKod = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const eur = (n) => `${(Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',')} €`;

// motivy (volitelne, kosik motivov): [{ popis, pocetKs, cenaKusBezDph, cenaSpoluBezDph, suborCesta }] — tlacove subory su uz nahrane; dopyt potom obsahuje vsetky motivy.
export async function vytvorB2bDopyt(supabase, { typ, produktNazov, popisVarianty, pocetKs, cenaKusBezDph, cenaSpoluBezDph, expres, osobnyOdber, b2b, engine, motivy = null }) {
  const kod = nahodnyKod();
  let suborCesta = null;
  let dizajnJson = null;
  if (motivy && motivy.length > 0) {
    suborCesta = motivy[0].suborCesta || null;
  } else if (engine) {
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
    ...(motivy && motivy.length > 0 ? { motivy: motivy.map((m) => ({ popis: m.popis, pocet_ks: m.pocetKs, cena_kus: Math.round(m.cenaKusBezDph * 100) / 100, cena_spolu: Math.round(m.cenaSpoluBezDph * 100) / 100, subor_cesta: m.suborCesta || null })) } : {}),
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
    ...(motivy && motivy.length > 1 ? [`Motívy (${motivy.length}):`, ...motivy.map((m, i) => `  ${i + 1}. ${m.popis} — ${m.pocetKs} ks × ${eur(m.cenaKusBezDph)} = ${eur(m.cenaSpoluBezDph)} bez DPH`)] : []),
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
