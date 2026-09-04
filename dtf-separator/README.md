# DTF/DTG Separátor

Interný nástroj na halftone/farebnú separáciu pre DTF a DTG tlač. Samostatná appka, oddelená od
TEX-MASTER ERP a od PrintStudio Pro — vlastný Vite build, vlastný Vercel deploy.

## Fáza 1 (hotovo)

- Upload PNG/JPG, canvas náhľad
- Jednofarebný (spot color) halftone: LPI 15–55, uhol rastra, tvar bodu (kruh/elipsa/diamant/štvorec/línia)
- 3 algoritmy: AM raster (rastúci bod), ordered dithering (Bayer matica), error diffusion (Floyd-Steinberg)
- Levels (čierny/biely bod) + invertovanie
- Náhľad: Original / Separácia / Split View (posuvník)
- Export PNG v plnom rozlíšení
- Stiahnuteľný LPI test sheet na kalibráciu s reálnou tlačiarňou
- Jednoduchý zdieľaný prístupový kód (bez užívateľských účtov) — `VITE_ACCESS_CODE` v `.env`

## Vývoj

```bash
npm install
npm run dev
```

## Prístupový kód

Nastav v `.env` (nie je v gite):

```
VITE_ACCESS_CODE=tvoj-kod
```

Zapamätá sa len v prehliadači, kde bol raz zadaný (localStorage) — iné zariadenie/prehliadač
si ho vypýta znova. Nie je to skutočná autentifikácia (nie sú tam účty jednotlivých ľudí),
len jednoduchá zábrana proti tomu, aby niekto vzal appku a používal ju mimo firmy.

## Ďalšie fázy (podľa brief-u)

2. Viacfarebná separácia (CMYK/simulovaný proces) + white underbase výpočet
3. Anti-haze spracovanie okrajov + presety pre konkrétne zariadenia (Supabase)
4. PSD export (`ag-psd`) + prepojenie na TEX-MASTER ERP
