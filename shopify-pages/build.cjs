// Generuje HTML info stranok pre Shopify (dtf-transfery-na-meter, sublimacia, digitalna-potlac-bavlny).
// Spustenie: node shopify-pages/build.cjs   -> zapise *.html do shopify-pages/
// Texty "co je v cene / co nie je / na co dat pozor" su z povodnych produktov Potlac latky (Shopify).
const fs = require('fs');
const path = require('path');

const EMAIL = 'pbtprint@pbtprint.sk';
const mail = (subj, body) => `mailto:${EMAIL}?subject=${encodeURIComponent(subj)}${body ? '&amp;body=' + encodeURIComponent(body) : ''}`;

const tlacCss = fs.readFileSync(path.join(__dirname, 'tlac.html'), 'utf8');
const baseCss = tlacCss.slice(tlacCss.indexOf('<style>') + 7, tlacCss.indexOf('</style>')).replace(/pbt-tlac/g, 'pbt-p');
const extraCss = `
.pbt-p .steps{list-style:none;margin:0 0 36px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;counter-reset:s}
.pbt-p .steps li{counter-increment:s;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 16px 14px;position:relative}
.pbt-p .steps li:before{content:counter(s);display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#0d9488;color:#fff;font-weight:800;margin-bottom:8px}
.pbt-p .steps h3{font-size:16px;margin:0 0 6px}
.pbt-p .steps p{font-size:14px;color:#475569;margin:0}
.pbt-p .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px 24px;margin:0 0 28px}
.pbt-p .box h3{font-size:18px;margin:0 0 8px}
.pbt-p .box p,.pbt-p .box li{font-size:14.5px;color:#475569}
.pbt-p .box ul{margin:0 0 6px;padding-left:20px}
.pbt-p .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:0 0 28px}
.pbt-p .warn{background:#fffbeb;border-color:#fde68a}
.pbt-p .soc{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.pbt-p .soc a{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:700;font-size:14px;padding:8px 14px;border-radius:9px;color:#fff}
.pbt-p .soc svg{width:20px;height:20px}
.pbt-p .soc .fb{background:#1877f2}.pbt-p .soc .ig{background:linear-gradient(45deg,#f09433,#dc2743 50%,#bc1888)}
@media(max-width:600px){.pbt-p .steps{grid-template-columns:1fr}}
`;
const style = `<style>${baseCss}${extraCss}</style>`;

const social = `<p style="margin:14px 0 0;font-weight:700;font-size:14px">Sleduj nás</p>
<div class="soc">
<a class="fb" href="https://www.facebook.com/pbtprint" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.8c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.7H7.6v3.3h2.8V22h3.1z"/></svg>Facebook</a>
<a class="ig" href="https://www.instagram.com/pbtprint/" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="#fff"/></svg>Instagram</a>
</div>`;

const dopytBody = (co) => `Dobrý deň,\n\nzašlite mi prosím cenovú ponuku:\n\n${co}\nMnožstvo:\nRozmer:\nKedy to potrebujem:\n\nGrafiku prikladám v prílohe.`;

const mailBox = (subj, co) => `<div class="mail">
<h2>Nechceš objednávať cez appku?</h2>
<p>Žiaden problém. Pošli nám e-mail s tým, čo potrebuješ, a priprav si grafiku. Pripravíme ti cenovú ponuku a o všetko ostatné sa postaráme.</p>
<a class="btn btn-main" href="${mail(subj, dopytBody(co))}">Poslať dopyt e-mailom</a>
<a class="btn btn-alt" href="/pages/contact">Kontaktný formulár</a>
${social}
</div>`;

const steps = (items) => `<ol class="steps">\n${items.map(([h, p]) => `<li><h3>${h}</h3><p>${p}</p></li>`).join('\n')}\n</ol>`;

// ---------------- DTF ----------------
const dtf = `${style}
<div class="pbt-p">
<div class="hero">
<h1>DTF transfery = nažehľovačky</h1>
<p class="lead">DTF transfer je to, čo poznáš ako nažehľovačku: potlač, ktorú si jednoducho nažehlíš na tričko. Objednáš si ju sám z domu, zvládne to aj mamina so žehličkou. Nahraj obrázok, zaplať a transfer ti pošleme domov. Cena sa spočíta hneď podľa rozmeru a množstva.</p>
<a class="btn btn-main" href="/apps/dtf-metraz?dtf=1">Objednať DTF transfery →</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?dtf=1&amp;rezim=vzorky">Objednať vzorku (A4) za 5 €</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?dtf=1&amp;rezim=paleta">Objednať paletu farieb za 5 €</a>
</div>

<h2 class="sec">Ako na to: 5 jednoduchých krokov</h2>
<p class="sub">Žiadne špeciálne vybavenie. Stačí žehlička, mastný papier (papier na pečenie) a tričko.</p>
${steps([
  ['Vlož obrázok', 'Nahraj svoje logo alebo grafiku v appke (ideálne PNG alebo TIFF bez pozadia, 300 DPI).'],
  ['Objednaj', 'Zadaj rozmer a počet kusov, cenu uvidíš hneď. Zaplatíš kartou a transfer ti pošleme domov.'],
  ['Umiestni na textil', 'Polož tričko na rovnú pevnú podložku a daj transfer potlačenou stranou na látku, kam ho chceš mať.'],
  ['Pritlač cez mastný papier', 'Prikry transfer mastným papierom a žehli cca 15 sekúnd, bez pary, s primerane silným prítlakom (pri ručnej žehličke tlač rovnomerne celou váhou ruky; tepelný lis cca 3–4 bar).'],
  ['Stiahni fóliu a dožehli', 'Stiahni prenosovú fóliu, prikry znova mastným papierom a prežehli ďalších cca 15 sekúnd.'],
])}

<div class="box">
<h3>Nie si si istý kvalitou alebo farbami?</h3>
<p>Vyskúšaj najprv za malý peniaz. Obe možnosti stoja 5 € vrátane poštovného.</p>
<a class="btn btn-alt" href="/apps/dtf-metraz?dtf=1&amp;rezim=vzorky">Vzorka tvojej grafiky (A4)</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?dtf=1&amp;rezim=paleta">Paleta farieb</a>
</div>

<h2 class="sec">Prečo DTF transfer</h2>
<div class="box"><ul>
<li>Plnofarebná potlač bez obmedzenia počtu farieb</li>
<li>Vhodné na bavlnu, polyester aj zmesové materiály</li>
<li>Žehlí sa jednoducho aj doma alebo v malej prevádzke</li>
<li>Výhodnejšia cena pri väčšom množstve, appka to prepočíta automaticky</li>
</ul></div>

${mailBox('Dopyt - DTF transfery', 'Dopyt na DTF transfery:')}
</div>`;

// ---------------- Sublimacia / Bavlna ----------------
const techPage = ({ slug, h1, lead, popis, materialy, siroka, napovedaPlus, tech, subj }) => `${style}
<div class="pbt-p">
<div class="hero">
<h1>${h1}</h1>
<p class="lead">${lead}</p>
<a class="btn btn-main" href="/apps/dtf-metraz?textil=${slug}">Objednať tlač v appke →</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?textil=${slug}&amp;rezim=farebnica">Objednať farebnicu za 5 €</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?textil=${slug}&amp;rezim=vzorka">Objednať vzorku za 5 €</a>
</div>

<h2 class="sec">O čom to je</h2>
<div class="box"><p style="margin:0">${popis}</p></div>

<div class="two">
<div class="box"><h3>Materiály a rozmery</h3><ul>
${materialy.map((x) => `<li>${x}</li>`).join('\n')}
<li>${siroka}</li>
<li>Tlač už od 1 bežného metra (vzorkové výstrižky na požiadanie)</li>
</ul></div>
<div class="box"><h3>Ako objednávka prebieha</h3><ul>
<li>Vyberieš technológiu a nahráš vzor alebo hotovú rolku</li>
<li>Zadáš šírku a dĺžku metráže</li>
<li>Cena sa spočíta hneď, vrátane DPH</li>
<li>Zaplatíš kartou, žiadne čakanie na potvrdenie</li>
</ul></div>
</div>

<div class="box">
<h3>Nie si si istý farbami alebo kvalitou?</h3>
<p>Objednaj si fyzickú farebnicu alebo vzorku svojej grafiky. Každá stojí 5 € vrátane poštovného.</p>
<a class="btn btn-alt" href="/apps/dtf-metraz?textil=${slug}&amp;rezim=farebnica">Objednať farebnicu</a>
<a class="btn btn-alt" href="/apps/dtf-metraz?textil=${slug}&amp;rezim=vzorka">Objednať vzorku</a>
</div>

<h2 class="sec">Čo je v cene a na čo dať pozor</h2>
<div class="two">
<div class="box"><h3>Čo je v cene</h3><ul>
<li>Potlač látky z nášho širokého repertoáru alebo na dodaný materiál</li>
<li>Základná grafická úprava na základe dodanej grafiky v dostatočnej kvalite pre tlač, prípadná konzultácia pred tlačou</li>
<li>Formát potlače nie je až tak dôležitý ako kvalita obrázku. Musí byť ostrý aj pri zväčšení na obrazovke približne do veľkosti želanej potlače</li>
<li>Ak grafika nezodpovedá kvalite, budeme ťa kontaktovať</li>
</ul></div>
<div class="box"><h3>Čo nie je v cene</h3><ul>
<li>Osobitný prístup pri tvorbe vlastného motívu naším grafikom. Grafické práce sa účtujú podľa časovej náročnosti</li>
</ul></div>
</div>
<div class="box warn"><h3>Na čo treba dávať pozor</h3>
<p style="margin:0">Takto vyrobený tovar na objednávku nie je možné reklamovať, keďže je zušľachtený podľa požiadaviek zákazníka. To však neplatí, ak bola nájdená chyba v tlači, alebo tovar bol dodaný poškodený alebo iný, ako je písané v objednávke.</p></div>

${mailBox(subj, 'Technológia: ' + tech)}
</div>`;

const sublimacia = techPage({
  slug: 'sublimacia',
  h1: 'Sublimačná potlač látky',
  lead: 'Digitálna plnofarebná potlač látky sublimačnou technológiou s najlepšou pracovnou stálosťou a brilantnosťou farieb. Aj fluorescenčné FLUO farby. Nahraj vzor, appka ti hneď vypočíta presnú cenu a objednávku rovno zaplatíš.',
  popis: 'Sublimácia zafarbí samotné vlákno, takže farby sú žiarivé a trvácne a nie je ich cítiť na dotyk. Môžeš tlačiť aj FLUO (fluorescenčné) farby, ktoré žiaria pod UV svetlom. Tlačíme na polyesterové látky rôzneho druhu, podľa tvojich požiadaviek.',
  materialy: ['Prevažne materiály 100 % polyester a 95 % polyester, 5 % lycra', 'Možnosť tlače FLUO farbami'],
  siroka: 'Šírka tlače závisí prevažne od šírky materiálu, maximálne 159 cm',
  tech: 'sublimácia',
  subj: 'Dopyt - sublimačná potlač',
});
const bavlna = techPage({
  slug: 'bavlna',
  h1: 'Digitálna potlač bavlny',
  lead: 'Digitálna plnofarebná potlač látky pigmentovými farbami s výbornou pracovnou stálosťou a krásnymi farbami. Nahraj vzor, appka ti hneď vypočíta presnú cenu a objednávku rovno zaplatíš.',
  popis: 'Priama pigmentová potlač bavlnených látok (jednolíc, výplnok, tkaniny) podľa tvojich požiadaviek. Plnofarebná potlač bez obmedzenia počtu farieb.',
  materialy: ['Prevažne materiály 100 % bavlna a 95 % bavlna, 5 % lycra'],
  siroka: 'Šírka tlače závisí prevažne od šírky materiálu, maximálne 180 cm',
  tech: 'digitálna potlač bavlny',
  subj: 'Dopyt - digitálna potlač bavlny',
});

for (const [name, html] of [['dtf', dtf], ['sublimacia', sublimacia], ['bavlna', bavlna]]) {
  fs.writeFileSync(path.join(__dirname, name + '.html'), html);
  fs.writeFileSync(path.join(__dirname, name + '.json'), JSON.stringify(html));
  console.log(name, html.length);
}
