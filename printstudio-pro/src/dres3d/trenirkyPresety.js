// Hotové dizajny trenírok (rovnaký princíp ako "Rýchle farebné inšpirácie" pri dresoch): jedným klikom sa nastavia farby všetkých
// zón trenírok. Zákazník ich potom môže ďalej ručne upraviť po zónach (záložka Trenírky). `prepojit: true` = farby podľa dresu.
export const TRENIRKY_PRESETY = [
  { id: 'podla_dresu', nazov: 'Podľa dresu', popis: 'Farby preberie z dresu', prepojit: true },
  { id: 'jednofarebne_modre', nazov: 'Jednofarebné modré', farby: { noha: '#1e3a8a', bok: '#1e3a8a', pasik: '#ffffff', pas: '#1e3a8a', lem: '#1e3a8a' } },
  { id: 'cierne_klasik', nazov: 'Čierne klasik', farby: { noha: '#0f172a', bok: '#0f172a', pasik: '#dc2626', pas: '#0f172a', lem: '#0f172a' } },
  { id: 'biele_modre', nazov: 'Biele s modrým pásom', farby: { noha: '#ffffff', bok: '#ffffff', pasik: '#1e3a8a', pas: '#1e3a8a', lem: '#1e3a8a' } },
  { id: 'modre_cervene_boky', nazov: 'Modré, červené boky', farby: { noha: '#1e3a8a', bok: '#dc2626', pasik: '#f59e0b', pas: '#ffffff', lem: '#1e3a8a' } },
  { id: 'cervene_biele_boky', nazov: 'Červené, biele boky', farby: { noha: '#dc2626', bok: '#ffffff', pasik: '#0f172a', pas: '#dc2626', lem: '#dc2626' } },
  { id: 'zlte_cierne', nazov: 'Žlté / čierne', farby: { noha: '#facc15', bok: '#0f172a', pasik: '#ffffff', pas: '#0f172a', lem: '#facc15' } },
  { id: 'zelene_biele', nazov: 'Zelené s bielym lemom', farby: { noha: '#16a34a', bok: '#16a34a', pasik: '#ffffff', pas: '#ffffff', lem: '#ffffff' } },
  { id: 'cierne_neon', nazov: 'Čierne, neónové boky', farby: { noha: '#0f172a', bok: '#06b6d4', pasik: '#f97316', pas: '#0f172a', lem: '#06b6d4' } },
  { id: 'fialove_biele', nazov: 'Fialové / biele', farby: { noha: '#9333ea', bok: '#ffffff', pasik: '#facc15', pas: '#9333ea', lem: '#ffffff' } },
  { id: 'oranzove_cierne', nazov: 'Oranžové / čierne', farby: { noha: '#f97316', bok: '#0f172a', pasik: '#ffffff', pas: '#0f172a', lem: '#f97316' } },
];
