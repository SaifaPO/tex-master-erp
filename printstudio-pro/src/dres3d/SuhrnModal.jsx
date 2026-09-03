import React, { useState } from 'react';
import { X, Download } from 'lucide-react';

const BUCKET = 'print-designs';

export default function SuhrnModal({ supabase, produkt, configState, roster, materialy, cena, snapshotUrl, onClose, onBackToEdit }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [techPanel, setTechPanel] = useState('');

  const material = materialy?.find(m => m.kod === configState.materialKod);

  const stiahniJson = () => {
    const exportData = {
      produkt: produkt?.nazov || 'Custom Jersey 3D',
      datum: new Date().toISOString(),
      konfiguracia: configState,
      materialNazov: material?.nazov || null,
      roster,
      celkovaCenaEUR: Number(cena.cenaSpolu.toFixed(2)),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dres-specifikacia-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const objednat = async () => {
    if (!supabase) { setSubmitError('Supabase klient nie je nakonfigurovaný.'); return; }
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const designId = 'dres_' + Date.now();
      let nahladUrl = null;
      if (snapshotUrl) {
        const blob = await fetch(snapshotUrl).then(r => r.blob());
        const cesta = `${designId}/dres.png`;
        await supabase.storage.from(BUCKET).upload(cesta, blob, { contentType: 'image/png' });
        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(cesta);
        nahladUrl = publicUrlData?.publicUrl || null;
      }

      const payload = {
        designId,
        produktId: produkt?.id,
        vzorKod: configState.vzor,
        farby: configState.farby,
        golierTyp: configState.golierTyp,
        materialKod: configState.materialKod,
        font: configState.text.fontRodina,
        timText: configState.text.zobrazitTimText ? configState.text.timText : '',
        roster: roster.map(h => ({ meno: h.meno, cislo: h.cislo, velkost: h.velkost })),
        nahladUrl,
      };

      const { data, error } = await supabase.functions.invoke('dres-create-draft-order', { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTechPanel(JSON.stringify({ payload, response: data }, null, 2));
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Server nevrátil odkaz na platbu.');
      }
    } catch (e) {
      setSubmitError('Objednávku sa nepodarilo odoslať (' + e.message + '). Mimo živého Shopify obchodu je to očakávané — over si payload v technickom paneli.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Konfigurácia dresu dokončená</h2>
            <p className="text-xs text-slate-400">Dizajn pripravený pre výrobu.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">3D Náhľad</span>
              {snapshotUrl
                ? <img src={snapshotUrl} alt="Náhľad dresu" className="w-full h-36 sm:h-44 object-contain rounded-lg bg-slate-900 border border-slate-800" />
                : <div className="w-full h-36 sm:h-44 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">Bez náhľadu</div>}
            </div>

            <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="text-xs font-bold text-slate-300 uppercase block mb-2">Parametre zákazky</span>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Produkt:</span>
                <span className="font-bold text-white">{produkt?.nazov || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Materiál:</span>
                <span className="font-bold text-white">{material?.nazov || 'Štandard'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Počet kusov:</span>
                <span className="font-bold text-indigo-400">{cena.pocet} ks</span>
              </div>
              <div className="flex justify-between py-1 pt-2">
                <span className="text-slate-300 font-bold">Celková cena:</span>
                <span className="font-extrabold text-base text-indigo-400">{cena.cenaSpolu.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div>
              <span className="text-xs font-bold text-white block">Technický výrobný list</span>
              <span className="text-[11px] text-slate-400">Špecifikácia pre výrobu vrátane súpisky</span>
            </div>
            <button onClick={stiahniJson} className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Stiahnuť JSON
            </button>
          </div>

          {submitError && <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-lg p-2.5">{submitError}</p>}
          {techPanel && (
            <details>
              <summary className="text-[11px] text-slate-400 cursor-pointer">Technický detail</summary>
              <pre className="text-[10px] bg-slate-950 text-slate-300 p-2 rounded-lg overflow-auto max-h-48 mt-1">{techPanel}</pre>
            </details>
          )}
        </div>

        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-2.5">
          <button onClick={onBackToEdit} className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800">Upraviť</button>
          <button onClick={objednat} disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-slate-950 font-bold text-xs sm:text-sm">
            {isSubmitting ? 'Odosielam…' : 'Vložiť do košíka'}
          </button>
        </div>
      </div>
    </div>
  );
}
