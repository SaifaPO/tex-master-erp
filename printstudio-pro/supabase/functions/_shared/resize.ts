import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

// Vytvorí zmenšený PNG náhľad (dosť veľký na navrhovanie na plátne, nedostatočný na kvalitnú tlač).
export async function vytvorNahladPng(bytes: Uint8Array, maxSirkaPx = 800): Promise<Uint8Array> {
  const img = await Image.decode(bytes);
  if (img.width > maxSirkaPx) img.resize(maxSirkaPx, Image.RESIZE_AUTO);
  return await img.encode();
}
