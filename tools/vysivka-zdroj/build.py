"""Zostaví jeden súbor public/apps/vysivka/index.html zo zdrojov (app.html + engine.js + fonts.css + ukážkové logo).
Spustenie z priečinka zdroj:  python3 build.py"""
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
logo = base64.b64encode(open(os.path.join(here, 'ukazka-logo.png'), 'rb').read()).decode()
out = rd('app.html').replace('/*FONTS*/', rd('fonts.css')).replace('/*ENGINE*/', rd('engine.js')).replace('__LOGO__', 'data:image/png;base64,' + logo)
dst = os.path.join(here, '..', '..', 'public', 'apps', 'vysivka', 'index.html')
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'w', encoding='utf-8').write(out)
print('OK', len(out) // 1024, 'KB ->', os.path.normpath(dst))
