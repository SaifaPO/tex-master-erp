// Edge Function: laser-spotreba-ingest — prijem dat z lokalneho agenta (laser-spotreba-agent), ktory prezera hotfolder s DXF suborami.
// Agent posiela pre kazdy novy DXF: nazov, cestu, hash, velkost, cas zmeny a rozmery rozlozenia v cm (bbox_x_cm, bbox_y_cm), dlzku rezu a pocet dielov.
// Funkcia z NAZVU suboru rozparsuje zakazku, zakaznika, material, farbu, strih, velkost a pocet kusov (slovnik farieb/materialov je v tabulke laser_slovnik),
// urci dlzku v smere rolky a stav (ok | chyba_v_nazve | nezmesti_sa | chyba_suboru) a ulozi riadok do laser_spotreba (kazdy subor len raz).
//
// Volanie (POST JSON, token = laser_spotreba_nastavenia.agent_token v hlavicke x-agent-token alebo v tele ako "token"):
//   { "akcia": "ping", "agent": "PC-Laser v1" }                                  -> zapise, ze agent zije
//   { "akcia": "config" }                                                          -> vrati nastavenia, ktore agent potrebuje
//   { "akcia": "subory", "agent": "...", "subory": [ { nazov, cesta, hash, velkost, zmena, bbox_x_cm, bbox_y_cm, dielov, dlzka_rezu_cm, chyba } ] }
// DOLEZITE pri nasadeni: vypni "Verify JWT" (agent nema prihlasenie, overuje ho token). Subor je samostatny (ziadne importy z ../_shared/).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-token',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const bezDiakritiky = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FILLER = new Set(['z', 'material', 'nevieaky', 'neviemaky', 'neviem']);

// deno-lint-ignore no-explicit-any
type Slovnik = { farby: string[]; materialy: string[] };

// Najde (cele slovo / frazu) v zvysku nazvu a vyreze ju — bez ohladu na diakritiku a velkost pismen (dlzka textu sa normalizaciou nemeni, indexy sedia).
function vyrezFrazu(zvysok: string, frazy: string[]): { hodnota: string | null; zvysok: string } {
  const norm = bezDiakritiky(zvysok);
  const zoradene = [...frazy].sort((a, b) => b.length - a.length);
  for (const f of zoradene) {
    const re = new RegExp(`(^|\\s)(${esc(bezDiakritiky(f)).replace(/\s+/g, '\\s+')})(?=\\s|$)`);
    const m = re.exec(norm);
    if (m) {
      const start = m.index + m[1].length;
      const end = start + m[2].length;
      return { hodnota: zvysok.slice(start, end).trim(), zvysok: (zvysok.slice(0, start) + ' ' + zvysok.slice(end)).replace(/\s+/g, ' ').trim() };
    }
  }
  return { hodnota: null, zvysok };
}

function parseNazov(nazovSuboru: string, slovnik: Slovnik) {
  const poznamky: string[] = [];
  let zvysok = nazovSuboru.replace(/\.dxf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1) velkost + pocet kusov na konci: "... XL 10X", "... L-5cm 1x", "... M+5 cm 2x", "... 2XL 1x"
  let velkost: string | null = null;
  let pocet: number | null = null;
  const mk = zvysok.match(/(?:^|\s)((?:xxs|xxl|xs|xl|[2-6]\s?xl|s|m|l)(?:\s*[+-]\s*\d+(?:\s*cm)?)?)\s+(\d+)\s*x\s*$/i);
  if (mk) {
    velkost = mk[1].replace(/\s+/g, ' ').toUpperCase();
    pocet = parseInt(mk[2], 10);
    zvysok = zvysok.slice(0, mk.index).trim();
  }

  // 2) cislo zakazky = prve cislo (3–6 cifier) na zaciatku
  let zakazka: string | null = null;
  const mz = zvysok.match(/^(\d{3,6})(?=\s|$)/);
  if (mz) { zakazka = mz[1]; zvysok = zvysok.slice(mz[0].length).trim(); }

  // 3) farba a material zo slovnika
  const f = vyrezFrazu(zvysok, slovnik.farby); zvysok = f.zvysok;
  const m = vyrezFrazu(zvysok, slovnik.materialy); zvysok = m.zvysok;

  // 4) strih: "ten 691", "TEN 674", "KZ674TEN"
  let strih: string | null = null;
  const ms = zvysok.match(/(?:^|\s)((?:kz\s?)?ten\s?\d{2,4}|kz\s?\d{2,4}\s?ten|[a-z]{1,3}\s?\d{3})(?=\s|$)/i);
  if (ms) {
    strih = ms[1].replace(/\s+/g, ' ').toUpperCase();
    const start = ms.index + ms[0].indexOf(ms[1]);
    zvysok = (zvysok.slice(0, start) + ' ' + zvysok.slice(start + ms[1].length)).replace(/\s+/g, ' ').trim();
  }

  // 5) zvysok (bez vypln. slov) = zakaznik
  const slova = zvysok.split(' ').filter((w) => w && !FILLER.has(bezDiakritiky(w)));
  const zakaznik = slova.length ? slova.join(' ') : null;

  if (!zakazka) poznamky.push('V názve chýba číslo zákazky');
  if (!velkost || pocet == null) poznamky.push('V názve chýba veľkosť a počet kusov na konci (napr. „M 3X")');
  if (!f.hodnota) poznamky.push('Farba nerozpoznaná (doplň do slovníka)');
  if (!m.hodnota) poznamky.push('Materiál nerozpoznaný (doplň do slovníka)');

  return {
    zakazka, zakaznik, material: m.hodnota, farba: f.hodnota, strih, velkost, pocet,
    chybaNazvu: !zakazka || !velkost || pocet == null, poznamky,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    let b: Record<string, unknown> = {};
    try { b = await req.json(); } catch { /* bez tela */ }
    const token = String(req.headers.get('x-agent-token') || b.token || '').trim();
    if (token.length < 20) return json({ ok: false, error: 'Neplatný token.' }, 401);

    const { data: nast } = await supabase.from('laser_spotreba_nastavenia').select('*').eq('id', 1).maybeSingle();
    if (!nast || nast.agent_token !== token) return json({ ok: false, error: 'Neplatný token.' }, 401);

    const agent = String(b.agent || '').slice(0, 200) || null;
    const akcia = String(b.akcia || 'ping');
    await supabase.from('laser_spotreba_nastavenia').update({ posledny_ping: new Date().toISOString(), ...(agent ? { agent_info: agent } : {}) }).eq('id', 1);

    if (akcia === 'ping') return json({ ok: true });
    if (akcia === 'config') return json({ ok: true, max_sirka_cm: nast.max_sirka_cm, osa_dlzky: nast.osa_dlzky });
    if (akcia !== 'subory') return json({ ok: false, error: 'Neznáma akcia.' }, 400);

    const subory = Array.isArray(b.subory) ? b.subory.slice(0, 200) : [];
    if (!subory.length) return json({ ok: true, vlozene: 0, preskocene: 0 });

    const { data: sl } = await supabase.from('laser_slovnik').select('typ, hodnota');
    const slovnik: Slovnik = {
      farby: (sl || []).filter((x) => x.typ === 'farba').map((x) => x.hodnota),
      materialy: (sl || []).filter((x) => x.typ === 'material').map((x) => x.hodnota),
    };
    const maxSirka = Number(nast.max_sirka_cm) || 160;

    // zakaznik z ERP zakaziek (ak sa cislo zakazky najde), inak z nazvu suboru
    const zakazky = [...new Set(subory.map((s: Record<string, unknown>) => parseNazov(String(s.nazov || ''), slovnik).zakazka).filter(Boolean))] as string[];
    const zakaznikPodlaZakazky: Record<string, string> = {};
    if (zakazky.length) {
      const { data: ord } = await supabase.from('orders').select('order_number, customer').in('order_number', zakazky);
      for (const o of ord || []) if (o.order_number && o.customer) zakaznikPodlaZakazky[String(o.order_number)] = String(o.customer);
    }

    const datumBA = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(new Date(iso));
    const riadky = subory.map((s: Record<string, unknown>) => {
      const nazov = String(s.nazov || '');
      const p = parseNazov(nazov, slovnik);
      const bx = Number(s.bbox_x_cm) || 0;
      const by = Number(s.bbox_y_cm) || 0;
      let dlzka = Math.max(bx, by), sirka = Math.min(bx, by);
      if (nast.osa_dlzky === 'x') { dlzka = bx; sirka = by; } else if (nast.osa_dlzky === 'y') { dlzka = by; sirka = bx; }
      const poznamky = [...p.poznamky];
      let stav = 'ok';
      if (s.chyba) { stav = 'chyba_suboru'; poznamky.unshift(`Súbor sa nepodarilo prečítať: ${String(s.chyba).slice(0, 200)}`); }
      else if (p.chybaNazvu) stav = 'chyba_v_nazve';
      else if (sirka > maxSirka) { stav = 'nezmesti_sa'; poznamky.unshift(`Šírka rozloženia ${sirka.toFixed(1)} cm je väčšia ako šírka metráže ${maxSirka} cm`); }
      else if (sirka > 0 && dlzka <= 0) stav = 'chyba_suboru';
      const zmena = String(s.zmena || new Date().toISOString());
      return {
        datum: datumBA(zmena), subor_nazov: nazov, subor_cesta: String(s.cesta || nazov), obsah_hash: String(s.hash || `${nazov}:${s.velkost}`),
        velkost_bajtov: Number(s.velkost) || null, zmena_ts: zmena,
        zakazka: p.zakazka, zakaznik: (p.zakazka && zakaznikPodlaZakazky[p.zakazka]) || p.zakaznik, material: p.material, farba: p.farba, strih: p.strih,
        velkost: p.velkost, pocet_ks: p.pocet, dlzka_cm: Math.round(dlzka * 100) / 100, sirka_cm: Math.round(sirka * 100) / 100,
        dielov: Number(s.dielov) || null, dlzka_rezu_cm: Number(s.dlzka_rezu_cm) || null, stav, poznamka: poznamky.join('; ') || null,
      };
    });

    const { data: vlozene, error } = await supabase.from('laser_spotreba').upsert(riadky, { onConflict: 'subor_cesta,obsah_hash', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    return json({ ok: true, vlozene: vlozene?.length || 0, preskocene: riadky.length - (vlozene?.length || 0) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
