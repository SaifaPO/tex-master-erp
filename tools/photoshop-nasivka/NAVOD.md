# Nášivka / výšivka → biely kanál (W1) — skript do Photoshopu

Skript robí automaticky to, čo je vo videu: z hotového obrázka s efektom výšivky (napr. z ChatGPT) pripraví **spot kanál `W1`** (biela farba) a uloží **TIFF**, ktorý ide do RIPu.

Postup, ktorý skript nahrádza: Duplicate Layer → Filter → Stylize → Find Edges → Threshold → Magic Wand + Select Similar → New Spot Channel „W1" → File → Save → TIFF (Spot Colors + Layers).

## Príprava obrázka (raz pre každé logo)
1. Otvor obrázok z ChatGPT vo Photoshope.
2. **Odstráň pozadie** (vrstva musí mať priehľadné okolie, inak by biela farba išla aj mimo loga): Properties → **Remove Background**, prípadne Select → Subject → Layer Mask → Apply.
3. Ak chceš viac kusov na jednom hárku (vo videu 9×), skopíruj vrstvu a rozlož ich. **Vrstva s logom musí byť jedna** (po rozložení spoj: Ctrl+E). Nastav správnu veľkosť (Image → Image Size) a rozlíšenie podľa tlače.

## Inštalácia skriptu (jednorazovo)
1. Skopíruj súbor `NASIVKA_biely_kanal.jsx` do priečinka Photoshopu `Presets\Scripts` (napr. `C:\Program Files\Adobe\Adobe Photoshop 2025\Presets\Scripts`), reštartuj Photoshop. Potom ho máš v **File → Scripts → NASIVKA_biely_kanal**.
2. Alebo ho vždy spusti cez **File → Scripts → Browse…** a vyber súbor.

### Skratka na kláves (voliteľné)
1. Window → **Actions** → ikona „Create new action" → názov „Nášivka W1", **Function Key** napr. F9 → Record.
2. File → Scripts → Browse… → vyber `NASIVKA_biely_kanal.jsx` — skript sa spustí; v dialógu daj Zrušiť.
3. V paneli Actions klikni Stop. Odteraz F9 spustí skript.

## Použitie
1. Označ vrstvu s logom (panel Layers).
2. Spusti skript. Ak dokument nie je v CMYK, ponúkne prepnutie.
3. V dialógu nastav:
   - **Prah (Threshold)** – začni na 115 (vo videu 105–125). Vyšší prah = viac čiernej plochy.
   - **Kde bude biela farba** – „na čiernej ploche" (ako vo videu, hrany/stehy) alebo „na bielej ploche".
4. Skript vytvorí kanál `W1`. **Zelená plocha = tu pôjde biela farba** (farba kanála tlač neovplyvní, len ukazuje, kde kanál je).
5. Potvrdenie „Je to v poriadku?" → **Nie** vráti všetko späť a môžeš zadať iný prah; **Áno** pokračuje na uloženie.
6. Uloží sa TIFF (Spot Colors + Layers), pracovný dokument ostane otvorený.

## Čo ak niečo nejde
- Hlási „plocha pre bielu farbu je prázdna" → zmeň prah alebo prepni možnosť čierna/biela plocha.
- Biela farba je aj mimo loga → obrázok nemá priehľadné pozadie (krok 2 prípravy).
- RIP TIFF nenačíta → v hornej časti skriptu zmeň `TIFFEncoding.TIFFLZW` na `TIFFEncoding.NONE`.
- Iný názov kanála než `W1` (podľa RIPu) → v hornej časti skriptu zmeň `NAZOV_KANALA`.

> Skript je napísaný podľa postupu z videa, ale v tomto prostredí som ho nemohol spustiť vo Photoshope. Pri prvom použití ho skús na jednom logu a daj vedieť, ak niečo nesedí (verzia Photoshopu, správanie kanála) — upravím ho.
