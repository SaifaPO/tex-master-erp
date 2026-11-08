// Spoločné pre prehliadač aj skript na predpreklad: z textu spraví kľúč (čísla -> {0}, {1}…), aby sa "10 ks" a "250 ks" prekladali jedným záznamom.
export function normalizuj(text) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const jadro = m[2].replace(/\s+/g, ' ');
  const cisla = [];
  const kluc = jadro.replace(/(?<![\p{L}\d])\d+(?:[.,]\d+)*(?![\p{L}\d])/gu, (x) => { cisla.push(x); return `{${cisla.length - 1}}`; });
  return { kluc, cisla, predok: m[1], za: m[3] };
}

export function jePrekladatelny(kluc) {
  const bezCisel = kluc.replace(/\{\d+\}/g, '').trim();
  if (!/\p{L}/u.test(bezCisel) || kluc.length > 600) return false;
  if (bezCisel.length <= 6 && /^[A-Z0-9×xX.,%€\s:+\-–/()]+$/.test(bezCisel)) return false; // XL, PDF, A4, 3XL
  if (/^(https?:\/\/|[\w.+-]+@[\w-]+\.)/.test(bezCisel)) return false;
  return true;
}

export const dosad = (preklad, cisla) => preklad.replace(/\{(\d+)\}/g, (m, i) => (cisla[i] !== undefined ? cisla[i] : m));
