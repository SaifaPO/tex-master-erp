// DODACÍ LIST (PDF) pre zákazníka vo vzhľade papierového formulára (modrý rámik, Odberateľ / Dodávateľ, tabuľka položiek)
// s podpisom preberajúceho z tabletu, jeho menom a dátumom/časom prevzatia. Vstup: riadok z order_handovers (podpis prstom v ERP).
// Dodávateľ sa berie z Nastavení firmy, adresa odberateľa z adresára zákazníkov. Knižnice sa načítajú až pri prvom použití.

const MOD = '#1a8fc9';
const SPOSOBY = { osobny_odber: 'Osobný odber', kurier: 'Kuriér', ine: 'Iné' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = (n) => String(n).padStart(2, '0');
const skDatum = (iso) => { const d = new Date(iso); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
const skCas = (iso) => { const d = new Date(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

export function zostavHtml(h, firma, odberatel) {
  const pol = h.polozky || [];
  const PRAZDNE = 14;
  const riadky = pol.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${esc(p.nazov)}${p.poznamka ? `<div class="pz">${esc(String(p.poznamka).slice(0, 260))}</div>` : ''}</td><td class="c">${esc(p.qty)}</td><td class="c">ks</td></tr>`).join('')
    + Array.from({ length: Math.max(0, PRAZDNE - pol.length) }, () => '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td></tr>').join('');
  const spolu = pol.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const dodavatel = [firma?.company_name, firma?.address, firma?.ico ? `IČO: ${firma.ico}` : '', firma?.dic ? `DIČ: ${firma.dic}` : '', firma?.ic_dph ? `IČ DPH: ${firma.ic_dph}` : ''].filter(Boolean);
  const odb = [h.customer, odberatel?.address, odberatel?.ico ? `IČO: ${odberatel.ico}` : ''].filter(Boolean);
  return `<div style="width:794px;box-sizing:border-box;padding:34px 38px;background:#fff;color:${MOD};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35">
  <style>
    .v td,.v th{border:1px solid ${MOD};padding:4px 6px;font-size:11px;vertical-align:top} .v th{font-size:10px;text-align:center;font-weight:700}
    .v .c{text-align:center} .v td{color:#0f3f5a;height:17px} .pz{font-size:9px;color:#5b8aa3;margin-top:1px}
    .box{border:1.5px solid ${MOD};border-radius:6px;padding:8px 10px} .lbl{font-weight:700;font-size:11px} .val{color:#0f3f5a;font-size:12px}
  </style>
  <div style="display:flex;gap:18px">
    <div style="flex:1">
      <div class="box" style="font-size:19px;font-weight:700;padding:7px 12px;border-radius:14px">Dodací list č.: <span style="color:#0f3f5a">${esc(h.order_number || h.order_id || '')}</span></div>
      <div style="margin-top:10px"><span class="lbl">DÁTUM A ČAS PREVZATIA:</span> <span class="val">${esc(skDatum(h.signed_at))} ${esc(skCas(h.signed_at))}</span></div>
      <div style="margin-top:4px"><span class="lbl">SPÔSOB PREVZATIA:</span> <span class="val">${esc(SPOSOBY[h.sposob] || h.sposob || '')}</span></div>
    </div>
    <div style="flex:1">
      <div class="lbl">Odberateľ:</div>
      <div class="val" style="margin-top:2px">${odb.map((x, i) => `<div${i === 0 ? ' style="font-size:14px;font-weight:700"' : ''}>${esc(x)}</div>`).join('')}</div>
      <div class="box" style="margin-top:8px;min-height:74px"><div class="lbl">Dodávateľ:</div><div class="val" style="margin-top:2px">${dodavatel.map((x, i) => `<div${i === 0 ? ' style="font-weight:700"' : ''}>${esc(x)}</div>`).join('')}</div></div>
    </div>
  </div>
  <table class="v" style="width:100%;border-collapse:collapse;margin-top:14px">
    <thead><tr><th style="width:36px">Por. číslo</th><th>Názov a druh tovaru</th><th style="width:80px">Množstvo</th><th style="width:50px">Jedn. rozm.</th></tr></thead>
    <tbody>${riadky}<tr><td colspan="2" style="text-align:right;font-weight:700">Spolu odovzdaných kusov</td><td class="c" style="font-weight:700">${esc(spolu)}</td><td class="c">ks</td></tr></tbody>
  </table>
  <div style="display:flex;gap:18px;margin-top:14px">
    <div style="flex:1">
      <div class="box" style="min-height:70px"><div class="lbl">Poznámka:</div><div class="val" style="margin-top:3px;font-size:11px">${esc(h.poznamka || '')}</div></div>
      <div style="font-size:10px;color:#0f3f5a;margin-top:8px">Svojím podpisom preberajúci potvrdzuje, že vyššie uvedený tovar v uvedenom množstve prevzal a že bol odovzdaný v poriadku.</div>
    </div>
    <div style="flex:1">
      <div class="lbl">Prevzal (meno, priezvisko):</div>
      <div class="val" style="font-size:14px;font-weight:700;margin:2px 0 6px">${esc(h.prevzal_meno || '')}</div>
      <div style="height:100px;border-bottom:1px solid ${MOD};display:flex;align-items:flex-end">${h.podpis_png ? `<img src="${h.podpis_png}" style="max-height:96px;max-width:100%">` : ''}</div>
      <div style="font-size:10px;font-weight:700;margin-top:3px">Podpis preberajúceho${h.created_by ? ` • odovzdal: ${esc(h.created_by)}` : ''}</div>
    </div>
  </div>
</div>`;
}

export async function stiahniDodaciList(supabase, h) {
  const [{ data: firma }, { data: odb }] = await Promise.all([
    supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
    h.customer ? supabase.from('customers').select('address').eq('name', h.customer).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff';
  host.innerHTML = zostavHtml(h, firma, odb);
  document.body.appendChild(host);
  try {
    const imgs = [...host.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    const canvas = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const sirka = 210, vyskaStrany = 297;
    const vyska = (canvas.height * sirka) / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.93);
    let zostava = vyska, pozicia = 0;
    pdf.addImage(img, 'JPEG', 0, pozicia, sirka, vyska);
    zostava -= vyskaStrany;
    while (zostava > 0.5) { pozicia = zostava - vyska; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pozicia, sirka, vyska); zostava -= vyskaStrany; }
    pdf.save(`Dodaci-list-${String(h.order_number || h.order_id || 'zakazka').replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}
