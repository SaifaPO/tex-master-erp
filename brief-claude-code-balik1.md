# TEX-MASTER ERP — Brief pre Claude Code

## Kontext projektu (dôležité prečítať pred začatím)

- **Stack:** React + Vite + Tailwind CSS + Supabase (Postgres, Realtime, Auth, Storage, Edge Functions) + Vercel
- **Hlavný súbor appky:** `src/App.jsx` (jeden veľký komponent, niekoľko tisíc riadkov)
- **Build:** `npm run build` (Vite + Rolldown) — **vždy over build lokálne pred commitom**, appka je v produkcii pre reálnu firmu
- **Zamestnanci:** role `master` / `supervisor` / `sales` (Obchodník) / `employee`
  - Master/Supervisor/Sales sa prihlasujú cez Supabase Auth (email + heslo, voliteľne 2FA)
  - `employee` (bežní zamestnanci na dielni) sa prihlasujú cez QR kód na stanici + 4-miestny PIN (vlastný systém, NEvytvára Supabase Auth session — je to známe bezpečnostné obmedzenie, budeme ho riešiť samostatne, nie v tomto balíku)
- **Zákazky:** tabuľka `orders`, položky (`items`) ako JSONB pole s `stationStatuses`, `stationDates` (dátum výroby per stanica), `stationMeta` (kto/kedy pracoval), `priority` (globálne poradové číslo naprieč všetkými položkami)
- **Stanice:** `STATION_ORDER = ['grafik', 'strihanie', 'laser', 'sublimacia', 'transfer', 'sietotlac', 'sitie', 'balenie']`
- **Práva:** tabuľka `acl_settings`, kontrola cez `hasPermission(akcia)` v kóde
- **Existujúci systém "Problémy":** tabuľka `problem_reports` (kategória, popis, fotka, stav open/resolved), s vizuálnou eskaláciou naliehavosti + zvukovou/desktop notifikáciou master/supervisor
- **QR kódy:** každá položka má QR kód (`?scan=itemId`), appka podľa neho vie predvyplniť skener na stanici

---

## FUNKCIA 1: Ultra priorita zákazky

**Cieľ:** Zákazka/položka s "ultra prioritou" má prednosť pred všetkým ostatným v ten deň, a v Plánovacej Matici je **vizuálne extrémne nápadná** (pulzujúci červený efekt).

**Kto môže zapnúť:**
- **Master, Supervisor** → priamo, okamžite, bez schvaľovania
- **Sales (Obchodník)** → môže len **navrhnúť** (vytvorí žiadosť), nie priamo nastaviť

**Schvaľovací tok (keď žiada Sales):**
1. Sales klikne "Navrhnúť ultra prioritu" pri položke → uloží sa žiadosť (pending stav)
2. Master/Supervisor dostane **notifikáciu** (odporúčam znovupoužiť existujúci vzor zo systému "Problémy" — zvuk + desktop notifikácia + odznak v hornom paneli)
3. Master/Supervisor **Schváli** (aktivuje ultra prioritu) alebo **Zamietne** (žiadosť sa zruší, dôvod voliteľný)

**Návrh dátového modelu (na položke, JSONB):**
```
item.ultraPriority: boolean
item.ultraPriorityStatus: 'none' | 'pending' | 'approved'
item.ultraPriorityRequestedBy: string (meno)
item.ultraPriorityRequestedAt: timestamp
```

**Vizuál v matici:** karta s `ultraPriority: true` — výrazný pulzujúci červený rámček/glow (CSS animácia), musí byť nápadnejšia než farebné rozlíšenie podľa zákazky, ktoré už existuje.

---

## FUNKCIA 2: Schvaľovací krok pred Transfer / Sieťotlač

**Cieľ:** Pred spustením tlače na staniciach **Transfer** a **Sieťotlač** musí zamestnanec najprv potvrdiť, že prijatý textil sedí s objednávkou.

**Tok:**
1. Zamestnanec vidí položku v stave "Čaká sa" → klikne **"Potvrdiť — spočítané, sedí"**, až potom sa mu sprístupní zmena stavu na aktívnu tlač.
2. Ak **niečo nesedí** (chýba materiál/kusy): zamestnanec namiesto potvrdenia klikne **"Nahlásiť nezrovnalosť"** → napíše čo chýba/nesedí (text + prípadne počet kusov).
3. Táto nezrovnalosť ide **nadriadenému** (Master/Supervisor) na rozhodnutie:
   - **"Dať bokom"** → položka prejde do nového stavu, napr. `caka_na_vyriesenie` (mimo bežného flow, viditeľné oddelene)
   - **"Pokračuj napriek tomu"** → zamestnanec môže začať tlačiť aj tak
4. Po dokončení: zamestnanec **naskenuje QR kód** položky = potvrdenie dokončenia (over, či toto už v appke existuje, ak nie, doplniť).
5. **Finálna kontrola:** osoba na balení pri prevzatí **naskenuje QR kód znova** = finálne potvrdenie kontroly kompletnosti (nové pole `finalCheckConfirmedBy` / `finalCheckConfirmedAt`).

**Poznámka:** tento krok platí **len** pre stanice `transfer` a `sietotlac` (podľa zadania), nie pre ostatné.

---

## FUNKCIA 3: Rozšírenie hlásenia problémov — zodpovednosť a náklady

**Cieľ:** Pri riešení nahláseného problému (existujúci systém `problem_reports`) pridať možnosť zaznamenať:
- **Kto problém zavinil** (výber zo zoznamu zamestnancov, voliteľné pole)
- **Koľko to stálo** (číslo v €, alebo čas — uprav podľa toho, čo dáva zmysel)

**Nová záložka/report:** "Rebríček chybovosti zamestnancov" — zoskupenie podľa zamestnanca, počet problémov + súčet nákladov, s filtrom podľa obdobia (mesiac / 3 mesiace / 6 mesiacov / rok).

**Účel:** podklad na rozhodovanie o kompenzácii alebo výmene zamestnanca pri opakovanej nízkej kvalite.

Citlivé dáta o výkone jednotlivých ľudí — zváž obmedziť prístup k tomuto rebríčku len na Master (nie automaticky Supervisor).

---

## FUNKCIA 4: Zvýraznenie zmeny zákazky na sprievodke

**Cieľ:** Keď sa v zákazke/položke niečo zmení (dátum, stav, poznámka...), sprievodka to má **výrazne farebne (červeno) upozorniť**, aby si to obsluha na dielni neprehliadla.

**Jednoduchší návrh (odporúčaný ako prvý krok):** banner hore na sprievodke — "Táto zákazka bola nedávno upravená (kedy, čo presne)" — netreba sledovať zmenu každého jednotlivého poľa zvlášť, stačí `lastModifiedAt` + krátky popis zmeny.

**Zložitejšia verzia (voliteľne neskôr):** zvýrazniť priamo konkrétne zmenené pole/hodnotu na sprievodke červeným rámčekom.

---

## Odporúčané poradie implementácie

1. **Funkcia 2** (schvaľovací krok pred Transfer/Sieťotlač) — najväčší vplyv na dennú prevádzku
2. **Funkcia 3** (rebríčky chybovosti) — rozšírenie existujúceho systému, menší zásah
3. **Funkcia 1** (ultra priorita) — nová vec, ale schvaľovací princíp je podobný Funkcii 2
4. **Funkcia 4** (zvýraznenie zmien) — najjednoduchšie, ide na koniec

---

## Dôležité zásady práce na tomto projekte

- **Vždy over build** (`npm run build`) pred tým, než niečo označíš za hotové — v minulosti vznikli chyby z nesúladu premenných po viacerých úpravách.
- **SQL migrácie vždy idempotentné** (`if not exists`, `create or replace`, `drop policy if exists` + `create policy`) — nič nesmie zmazať existujúce dáta.
- **Postupuj po malých, samostatne otestovateľných krokoch** — je to produkčný systém reálnej firmy, nie testovací projekt.
- **Pred väčšími zmenami zabezpečenia/dát navrhni zálohu** (appka už má automatické nočné zálohy cez Edge Function `nightly-backup` do Supabase Storage).

---

## Ostávajúce funkcie (nie v tomto balíku, na neskôr)

Toto sme si rozobrali, ale zámerne odložili na ďalšie kolo — nech sa v Claude Code nestratia:

- **AI hlasový/chatový asistent** — vytvorí zákazku podľa hlasového zadania, screenshotu objednávky od zákazníka, alebo importu emailu s rozpisom objednávky.
- **Export/import zoznamu produktov cez Excel** — s voľbou "doplniť aktuálny zoznam" alebo "nahradiť celý zoznam".
- **QR platba pre zákazníka pri prevzatí tovaru** — appka vygeneruje PAY by square QR kód s variabilným symbolom priamo pre zákazníka na mieste.
- **Všeobecná tabuľka nákladov/metrík** — elektrina, mzdy, cena za meter sublimácie/fólie/DTF, hodina tlače, kus tlače a pod. Editovateľné manuálne, prepojené obojsmerne naprieč appkou (zmena na jednom mieste sa prejaví všade), s poľom na popis/vzorec/zdroj čísla.
- **Predvoľby splatnosti faktúr** — rýchly výber 1/2/3/4 týždne namiesto ručného zadávania dátumu.
