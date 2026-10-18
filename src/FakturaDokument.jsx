import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TYPY_DOKLADOV, TEXTY, skDatum, eur2, zostavaUhradit, poznamkaOslobodenie } from './fakturaTexty';

// Vzhľad dokladu (faktúra / dobropis / zálohová faktúra) v slovenčine alebo angličtine — podľa faktura.language.
// Toto je to, čo sa tlačí, ukladá do PDF a posiela e-mailom (vrátane QR kódu PAY by square).
export default function FakturaDokument({ faktura: f, firma, qrHodnota }) {
  const jazyk = f.language === 'en' ? 'en' : 'sk';
  const t = TEXTY[jazyk];
  const typ = f.docType || 'faktura';
  const nadpis = (TYPY_DOKLADOV[typ] || TYPY_DOKLADOV.faktura)[jazyk];
  const zostava = zostavaUhradit(f);
  const oslobodenie = poznamkaOslobodenie(f, jazyk);

  return (
    <>
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">{nadpis}</h1>
          <p className="text-sm text-slate-600">{t.cislo} {f.invoiceNumber}</p>
          {typ === 'dobropis' && f.relatedInvoiceNumber && <p className="text-xs text-slate-600">{t.kFakture} {f.relatedInvoiceNumber}</p>}
          {typ === 'faktura' && f.relatedInvoiceNumber && <p className="text-xs text-slate-600">{t.zFaktury} {f.relatedInvoiceNumber}</p>}
          {f.status === 'paid' && <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t.uhradena}</span>}
        </div>
        <img src="/logo-atak-pbt.png" alt="Logo" className="h-10" />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
        <div>
          <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">{t.dodavatel}</span>
          <p className="font-bold">{firma.companyName || '—'}</p>
          <p>{firma.address}</p>
          <p>{t.ico}: {firma.ico} {firma.dic && `• ${t.dic}: ${firma.dic}`}</p>
          {firma.icDph && <p>{t.icDph}: {firma.icDph}</p>}
          {(firma.email || firma.phone) && <p>{[firma.email, firma.phone && `${t.telefon} ${firma.phone}`].filter(Boolean).join(' • ')}</p>}
        </div>
        <div>
          <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">{t.odberatel}</span>
          <p className="font-bold">{f.customerName}</p>
          <p>{f.customerAddress}</p>
          {f.customerIco && <p>{t.ico}: {f.customerIco} {f.customerDic && `• ${t.dic}: ${f.customerDic}`}</p>}
          {f.customerIcDph && <p>{t.icDph}: {f.customerIcDph}</p>}
        </div>
      </div>

      <div className={`grid ${typ === 'dobropis' ? 'grid-cols-3' : 'grid-cols-4'} gap-2 mb-6 text-xs bg-slate-50 p-3 rounded`}>
        <div><span className="text-slate-500 block">{t.vystavenie}</span><strong>{skDatum(f.issueDate)}</strong></div>
        <div><span className="text-slate-500 block">{t.dodanie}</span><strong>{skDatum(f.deliveryDate)}</strong></div>
        {typ !== 'dobropis' && <div><span className="text-slate-500 block">{t.splatnost}</span><strong>{skDatum(f.dueDate)}</strong></div>}
        <div><span className="text-slate-500 block">{t.vs}</span><strong>{f.variableSymbol}</strong></div>
      </div>

      {typ === 'dobropis' && f.creditReason && <p className="text-xs mb-4"><span className="text-slate-500">{t.dovod}:</span> <strong>{f.creditReason}</strong></p>}

      <table className="w-full text-xs mb-6">
        <thead><tr className="border-b border-slate-300 text-slate-500"><th className="text-left py-1.5">{t.popis}</th><th className="text-center py-1.5">{t.ks}</th><th className="text-right py-1.5">{t.cenaKs}</th><th className="text-right py-1.5">{t.dph}</th><th className="text-right py-1.5">{t.spolu}</th></tr></thead>
        <tbody>
          {f.items.map((it, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1.5">{it.description}</td><td className="text-center py-1.5">{it.qty}</td><td className="text-right py-1.5">{eur2(it.unitPrice)}</td><td className="text-right py-1.5">{it.vatRate}%</td><td className="text-right py-1.5 font-bold">{eur2(it.qty * it.unitPrice * (1 + it.vatRate / 100))}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-start gap-6">
        <div className="text-xs space-y-1">
          {typ !== 'dobropis' && <>
            <p><span className="text-slate-500">{t.banka}:</span> {firma.bankName}</p>
            <p><span className="text-slate-500">{t.iban}:</span> <strong className="font-mono">{firma.iban}</strong></p>
            <p><span className="text-slate-500">{t.vs}:</span> <strong>{f.variableSymbol}</strong></p>
          </>}
          {f.notes && <p className="italic text-slate-600 mt-2">{f.notes}</p>}
        </div>
        <div className="text-right space-y-1 text-xs shrink-0">
          <p>{t.zaklad}: <strong>{eur2(f.subtotal)}</strong></p>
          <p>{t.dphSuma}: <strong>{eur2(f.vatTotal)}</strong></p>
          <p className="text-lg font-extrabold border-t border-slate-800 pt-1 mt-1">{typ === 'dobropis' ? `${t.sumaNaVratenie}: ` : ''}{eur2(f.total)}</p>
          {typ === 'faktura' && Number(f.advancePaid) > 0 && (
            <>
              <p>{t.zalohaUhradena}: <strong>-{eur2(f.advancePaid)}</strong></p>
              <p className="text-sm font-extrabold">{t.zostava}: {eur2(Math.max(0, f.total - f.advancePaid))}</p>
            </>
          )}
        </div>
        {qrHodnota && zostava > 0 && (
          <div className="text-center shrink-0">
            <QRCodeSVG value={qrHodnota} size={100} level="M" />
            <p className="text-[9px] text-slate-500 mt-1">{t.qr}</p>
          </div>
        )}
      </div>

      {typ === 'zalohova' && <p className="text-[11px] font-bold text-slate-700 mt-5 border border-slate-300 rounded p-2">{t.zalohovaPoznamka}</p>}
      {oslobodenie && <p className="text-[11px] text-slate-700 mt-4">{oslobodenie}</p>}
    </>
  );
}
