@echo off
rem Vytvori naplanovanu ulohu: agent sa spusti (skryte) po kazdom prihlaseni do Windows.
cd /d "%~dp0"
for /f "delims=" %%i in ('where pythonw 2^>nul') do set PYW=%%i
if "%PYW%"=="" (
  echo Nenasiel som pythonw. Je Python nainstalovany a pridany do PATH?
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
pause
