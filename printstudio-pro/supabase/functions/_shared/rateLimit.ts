// Rate-limit pre AI funkcie — tri vrstvy: na reláciu prehliadača, na IP adresu, a celkový
// denný strop pre celý eshop (poistka, aj keby niekto obchádzal session/IP). Limity sa dajú
// meniť cez `supabase secrets set` bez nutnosti redeploy (čítajú sa za behu).
const MAX_PER_SESSION_PER_DAY = parseInt(Deno.env.get('AI_MAX_PER_SESSION_PER_DAY') || '8');
const MAX_PER_IP_PER_DAY = parseInt(Deno.env.get('AI_MAX_PER_IP_PER_DAY') || '15');
const MAX_GLOBAL_PER_DAY = parseInt(Deno.env.get('AI_MAX_GLOBAL_PER_DAY') || '300');

export class RateLimitError extends Error {}

export function ziskajIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function skontrolujARegistrujLimit(
  supabase: any,
  { ip, sessionId, typ }: { ip: string; sessionId: string | null; typ: 'generate' | 'prepare' },
) {
  const od = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: globalCount }, { count: ipCount }, sessionRes] = await Promise.all([
    supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).gte('created_at', od),
    supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).eq('ip_address', ip).gte('created_at', od),
    sessionId
      ? supabase.from('ai_pouzitie').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).gte('created_at', od)
      : Promise.resolve({ count: 0 }),
  ]);

  if ((globalCount || 0) >= MAX_GLOBAL_PER_DAY) {
    throw new RateLimitError('Dnešný limit AI generovania pre celý eshop je vyčerpaný. Skús to prosím zajtra.');
  }
  if ((ipCount || 0) >= MAX_PER_IP_PER_DAY) {
    throw new RateLimitError('Dosiahol si dnešný limit AI generovania z tejto siete. Skús to prosím zajtra.');
  }
  if ((sessionRes.count || 0) >= MAX_PER_SESSION_PER_DAY) {
    throw new RateLimitError('Dosiahol si dnešný limit AI generovania pre túto reláciu. Skús to prosím zajtra.');
  }

  await supabase.from('ai_pouzitie').insert({ ip_address: ip, session_id: sessionId, typ });
}
