@echo off
rem Vytvori naplanovanu ulohu: agent sa spusti (skryte, bez okna) po kazdom prihlaseni do Windows a hned sa aj spusti.
cd /d "%~dp0"
set PYW=
for /f "delims=" %%i in ('where pythonw 2^>nul') do if not defined PYW set PYW=%%i
if not defined PYW for /f "delims=" %%i in ('py -3 -c "import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))" 2^>nul') do set PYW=%%i
if not defined PYW (
  echo Nenasiel som pythonw. Je Python nainstalovany?
  pause
  exit /b 1
)
schtasks /create /tn "TEX-MASTER Laser spotreba agent" /tr "\"%PYW%\" \"%~dp0agent.py\"" /sc onlogon /f
if errorlevel 1 (
  echo Vytvorenie ulohy zlyhalo.
  pause
  exit /b 1
)
echo.
echo Hotovo. Agent sa spusti po kazdom prihlaseni do Windows.
echo Prave teraz ho spustim aj hned.
schtasks /run /tn "TEX-MASTER Laser spotreba agent"
if not "%1"=="z_instalatora" pause
