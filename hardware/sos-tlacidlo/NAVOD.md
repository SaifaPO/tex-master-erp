# SOS tlačidlo na stanici — návod

Pracovník na šití, kompletáži alebo balení stlačí tlačidlo pri stroji. V ERP vznikne žiadosť o pomoc pre **grafika, ktorý robil zákazku rozrobenú na tej stanici** (ak sa nedá zistiť, pre supervízora). Pracovník nič nepíše ani neskenuje navyše.

Ako sa zistí zákazka: pracovník zákazku naskenuje pri začatí práce (Dielenská čítačka QR kódov), čím sa na stanici označí ako rozrobená. Tlačidlo vie, na ktorej stanici je, a zavolá toho, kto robil zákazku rozrobenú práve tam.

## Stisky
| Stisk | Význam v ERP |
|---|---|
| 1× | 🆘 Potrebujem pomoc |
| 2× | 📦 Chýba materiál |
| 3× | 🎨 Chyba v grafike |
| dlhý (3 s) | 🔧 Nefunguje stroj |

Keď grafik v ERP klikne **Idem**, LED na tlačidle zasvieti nazeleno a zapípa (len pri variante s ESP32).

## Krok 1 — v ERP
1. V Supabase SQL Editore spusti `migration_sos_stanice.sql`.
2. V Supabase → Edge Functions vytvor funkciu `sos-stanica` a vlož kód zo `supabase/functions/sos-stanica/index.ts`. **Pri tejto funkcii vypni „Verify JWT“ (Enforce JWT verification)** — tlačidlo nemá prihlásenie, overuje ho token.
3. V ERP: PrintStudio → Nastavenia → **SOS tlačidlá (stanice)** → zadaj názov (napr. „Šitie – stôl 1“), vyber stanicu → **Vytvoriť tlačidlo**. Zobrazí sa token a odkaz.
4. Klikni **Poslať skúšobné stlačenie** — v ERP v „Žiadostiach o pomoc“ sa objaví žiadosť.

## Krok 2 — hardvér (vyber jednu možnosť)

### Možnosť A: Shelly Button (bez programovania, odporúčané na skúšku)
- Kúpiš: **Shelly BLU Button1** alebo **Shelly Button1** (cca 15–25 €), napájané batériou/USB.
- V aplikácii Shelly pripoj tlačidlo na Wi-Fi a v nastavení **Actions → Short push / Double push / Triple push / Long push** nastav „URL“ (GET):
  - Short: odkaz z ERP s `&typ=pomoc`
  - Double: odkaz s `&typ=material`
  - Triple: odkaz s `&typ=grafika`
  - Long: odkaz s `&typ=stroj`
- Odkaz je v ERP pri tlačidle (typ „pomoc“); v ostatných odkazoch zmeň len koniec `typ=…`.
- Nevýhoda: tlačidlo nezasvieti nazeleno, keď grafik klikne „Idem“ (pracovník to uvidí iba na obrazovke/tablete).

### Možnosť B: ESP32 s LED a bzučiakom (zelená LED „Idem“)
- Zoznam súčiastok (spolu cca 15–25 €): ESP32 DevKit, veľké tlačidlo (arcade 60 mm), červená a zelená LED + 2 rezistory 330 Ω, aktívny bzučiak, krabička, USB napájač.
- Zapojenie je v komentári na začiatku súboru `sos_tlacidlo.ino`.
- Otvor `sos_tlacidlo.ino` v Arduino IDE, vyplň Wi-Fi (názov a heslo), adresu funkcie a token z ERP a nahraj do ESP32.
- Správanie: po stlačení pípne, červená LED bliká, kým grafik neklikne „Idem“, potom zasvieti zelená a trikrát zapípa.
- V ERP pri tlačidle uvidíš „online“ (tlačidlo sa ozýva každú minútu).

## Krok 3 — kde to uvidí grafik
- V ERP: vpravo hore ikona žiadostí o pomoc a hlasné upozornenie (4 pípnutia), ak má ERP otvorené.
- Žiadosť obsahuje stanicu, číslo zákazky, zákazníka a produkt. Grafik klikne **Idem** a po vyriešení **Vyriešené**.
- Ak má grafik často ERP zatvorené, ďalším krokom je upozornenie na telefón (Telegram) — dá sa doplniť.

## Veľké tlačidlo v ERP (bez hardvéru)
V ERP → Dielenská čítačka QR kódov je pod čítačkou štyri veľké tlačidlá (Potrebujem pomoc / Chyba v grafike / Chýba materiál / Nefunguje stroj). Rovnako vytvoria žiadosť pre grafika zákazky. Hodí sa pre tablet pri stanici.
