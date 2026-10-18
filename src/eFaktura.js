// ELEKTRONICKÁ FAKTÚRA (e-faktúra) — XML vo formáte Peppol BIS Billing 3.0 / EN 16931 (UBL 2.1), ktorý vyžaduje slovenský systém
// elektronickej fakturácie od 1. 1. 2027. ERP z faktúry vyrobí XML súbor; ODOSLANIE cez sieť Peppol zabezpečuje certifikovaný
// poskytovateľ (Access Point) — ten si musí firma vybrať zvlášť. XML sa dá nahrať/odovzdať poskytovateľovi alebo účtovníčke.
// Pozn.: ide o technický podklad; pred ostrým používaním ho treba overiť (validátor poskytovateľa) a skontrolovať s účtovníčkou.

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f2 = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// Adresa je v ERP jeden riadok ("Ulica 12, 811 01 Bratislava") — rozdelí sa na ulicu, PSČ a mesto
export function rozdelAdresu(adresa) {
  const casti = String(adresa || '').split(',').map((x) => x.trim()).filter(Boolean);
  let ulica = casti[0] || '', psc = '', mesto = '';
  for (let i = casti.length - 1; i >= 0; i--) {
    const m = casti[i].match(/^(\d{3}\s?\d{2})\s+(.+)$/);
    if (m) { psc = m[1].replace(/\s/g, ''); mesto = m[2]; ulica = casti.slice(0, i).join(', ') || ulica; break; }
  }
  if (!mesto && casti.length > 1) mesto = casti[casti.length - 1];
  return { ulica, psc, mesto };
}

const krajinaZIcDph = (icDph) => { const m = String(icDph || '').trim().toUpperCase().match(/^([A-Z]{2})/); return m ? m[1] : null; };

// Kategória DPH pre riadok: S = základná/znížená sadzba, Z = 0 %, K = dodanie do EÚ, G = vývoz
function kategoriaDph(sadzba, typOdberatela) {
  if (sadzba > 0) return { id: 'S', dovod: null };
  if (typOdberatela === 'eu_platca') return { id: 'K', kod: 'VATEX-EU-IC', dovod: 'Intra-Community supply' };
  if (typOdberatela === 'tretia_krajina') return { id: 'G', kod: 'VATEX-EU-G', dovod: 'Export of goods outside the EU' };
  return { id: 'Z', dovod: null };
}

function strana(tag, { nazov, adresa, krajina, icDph, dic, ico, email }) {
  const a = rozdelAdresu(adresa);
  // Koncový bod Peppol: DIČ (schéma 0245); ak chýba, e-mail (schéma EM)
  const koncovy = dic ? `<cbc:EndpointID schemeID="0245">${esc(String(dic).replace(/\s/g, ''))}</cbc:EndpointID>` : email ? `<cbc:EndpointID schemeID="EM">${esc(email)}</cbc:EndpointID>` : '';
  return `  <cac:${tag}>
    <cac:Party>
      ${koncovy}
      <cac:PartyName><cbc:Name>${esc(nazov)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(a.ulica)}</cbc:StreetName>
        <cbc:CityName>${esc(a.mesto)}</cbc:CityName>
        <cbc:PostalZone>${esc(a.psc)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(krajina)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${icDph ? `
      <cac:PartyTaxScheme><cbc:CompanyID>${esc(String(icDph).replace(/\s/g, ''))}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(nazov)}</cbc:RegistrationName>${ico ? `
        <cbc:CompanyID>${esc(ico)}</cbc:CompanyID>` : ''}
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:${tag}>`;
}

export function zostavEFakturu(f, firma) {
  const dobropis = f.docType === 'dobropis';
  const warnings = [];
  if (!firma.icDph && !firma.dic) warnings.push('Chýba DIČ / IČ DPH dodávateľa (Financie → Nastavenia firmy).');
  if (!firma.iban) warnings.push('Chýba IBAN dodávateľa.');
  if (!firma.email && !firma.dic) warnings.push('Chýba e-mail dodávateľa (Nastavenia firmy) — koncový bod Peppol nie je vyplnený.');
  if (!f.customerDic && !f.customerIcDph) warnings.push('Odberateľ nemá DIČ / IČ DPH — koncový bod odberateľa v Peppol nie je vyplnený.');
  const krajinaOdberatela = krajinaZIcDph(f.customerIcDph) || 'SK';
  if ((f.customerType === 'eu_platca' || f.customerType === 'tretia_krajina') && !krajinaZIcDph(f.customerIcDph)) warnings.push('Odberateľ je zo zahraničia — doplň IČ DPH s kódom krajiny (napr. CZ12345678), inak sa uvedie krajina SK.');

  const znak = dobropis ? -1 : 1; // v UBL dobropise sú množstvá a sumy kladné
  const riadky = f.items.map((it, i) => {
    const mnozstvo = Math.abs(Number(it.qty) || 0);
    const zaklad = Math.round(mnozstvo * (Number(it.unitPrice) || 0) * 100) / 100;
    const kat = kategoriaDph(Number(it.vatRate) || 0, f.customerType);
    return { i: i + 1, popis: it.description, mnozstvo, jednotkova: Number(it.unitPrice) || 0, zaklad, sadzba: Number(it.vatRate) || 0, kat };
  });
  const skupiny = new Map();
  riadky.forEach((r) => {
    const k = `${r.kat.id}|${r.sadzba}`;
    const g = skupiny.get(k) || { kat: r.kat, sadzba: r.sadzba, zaklad: 0 };
    g.zaklad += r.zaklad; skupiny.set(k, g);
  });
  const dphSkupiny = [...skupiny.values()].map((g) => ({ ...g, dph: Math.round(g.zaklad * g.sadzba) / 100 }));
  const spoluZaklad = dphSkupiny.reduce((s, g) => s + g.zaklad, 0);
  const spoluDph = dphSkupiny.reduce((s, g) => s + g.dph, 0);
  const spolu = spoluZaklad + spoluDph;
  const zaloha = !dobropis ? Number(f.advancePaid) || 0 : 0;
  const rootTag = dobropis ? 'CreditNote' : 'Invoice';
  const lineTag = dobropis ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = dobropis ? 'CreditedQuantity' : 'InvoicedQuantity';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootTag}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(f.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${esc(f.issueDate)}</cbc:IssueDate>${dobropis ? '' : `
  <cbc:DueDate>${esc(f.dueDate || f.issueDate)}</cbc:DueDate>`}
  <cbc:${dobropis ? 'CreditNoteTypeCode>381' : 'InvoiceTypeCode>380'}</cbc:${dobropis ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'}>${f.notes || f.creditReason ? `
  <cbc:Note>${esc(f.creditReason || f.notes)}</cbc:Note>` : ''}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${esc(f.orderId || f.variableSymbol || f.invoiceNumber)}</cbc:BuyerReference>${f.relatedInvoiceNumber && dobropis ? `
  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(f.relatedInvoiceNumber)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>` : ''}
${strana('AccountingSupplierParty', { nazov: firma.companyName, adresa: firma.address, krajina: 'SK', icDph: firma.icDph, dic: firma.dic, ico: firma.ico, email: firma.email })}
${strana('AccountingCustomerParty', { nazov: f.customerName, adresa: f.customerAddress, krajina: krajinaOdberatela, icDph: f.customerIcDph, dic: f.customerDic, ico: f.customerIco })}
  <cac:Delivery><cbc:ActualDeliveryDate>${esc(f.deliveryDate || f.issueDate)}</cbc:ActualDeliveryDate></cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>${esc(f.variableSymbol || f.invoiceNumber)}</cbc:PaymentID>${firma.iban ? `
    <cac:PayeeFinancialAccount><cbc:ID>${esc(String(firma.iban).replace(/\s/g, ''))}</cbc:ID></cac:PayeeFinancialAccount>` : ''}
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${f2(spoluDph)}</cbc:TaxAmount>${dphSkupiny.map((g) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${f2(g.zaklad)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${f2(g.dph)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${g.kat.id}</cbc:ID>
        <cbc:Percent>${f2(g.sadzba)}</cbc:Percent>${g.kat.kod ? `
        <cbc:TaxExemptionReasonCode>${g.kat.kod}</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>${esc(g.kat.dovod)}</cbc:TaxExemptionReason>` : ''}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join('')}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${f2(spoluZaklad)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${f2(spoluZaklad)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${f2(spolu)}</cbc:TaxInclusiveAmount>${zaloha > 0 ? `
    <cbc:PrepaidAmount currencyID="EUR">${f2(zaloha)}</cbc:PrepaidAmount>` : ''}
    <cbc:PayableAmount currencyID="EUR">${f2(spolu - zaloha)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${riadky.map((r) => `
  <cac:${lineTag}>
    <cbc:ID>${r.i}</cbc:ID>
    <cbc:${qtyTag} unitCode="C62">${r.mnozstvo}</cbc:${qtyTag}>
    <cbc:LineExtensionAmount currencyID="EUR">${f2(r.zaklad)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(r.popis)}</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>${r.kat.id}</cbc:ID><cbc:Percent>${f2(r.sadzba)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${r.jednotkova.toFixed(4)}</cbc:PriceAmount></cac:Price>
  </cac:${lineTag}>`).join('')}
</${rootTag}>
`;
  return { xml, warnings, znak };
}

export function stiahniEFakturu(faktura, firma, onWarning = () => {}) {
  const { xml, warnings } = zostavEFakturu(faktura, firma);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${String(faktura.invoiceNumber).replace(/[\\/:*?"<>|]/g, '-')}.xml`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (warnings.length) onWarning('E-faktúra stiahnutá, ale je neúplná: ' + warnings.join(' '));
}
