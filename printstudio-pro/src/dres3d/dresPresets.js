// Statické vizuálne šablóny 3D konfigurátora dresov — vzory, goliere, preset palety,
// rýchle farby, značkové logá a emoji erby. Nie sú to obchodné dáta (tie sú v Supabase),
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

export const VSETKY_GOLIERE = [
  { id: 'round', nazov: 'Okrúhly' },
  { id: 'vneck', nazov: 'V-Výstrih' },
  { id: 'ribbed', nazov: 'Rebrovaný' },
];

export const PRESET_PALETY = [
  { nazov: 'Kráľovský Madrid', base: '#ffffff', pattern: '#f59e0b', accent: '#1e3a8a', sleeves: '#ffffff', collar: '#1e3a8a' },
  { nazov: 'Barcelona Blaugrana', base: '#1e3a8a', pattern: '#991b1b', accent: '#f59e0b', sleeves: '#1e3a8a', collar: '#f59e0b' },
  { nazov: 'Miláno Čierno-červená', base: '#0f172a', pattern: '#dc2626', accent: '#ffffff', sleeves: '#0f172a', collar: '#dc2626' },
  { nazov: 'Dortmund Neon Žltá', base: '#facc15', pattern: '#0f172a', accent: '#ffffff', sleeves: '#0f172a', collar: '#0f172a' },
];

export const RYCHLE_FARBY = ['#ffffff', '#000000', '#dc2626', '#1e3a8a', '#2563eb', '#16a34a', '#facc15', '#f97316', '#9333ea', '#06b6d4'];

export const BRAND_LOGA = [
  { id: 'swoosh', nazov: 'Dynamic Speed Streak' },
  { id: 'geometric', nazov: 'Apex Diamond' },
  { id: 'spized', nazov: 'SPIZED Vector' },
];

export const EMOJI_ERBY = [
  { id: 'shield', nazov: 'Štít', emoji: '🛡️' },
  { id: 'star', nazov: 'Hviezda', emoji: '⭐' },
  { id: 'eagle', nazov: 'Orol', emoji: '🦅' },
  { id: 'crown', nazov: 'Koruna', emoji: '👑' },
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
    fontRodina: 'Teko',
    farbaTextu: '#ffffff',
    farbaObrysu: '#000000',
    timText: 'FLY EMIRATES',
    zobrazitTimText: true,
  },
  loga: {
    typErbu: 'shield',
    vlastnyErbImg: null,
    zobrazitErb: true,
    brandIcon: 'swoosh',
    zobrazitBrandLogo: true,
    zobrazitOdznakRukav: true,
  },
  golierTyp: 'round',
  materialKod: null,
};
