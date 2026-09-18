"""
Kamera pri laseri — sleduje obraz, a keď v ňom uvidí QR kód zo sprievodného listu
zákazky (rovnaký kód ako v ERP na tlačidle "Sprievodka"), počká chvíľu (kým sa
látka pod laserom zastaví a obraz sa doostrí) a urobí niekoľko fotiek. Tie sa
nahrajú do Supabase (rovnaké úložisko, aké ERP používa pre iné prílohy) a
vytvorí sa záznam, ktorý sa objaví v ERP na kontrolu (grafik/majster).

Žiadne ručné fotenie zamestnancami — celé to beží samo, pokiaľ je táto appka spustená.
"""

import io
import json
import os
import time
import urllib.parse
from datetime import datetime, timezone

import cv2
from supabase import create_client

# --- NASTAVENIA — uprav podľa potreby, alebo nechaj tak a nastav cez config.json (pozri README.md) ---
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_CONFIG = {
    "supabase_url": "",
    "supabase_service_key": "",
    "camera_index": 0,
    "photos_per_capture": 3,
    "settle_delay_seconds": 1.2,
    "delay_between_photos_seconds": 0.3,
    "cooldown_seconds": 15,
    "show_preview_window": True,
    "storage_bucket": "item-attachments",
}


def load_config():
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
        print(f"Vytvoril som {CONFIG_PATH} — vyplň tam supabase_url a supabase_service_key a appku spusti znova.")
        raise SystemExit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = {**DEFAULT_CONFIG, **json.load(f)}
    if not cfg["supabase_url"] or not cfg["supabase_service_key"]:
        print("V config.json chýba supabase_url alebo supabase_service_key — doplň ich a spusti znova.")
        raise SystemExit(1)
    return cfg


def extract_item_id(decoded_text):
    """QR kód na sprievodnom liste obsahuje URL v tvare .../?scan=POLOZKA-ID. Vytiahne len POLOZKA-ID."""
    if not decoded_text:
        return None
    try:
        query = urllib.parse.urlparse(decoded_text).query
        params = urllib.parse.parse_qs(query)
        if "scan" in params and params["scan"]:
            return params["scan"][0]
    except Exception:
        pass
    # Ak niekto naskenuje kód, ktorý nie je URL (napr. len holé ID), použi to priamo.
    return decoded_text.strip() or None


def upload_and_record(supabase, cfg, item_id, frames):
    photo_urls = []
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    safe_item_id = "".join(c for c in item_id if c.isalnum() or c in "-_") or "neznama-polozka"
    for i, frame in enumerate(frames, start=1):
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            continue
        path = f"laser-kontrola/{safe_item_id}/{stamp}-{i}.jpg"
        supabase.storage.from_(cfg["storage_bucket"]).upload(
            path, io.BytesIO(buf.tobytes()).read(), {"content-type": "image/jpeg"}
        )
        public_url = supabase.storage.from_(cfg["storage_bucket"]).get_public_url(path)
        photo_urls.append(public_url)

    supabase.table("laser_scan_checks").insert({
        "item_id": item_id,
        "photos": photo_urls,
        "status": "pending",
    }).execute()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Odfotené a nahrané: {item_id} ({len(photo_urls)} fotiek)")


def main():
    cfg = load_config()
    supabase = create_client(cfg["supabase_url"], cfg["supabase_service_key"])

    cap = cv2.VideoCapture(cfg["camera_index"])
    if not cap.isOpened():
        print(f"Nepodarilo sa otvoriť kameru (camera_index={cfg['camera_index']}). Skús iné číslo v config.json (0, 1, 2...).")
        raise SystemExit(1)

    detector = cv2.QRCodeDetector()
    last_item_id = None
    last_capture_time = 0.0

    print("Sledovanie spustené. Ukáž QR kód kamere — ak funguje, uvidíš hlásenie tu v konzole.")
    print("Zastavíš klávesom Q (ak beží náhľadové okno) alebo Ctrl+C v konzole.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.2)
                continue

            decoded_text, points, _ = detector.detectAndDecode(frame)
            now = time.time()

            if decoded_text:
                item_id = extract_item_id(decoded_text)
                cooldown_elapsed = (now - last_capture_time) > cfg["cooldown_seconds"]
                is_new_item = item_id != last_item_id
                if item_id and (is_new_item or cooldown_elapsed):
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] QR rozpoznaný: {item_id} — čakám {cfg['settle_delay_seconds']}s a fotím...")
                    time.sleep(cfg["settle_delay_seconds"])
                    frames = []
                    for _ in range(cfg["photos_per_capture"]):
                        ok2, shot = cap.read()
                        if ok2:
                            frames.append(shot)
                        time.sleep(cfg["delay_between_photos_seconds"])
                    if frames:
                        try:
                            upload_and_record(supabase, cfg, item_id, frames)
                        except Exception as e:
                            print(f"Chyba pri nahrávaní/ukladaní: {e}")
                    last_item_id = item_id
                    last_capture_time = time.time()

            if cfg["show_preview_window"]:
                display = frame.copy()
                if decoded_text and points is not None:
                    pts = points.astype(int).reshape(-1, 2)
                    for j in range(len(pts)):
                        cv2.line(display, tuple(pts[j]), tuple(pts[(j + 1) % len(pts)]), (0, 255, 0), 3)
                    cv2.putText(display, decoded_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.imshow("Laser QR kontrola (Q = koniec)", display)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
