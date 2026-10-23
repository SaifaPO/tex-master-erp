"""
Agent: spotreba metráže z laserového hotfoldera.

Beží na jednom PC v sieti. Každých pár minút prezrie hotfolder s DXF súbormi na rezanie, z každého NOVÉHO súboru prečíta rozmer
rozloženia (bounding box všetkých entít), dĺžku rezu a počet dielov a pošle to do ERP (Supabase funkcia laser-spotreba-ingest).
Z názvu súboru rozparsuje zákazku, farbu, materiál atď. až server — agent posiela len surový názov a rozmery.

Súbory v hotfolderi zostávajú, preto si agent pamätá spracované súbory (cesta + veľkosť + čas zmeny) v súbore stav.db a nič nepošle dvakrát.
Po vypnutí PC dobehne všetko, čo medzitým pribudlo. Pri úplne prvom spustení sa staré súbory len "zapamätajú" (nepočítajú sa do spotreby),
pokiaľ v config.json nenastavíš import_dni_pri_prvom_spusteni.

Použitie:
    python agent.py                       beží stále (slučka každých interval_sekund)
    python agent.py --raz                 jeden prechod a koniec
    python agent.py --test subor.dxf ...  len vypíše rozmery súborov (nič neposiela) — na overenie jednotiek a osi dĺžky
"""
import hashlib
import json
import logging
import math
import os
import socket
import sqlite3
import sys
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

import requests
import ezdxf
from ezdxf import bbox, path as ezpath
from ezdxf import recover

VERZIA = "1.0"
HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
DB_PATH = os.path.join(HERE, "stav.db")
LOG_PATH = os.path.join(HERE, "agent.log")

DEFAULT_CONFIG = {
    "hotfolder": "\\\\SERVER\\LASER",
    "endpoint": "https://uqjzecxwmjtytjodhjxp.supabase.co/functions/v1/laser-spotreba-ingest",
    "token": "",
    "interval_sekund": 300,
    "stabilny_po_sekundach": 60,
    "jednotky": "auto",
    "import_dni_pri_prvom_spusteni": 0,
    "davka": 25,
}

# $INSUNITS -> koľko cm je jedna jednotka výkresu
INSUNITS_NA_CM = {1: 2.54, 2: 30.48, 4: 0.1, 5: 1.0, 6: 100.0}

log = logging.getLogger("laser-agent")


def nastav_log():
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s  %(message)s", "%d.%m.%Y %H:%M:%S")
    fh = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    log.addHandler(fh)
    if sys.stdout and sys.stdout.isatty():
        sh = logging.StreamHandler()
        sh.setFormatter(fmt)
        log.addHandler(sh)


def nacitaj_config():
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
        print(f"Vytvoril som {CONFIG_PATH}. Otvor ho, doplň 'hotfolder' a 'token' a spusti agenta znova.")
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = {**DEFAULT_CONFIG, **json.load(f)}
    return cfg


# ---------------------------------------------------------------- DXF
def dlzka_cesty(p, tolerancia=0.05):
    pts = list(p.flattening(tolerancia))
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def prechadzaj(entity, hlbka=0):
    """Vráti entity vrátane obsahu blokov (INSERT)."""
    if entity.dxftype() == "INSERT" and hlbka < 5:
        try:
            for v in entity.virtual_entities():
                yield from prechadzaj(v, hlbka + 1)
        except Exception:
            return
    else:
        yield entity


def analyzuj_dxf(cesta, jednotky="auto"):
    """Vráti dict: bbox_x_cm, bbox_y_cm, dielov, dlzka_rezu_cm, info (alebo vyhodí výnimku)."""
    try:
        doc = ezdxf.readfile(cesta)
    except (ezdxf.DXFStructureError, UnicodeDecodeError, ezdxf.DXFVersionError):
        doc, _ = recover.readfile(cesta)
    msp = doc.modelspace()
    ext = bbox.extents(msp)
    if not ext.has_data:
        raise ValueError("výkres je prázdny (žiadne entity)")
    dx, dy = ext.size.x, ext.size.y

    ins = doc.header.get("$INSUNITS", 0)
    if jednotky == "cm":
        faktor, info = 1.0, "cm (nastavené)"
    elif jednotky == "mm":
        faktor, info = 0.1, "mm (nastavené)"
    elif ins in INSUNITS_NA_CM:
        faktor, info = INSUNITS_NA_CM[ins], f"INSUNITS={ins}"
    elif max(dx, dy) > 1000:
        faktor, info = 0.1, "odhad: mm (rozmer > 1000)"
    else:
        faktor, info = 1.0, "odhad: cm"

    dielov, dlzka = 0, 0.0
    for e in msp:
        for p in prechadzaj(e):
            try:
                cesta_e = ezpath.make_path(p)
            except Exception:
                continue
            try:
                d = dlzka_cesty(cesta_e)
            except Exception:
                continue
            if d > 0:
                dielov += 1
                dlzka += d
    return {
        "bbox_x_cm": round(dx * faktor, 2),
        "bbox_y_cm": round(dy * faktor, 2),
        "dielov": dielov,
        "dlzka_rezu_cm": round(dlzka * faktor, 1),
        "info": info,
    }


def sha256_suboru(cesta):
    h = hashlib.sha256()
    with open(cesta, "rb") as f:
        for blok in iter(lambda: f.read(1024 * 1024), b""):
            h.update(blok)
    return h.hexdigest()


# ---------------------------------------------------------------- stav
def otvor_db():
    db = sqlite3.connect(DB_PATH)
    db.execute("create table if not exists subory (cesta text primary key, velkost integer, mtime real, hash text, odoslane integer, ts real)")
    db.execute("create table if not exists meta (k text primary key, v text)")
    return db


def uz_spracovane(db, cesta, velkost, mtime):
    r = db.execute("select velkost, mtime from subory where cesta=?", (cesta,)).fetchone()
    return bool(r) and r[0] == velkost and abs(r[1] - mtime) < 1


def zapamataj(db, cesta, velkost, mtime, h, odoslane=1):
    db.execute("insert or replace into subory (cesta, velkost, mtime, hash, odoslane, ts) values (?,?,?,?,?,?)", (cesta, velkost, mtime, h, odoslane, time.time()))


def najdi_dxf(koren):
    for dp, _dn, fn in os.walk(koren):
        for n in fn:
            if n.lower().endswith(".dxf") and not n.startswith("~"):
                yield os.path.join(dp, n)


# ---------------------------------------------------------------- odosielanie
def posli(cfg, akcia, **extra):
    r = requests.post(
        cfg["endpoint"],
        json={"akcia": akcia, "agent": f"{socket.gethostname()} v{VERZIA}", **extra},
        headers={"x-agent-token": cfg["token"]},
        timeout=60,
    )
    try:
        data = r.json()
    except Exception:
        data = {"ok": False, "error": r.text[:200]}
    if r.status_code != 200 or not data.get("ok"):
        raise RuntimeError(f"ERP odmietlo požiadavku ({r.status_code}): {data.get('error')}")
    return data


def jeden_prechod(cfg, db):
    koren = cfg["hotfolder"]
    if not os.path.isdir(koren):
        raise RuntimeError(f"Hotfolder nie je dostupný: {koren} (je PC pripojený na sieť?)")
    prvy_beh = db.execute("select v from meta where k='baseline'").fetchone() is None
    hranica_importu = time.time() - cfg["import_dni_pri_prvom_spusteni"] * 86400
    nove, zapamatane = [], 0
    for cesta in najdi_dxf(koren):
        try:
            st = os.stat(cesta)
        except OSError:
            continue
        if uz_spracovane(db, cesta, st.st_size, st.st_mtime):
            continue
        if prvy_beh and st.st_mtime < hranica_importu:
            zapamataj(db, cesta, st.st_size, st.st_mtime, None, odoslane=0)
            zapamatane += 1
            continue
        if time.time() - st.st_mtime < cfg["stabilny_po_sekundach"]:
            continue  # súbor sa ešte ukladá
        nove.append((cesta, st))
    if prvy_beh:
        db.execute("insert or replace into meta (k, v) values ('baseline', ?)", (datetime.now().isoformat(),))
        db.commit()
        log.info("Prvé spustenie: %d existujúcich súborov som si len zapamätal (nepočítajú sa do spotreby).", zapamatane)

    odoslane = 0
    davka = []
    def spusti_davku():
        nonlocal davka, odoslane
        if not davka:
            return
        odp = posli(cfg, "subory", subory=[d["_polozka"] for d in davka])
        for d in davka:
            zapamataj(db, d["_cesta"], d["_velkost"], d["_mtime"], d["_polozka"]["hash"])
        db.commit()
        odoslane += len(davka)
        log.info("Odoslaných %d súborov (nových v ERP: %s).", len(davka), odp.get("vlozene"))
        davka = []

    for cesta, st in sorted(nove, key=lambda x: x[1].st_mtime):
        try:
            h = sha256_suboru(cesta)
        except OSError as e:
            log.info("Súbor sa nedá prečítať, skúsim neskôr: %s (%s)", cesta, e)
            continue
        polozka = {
            "nazov": os.path.basename(cesta),
            "cesta": os.path.relpath(cesta, koren).replace("\\", "/"),
            "hash": h,
            "velkost": st.st_size,
            "zmena": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
        }
        try:
            a = analyzuj_dxf(cesta, cfg["jednotky"])
            polozka.update({k: a[k] for k in ("bbox_x_cm", "bbox_y_cm", "dielov", "dlzka_rezu_cm")})
            log.info("%s: %.1f × %.1f cm, %d dielov, rez %.0f cm (%s)", polozka["nazov"], a["bbox_x_cm"], a["bbox_y_cm"], a["dielov"], a["dlzka_rezu_cm"], a["info"])
        except Exception as e:
            polozka["chyba"] = str(e)[:200]
            log.info("%s: chyba čítania DXF: %s", polozka["nazov"], e)
        davka.append({"_polozka": polozka, "_cesta": cesta, "_velkost": st.st_size, "_mtime": st.st_mtime})
        if len(davka) >= cfg["davka"]:
            spusti_davku()
    spusti_davku()
    db.commit()
    if not odoslane:
        posli(cfg, "ping")
    return odoslane


def main():
    nastav_log()
    if "--test" in sys.argv:
        cfg = {**DEFAULT_CONFIG, **(json.load(open(CONFIG_PATH, encoding="utf-8")) if os.path.exists(CONFIG_PATH) else {})}
        for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
            try:
                a = analyzuj_dxf(f, cfg["jednotky"])
                print(f"{os.path.basename(f)}\n   rozmer: {a['bbox_x_cm']} × {a['bbox_y_cm']} cm (x × y)   dielov: {a['dielov']}   dĺžka rezu: {a['dlzka_rezu_cm']} cm   jednotky: {a['info']}")
            except Exception as e:
                print(f"{os.path.basename(f)}\n   CHYBA: {e}")
        return
    cfg = nacitaj_config()
    if not cfg["token"]:
        print("V config.json chýba 'token' (nájdeš ho v ERP: PrintStudio → Laser – spotreba metráže → Nastavenia).")
        sys.exit(1)
    db = otvor_db()
    log.info("Agent %s spustený. Hotfolder: %s, interval %ss.", VERZIA, cfg["hotfolder"], cfg["interval_sekund"])
    while True:
        try:
            jeden_prechod(cfg, db)
        except Exception as e:
            log.info("Chyba: %s", e)
        if "--raz" in sys.argv:
            break
        time.sleep(max(30, int(cfg["interval_sekund"])))


if __name__ == "__main__":
    main()
