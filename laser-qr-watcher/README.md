# Kamera pri laseri — automatická fotokontrola

Sleduje obraz z kamery pri laseri, rozpozná QR kód zo sprievodného listu zákazky,
počká kým sa látka zastaví, urobí pár fotiek a nahrá ich do ERP na kontrolu.
Nikto nič ručne nefotí — beží to samo, pokiaľ je appka spustená.

## Dôležité — aká kamera

**Kúp bežnú USB webkameru (USB kábel priamo do počítača), nie kameru cez Bluetooth.**
Bluetooth sa dnes v praxi používa len na ovládanie kamery (spúšť), nie na prenos živého
videa — na to nemá dostatočnú rýchlosť. Živý obraz vo vysokom rozlíšení potrebuje buď
USB kábel, alebo WiFi/sieťovú (IP) kameru. USB webkamera (pokojne 2K/4K, značka SVIS aj
väčšina iných bežných webkamier funguje) je najjednoduchšia — zapojíš, systém ju
rozpozná ako bežnú kameru, appka ju hneď vidí. Ak by si predsa len chcel bezdrôtovú
kameru, povedz mi to vopred — vtedy treba iný spôsob pripojenia v appke (RTSP/sieťová
adresa kamery namiesto čísla USB kamery).

## Krok 1 — Nainštaluj Python (ak ešte nie je na tom počítači, kde beží laser)

1. Choď na [python.org/downloads](https://www.python.org/downloads/) a stiahni najnovšiu verziu pre Windows.
2. Pri inštalácii **zaškrtni "Add python.exe to PATH"** (dôležité, dole na prvej obrazovke inštalátora), potom Install Now.

## Krok 2 — Skopíruj tento priečinok na počítač pri laseri

Skopíruj celý priečinok `laser-qr-watcher` (aj s `watcher.py` a `requirements.txt`) na počítač, ktorý ovláda laser — napr. na plochu.

## Krok 3 — Nainštaluj potrebné knižnice

1. V priečinku `laser-qr-watcher` klikni v paneli s adresou (hore v Prieskumníkovi) a napíš `cmd`, potom Enter — otvorí sa čierne okno príkazového riadku priamo v tomto priečinku.
2. Napíš a spusti:

```bash
pip install -r requirements.txt
```

## Krok 4 — Získaj prístupové údaje k Supabase (opýtaj sa ma, dám ti presné hodnoty)

Appka potrebuje dva údaje, ktoré nájdeš v Supabase dashboarde projektu tohto ERP (Settings → API):
- **Project URL** (napr. `https://xxxxx.supabase.co`)
- **service_role key** (tajný kľúč — nezdieľaj ho nikomu mimo tohto účelu, má plný prístup)

## Krok 5 — Prvé spustenie a nastavenie

1. V tom istom čiernom okne (príkazový riadok v priečinku `laser-qr-watcher`) spusti:

```bash
python watcher.py
```

2. Prvýkrát vytvorí súbor `config.json` a appka sa hneď ukončí s hláškou, že treba doplniť údaje.
3. Otvor `config.json` (dvojklikom, otvorí sa v Poznámkovom bloku) a doplň:
   - `supabase_url` — Project URL z kroku 4
   - `supabase_service_key` — service_role key z kroku 4
   - `camera_index` — nechaj `0` (ak by appka otvorila zlú kameru, skús `1`, `2`...)
4. Ulož a spusti appku znova (`python watcher.py`).
5. Malo by sa otvoriť okno so živým obrazom z kamery. Ukáž jej vytlačený QR kód zo sprievodného listu — keď ho appka rozpozná, obkreslí ho zeleným rámčekom a za chvíľu (podľa `settle_delay_seconds` v `config.json`) urobí fotky a v konzole napíše potvrdenie.

## Krok 6 — Aby sa appka spúšťala automaticky s laserom

Najjednoduchšie: vytvor v priečinku `laser-qr-watcher` súbor `spustit.bat` s týmto obsahom:

```bat
cd /d "%~dp0"
python watcher.py
```

a jeho odkaz (pravý klik → Vytvoriť odkaz) presuň do priečinka, ktorý sa otvorí príkazom `shell:startup` (napíš to do vyhľadávania vo Windows a Enter) — appka sa potom spustí automaticky pri zapnutí počítača. Ak chceš, aby sa spúšťala presne s laserovým softvérom (nie hneď pri zapnutí PC), daj mi vedieť, akým programom sa laser ovláda — dá sa to prepojiť aj na jeho spustenie.

## Nastavenia v config.json

| Kľúč | Význam |
|---|---|
| `camera_index` | Ktorá kamera sa má použiť, ak je ich pripojených viac (0, 1, 2...) |
| `photos_per_capture` | Koľko fotiek sa urobí pri jednom rozpoznaní QR kódu |
| `settle_delay_seconds` | Ako dlho počkať po rozpoznaní QR kódu pred fotením (nech sa látka stihne zastaviť a obraz doostriť) |
| `cooldown_seconds` | Ako dlho appka ignoruje ten istý QR kód, aby nefotila znova a znova, kým visí pred kamerou |
| `show_preview_window` | `true` = vidíš živý obraz na obrazovke (dobré na ladenie), `false` = beží na pozadí bez okna |

## Kde sa fotky objavia

V ERP pribudne (v ďalšom kroku, ktorý spravím) prehľad "Kontrola z lasera" — zoznam
posledných odfotených položiek s fotkami, kde ich grafik/majster odklikne ako
skontrolované. Zatiaľ sú fotky a záznamy uložené v Supabase, appka len potvrdzuje
úspešné nahranie v konzole.
