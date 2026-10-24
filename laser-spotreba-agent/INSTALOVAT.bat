@echo off
rem Instalacia agenta "Laser - spotreba metraze" na PC pri laseri. Staci dvojklik. Vypisy su bez diakritiky (kvoli oknu Windows).
cd /d "%~dp0"
title Instalacia agenta - Laser spotreba metraze
echo.
echo ===== Instalacia agenta: Laser - spotreba metraze =====
echo.

set PY=
where py >nul 2>&1 && set PY=py -3
if not defined PY ( where python >nul 2>&1 && set PY=python )
if not defined PY goto nopython
%PY% --version >nul 2>&1
if errorlevel 1 goto nopython

echo [1/4] Instalujem potrebne kniznice (potrebuje internet)...
%PY% -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto chyba

echo.
echo [2/4] Nastavenie hotfoldera
%PY% nastav.py
if errorlevel 1 goto chyba

echo.
echo [3/4] Prvy prechod: agent si zapamata existujuce subory (nepocitaju sa do spotreby)...
%PY% agent.py --raz
if errorlevel 1 goto chyba
echo Hotovo. Podrobnosti su v subore agent.log

echo.
echo [4/4] Spustanie agenta po kazdom prihlaseni do Windows...
call nainstalovat_autostart.bat z_instalatora
goto koniec

:nopython
echo Python nie je nainstalovany (alebo nie je v PATH).
where winget >nul 2>&1
if errorlevel 1 goto manualpython
echo Skusam ho nainstalovat automaticky cez winget...
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
echo.
echo Ak sa instalacia podarila, ZAVRI toto okno a spusti INSTALOVAT.bat este raz.
pause
exit /b 0
:manualpython
echo Stiahni a nainstaluj Python z https://www.python.org/downloads/
echo DOLEZITE: na prvej obrazovke instalatora zaskrtni "Add python.exe to PATH".
echo Potom spusti INSTALOVAT.bat este raz.
pause
exit /b 1

:chyba
echo.
echo Nieco sa nepodarilo (pozri hlasku vyssie). Posli mi screenshot tohto okna.
pause
exit /b 1

:koniec
echo.
echo ===== Instalacia dokoncena =====
echo Agent bezi na pozadi. V ERP (Laser - spotreba metraze) uvidis "agent na PC: online".
pause
