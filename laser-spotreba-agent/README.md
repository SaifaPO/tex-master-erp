# Laser — spotreba metráže z hotfoldera (agent)

Malý program, ktorý beží na **jednom PC v sieti** (ideálne na tom, ktorý je zapnutý cez deň, napr. pri laseri). Každých 5 minút prezrie
zdieľaný hotfolder s DXF súbormi, z každého **nového** súboru prečíta rozmer rozloženia a pošle ho do ERP. ERP z názvu súboru rozpozná
zákazku, farbu, materiál, strih, veľkosť a počet kusov, vypočíta spotrebu metráže a každý večer pošle súhrn e-mailom.

Súbory v hotfolderi zostávajú — agent si pamätá, čo už spracoval (súbor `stav.db`), takže nič nepočíta dvakrát. Keď je PC vypnutý,
po zapnutí dobehne všetko, čo medzitým pribudlo.

## Krok 1 — Python (ak ešte nie je na tom PC)
1. [python.org/downloads](https://www.python.org/downloads/) → stiahni a nainštaluj.
2. Na prvej obrazovke inštalátora **zaškrtni „Add python.exe to PATH“**, potom Install Now.

## Krok 2 — Skopíruj priečinok
Skopíruj celý priečinok `laser-spotreba-agent` na to PC, napr. na `C:\laser-spotreba-agent` (nie na sieťový disk).

## Krok 3 — Knižnice
V priečinku `laser-spotreba-agent` klikni do adresného riadku Prieskumníka, napíš `cmd` a Enter. V čiernom okne spusti:

```bash
pip install -r requirements.txt
```

## Krok 4 — Nastavenie
1. V tom istom okne spusti `python agent.py` — vytvorí sa súbor `config.json` a program sa ukončí.
2. Otvor `config.json` (Poznámkový blok) a doplň:
   - `hotfolder` — cesta k hotfolderu. **Použi sieťovú cestu (UNC)**, napr. `\\\\SERVER\\LASER` (v súbore sa spätné lomky zdvojujú), nie písmeno disku (`Z:`) — disky z písmen sa po reštarte niekedy nepripojia včas.
   - `token` — v ERP: **PrintStudio → Laser – spotreba metráže → Nastavenia agenta** (tlačidlo „Kopírovať“).
   - Ostatné nechaj. `jednotky: "auto"` číta jednotky z DXF (u vás sú to cm); `import_dni_pri_prvom_spusteni: 0` znamená, že staré súbory v hotfolderi sa len zapamätajú a **nepočítajú** do spotreby (ak chceš napr. započítať posledných 7 dní, daj 7).
3. Ulož.

## Krok 5 — Skúška
Over rozmery na pár súboroch (nič sa neposiela):

```bash
python agent.py --test "\\SERVER\LASER\1171 sk zahradne ten 691 z cierne garzato M 3X.dxf"
```
Vypíše rozmer × rozmer v cm, počet dielov a dĺžku rezu. Potom skús jeden prechod naostro:

```bash
python agent.py --raz
```
Nové súbory sa objavia v ERP (Laser – spotreba metráže). Priebeh vidíš aj v súbore `agent.log`.

## Krok 6 — Spúšťanie so štartom Windows
Dvojklikom spusti **`nainstalovat_autostart.bat`**. Vytvorí úlohu, ktorá spustí agenta (skryte, bez okna) po každom prihlásení do Windows.
PC musí byť po zapnutí prihlásené (alebo si nastav automatické prihlásenie). Zrušenie: `odinstalovat_autostart.bat`.

## Ako sa počíta spotreba
- **Dĺžka** = dlhšia strana rozloženia v DXF (osa dĺžky sa dá v ERP prepnúť na X alebo Y), **šírka** = kratšia strana. Šírka slúži len na kontrolu, či sa strih zmestí na metráž (max. šírka v nastaveniach, predvolene 160 cm).
- Číslo na konci názvu (`1x`, `2x`, `3x`…) = koľkokrát sa súbor reže, spotreba = dĺžka rozloženia × počet. Ak na konci nič nie je, reže sa raz. Dá sa vypnúť v nastaveniach.
- Riadok má stav: **OK**, **chyba v názve** (chýba číslo zákazky na začiatku názvu), **nezmestí sa na šírku**, **súbor sa nedal prečítať**.
  Chybné riadky sa dajú v ERP opraviť alebo ignorovať.

## Čo ak niečo nejde
- *„Hotfolder nie je dostupný“* v `agent.log` — PC nie je v sieti alebo je zlá cesta v `config.json`.
- *„ERP odmietlo požiadavku (401)“* — zlý `token` v `config.json`.
- V ERP vidíš „Posledný signál od agenta“ — ak je starý, agent nebeží.
