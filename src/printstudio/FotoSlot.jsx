import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';

// Fotka materiálu/produktu s tlačidlom na nahratie alebo výmenu — súbor ide do verejného bucketu "grafiky" (priečinok `priecinok`),
// do databázy sa ukladá len verejný odkaz. Zákazník ju potom vidí vo výbere materiálu v konfigurátore.
const BUCKET = 'grafiky';

export async function nahrajFoto(supabase, subor, priecinok) {
  const cesta = `${priecinok}/${Date.now()}-${subor.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from(BUCKET).upload(cesta, subor);
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(cesta).data.publicUrl;
}

export default function FotoSlot({ supabase, url, priecinok, onZmena, popis = 'Nahrať foto' }) {
  const inputRef = useRef(null);
  const [nahravam, setNahravam] = useState(false);
  const vyber = async (e) => {
    const subor = e.target.files?.[0];
    e.target.value = '';
    if (!subor) return;
    setNahravam(true);
    try { onZmena(await nahrajFoto(supabase, subor, priecinok)); }
    catch (err) { window.alert('Nahratie fotky zlyhalo: ' + err.message); }
    setNahravam(false);
  };
  return (
    <div className="flex items-center gap-2 shrink-0">
      {url
        ? <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-700" />
        : <div className="w-16 h-16 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-600"><ImagePlus className="w-5 h-5" /></div>}
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={nahravam} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold disabled:opacity-50 text-left">{nahravam ? 'Nahrávam…' : (url ? 'Vymeniť fotku' : popis)}</button>
        {url && <button type="button" onClick={() => onZmena(null)} className="text-[10px] text-slate-500 hover:text-rose-400 text-left">Odstrániť</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={vyber} className="hidden" />
    </div>
  );
}
