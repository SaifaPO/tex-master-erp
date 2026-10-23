@echo off
schtasks /end /tn "TEX-MASTER Laser spotreba agent" >nul 2>&1
schtasks /delete /tn "TEX-MASTER Laser spotreba agent" /f
echo Hotovo.
pause
