import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Download, Package, Loader2, CheckCircle2, AlertTriangle, Copy, RefreshCw } from 'lucide-react';

// MESACNY BALIK PRE UCTOVNICKU: jedno kliknutie -> Excel (vydane faktury, prijate faktury, banka, pokladna, suma na kontrolu)
// + ZIP s PDF/fotkami prijatych faktur. Hore je kontrolny zoznam "je mesiac pripraveny?", aby uctovnicka nemusela nic doplnat ani pytat.

const eur = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n).toFixed(2)} €`);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const SK_MESIACE = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const STAV_PRIJATE = { spracovava: 'Spracúva sa', na_schvalenie: 'Na schválenie', schvalena: 'Schválená', uhradena: 'Uhradená', zamietnuta: 'Zamietnutá' };
const REZIM = { standard: 'Bežná s DPH', prenos_danovej_povinnosti: 'Prenos daňovej povinnosti', oslobodene: 'Oslobodené', mimo_sk_bez_dph: 'Zahraničná / bez DPH', nejasne: 'Nejasné' };

const predosliMesiac = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const dnes = () => new Date().toISOString().slice(0, 10);
const mesiacNazov = (m) => { const [r, mm] = m.split('-'); return `${SK_MESIACE[Number(mm) - 1]} ${r}`; };
const bezDiakritiky = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

function stiahni(blob, nazov) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nazov; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function MesacnyBalikTab({ supabase, invoices = [], cashDocuments = [], bankTransactions = [], pendingReviewCount = 0, triggerNotification = () => {} }) {
  const [mesiac, setMesiac] = useState(predosliMesiac());
  const [prijate, setPrijate] = useState([]);
  const [nacitava, setNacitava] = useState(true);
  const [chyba, setChyba] = useState('');
  const [pracujem, setPracujem] = useState('');

  const nacitaj = useCallback(async () => {
    setNacitava(true);
    const { data, error } = await supabase.from('prijate_faktury').select('*').order('datum_vystavenia', { ascending: true });
    if (error) { setChyba(error.message.includes('prijate_faktury') ? 'Tabuľka prijatých faktúr ešte neexistuje — spusti v Supabase SQL migráciu migration_prijate_faktury.sql.' : error.message); setPrijate([]); }
    else { setChyba(''); setPrijate(data || []); }
    setNacitava(false);
  }, [supabase]);
  useEffect(() => { nacitaj(); }, [nacitaj]);

  const dataMesiaca = useMemo(() => {
    const vMesiaci = (d) => !!d && String(d).slice(0, 7) === mesiac;
    const vydane = invoices.filter((i) => vMesiaci(i.issueDate)).sort((a, b) => String(a.invoiceNumber).localeCompare(String(b.invoiceNumber), undefined, { numeric: true }));
    // prijata faktura patri do mesiaca podla datumu vystavenia (ak chyba, podla dodania, inak podla nahratia)
    const prijataMesiac = (f) => (f.datum_vystavenia || f.datum_dodania || String(f.created_at || '').slice(0, 10));
    const prijateVsetky = prijate.filter((f) => vMesiaci(prijataMesiac(f)) && f.stav !== 'zamietnuta');
    const prijateHotove = prijateVsetky.filter((f) => f.stav === 'schvalena' || f.stav === 'uhradena');
    const prijateCakajuce = prijateVsetky.filter((f) => f.stav === 'spracovava' || f.stav === 'na_schvalenie');
    const banka = bankTransactions.filter((t) => vMesiaci(t.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pokladna = cashDocuments.filter((d) => vMesiaci(d.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { vydane, prijateVsetky, prijateHotove, prijateCakajuce, banka, pokladna };
  }, [invoices, prijate, bankTransactions, cashDocuments, mesiac]);

  const sumy = useMemo(() => {
    const { vydane, prijateHotove, banka, pokladna } = dataMesiaca;
    const sum = (arr, fn) => r2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
    const prijemBanka = sum(banka.filter((t) => t.amount > 0), (t) => t.amount);
    const vydavokBanka = sum(banka.filter((t) => t.amount < 0), (t) => Math.abs(t.amount));
    return {
      trzbyZaklad: sum(vydane, (i) => i.subtotal), trzbyDph: sum(vydane, (i) => i.vatTotal), trzbyCelkom: sum(vydane, (i) => i.total),
      nakladyZaklad: sum(prijateHotove, (f) => f.zaklad_dane), nakladyDph: sum(prijateHotove, (f) => f.dph_suma), nakladyCelkom: sum(prijateHotove, (f) => f.suma_celkom),
      prijemBanka, vydavokBanka,
      pokladnaPrijem: sum(pokladna.filter((d) => d.docType === 'prijem'), (d) => d.amount),
      pokladnaVydavok: sum(pokladna.filter((d) => d.docType !== 'prijem'), (d) => d.amount),
    };
  }, [dataMesiaca]);

  const kontrola = useMemo(() => {
    const { vydane, prijateCakajuce, prijateHotove, banka } = dataMesiaca;
    const dnesStr = dnes();
    const poSplatnosti = vydane.filter((i) => i.status !== 'paid' && i.dueDate && i.dueDate < dnesStr);
    const bezSuboru = prijateHotove.filter((f) => !f.subor_cesta);
    const vydavkyNesparovane = banka.filter((t) => t.amount < 0 && !t.matched);
    const prijmyNesparovane = banka.filter((t) => t.amount > 0 && !t.matched);
    const naKontrolu = prijateHotove.filter((f) => f.vyzaduje_kontrolu);
    return [
      { id: 'cakajuce', blokuje: true, pocet: prijateCakajuce.length, ok: 'Všetky prijaté faktúry za mesiac sú schválené.', zle: `${prijateCakajuce.length} prijatých faktúr ešte nie je schválených (záložka Prijaté faktúry).` },
      { id: 'fronta', blokuje: true, pocet: pendingReviewCount, ok: 'Žiadne hotové zákazky nečakajú na fakturáciu.', zle: `${pendingReviewCount} hotových zákaziek čaká vo fronte na vystavenie faktúry (záložka Fronta pre účtovníka).` },
      { id: 'vydavky', blokuje: false, pocet: vydavkyNesparovane.length, ok: 'Všetky odchádzajúce platby z banky sú spárované s faktúrou.', zle: `${vydavkyNesparovane.length} odchádzajúcich platieb z banky nie je spárovaných s prijatou faktúrou (môže ísť o mzdy, dane, odvody — to je v poriadku).` },
      { id: 'prijmy', blokuje: false, pocet: prijmyNesparovane.length, ok: 'Všetky prichádzajúce platby sú spárované s vydanou faktúrou.', zle: `${prijmyNesparovane.length} prichádzajúcich platieb nie je spárovaných s vydanou faktúrou (záložka Banka).` },
      { id: 'subory', blokuje: false, pocet: bezSuboru.length, ok: 'Ku každej prijatej faktúre je priložený doklad.', zle: `${bezSuboru.length} prijatých faktúr nemá priložený PDF/foto doklad.` },
      { id: 'po_splatnosti', blokuje: false, pocet: poSplatnosti.length, ok: 'Žiadne vydané faktúry po splatnosti.', zle: `${poSplatnosti.length} vydaných faktúr je po splatnosti (stále neuhradené).` },
      { id: 'na_kontrolu', blokuje: false, pocet: naKontrolu.length, ok: 'Žiadne doklady na osobitnú kontrolu.', zle: `${naKontrolu.length} prijatých dokladov je označených na kontrolu účtovníčkou (nový dodávateľ, zahraničie, dobropis, neštandardné DPH…) — nájdeš ich v Exceli na liste „Na kontrolu".` },
    ];
  }, [dataMesiaca, pendingReviewCount]);

  const blokujucich = kontrola.filter((k) => k.blokuje && k.pocet > 0).length;

  const zostavExcel = () => {
    const { vydane, prijateHotove, prijateCakajuce, banka, pokladna } = dataMesiaca;
    const wb = XLSX.utils.book_new();
    const pridaj = (nazov, riadky) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riadky.length ? riadky : [{ Poznámka: 'Žiadne záznamy za toto obdobie.' }]), nazov);

    pridaj('Súhrn', [
      { Položka: 'Obdobie', Hodnota: mesiacNazov(mesiac) },
      { Položka: 'Vygenerované', Hodnota: new Date().toLocaleString('sk-SK') },
      { Položka: 'Vydané faktúry – počet', Hodnota: vydane.length },
      { Položka: 'Vydané faktúry – základ (€)', Hodnota: sumy.trzbyZaklad },
      { Položka: 'Vydané faktúry – DPH na výstupe (€)', Hodnota: sumy.trzbyDph },
      { Položka: 'Vydané faktúry – celkom (€)', Hodnota: sumy.trzbyCelkom },
      { Položka: 'Prijaté faktúry (schválené) – počet', Hodnota: prijateHotove.length },
      { Položka: 'Prijaté faktúry – základ (€)', Hodnota: sumy.nakladyZaklad },
      { Položka: 'Prijaté faktúry – DPH na vstupe (€)', Hodnota: sumy.nakladyDph },
      { Položka: 'Prijaté faktúry – celkom (€)', Hodnota: sumy.nakladyCelkom },
      { Položka: 'Orientačná DPH na úhradu (výstup − vstup) (€)', Hodnota: r2(sumy.trzbyDph - sumy.nakladyDph) },
      { Položka: 'Banka – príjmy (€)', Hodnota: sumy.prijemBanka },
      { Položka: 'Banka – výdavky (€)', Hodnota: sumy.vydavokBanka },
      { Položka: 'Pokladňa – príjmy (€)', Hodnota: sumy.pokladnaPrijem },
      { Položka: 'Pokladňa – výdavky (€)', Hodnota: sumy.pokladnaVydavok },
      { Položka: 'Prijaté faktúry ešte neschválené (nie sú v balíku)', Hodnota: prijateCakajuce.length },
      { Položka: 'Poznámka', Hodnota: 'DPH je orientačný súčet z dokladov (nenahrádza daňové priznanie). Prijaté faktúry sú vyčítané AI a skontrolované majiteľom.' },
    ]);
    pridaj('Vydané faktúry', vydane.map((i) => ({
      'Číslo faktúry': i.invoiceNumber, Odberateľ: i.customerName, Adresa: i.customerAddress, IČO: i.customerIco, DIČ: i.customerDic, 'IČ DPH': i.customerIcDph,
      'Dátum vystavenia': i.issueDate, 'Dátum dodania': i.deliveryDate, Splatnosť: i.dueDate, 'Variabilný symbol': i.variableSymbol,
      'Základ (€)': i.subtotal, 'DPH (€)': i.vatTotal, 'Celkom (€)': i.total,
      Stav: i.status === 'paid' ? 'Uhradená' : 'Neuhradená', 'Uhradené dňa': i.paidAt || '', Poznámka: i.notes || '',
    })));
    pridaj('Prijaté faktúry', prijateHotove.map((f, idx) => ({
      'P.č.': idx + 1, Firma: f.firma, Dodávateľ: f.dodavatel_nazov, IČO: f.dodavatel_ico, DIČ: f.dodavatel_dic, 'IČ DPH': f.dodavatel_ic_dph, Krajina: f.dodavatel_krajina,
      Druh: f.druh, 'Číslo faktúry': f.cislo_faktury, 'Variabilný symbol': f.variabilny_symbol, IBAN: f.iban,
      'Dátum vystavenia': f.datum_vystavenia, 'Dátum dodania': f.datum_dodania, Splatnosť: f.datum_splatnosti,
      Mena: f.mena, 'Základ (€)': f.zaklad_dane, 'DPH (€)': f.dph_suma, 'Celkom (€)': f.suma_celkom,
      'Režim DPH': REZIM[f.rezim_dph] || f.rezim_dph, Kategória: f.kategoria, Popis: f.popis, Stav: STAV_PRIJATE[f.stav] || f.stav,
      'Uhradené dňa': f.uhradena_datum || '', 'Spôsob úhrady': f.sposob_uhrady || '', 'Súbor v balíku': f.subor_cesta ? nazovSuboru(f, idx) : '', Poznámka: f.poznamka || '',
    })));
    pridaj('Na kontrolu', prijateHotove.filter((f) => f.vyzaduje_kontrolu).map((f) => ({
      Dodávateľ: f.dodavatel_nazov, 'Číslo faktúry': f.cislo_faktury, 'Celkom (€)': f.suma_celkom, Dôvod: f.dovod_kontroly || '',
    })));
    pridaj('Banka', banka.map((t) => ({
      Dátum: t.date, Odosielateľ: t.sender, 'Suma (€)': t.amount, 'Variabilný symbol': t.variableSymbol,
      Spárované: t.matched ? 'Áno' : 'Nie',
      'Spárované s': t.invoiceId ? `vydaná faktúra ${invoices.find((i) => i.id === t.invoiceId)?.invoiceNumber || ''}` : t.prijataFakturaId ? `prijatá faktúra ${prijate.find((f) => f.id === t.prijataFakturaId)?.cislo_faktury || ''}` : '',
    })));
    pridaj('Pokladňa', pokladna.map((d) => ({
      Doklad: d.docNumber, Dátum: d.date, Typ: d.docType === 'prijem' ? 'Príjem (PPD)' : 'Výdaj (VPD)', Popis: d.description, Kategória: d.category,
      'Suma (€)': d.docType === 'prijem' ? d.amount : -d.amount,
    })));
    return wb;
  };

  const nazovSuboru = (f, idx) => {
    const pripona = (f.subor_nazov || f.subor_cesta || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    return `prijate_faktury/${String(idx + 1).padStart(3, '0')}_${bezDiakritiky(f.dodavatel_nazov) || 'dodavatel'}_${bezDiakritiky(f.cislo_faktury) || 'bez_cisla'}.${pripona}`;
  };

  const stiahniExcel = () => {
    try {
      XLSX.writeFile(zostavExcel(), `podklady_${mesiac}.xlsx`);
    } catch (e) { triggerNotification('error', 'Excel sa nepodarilo vytvoriť: ' + (e.message || e)); }
  };

  const stiahniBalik = async () => {
    setPracujem('Pripravujem balík…');
    try {
      const zip = new JSZip();
      const xlsxBytes = XLSX.write(zostavExcel(), { bookType: 'xlsx', type: 'array' });
      zip.file(`podklady_${mesiac}.xlsx`, xlsxBytes);
      const { prijateHotove } = dataMesiaca;
      let chybajuce = 0;
      for (let i = 0; i < prijateHotove.length; i++) {
        const f = prijateHotove[i];
        if (!f.subor_cesta) continue;
        setPracujem(`Sťahujem doklady ${i + 1}/${prijateHotove.length}…`);
        const { data, error } = await supabase.storage.from('prijate-faktury').download(f.subor_cesta);
        if (error || !data) { chybajuce++; continue; }
        zip.file(nazovSuboru(f, i), data);
      }
      zip.file('CITAJ_ME.txt', `Podklady za ${mesiac}\nVygenerované: ${new Date().toLocaleString('sk-SK')}\n\n- podklady_${mesiac}.xlsx: súhrn, vydané faktúry, prijaté faktúry, doklady na kontrolu, banka, pokladňa\n- prijate_faktury/: PDF/fotky prijatých faktúr (číslo na začiatku zodpovedá P.č. v Exceli)\n${chybajuce ? `\nUpozornenie: ${chybajuce} dokladov sa nepodarilo stiahnuť.\n` : ''}`);
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      stiahni(blob, `podklady_${mesiac}.zip`);
      triggerNotification('success', chybajuce ? `Balík stiahnutý, ${chybajuce} dokladov chýba.` : 'Balík pre účtovníčku je stiahnutý.');
    } catch (e) { triggerNotification('error', 'Balík sa nepodarilo vytvoriť: ' + (e.message || e)); }
    setPracujem('');
  };

  const sprievodnyText = () => {
    const { vydane, prijateHotove } = dataMesiaca;
    const otvorene = kontrola.filter((k) => k.pocet > 0 && k.blokuje);
    return `Dobrý deň,\n\nposielam podklady za ${mesiacNazov(mesiac)}.\n\n` +
      `• Vydané faktúry: ${vydane.length} (základ ${eur(sumy.trzbyZaklad)}, DPH ${eur(sumy.trzbyDph)}, spolu ${eur(sumy.trzbyCelkom)})\n` +
      `• Prijaté faktúry: ${prijateHotove.length} (základ ${eur(sumy.nakladyZaklad)}, DPH ${eur(sumy.nakladyDph)}, spolu ${eur(sumy.nakladyCelkom)})\n` +
      `• Banka: príjmy ${eur(sumy.prijemBanka)}, výdavky ${eur(sumy.vydavokBanka)}\n` +
      `• Pokladňa: príjmy ${eur(sumy.pokladnaPrijem)}, výdavky ${eur(sumy.pokladnaVydavok)}\n\n` +
      `V prílohe je Excel so všetkými zoznamami a priečinok s PDF prijatých faktúr. Doklady, ktoré treba skontrolovať, sú na liste „Na kontrolu".\n` +
      (otvorene.length ? `\nPozor, ešte nie je dokončené: ${otvorene.map((k) => k.zle).join(' ')}\n` : '') +
      `\nĎakujem a pekný deň`;
  };

  const kopirujText = async () => {
    try { await navigator.clipboard.writeText(sprievodnyText()); triggerNotification('success', 'Text e-mailu je skopírovaný.'); }
    catch { triggerNotification('error', 'Kopírovanie sa nepodarilo.'); }
  };

  const Karta = ({ nadpis, hodnota, podnadpis, cls = 'text-white' }) => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{nadpis}</p>
      <p className={`text-lg font-bold ${cls}`}>{hodnota}</p>
      {podnadpis && <p className="text-[10px] text-slate-500">{podnadpis}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Vyber mesiac a stiahni všetko, čo potrebuje účtovníčka, na jedno kliknutie. Hore uvidíš, či je mesiac pripravený.</p>

      {chyba && <div className="bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs rounded-lg p-3">{chyba}</div>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Mesiac</label>
          <input type="month" value={mesiac} onChange={(e) => e.target.value && setMesiac(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={nacitaj} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Obnoviť</button>
        <div className="flex-1" />
        <button onClick={stiahniExcel} disabled={nacitava || !!pracujem} className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Download className="h-4 w-4" /> Len Excel</button>
        <button onClick={stiahniBalik} disabled={nacitava || !!pracujem} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
          {pracujem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} {pracujem || 'Stiahnuť balík (ZIP s PDF)'}
        </button>
      </div>

      {nacitava ? (
        <div className="text-slate-500 text-xs flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Načítavam…</div>
      ) : (
        <>
          <div className={`rounded-xl border p-3 text-xs font-bold ${blokujucich === 0 ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-amber-950/30 border-amber-800/50 text-amber-300'}`}>
            {blokujucich === 0 ? `✓ ${mesiacNazov(mesiac)} je pripravený na odoslanie účtovníčke.` : `${mesiacNazov(mesiac)}: ešte treba dokončiť ${blokujucich} ${blokujucich === 1 ? 'vec' : 'veci'} (označené nižšie).`}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Karta nadpis="Vydané faktúry" hodnota={eur(sumy.trzbyCelkom)} podnadpis={`${dataMesiaca.vydane.length} ks · základ ${eur(sumy.trzbyZaklad)} · DPH ${eur(sumy.trzbyDph)}`} cls="text-emerald-300" />
            <Karta nadpis="Prijaté faktúry" hodnota={eur(sumy.nakladyCelkom)} podnadpis={`${dataMesiaca.prijateHotove.length} ks · základ ${eur(sumy.nakladyZaklad)} · DPH ${eur(sumy.nakladyDph)}`} cls="text-rose-300" />
            <Karta nadpis="Orientačná DPH na úhradu" hodnota={eur(sumy.trzbyDph - sumy.nakladyDph)} podnadpis="DPH na výstupe − DPH na vstupe (orientačne)" cls="text-sky-300" />
            <Karta nadpis="Banka / pokladňa" hodnota={`${eur(sumy.prijemBanka - sumy.vydavokBanka)}`} podnadpis={`banka +${eur(sumy.prijemBanka)} / −${eur(sumy.vydavokBanka)} · pokladňa +${eur(sumy.pokladnaPrijem)} / −${eur(sumy.pokladnaVydavok)}`} />
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl divide-y divide-slate-800">
            {kontrola.map((k) => {
              const ok = k.pocet === 0;
              return (
                <div key={k.id} className="flex items-start gap-2.5 px-3 py-2.5 text-xs">
                  {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${k.blokuje ? 'text-amber-400' : 'text-slate-500'}`} />}
                  <span className={ok ? 'text-slate-400' : k.blokuje ? 'text-amber-200 font-semibold' : 'text-slate-300'}>{ok ? k.ok : k.zle}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white">Text e-mailu pre účtovníčku</p>
              <button onClick={kopirujText} className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Copy className="h-3.5 w-3.5" /> Skopírovať</button>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] text-slate-400 font-sans leading-relaxed">{sprievodnyText()}</pre>
          </div>
        </>
      )}
    </div>
  );
}
