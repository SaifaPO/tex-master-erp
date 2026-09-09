import React, { useState } from 'react';
import { Globe, Search } from 'lucide-react';

// Skratena, ale bezna sada statov — rovnaka ako v referencnom prototype (flagcdn.com poskytuje
// vlajky vo vysokom rozliseni a s CORS hlavickami, takze sa daju pouzit aj v canvas.toDataURL()).
const STATY = [
  { name: 'Slovensko', code: 'sk' }, { name: 'Česko', code: 'cz' }, { name: 'Poľsko', code: 'pl' },
  { name: 'Nemecko', code: 'de' }, { name: 'Rakúsko', code: 'at' }, { name: 'Maďarsko', code: 'hu' },
  { name: 'Ukrajina', code: 'ua' }, { name: 'Spojené štáty', code: 'us' }, { name: 'Spojené kráľovstvo', code: 'gb' },
  { name: 'Francúzsko', code: 'fr' }, { name: 'Taliansko', code: 'it' }, { name: 'Španielsko', code: 'es' },
  { name: 'Švajčiarsko', code: 'ch' }, { name: 'Japonsko', code: 'jp' }, { name: 'Čína', code: 'cn' },
  { name: 'Kanada', code: 'ca' }, { name: 'Austrália', code: 'au' }, { name: 'Brazília', code: 'br' },
  { name: 'Chorvátsko', code: 'hr' }, { name: 'Švédsko', code: 'se' }, { name: 'Nórsko', code: 'no' },
  { name: 'Fínsko', code: 'fi' }, { name: 'Dánsko', code: 'dk' }, { name: 'Grécko', code: 'gr' },
  { name: 'Turecko', code: 'tr' }, { name: 'Slovinsko', code: 'si' }, { name: 'Portugalsko', code: 'pt' },
  { name: 'Holandsko', code: 'nl' }, { name: 'Belgicko', code: 'be' },
];

export default function StatnaVlajkaPicker({ vybranyNazov, onVyber, onOdstranit }) {
  const [query, setQuery] = useState('');
  const filtrovane = query.trim() ? STATY.filter(s => s.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-600" /> Štátna vlajka (voliteľné)</h4>
      {vybranyNazov ? (
        <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-xs font-bold text-slate-800">{vybranyNazov}</span>
          <button onClick={onOdstranit} className="text-[11px] text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 rounded border border-red-200">Odstrániť</button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Začnite písať názov štátu…" className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2" />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          </div>
          {filtrovane.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
              {filtrovane.map(s => (
                <div key={s.code} onClick={() => { onVyber(s.name, `https://flagcdn.com/w1600/${s.code}.png`); setQuery(''); }} className="p-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-2.5 border-b border-slate-100 text-xs">
                  <img src={`https://flagcdn.com/w40/${s.code}.png`} alt="" className="w-6 h-4 object-cover rounded border border-slate-200" />
                  <span className="font-medium text-slate-800">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
