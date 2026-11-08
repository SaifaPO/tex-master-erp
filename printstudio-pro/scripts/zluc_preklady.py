# Spojí ručné preklady scripts/_pr/p*.txt (idx|en|de, "=" = nechať pôvodný text) a q*.txt (sk|en|de) do src/i18n/slovnik-{en,de}.json.
import json, glob
z = json.load(open('scripts/_texty.json', encoding='utf-8'))
en, de = {}, {}
for f in sorted(glob.glob('scripts/_pr/p*.txt')):
    for r in open(f, encoding='utf-8').read().split('\n'):
        if not r.strip(): continue
        p = r.split('|')
        if len(p) < 3 or not p[0].isdigit(): print('chyba riadok', f, r[:60]); continue
        k = z[int(p[0])]; a = p[1]; b = '|'.join(p[2:])
        if a != '=': en[k] = a
        if b != '=': de[k] = b
for f in sorted(glob.glob('scripts/_pr/q*.txt')):
    for r in open(f, encoding='utf-8').read().split('\n'):
        if not r.strip(): continue
        p = r.split('|')
        if len(p) < 3: print('chyba riadok', f, r[:60]); continue
        k = ' '.join(p[0].split()); en[k] = p[1]; de[k] = '|'.join(p[2:])
for nm, d in (('en', en), ('de', de)):
    try: old = json.load(open(f'src/i18n/slovnik-{nm}.json', encoding='utf-8'))
    except Exception: old = {}
    old.update(d)
    json.dump(dict(sorted(old.items())), open(f'src/i18n/slovnik-{nm}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(nm, len(old))
