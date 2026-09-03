# Brief pre hlavný ERP chat — pokračovanie DTF Metráž v jednom vlákne

Toto je odovzdávací dokument. Vlož/nalinkuj ho do svojho hlavného Claude Code chatu
(ten, ktorý používaš pre TEX-MASTER ERP) a povedz mu niečo v zmysle: *"Prečítaj si
brief-claude-code-dtf-metraz.md a pokračuj v práci na DTF metráži odtiaľto, v tomto
jednom vlákne."* Od tejto chvíle by mal **len jeden chat naraz** upravovať
`printstudio-pro/` a `src/printstudio/`, aby sa predišlo tomu, čo sa stalo nižšie.

## ⚠️ Dôležité — práve sa stal live konflikt súborov, je opravený

Kým som pracoval na DTF metráži, iný chat mal otvorený `npm run dev` nad tým istým
priečinkom a súčasne upravoval `printstudio-pro/src/App.jsx`. Keďže projekt leží v
iCloud Drive, súbežné zápisy do toho istého súboru spôsobili, že iCloud vytvoril
konfliktnú kópiu (`App 2.jsx`) a pôvodný `App.jsx` sa stratil zo svojej cesty. To isté
sa stalo aj s `printstudio-pro/src/beachflag/BeachflagApp.jsx` (→ `BeachflagApp 2.jsx`),
zjavne z skoršej session tej istej druhej session.

**Opravil som to** — obsah oboch " 2" kópií bol v skutočnosti v poriadku (obsahoval
zlúčené zmeny z oboch strán, nič sa nestratilo), len mal zlé meno súboru. Premenoval
som ich späť na správne cesty a zmazal duplikáty. Oba `npx vite build` (printstudio-pro
aj hlavné ERP) po oprave prešli bez chýb.

**Prečo sa to stalo:** rýchle/súbežné úpravy toho istého súboru z dvoch miest naraz,
v priečinku synchronizovanom cez iCloud. Toto je známy opakujúci sa problém (viď pamäť
`feedback_icloud_sync_large_file_edits`) — nie je to spôsobené konkrétne DTF prácou,
môže sa stať kedykoľvek, keď bežia dve session naraz nad rovnakými súbormi.

**Odporúčanie do budúcna:**
1. Pracuj na `printstudio-pro/` a `src/printstudio/` len z **jedného** chatu naraz —
   ak máš viac otvorených Claude Code okien/tabov, zavri ostatné pred úpravou týchto
   priečinkov, alebo aspoň nenechávaj v nich bežať `npm run dev` z viacerých miest.
2. Po každej väčšej dávke úprav skontroluj `git status` — súbor s "2" v názve alebo
   nečakané "D" (deleted) pri súbore, ktorý si neplánoval mazať, je signál konfliktu.
3. Commituj častejšie (aj priebežné medzistavy) — git potom vie zmeny jasne odlíšiť
   a merge konflikt je viditeľný a riešiteľný namiesto tichého prepísania.
4. Dlhodobo zváž presunutie repozitára mimo iCloud Drive (alebo pozastavenie sync počas
   aktívnej práce) — vyriešilo by to koreň problému, nie len príznaky.

## Aktuálny stav repozitára (git status, 2026-09-03)

Toto sú VŠETKY rozrobené veci v `printstudio-pro/` a `src/printstudio/` naprieč
viacerými session — nič z toho ešte nie je commitnuté:

- **Personalizácia oblečenia** (pôvodný konfigurátor) — `Dizajner.jsx`, `Katalog.jsx`,
  `produktData.js`, admin taby `FarbyTab.jsx`, `MockupyTab.jsx`, `ProduktyTab.jsx`,
  `PrintStudioAdmin.jsx`, `ShopifyTab.jsx` — upravované inou session.
- **Plážové vlajky (beachflag)** — `printstudio-pro/src/beachflag/`, admin taby
  `VlajkaDoplnkyTab.jsx`, `VlajkaObjednavkyTab.jsx`, `VlajkaTvaryTab.jsx`,
  `VlajkaVelkostiTab.jsx`, `VlajkyAdmin.jsx`, `vlajkaCenotvorba.js`, migrácie
  `migration_beachflag*.sql`, Edge Functions `beachflag-*` — **už zapojené a
  reachable** v hlavnom ERP ako tab "Plážové Vlajky".
- **3D dresy** — `printstudio-pro/src/dres3d/`, admin taby `DresAdmin.jsx`,
  `DresNastaveniaTab.jsx`, `DresObjednavkyTab.jsx`, `DresZlavyTab.jsx`, migrácia
  `migration_dres3d.sql`, Edge Functions `dres-*` — **NIE JE zapojené** do hlavného
  ERP nav (žiadny import v `src/App.jsx`), rozrobené.
- **DTF metráž (táto session, 2026-09-03)** — pozri nižšie, detail.
- **Shopify variant sync** — `migration_shopify_varianty.sql`,
  `supabase/functions/shopify-sync-variants/` — rozrobené, účel/stav neznámy.

## Čo som spravil ja (DTF metráž) — kompletný zoznam

Nový, samostatný produkt: predaj hotových DTF transferov na meter (rolka 56cm),
nezávislé od personalizácie oblečenia. Files:

- `printstudio-pro/migration_dtf_metraz.sql` — 4 nové tabuľky (`dtf_cenove_hladiny`,
  `dtf_naklady`, `dtf_nastavenia`, `dtf_objednavky`) + RLS. **Ešte nespustené** v
  Supabase (over cez SQL Editor → run).
- `printstudio-pro/src/DtfMetraz.jsx` — zákaznícky konfigurátor, dostupný na
  `?dtf=1`, zapojený do `App.jsx` cez `zobrazDtfMetraz` state (aditívna zmena,
  Katalog/Dizajner vetvy nedotknuté).
- `src/printstudio/DtfMetrazTab.jsx` — admin karta (náklady, cenové hladiny s maržou,
  Shopify nastavenia, prijaté objednávky so súbormi).
- Zapojené na **dvoch** miestach (obe nechané, sú neškodné/redundantné):
  1. `src/App.jsx` (hlavný ERP) — nový top-level tab "DTF Metráž" v nav bare, vedľa
     "Plážové Vlajky" — **toto je live reachable teraz**.
  2. `src/printstudio/PrintStudioAdmin.jsx` — pridané do `SUBTABS` poľa, ale tento
     shell zatiaľ nie je nikde importovaný/zapojený (orphan, rovnako ako 3D dresy) —
     neriešil som to, nie je to moja úloha.
- Shopify prepojenie: keďže Martin je na bežnom (nie Plus) pláne, cena za meter je
  spojitá (nie pár pevných úrovní), takže som použil **jednotkovú-cenu-krát-počet**
  trik namiesto diskrétnych variantov, ktoré používa `ShopifyTab.jsx` pre malý fixný
  poplatok za personalizáciu. Detaily v admin karte "DTF Metráž" → "Prepojenie na
  Shopify".

**Zostáva spraviť (povedané Martinovi, čaká sa naňho):**
1. Spustiť `migration_dtf_metraz.sql` v Supabase SQL Editore.
2. V Shopify Admin vytvoriť produkt "DTF tlač — jednotka" s jedným variantom (napr.
   0,05 €), Variant ID vložiť do admin karty.
3. Doladiť reálne výrobné náklady a cenové hladiny v admin karte.
4. Neskôr: AI asistent pre DTF chat (zámerne odložené — treba Edge Function proxy,
   nie priamy kľúč v prehliadači ako mal pôvodný HTML prototyp).
5. Zvážiť commit celého aktuálneho stavu (všetky rozrobené veci vyššie) ako čistý
   checkpoint — momentálne je toho v `git status` veľa naprieč viacerými funkciami
   a nič nie je commitnuté, čo je presne rizikový stav pre ďalšie sync konflikty.
