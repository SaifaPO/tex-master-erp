// SOS tlačidlo pre stanice (šitie, kompletáž…) — ESP32 + veľké tlačidlo + LED + bzučiak.
// Po stlačení pošle v ERP žiadosť o pomoc (Edge Function sos-stanica); keď grafik v ERP klikne „Idem“, LED zasvieti nazeleno a bzučiak zapípa.
//   1 stisk  = Potrebujem pomoc      2 stisky = Chýba materiál      3 stisky = Chyba v grafike      dlhý stisk (3 s) = Nefunguje stroj
//
// Zapojenie (ESP32 DevKit):  tlačidlo medzi GPIO 4 a GND  |  červená LED (cez 330 Ω) GPIO 16  |  zelená LED (cez 330 Ω) GPIO 17  |  aktívny bzučiak GPIO 19
// Arduino IDE: doska „ESP32 Dev Module“, knižnice WiFi a HTTPClient sú súčasťou ESP32 balíka. Vyplň 4 riadky nižšie (Wi-Fi, adresa funkcie, token) a nahraj.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ===== NASTAVENIE =====
const char* WIFI_SSID = "NAZOV_WIFI";
const char* WIFI_HESLO = "HESLO_WIFI";
const char* FUNKCIA_URL = "https://<projekt>.supabase.co/functions/v1/sos-stanica";   // z ERP: PrintStudio → Nastavenia → SOS tlačidlá
const char* TOKEN = "TOKEN_Z_ERP";                                                    // token tohto tlačidla z ERP
// ======================

const int PIN_TLACIDLO = 4, PIN_CERVENA = 16, PIN_ZELENA = 17, PIN_BZUCIAK = 19;
const unsigned long OKNO_STLACENI_MS = 700;     // dokedy sa počítajú ďalšie stlačenia (dvojklik…)
const unsigned long DLHY_STISK_MS = 3000;
const unsigned long KONTROLA_STAVU_MS = 3000;   // ako často sa pýta, či grafik klikol „Idem“
const unsigned long TIMEOUT_MS = 15UL * 60 * 1000;
const unsigned long PING_MS = 60UL * 1000;

enum Stav { NECINNY, ODOSLANE, IDE };
Stav stav = NECINNY;
unsigned long odoslaneO = 0, poslednaKontrola = 0, poslednyPing = 0, ideO = 0;
int pocetStlaceni = 0; unsigned long poslednePustenie = 0, stlacenieZaciatok = 0; bool drzi = false, dlhyPoslany = false;

void pipni(int pocet, int ms = 120) { for (int i = 0; i < pocet; i++) { digitalWrite(PIN_BZUCIAK, HIGH); delay(ms); digitalWrite(PIN_BZUCIAK, LOW); delay(ms); } }
void ledky(bool c, bool z) { digitalWrite(PIN_CERVENA, c); digitalWrite(PIN_ZELENA, z); }

void pripojWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_HESLO);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) { ledky(millis() / 300 % 2, 0); delay(50); }
  ledky(0, 0);
}

// Zavolá funkciu; vráti telo odpovede (alebo prázdny reťazec pri chybe)
String zavolaj(const String& parametre) {
  pripojWifi();
  if (WiFi.status() != WL_CONNECTED) return "";
  WiFiClientSecure klient; klient.setInsecure();   // jednoduché overenie (token chráni volanie); pre prísnejšie nastav koreňový certifikát
  HTTPClient http;
  if (!http.begin(klient, String(FUNKCIA_URL) + "?t=" + TOKEN + parametre)) return "";
  http.setTimeout(8000);
  int kod = http.GET();
  String telo = kod > 0 ? http.getString() : "";
  http.end();
  return telo;
}

void odosli(const char* typ) {
  ledky(1, 1);
  String odp = zavolaj(String("&akcia=stlacenie&typ=") + typ);
  if (odp.indexOf("\"ok\":true") >= 0) {
    stav = ODOSLANE; odoslaneO = millis(); poslednaKontrola = 0;
    pipni(1, 200);       // potvrdenie: požiadavka odišla
  } else {
    pipni(3, 80);        // chyba (bez Wi-Fi alebo servera) — skús znova
    ledky(1, 0); delay(1500);
  }
}

void vyhodnotStlacenia() {
  if (pocetStlaceni == 1) odosli("pomoc");
  else if (pocetStlaceni == 2) odosli("material");
  else if (pocetStlaceni >= 3) odosli("grafika");
  pocetStlaceni = 0;
}

void setup() {
  pinMode(PIN_TLACIDLO, INPUT_PULLUP);
  pinMode(PIN_CERVENA, OUTPUT); pinMode(PIN_ZELENA, OUTPUT); pinMode(PIN_BZUCIAK, OUTPUT);
  ledky(0, 0);
  pripojWifi();
  pipni(2, 60);
}

void loop() {
  unsigned long teraz = millis();
  bool stlacene = digitalRead(PIN_TLACIDLO) == LOW;

  if (stlacene && !drzi) { drzi = true; dlhyPoslany = false; stlacenieZaciatok = teraz; }
  if (stlacene && drzi && !dlhyPoslany && teraz - stlacenieZaciatok >= DLHY_STISK_MS) {   // dlhý stisk = porucha stroja
    dlhyPoslany = true; pocetStlaceni = 0; pipni(1, 300); odosli("stroj");
  }
  if (!stlacene && drzi) {
    drzi = false;
    if (!dlhyPoslany && teraz - stlacenieZaciatok > 30) { pocetStlaceni++; poslednePustenie = teraz; }
    delay(30);
  }
  if (pocetStlaceni > 0 && !drzi && teraz - poslednePustenie > OKNO_STLACENI_MS) vyhodnotStlacenia();

  // Sledovanie odpovede z ERP
  if (stav == ODOSLANE) {
    ledky(0, 0); digitalWrite(PIN_CERVENA, (teraz / 600) % 2);      // červená bliká — čaká sa, kým niekto povie „Idem“
    if (teraz - poslednaKontrola > KONTROLA_STAVU_MS) {
      poslednaKontrola = teraz;
      String odp = zavolaj("&akcia=stav");
      if (odp.indexOf("\"stav\":\"ack\"") >= 0) { stav = IDE; ideO = millis(); ledky(0, 1); pipni(3, 120); }
      else if (odp.indexOf("\"stav\":\"resolved\"") >= 0) { stav = NECINNY; ledky(0, 0); }
    }
    if (teraz - odoslaneO > TIMEOUT_MS) { stav = NECINNY; ledky(0, 0); }
  } else if (stav == IDE) {
    ledky(0, 1);                                                    // zelená svieti — pomoc ide
    if (teraz - ideO > 5UL * 60 * 1000) { stav = NECINNY; ledky(0, 0); }
  }

  // Signál „žijem“ do ERP (kontrola, že tlačidlo je online)
  if (teraz - poslednyPing > PING_MS) { poslednyPing = teraz; zavolaj("&akcia=ping"); }
  delay(10);
}
