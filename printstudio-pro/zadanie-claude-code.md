# PrintStudio Pro — zadanie pre Claude Code

## Kontext
V Claude.ai chate sme navrhli a odprototypovali konfigurátor potlače pre TEX-MASTER
(Shopify eshop so sublimáciou/DTF/sieťotlačou/rezaným transferom). Vznikli tri hotové
referenčné súbory — **priložené k tomuto zadaniu, alebo ich nájdeš v priečinku, kam si
ich uložil zo stiahnutých príloh**:

- `master-admin.html` — funkčný HTML/JS prototyp admin rozhrania
- `konfigurator-fabric.html` — funkčný HTML/JS prototyp zákazníckeho konfigurátora (Fabric.js)
- `migration_konfigurator.sql` — hotová Supabase SQL schéma zodpovedajúca obom prototypom

**Tvoja úloha:** preniesť logiku z týchto prototypov do nášho reálneho React + Vite +
Tailwind + Supabase stacku (rovnaký ako TEX-MASTER ERP), nasadiť cez GitHub → Vercel,
a napojiť na Supabase namiesto dát v pamäti prehliadača.

Priebežne over `git status` pred každým commitom (zvyk, ktorý už používame) a over
syntax buildu (`npx vite build` alebo ekvivalent) pred odovzdaním výstupu.

---

## 1. Databáza
Spusti `migration_konfigurator.sql` v Supabase projekte (SQL editor alebo
`supabase db push`). Skontroluj, že sa vytvorili všetky tabuľky a RLS politiky.

Kľúčové tabuľky: `kategorie`, `produkty`, `farby`, `produkt_farby`, `produkt_velkosti`,
`produkt_velkost_zony`, `fonty`, `grafiky`, `cennik_technologie`, `cennik_sietotlac`,
`cennik_folie`, `cennik_rezany_transfer`, `objednavky`, `objednavka_zony`.

Vytvor v Supabase Storage privátny bucket `print-designs` pre tlačové súbory a náhľady
(prístup cez signed URL, nie verejný).

## 2. Master Admin (React)
Prepíš `master-admin.html` na React komponenty napojené na Supabase klienta:

- **Prihlásenie** cez Supabase Auth (nie hardcoded heslo z prototypu) — rola Master,
  rovnaký vzor ako v TEX-MASTER ERP (zváž aj TOTP 2FA, ak to tam už máme).
- **Kategórie** — CRUD, viazané na `kategorie` tabuľku.
- **Produkty (Blanks)** — CRUD s poliami: kategória, názov, Shopify handle (párovanie
  s eshopom), pohlavie (muž/žena/dieťa/unisex), základná cena, technológia potlače,
  dodávateľ, aktívny/neaktívny prepínač priamo v tabuľke.
  - Zóny potlače (predok/chrbát/ľavý rukáv/pravý rukáv) ako checkboxy.
  - Pre každú veľkosť produktu nastaviteľný max. rozmer potlače (š×v cm) **zvlášť pre
    každú zapnutú zónu** — v prototype je to dynamická tabuľka veľkostí, zachovaj to.
  - **Žiadne sledovanie skladových zásob/množstva** — to bolo zámerne odstránené,
    nepridávaj to späť.
- **Farby** — globálna paleta (názov + hex), CRUD.
- **Fonty** — názov (CSS font-family) + použitie (meno/číslo/text/všetko), CRUD.
- **Grafiky** — knižnica motívov s nahrávaním obrázkov do Storage, CRUD.
- **Cenník potlače** — samostatná karta s nastavením:
  - Sublimácia, DTF: sadzba €/cm² + minimálna cena (počet farieb cenu neovplyvňuje).
  - Sieťotlač: sadzba €/cm² + minimálna cena + príplatok za každú ďalšiu farbu.
  - Rezaný transfer: zoznam typov fólie (každá vlastná sadzba €/cm²) + minimálna cena;
    cena = plocha × sadzba fólie × počet farieb.
  - Testovacia kalkulačka (technológia, rozmery, počet farieb, typ fólie → živý
    prepočet ceny) — nechaj presne ako v prototype, je to dôležitý nástroj na overenie
    cien pred nasadením.
- **Dôležitá poznámka z ladenia:** natívne `confirm()`/`alert()` boli v sandboxovanom
  prostredí Claude.ai artefaktov blokované, preto má prototyp vlastné potvrdzovacie
  okno a toast namiesto nich. V reálnej React appke mimo tohto sandboxu môžeš pokojne
  použiť čokoľvek vhodné (native confirm, alebo krajšie vlastné komponenty) — over si
  ale v skutočnom nasadení, že mazanie/potvrdzovanie funguje.

## 3. Zákaznícky konfigurátor (React)
Prepíš `konfigurator-fabric.html` — canvas editor (Fabric.js zostáva) napojený na
Supabase namiesto hardcoded `products` objektu:

- **Katalóg** — hlavná obrazovka: kategórie → produkty v kategórii → dizajnér.
  Číta `kategorie` a `produkty` (len `aktivny = true`) zo Supabase.
- **Priamy vstup z eshopu** — appka pri načítaní číta `?produkt=<shopify_handle>`
  z URL; ak nájde zhodu v `produkty.shopify_handle`, preskočí katalóg a otvorí
  dizajnér rovno s daným produktom (farby/veľkosti/zóny podľa DB).
- **Viacero zón v jednej objednávke** — zákazník môže naraz navrhnúť predok, chrbát
  aj rukávy pre ten istý produkt; cena sa počíta zo súčtu plochy naprieč zónami.
- **Dresy Expres** — meno + číslo (chrbát), liga na srdce + sponzor na hrudi (predok),
  sponzor pod číslom (chrbát) — zachovaj presne toto rozdelenie zón.
- **Cenotvorba** — načítaj `cennik_technologie` / `cennik_sietotlac` / `cennik_folie`
  / `cennik_rezany_transfer` zo Supabase namiesto hardcoded `CENNIK` objektu v
  prototype, aby zmena v Master Admin karte "Cenník potlače" bola okamžite vidieť aj
  tu. Počet farieb sa počíta automaticky z unikátnych farieb použitých v návrhu.
  Zákazník nevidí žiadny rozpis — len finálnu cenu.
- **AI príprava obrázka** (odstránenie pozadia / zvýšenie kvality) — v prototype je to
  len simulácia. Pre reálnu funkčnosť potrebuješ Supabase Edge Function, ktorá zavolá
  externú službu (napr. remove.bg, Clipdrop, alebo self-hosted `rembg`/upscaler).
  Toto over so mnou v chate predtým, než začneš — treba vybrať konkrétnu službu a
  získať API kľúč.
- **Odoslanie do košíka** — pri "Pridať do košíka" appka:
  1. vyexportuje tlačové dáta (PNG/PDF) z Fabric canvasu pre každú použitú zónu,
  2. nahrá ich do Supabase Storage bucketu `print-designs`,
  3. zavolá Shopify `/cart/add.js` s `properties` obsahujúcimi `_design_id` a
     `_tlacovy_subor_<zona>` odkazy (podčiarovník = skryté zákazníkovi, viditeľné v
     Shopify Admin).

## 4. Shopify integrácia
- **Theme App Extension** — tlačidlo "Navrhni si potlač" na produktovej stránke,
  ktoré otvorí konfigurátor s `?produkt=<handle>` aktuálneho produktu.
- **Cena za potlač** — keďže Shopify checkout nedovolí meniť cenu položky za behu,
  over si so mnou, ktorý z dvoch prístupov ideme: (a) samostatná "Personalizácia"
  položka v košíku s vypočítanou cenou, alebo (b) Shopify Draft Order API s presnou
  cenou a presmerovaním na jeho checkout link. Toto ovplyvní implementáciu košíka.
- **Webhook `orders/create`** → Supabase Edge Function → vloží záznam do `objednavky`
  (status `na_schvalenie`) + `objednavka_zony` s odkazmi na tlačové súbory z line item
  properties.

## 5. Poradie práce (odporúčané)
1. Migrácia do Supabase + over dáta cez Table editor
2. Master Admin — kategórie, farby, fonty, grafiky, cenník (jednoduchšie CRUD časti)
3. Master Admin — produkty so zónami a veľkosťami (najkomplexnejšia časť)
4. Zákaznícky konfigurátor — katalóg + čítanie dát zo Supabase
5. Zákaznícky konfigurátor — cenotvorba naživo z DB cenníka
6. Shopify Theme App Extension + `?produkt=` prepojenie
7. Cart/add.js + upload do Storage
8. Webhook → ERP objednávky
9. AI príprava obrázka (posledné, závisí od výberu externej služby)

Ak niektorý bod nie je jasný alebo sa v priebehu objaví rozpor s tým, čo je v
prototypoch, radšej sa spýtaj, než hádaj — obchodná logika (hlavne cenotvorba a
zóny) musí sedieť presne.
