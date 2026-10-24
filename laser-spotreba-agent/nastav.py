"""Jednoduche nastavenie agenta: opyta sa na cestu k hotfolderu a zapise ju do config.json (token a adresa funkcie ostanu).
Spusta ho INSTALOVAT.bat. Vypisy su zamerne bez diakritiky (aby sa v okne Windows nezobrazovali zle)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
DEFAULT = {
    "hotfolder": "",
    "endpoint": "https://uqjzecxwmjtytjodhjxp.supabase.co/functions/v1/laser-spotreba-ingest",
    "token": "",
    "interval_sekund": 300,
    "stabilny_po_sekundach": 60,
    "jednotky": "auto",
    "import_dni_pri_prvom_spusteni": 0,
    "davka": 25,
}


def na_unc(cesta):
    """Ak je cesta na mapovanom sietovom disku (napr. Z:\\LASER), prepise ju na UNC (\\\\server\\zdielane\\LASER) — to funguje aj po restarte."""
    if os.name != "nt" or len(cesta) < 2 or cesta[1] != ":":
        return cesta
    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(1024)
        size = ctypes.c_ulong(1024)
        if ctypes.windll.mpr.WNetGetConnectionW(cesta[:2], buf, ctypes.byref(size)) == 0 and buf.value:
            return buf.value + cesta[2:]
    except Exception:
        pass
    return cesta


def main():
    cfg = dict(DEFAULT)
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    if not cfg.get("token"):
        print("CHYBA: v config.json chyba token. Skopiruj ho z ERP: Laser - spotreba metraze -> Nastavenia -> Token agenta.")
        cfg["token"] = input("Vloz token: ").strip()
        if not cfg["token"]:
            sys.exit(1)

    print()
    print("Kde je hotfolder s DXF subormi? Zadaj cestu, napr.  \\\\SERVER\\LASER   alebo   Z:\\LASER")
    print("(mozes ju skopirovat z adresneho riadku v Prieskumnikovi)")
    while True:
        zadane = input("Cesta k hotfolderu [" + (cfg.get("hotfolder") or "-") + "]: ").strip().strip('"')
        cesta = zadane or cfg.get("hotfolder", "")
        if not cesta:
            continue
        unc = na_unc(cesta)
        if unc != cesta and os.path.isdir(unc):
            cesta = unc          # sietova cesta funguje -> je spolahlivejsia nez pismeno disku
        elif unc != cesta and os.path.isdir(cesta):
            print("  Poznamka: pouzijem cestu s pismenom disku (" + cesta + "). Ak by sa po restarte PC disk nepripojil,")
            print("  agent to hlasi v agent.log a skusa znova kazdych 5 minut.")
        if os.path.isdir(cesta):
            break
        print("  Tento priecinok nevidim (" + cesta + "). Je PC pripojeny na siet? Skus znova (alebo zadaj spravnu cestu).")
    cfg["hotfolder"] = cesta
    pocet = sum(1 for _dp, _dn, fn in os.walk(cesta) for n in fn if n.lower().endswith(".dxf"))
    print("  OK, nasiel som tam " + str(pocet) + " DXF suborov.")

    print()
    print("Stare subory v hotfolderi sa do spotreby NEZAPOCITAJU (agent si ich len zapamata).")
    odp = input("Zapocitat aj subory z poslednych X dni? Zadaj cislo (0 = nie, len nove) [0]: ").strip()
    try:
        cfg["import_dni_pri_prvom_spusteni"] = max(0, int(odp)) if odp else 0
    except ValueError:
        cfg["import_dni_pri_prvom_spusteni"] = 0

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print()
    print("Nastavenie ulozene do config.json.")


if __name__ == "__main__":
    main()
