// Klient Supabase v "režime náhľadu" — pre Supervisora v PrintStudio Pro.
// Čítať smie všetko ako doteraz, ale každý zápis (insert/update/upsert/delete, rpc, nahrávanie/mazanie súborov,
// funkcie, ktoré nie sú len náhľad ceny) sa NEODOŠLE na server a miesto toho sa vráti chyba.
// Lokálne zmeny čísel na obrazovke zostanú (môže si skúšať), po obnovení stránky sa vrátia pôvodné hodnoty.
//
// POZOR: je to ochrana v aplikácii, nie v databáze. Pred technicky zdatným útočníkom s vlastným prihlásením
// by ju držala len databázová politika (RLS) — pre bežné používanie Supervisorom to stačí.

export const READ_ONLY_MESSAGE = 'Režim náhľadu (Supervisor): zmeny sa neukladajú.';

const WRITE_QUERY_METHODS = ['insert', 'update', 'upsert', 'delete'];
const WRITE_STORAGE_METHODS = ['upload', 'update', 'remove', 'move', 'copy', 'uploadToSignedUrl', 'createSignedUploadUrl'];

// Odpoveď "zablokované" — da sa na nu zretazit .eq().select().single() aj await-nut, vzdy skonci chybou.
function blockedResult() {
  const result = { data: null, error: { message: READ_ONLY_MESSAGE, code: 'READ_ONLY' }, count: null, status: 403, statusText: 'Read-only' };
  const chain = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
      if (prop === 'catch') return (rej) => Promise.resolve(result).catch(rej);
      if (prop === 'finally') return (fn) => Promise.resolve(result).finally(fn);
      return () => chain;
    },
    apply() { return chain; },
  });
  return chain;
}

// Funkcie, ktore len pocitaju/citaju (nahlad ceny, sumar) — tie smu bezat; ostatne (vytvorenie objednavky, Shopify sync...) nie.
function jeFunkciaLenNahlad(name, opts) {
  const body = opts && opts.body;
  return /preview|sumar/i.test(String(name)) || (body && body.preview === true);
}

export function makeReadOnlySupabase(client, onBlocked) {
  if (!client) return client;
  const zablokuj = (co) => { try { onBlocked && onBlocked(co); } catch { /* upozornenie nesmie zhodit appku */ } return blockedResult(); };

  const from = (table) => new Proxy(client.from(table), {
    get(target, prop) {
      if (WRITE_QUERY_METHODS.includes(prop)) return () => zablokuj(`${prop} ${table}`);
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });

  const storage = {
    from: (bucket) => new Proxy(client.storage.from(bucket), {
      get(target, prop) {
        if (WRITE_STORAGE_METHODS.includes(prop)) return () => zablokuj(`${prop} ${bucket}`);
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    }),
  };

  const functions = {
    invoke: (name, opts) => (jeFunkciaLenNahlad(name, opts) ? client.functions.invoke(name, opts) : zablokuj(`funkcia ${name}`)),
  };

  const overrides = { from, storage, functions, rpc: (name) => zablokuj(`rpc ${name}`), __readOnly: true };

  return new Proxy(client, {
    get(target, prop) {
      if (prop in overrides) return overrides[prop];
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
