// Spoločné texty a pomocné funkcie pre doklady (faktúra / dobropis / zálohová faktúra) v slovenčine a angličtine.

export const TYPY_DOKLADOV = {
  faktura: { sk: 'FAKTÚRA', en: 'INVOICE', kratky: 'Faktúra' },
  dobropis: { sk: 'DOBROPIS', en: 'CREDIT NOTE', kratky: 'Dobropis' },
  zalohova: { sk: 'ZÁLOHOVÁ FAKTÚRA', en: 'PROFORMA INVOICE', kratky: 'Zálohová faktúra' },
};

export const TEXTY = {
  sk: {
    cislo: 'č.', uhradena: 'UHRADENÁ', dodavatel: 'Dodávateľ', odberatel: 'Odberateľ', ico: 'IČO', dic: 'DIČ', icDph: 'IČ DPH',
    vystavenie: 'Dátum vystavenia', dodanie: 'Dátum dodania', splatnost: 'Splatnosť', vs: 'Variabilný symbol',
    popis: 'Popis', ks: 'Ks', cenaKs: 'Cena/ks', dph: 'DPH', spolu: 'Spolu s DPH',
    banka: 'Banka', iban: 'IBAN', zaklad: 'Základ', dphSuma: 'DPH', celkom: 'Celkom', zalohaUhradena: 'Uhradená záloha', zostava: 'Zostáva uhradiť',
    kFakture: 'k faktúre č.', dovod: 'Dôvod', sumaNaVratenie: 'Suma dobropisu',
    zalohovaPoznamka: 'Zálohová faktúra nie je daňovým dokladom. Po úhrade vám vystavíme faktúru.',
    zFaktury: 'Konečná faktúra k zálohovej faktúre č.',
    qr: 'PAY by square', telefon: 'Tel.', email: 'E-mail',
    eu: (ic) => `Dodanie tovaru do iného členského štátu oslobodené od dane podľa § 43 zákona č. 222/2004 Z. z. o DPH.${ic ? ` IČ DPH odberateľa: ${ic}.` : ''}`,
    vyvoz: 'Vývoz tovaru oslobodený od dane podľa § 47 zákona č. 222/2004 Z. z. o DPH.',
  },
  en: {
    cislo: 'No.', uhradena: 'PAID', dodavatel: 'Supplier', odberatel: 'Customer', ico: 'Company ID', dic: 'Tax ID', icDph: 'VAT ID',
    vystavenie: 'Issue date', dodanie: 'Date of supply', splatnost: 'Due date', vs: 'Variable symbol',
    popis: 'Description', ks: 'Qty', cenaKs: 'Unit price', dph: 'VAT', spolu: 'Total incl. VAT',
    banka: 'Bank', iban: 'IBAN', zaklad: 'Net amount', dphSuma: 'VAT', celkom: 'Total', zalohaUhradena: 'Advance paid', zostava: 'Balance due',
    kFakture: 'relating to invoice no.', dovod: 'Reason', sumaNaVratenie: 'Credit amount',
    zalohovaPoznamka: 'This proforma invoice is not a tax document. A final invoice will be issued after payment.',
    zFaktury: 'Final invoice for proforma invoice no.',
    qr: 'PAY by square', telefon: 'Tel.', email: 'E-mail',
    eu: (ic) => `Intra-Community supply of goods exempt from VAT pursuant to Section 43 of the Slovak VAT Act (Act No. 222/2004 Coll.).${ic ? ` Customer VAT ID: ${ic}.` : ''}`,
    vyvoz: 'Export of goods exempt from VAT pursuant to Section 47 of the Slovak VAT Act (Act No. 222/2004 Coll.).',
  },
};

export const skDatum = (s) => (s ? `${String(s).slice(8, 10)}.${String(s).slice(5, 7)}.${String(s).slice(0, 4)}` : '—');
export const eur2 = (n) => `${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)} €`;

// Suma, ktorá ešte ostáva uhradiť (po odpočítaní zálohy); dobropis a uhradené doklady = 0
export const zostavaUhradit = (f) => {
  if (!f || f.status === 'paid' || f.docType === 'dobropis') return 0;
  return Math.max(0, Math.round(((Number(f.total) || 0) - (Number(f.advancePaid) || 0)) * 100) / 100);
};

// Zákonná poznámka k oslobodeniu od DPH podľa typu odberateľa (len ak doklad nemá žiadnu DPH)
export const poznamkaOslobodenie = (f, jazyk) => {
  if (!f || (Number(f.vatTotal) || 0) !== 0) return '';
  const t = TEXTY[jazyk] || TEXTY.sk;
  if (f.customerType === 'eu_platca') return t.eu(f.customerIcDph);
  if (f.customerType === 'tretia_krajina') return t.vyvoz;
  return '';
};
