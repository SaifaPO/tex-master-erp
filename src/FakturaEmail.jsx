import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';

// ODOSLANIE FAKTÚRY E-MAILOM: z detailu faktúry vytvorí PDF (zo zobrazeného dokladu) a cez Edge Function send-invoice-email
// ho pošle zákazníkovi ako prílohu. Text e-mailu je v slovenčine alebo angličtine (pre zahraničných zákazníkov), dá sa upraviť.
// Každé odoslanie sa eviduje (tabuľka faktury_email_log) a zobrazí sa pod formulárom.

const skDatum = (s) => (s ? `${String(s).slice(8, 10)}.${String(s).slice(5, 7)}.${String(s).slice(0, 4)}` : '—');
const eur = (n, jazyk) => `${Number(n || 0).toLocaleString(jazyk === 'en' ? 'en-GB' : 'sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const skDatumCas = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function zostavSpravu(f, firma, jazyk) {
  const nazovFirmy = firma.companyName || '';
  if (jazyk === 'en') {
    return {
      predmet: `Invoice no. ${f.invoiceNumber}${nazovFirmy ? ` – ${nazovFirmy}` : ''}`,
      text: `Hello,\n\nplease find attached invoice no. ${f.invoiceNumber} for ${eur(f.total, 'en')}, due on ${skDatum(f.dueDate)}.\n\nPayment details:\n• Amount: ${eur(f.total, 'en')}\n• Variable symbol: ${f.variableSymbol || f.invoiceNumber}\n${firma.iban ? `• IBAN: ${firma.iban}\n` : ''}${firma.bankName ? `• Bank: ${firma.bankName}\n` : ''}\nThank you for your order. If you have any questions, just reply to this e-mail.\n\nBest regards\n${nazovFirmy}`,
    };
  }
  return {
    predmet: `Faktúra č. ${f.invoiceNumber}${nazovFirmy ? ` – ${nazovFirmy}` : ''}`,
    text: `Dobrý deň,\n\nv prílohe Vám zasielame faktúru č. ${f.invoiceNumber} na sumu ${eur(f.total, 'sk')} so splatnosťou ${skDatum(f.dueDate)}.\n\nÚdaje na úhradu:\n• Suma: ${eur(f.total, 'sk')}\n• Variabilný symbol: ${f.variableSymbol || f.invoiceNumber}\n${firma.iban ? `• IBAN: ${firma.iban}\n` : ''}${firma.bankName ? `• Banka: ${firma.bankName}\n` : ''}\nĎakujeme za Vašu objednávku. V prípade otázok nám stačí odpovedať na tento e-mail.\n\nS pozdravom\n${nazovFirmy}`,
  };
}

// PDF zo zobrazeného dokladu (prvky s data-nepdf="1" sa do PDF nezahrnú). Knižnice sa načítajú až pri odosielaní.
async function vytvorPdf(prvok) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const canvas = await html2canvas(prvok, { scale: 2, backgroundColor: '#ffffff', useCORS: true, ignoreElements: (n) => n.dataset?.nepdf === '1' });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const sirka = 210, vyskaStrany = 297;
  const vyska = (canvas.height * sirka) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.92);
  let zostava = vyska, pozicia = 0;
  pdf.addImage(img, 'JPEG', 0, pozicia, sirka, vyska);
  zostava -= vyskaStrany;
  while (zostava > 0) {
    pozicia = zostava - vyska;
    pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, pozicia, sirka, vyska);
    zostava -= vyskaStrany;
  }
  return pdf.output('datauristring').split('base64,')[1];
}

export default function FakturaEmail({ supabase, faktura, zakaznici = [], firma, idDokumentu, triggerNotification = () => {} }) {
  const [otvorene, setOtvorene] = useState(false);
  const [jazyk, setJazyk] = useState('sk');
  const [komu, setKomu] = useState('');
  const [predmet, setPredmet] = useState('');
  const [text, setText] = useState('');
  const [posiela, setPosiela] = useState(false);
  const [log, setLog] = useState([]);

  const nacitajLog = async () => {
    const { data } = await supabase.from('faktury_email_log').select('created_at,prijemca,jazyk,stav,chyba').eq('invoice_id', String(faktura.id)).order('created_at', { ascending: false }).limit(5);
    setLog(data || []);
  };

  const otvor = () => {
    const z = zakaznici.find((c) => String(c.name || '').trim().toLowerCase() === String(faktura.customerName || '').trim().toLowerCase());
    setKomu(z?.email || '');
    const sprava = zostavSpravu(faktura, firma, 'sk');
    setJazyk('sk'); setPredmet(sprava.predmet); setText(sprava.text);
    setOtvorene(true);
    nacitajLog();
  };

  useEffect(() => { setOtvorene(false); }, [faktura.id]);

  const zmenJazyk = (j) => {
    setJazyk(j);
    const sprava = zostavSpravu(faktura, firma, j);
    setPredmet(sprava.predmet); setText(sprava.text);
  };

  const posli = async () => {
    const prvok = document.getElementById(idDokumentu);
    if (!prvok) { triggerNotification('error', 'Doklad sa nepodarilo nájsť na stránke.'); return; }
    setPosiela(true);
    try {
      const pdfBase64 = await vytvorPdf(prvok);
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoiceId: faktura.id, to: komu, subject: predmet, text, jazyk, pdfBase64, filename: `faktura-${String(faktura.invoiceNumber).replace(/[\\/:*?"<>|]/g, '-')}.pdf` },
      });
      let chyba = data?.error || '';
      if (!chyba && error) {
        try { chyba = (await error.context.json())?.error || error.message; } catch { chyba = error.message; }
      }
      if (chyba) { triggerNotification('error', chyba); return; }
      triggerNotification('success', `Faktúra ${faktura.invoiceNumber} bola odoslaná na ${komu}.`);
      await nacitajLog();
    } catch (e) {
      triggerNotification('error', 'Odoslanie zlyhalo: ' + (e?.message || e) + ' (je funkcia send-invoice-email nasadená?)');
    } finally {
      setPosiela(false);
    }
  };

  return (
    <>
      <button onClick={otvor} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><Mail className="h-4 w-4" /> Poslať e-mailom</button>
      {otvorene && (
        <div data-nepdf="1" className="fixed inset-0 bg-slate-950/80 z-[60] flex items-center justify-center p-4 print:hidden" onClick={() => !posiela && setOtvorene(false)}>
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-base font-extrabold">Poslať faktúru e-mailom</h3>
                <p className="text-xs text-slate-500">Faktúra č. {faktura.invoiceNumber} sa pošle ako PDF príloha.</p>
              </div>
              <button onClick={() => setOtvorene(false)} disabled={posiela} className="p-1 rounded bg-slate-200 text-slate-600 hover:text-slate-900"><X className="h-4 w-4" /></button>
            </div>

            <label className="block text-[11px] font-bold text-slate-600 mb-1">Komu (e-mail; viac adries oddeľ čiarkou)</label>
            <input type="text" value={komu} onChange={(e) => setKomu(e.target.value)} placeholder="zakaznik@firma.sk" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-1" />
            {!komu && <p className="text-[10px] text-amber-600 mb-2">Zákazník nemá v evidencii e-mail — zadaj ho ručne.</p>}

            <div className="flex items-center gap-2 mt-2 mb-2">
              <span className="text-[11px] font-bold text-slate-600">Jazyk textu e-mailu:</span>
              {[['sk', 'Slovensky'], ['en', 'English']].map(([k, n]) => (
                <button key={k} type="button" onClick={() => zmenJazyk(k)} className={`px-3 py-1 rounded-lg text-xs font-bold border ${jazyk === k ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300'}`}>{n}</button>
              ))}
            </div>
            {jazyk === 'en' && <p className="text-[10px] text-slate-500 mb-2">Text e-mailu bude po anglicky, samotná faktúra (PDF) zostáva v slovenčine.</p>}

            <label className="block text-[11px] font-bold text-slate-600 mb-1">Predmet</label>
            <input type="text" value={predmet} onChange={(e) => setPredmet(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2" />
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Text e-mailu</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={11} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono mb-3" />

            <button onClick={posli} disabled={posiela || !komu.trim() || !predmet.trim() || !text.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
              {posiela ? <><Loader2 className="h-4 w-4 animate-spin" /> Vytváram PDF a odosielam…</> : <><Send className="h-4 w-4" /> Odoslať</>}
            </button>

            {log.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                <p className="text-[11px] font-bold text-slate-600">Doteraz odoslané:</p>
                {log.map((l, i) => (
                  <p key={i} className={`text-[11px] ${l.stav === 'odoslane' ? 'text-slate-600' : 'text-red-600'}`}>
                    {skDatumCas(l.created_at)} → {l.prijemca} ({l.jazyk === 'en' ? 'EN' : 'SK'}) {l.stav === 'odoslane' ? '✓' : `— chyba: ${l.chyba || ''}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
