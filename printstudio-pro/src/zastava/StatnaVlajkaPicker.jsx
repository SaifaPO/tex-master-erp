import React, { useState } from 'react';
import { Globe, Search } from 'lucide-react';

// Kompletny zoznam statov sveta (vsetky clenske staty OSN + niekolko bezne ziadanych uzemi ako
// Taiwan/Vatikan/Kosovo/Palestina) — flagcdn.com poskytuje vlajky vo vysokom rozliseni a s CORS
// hlavickami podla ISO 3166-1 alpha-2 kodu, takze sa daju pouzit aj v canvas.toDataURL().
const STATY = [
  { name: 'Afganistan', code: 'af' }, { name: 'Albánsko', code: 'al' }, { name: 'Alžírsko', code: 'dz' },
  { name: 'Andorra', code: 'ad' }, { name: 'Angola', code: 'ao' }, { name: 'Antigua a Barbuda', code: 'ag' },
  { name: 'Argentína', code: 'ar' }, { name: 'Arménsko', code: 'am' }, { name: 'Austrália', code: 'au' },
  { name: 'Azerbajdžan', code: 'az' }, { name: 'Bahamy', code: 'bs' }, { name: 'Bahrajn', code: 'bh' },
  { name: 'Bangladéš', code: 'bd' }, { name: 'Barbados', code: 'bb' }, { name: 'Belgicko', code: 'be' },
  { name: 'Belize', code: 'bz' }, { name: 'Benin', code: 'bj' }, { name: 'Bhután', code: 'bt' },
  { name: 'Bielorusko', code: 'by' }, { name: 'Bolívia', code: 'bo' }, { name: 'Bosna a Hercegovina', code: 'ba' },
  { name: 'Botswana', code: 'bw' }, { name: 'Brazília', code: 'br' }, { name: 'Brunej', code: 'bn' },
  { name: 'Bulharsko', code: 'bg' }, { name: 'Burkina Faso', code: 'bf' }, { name: 'Burundi', code: 'bi' },
  { name: 'Cyprus', code: 'cy' }, { name: 'Čad', code: 'td' }, { name: 'Čierna Hora', code: 'me' },
  { name: 'Čile', code: 'cl' }, { name: 'Čína', code: 'cn' }, { name: 'Česko', code: 'cz' },
  { name: 'Dánsko', code: 'dk' }, { name: 'Demokratická republika Kongo', code: 'cd' }, { name: 'Dominika', code: 'dm' },
  { name: 'Dominikánska republika', code: 'do' }, { name: 'Džibutsko', code: 'dj' }, { name: 'Egypt', code: 'eg' },
  { name: 'Ekvádor', code: 'ec' }, { name: 'Eritrea', code: 'er' }, { name: 'Estónsko', code: 'ee' },
  { name: 'Eswatini', code: 'sz' }, { name: 'Etiópia', code: 'et' }, { name: 'Fidži', code: 'fj' },
  { name: 'Filipíny', code: 'ph' }, { name: 'Fínsko', code: 'fi' }, { name: 'Francúzsko', code: 'fr' },
  { name: 'Gabon', code: 'ga' }, { name: 'Gambia', code: 'gm' }, { name: 'Ghana', code: 'gh' },
  { name: 'Grécko', code: 'gr' }, { name: 'Grenada', code: 'gd' }, { name: 'Gruzínsko', code: 'ge' },
  { name: 'Guatemala', code: 'gt' }, { name: 'Guinea', code: 'gn' }, { name: 'Guinea-Bissau', code: 'gw' },
  { name: 'Guyana', code: 'gy' }, { name: 'Haiti', code: 'ht' }, { name: 'Holandsko', code: 'nl' },
  { name: 'Honduras', code: 'hn' }, { name: 'Chorvátsko', code: 'hr' }, { name: 'India', code: 'in' },
  { name: 'Indonézia', code: 'id' }, { name: 'Irak', code: 'iq' }, { name: 'Irán', code: 'ir' },
  { name: 'Írsko', code: 'ie' }, { name: 'Island', code: 'is' }, { name: 'Izrael', code: 'il' },
  { name: 'Jamajka', code: 'jm' }, { name: 'Japonsko', code: 'jp' }, { name: 'Jemen', code: 'ye' },
  { name: 'Jordánsko', code: 'jo' }, { name: 'Južná Afrika', code: 'za' }, { name: 'Južná Kórea', code: 'kr' },
  { name: 'Južný Sudán', code: 'ss' }, { name: 'Kambodža', code: 'kh' }, { name: 'Kamerun', code: 'cm' },
  { name: 'Kanada', code: 'ca' }, { name: 'Katar', code: 'qa' }, { name: 'Kazachstan', code: 'kz' },
  { name: 'Keňa', code: 'ke' }, { name: 'Kirgizsko', code: 'kg' }, { name: 'Kiribati', code: 'ki' },
  { name: 'Kolumbia', code: 'co' }, { name: 'Komory', code: 'km' }, { name: 'Kongo (Konžská republika)', code: 'cg' },
  { name: 'Kosovo', code: 'xk' }, { name: 'Kostarika', code: 'cr' }, { name: 'Kuba', code: 'cu' },
  { name: 'Kuvajt', code: 'kw' }, { name: 'Laos', code: 'la' }, { name: 'Lesotho', code: 'ls' },
  { name: 'Libanon', code: 'lb' }, { name: 'Libéria', code: 'lr' }, { name: 'Líbya', code: 'ly' },
  { name: 'Lichtenštajnsko', code: 'li' }, { name: 'Litva', code: 'lt' }, { name: 'Lotyšsko', code: 'lv' },
  { name: 'Luxembursko', code: 'lu' }, { name: 'Madagaskar', code: 'mg' }, { name: 'Maďarsko', code: 'hu' },
  { name: 'Malajzia', code: 'my' }, { name: 'Malawi', code: 'mw' }, { name: 'Maldivy', code: 'mv' },
  { name: 'Mali', code: 'ml' }, { name: 'Malta', code: 'mt' }, { name: 'Maroko', code: 'ma' },
  { name: 'Marshallove ostrovy', code: 'mh' }, { name: 'Mauritánia', code: 'mr' }, { name: 'Maurícius', code: 'mu' },
  { name: 'Mexiko', code: 'mx' }, { name: 'Mikronézia', code: 'fm' }, { name: 'Moldavsko', code: 'md' },
  { name: 'Monako', code: 'mc' }, { name: 'Mongolsko', code: 'mn' }, { name: 'Mozambik', code: 'mz' },
  { name: 'Mjanmarsko (Barma)', code: 'mm' }, { name: 'Namíbia', code: 'na' }, { name: 'Nauru', code: 'nr' },
  { name: 'Nemecko', code: 'de' }, { name: 'Nepál', code: 'np' }, { name: 'Niger', code: 'ne' },
  { name: 'Nigéria', code: 'ng' }, { name: 'Nikaragua', code: 'ni' }, { name: 'Nórsko', code: 'no' },
  { name: 'Nový Zéland', code: 'nz' }, { name: 'Omán', code: 'om' }, { name: 'Pakistan', code: 'pk' },
  { name: 'Palau', code: 'pw' }, { name: 'Palestína', code: 'ps' }, { name: 'Panama', code: 'pa' },
  { name: 'Papua-Nová Guinea', code: 'pg' }, { name: 'Paraguaj', code: 'py' }, { name: 'Peru', code: 'pe' },
  { name: 'Poľsko', code: 'pl' }, { name: 'Portugalsko', code: 'pt' }, { name: 'Rakúsko', code: 'at' },
  { name: 'Rovníková Guinea', code: 'gq' }, { name: 'Rumunsko', code: 'ro' }, { name: 'Rusko', code: 'ru' },
  { name: 'Rwanda', code: 'rw' }, { name: 'Salvádor', code: 'sv' }, { name: 'Samoa', code: 'ws' },
  { name: 'San Maríno', code: 'sm' }, { name: 'Saudská Arábia', code: 'sa' }, { name: 'Senegal', code: 'sn' },
  { name: 'Severná Kórea', code: 'kp' }, { name: 'Severné Macedónsko', code: 'mk' }, { name: 'Seychely', code: 'sc' },
  { name: 'Sierra Leone', code: 'sl' }, { name: 'Singapur', code: 'sg' }, { name: 'Slovensko', code: 'sk' },
  { name: 'Slovinsko', code: 'si' }, { name: 'Somálsko', code: 'so' }, { name: 'Spojené arabské emiráty', code: 'ae' },
  { name: 'Spojené kráľovstvo', code: 'gb' }, { name: 'Spojené štáty', code: 'us' }, { name: 'Srbsko', code: 'rs' },
  { name: 'Srí Lanka', code: 'lk' }, { name: 'Stredoafrická republika', code: 'cf' }, { name: 'Sudán', code: 'sd' },
  { name: 'Surinam', code: 'sr' }, { name: 'Švajčiarsko', code: 'ch' }, { name: 'Švédsko', code: 'se' },
  { name: 'Sýria', code: 'sy' }, { name: 'Tadžikistan', code: 'tj' }, { name: 'Taiwan', code: 'tw' },
  { name: 'Tanzánia', code: 'tz' }, { name: 'Thajsko', code: 'th' }, { name: 'Taliansko', code: 'it' },
  { name: 'Togo', code: 'tg' }, { name: 'Tonga', code: 'to' }, { name: 'Trinidad a Tobago', code: 'tt' },
  { name: 'Tunisko', code: 'tn' }, { name: 'Turecko', code: 'tr' }, { name: 'Turkménsko', code: 'tm' },
  { name: 'Tuvalu', code: 'tv' }, { name: 'Uganda', code: 'ug' }, { name: 'Ukrajina', code: 'ua' },
  { name: 'Uruguaj', code: 'uy' }, { name: 'Uzbekistan', code: 'uz' }, { name: 'Vanuatu', code: 'vu' },
  { name: 'Vatikán', code: 'va' }, { name: 'Venezuela', code: 've' }, { name: 'Vietnam', code: 'vn' },
  { name: 'Východný Timor', code: 'tl' }, { name: 'Zambia', code: 'zm' }, { name: 'Zelený mys (Kapverdy)', code: 'cv' },
  { name: 'Zimbabwe', code: 'zw' }, { name: 'Španielsko', code: 'es' },
].sort((a, b) => a.name.localeCompare(b.name, 'sk'));

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
