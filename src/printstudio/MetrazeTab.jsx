import React from 'react';
import DtfMetrazTab from './DtfMetrazTab';
import TextilMetrazTab from './TextilMetrazTab';

// Tenky wrapper zluvcujuci dve samostatne zakaznicke Shopify appky (DTF metraz, Textilna metraz)
// pod jednu admin kartu "Metraze" — kazda si ponechava vlastne "Otvorit appku" tlacidlo, keďže
// ide o 2 rozne konfiguratory. Vyrobne naklady oboch teraz zive citaju z karty "Kostra cien".
export default function MetrazeTab({ supabase }) {
  return (
    <div className="space-y-10">
      <DtfMetrazTab supabase={supabase} />
      <div className="border-t border-slate-800" />
      <TextilMetrazTab supabase={supabase} />
    </div>
  );
}
