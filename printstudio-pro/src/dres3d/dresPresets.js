// Statické vizuálne šablóny 3D konfigurátora dresov — vzory, goliere, preset palety,
// rýchle farby a tvary klubového znaku. Nie sú to obchodné dáta (tie sú v Supabase),
// len kresliace/UI šablóny prevzaté 1:1 z 3d_konfigurator_dresov.html.

export const VSETKY_VZORY = [
  { id: 'stripes', nazov: 'Zvislé Pruhy', icon: 'M4 4h4v16H4zm6 0h4v16h-4zm6 0h4v16h-4z' },
  { id: 'hoops', nazov: 'Vodorovné Pásy', icon: 'M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z' },
  { id: 'sash', nazov: 'Šikmý Pás', icon: 'M4 4l16 16h-4L4 8zm8-4l8 8v-4l-4-4z' },
  { id: 'honeycomb', nazov: 'Hexagon Vzor', icon: 'M12 2l4 2.5v5L12 12l-4-2.5v-5z M4 9l4 2.5v5L4 19l-4-2.5v-5z' },
  { id: 'chevron', nazov: 'Modern Chevron', icon: 'M4 8l8 5 8-5v4l-8 5-8-5zm0-6l8 5 8-5v4l-8 5-8-5z' },
  { id: 'gradient', nazov: 'Gradient Fade', icon: 'M4 4h16v16H4z' },
  { id: 'modern', nazov: 'Glitch / Digital', icon: 'M4 4h6v6H4zm8 4h8v4h-8zm-4 6h10v6H8z' },
  { id: 'camo', nazov: 'Polygon Camo', icon: 'M2 4l6 4-3 6 8-2 3 6 6-8-4-4z' },
  { id: 'plain', nazov: 'Hladký Minimal', icon: 'M4 4h16v16H4z' },
];

// Model má golier fyzicky vymodelovaný ako okrúhly (súčasť 3D strihu, nie len farba/textúra) —
// V-výstrih by vyzeral rovnako okrúhlo, len prefarbený, čo by zákazníka zbytočne zmiatlo. Preto
// je zatiaľ len jedna funkčná možnosť; V-výstrih pridáme až s modelom, ktorý ho má skutočne
// vymodelovaný (viď poznámka pre Martina).
export const VSETKY_GOLIERE = [
  { id: 'round', nazov: 'Okrúhly' },
];

export const PRESET_PALETY = [
  { nazov: 'Kráľovský Madrid', base: '#ffffff', pattern: '#f59e0b', accent: '#1e3a8a', sleeves: '#ffffff', collar: '#1e3a8a' },
  { nazov: 'Barcelona Blaugrana', base: '#1e3a8a', pattern: '#991b1b', accent: '#f59e0b', sleeves: '#1e3a8a', collar: '#f59e0b' },
  { nazov: 'Miláno Čierno-červená', base: '#0f172a', pattern: '#dc2626', accent: '#ffffff', sleeves: '#0f172a', collar: '#dc2626' },
  { nazov: 'Dortmund Neon Žltá', base: '#facc15', pattern: '#0f172a', accent: '#ffffff', sleeves: '#0f172a', collar: '#0f172a' },
];

export const RYCHLE_FARBY = ['#ffffff', '#000000', '#dc2626', '#1e3a8a', '#2563eb', '#16a34a', '#facc15', '#f97316', '#9333ea', '#06b6d4'];

// Tvary pre generátor "blank" klubového znaku — zákazník napíše vlastný text (napr. "FC
// TORNAĽA") a vyberie tvar, do ktorého sa text vykreslí. Nahrádza pôvodné emoji-erby.
export const ERB_TVARY = [
  { id: 'kruh', nazov: 'Kruh' },
  { id: 'stit', nazov: 'Štít' },
  { id: 'erb', nazov: 'Erb' },
  { id: 'ovál', nazov: 'Ovál' },
];

// Pozície voliteľného čísla na hrudi — zákazník si vyberie, kam presne má číslo ísť, keďže
// môže kolidovať so znakom na srdci alebo logom sponzora v strede.
export const POZICIE_CISLA_VPREDU = [
  { id: 'stred', nazov: 'V strede hrudi' },
  { id: 'pod_erb', nazov: 'Pod znakom na srdci' },
  { id: 'pod_logo', nazov: 'Pod logom v strede' },
];

// Pozície predného loga (logo_pred) — vždy zobrazené, len sa dá presunúť.
export const POZICIE_LOGA_PRED = [
  { id: 'zaklad', nazov: 'Oproti srdcu (pôvodné miesto)' },
  { id: 'zaklad_vyssie', nazov: 'Oproti srdcu, vyššie (ak je pod ním číslo)' },
  { id: 'stred', nazov: 'V strede hrudi' },
  { id: 'stred_vyssie', nazov: 'V strede hrudi, vyššie' },
];

export const VELKOSTI_FALLBACK = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

export const GOOGLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Inter:wght@400;500;600;700;800&family=Oswald:wght@500;700&family=Teko:wght@600;700&display=swap';

export const DEFAULT_CONFIG_STATE = {
  vzor: 'stripes',
  farby: {
    zakladna: '#1e3a8a',
    vzor: '#dc2626',
    akcent: '#f59e0b',
    rukava: '#1e3a8a',
    golier: '#ffffff',
  },
  text: {
    menoHraca: 'RONALDO',
    zobrazitMeno: true,
    cisloHraca: '7',
    zobrazitCislo: true,
    cisloVpredu: true,
    cisloVzadu: true,
    cisloVpreduPozicia: 'stred',
    fontRodina: 'Teko',
    farbaTextu: '#ffffff',
    farbaObrysu: '#000000',
    obrysZapnuty: true,
    obrysHrubkaMm: 3,
    pismenaMedzeraPx: 0,
    timText: 'FLY EMIRATES',
    zobrazitTimText: true,
    napisPodCislom: '',
    zobrazitNapisPodCislom: false,
  },
  // Číslo dresu má vlastné, od mena/nápisov nezávislé farby — výplň + až dva samostatné obrysy
  // (napr. biele číslo, čierny vnútorný obrys, farebný vonkajší obrys).
  cislo: {
    farbaVypln: '#ffffff',
    farbaObrys1: '#000000',
    obrys1HrubkaMm: 3,
    zobrazitObrys2: false,
    farbaObrys2: '#f59e0b',
    obrys2HrubkaMm: 2,
  },
  loga: {
    typErbu: 'kruh',
    erbText: 'FC TÍM',
    vlastnyErbImg: null,
    zobrazitErb: true,
    // Logo výrobcu (predné aj na krku vzadu) je fixné — súbory public/models/logo-pred.png
    // a logo-zad.png, zákazník ho nemôže nahradiť ani vypnúť, len predné presunúť.
    logoPredPozicia: 'zaklad',
    // Doladenie polohy ťahaním priamo na 3D modeli (pozri ThreeViewport.jsx) — pripočíta sa
    // k základnej pozícii danej vyššie uvedeným dropdownom/výpočtom. {x:0,y:0} = bez posunu.
    logoPredOffset: { x: 0, y: 0 },
    erbOffset: { x: 0, y: 0 },
    rukavLoga: [],
    rukavMedzeraMm: 6,
  },
  golierTyp: 'round',
  materialKod: null,
  vlastnyVzorId: null,
  vlastnyVzorObrazky: null,
};
