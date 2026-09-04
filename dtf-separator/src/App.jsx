import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Lock, RefreshCw, SplitSquareHorizontal, Image as ImageIcon } from 'lucide-react';
import { renderHalftone } from './lib/halftone.js';
import { generateLpiTestSheet } from './lib/testSheet.js';

const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || 'grafik2026';
const STORAGE_KEY = 'dtf-sep-unlocked';
const PREVIEW_MAX = 1000; // px na dlhsej strane, kvoli plynulemu live nahladu

const DOT_SHAPES = [
  { value: 'circle', label: 'Kruh' },
  { value: 'ellipse', label: 'Elipsa' },
  { value: 'diamond', label: 'Diamant' },
  { value: 'square', label: 'Štvorec' },
  { value: 'line', label: 'Línia' }
];
const ALGORITHMS = [
  { value: 'am', label: 'AM raster (klasický rastúci bod)' },
  { value: 'bayer', label: 'Ordered dithering (Bayer matica)' },
  { value: 'floyd', label: 'Error diffusion (Floyd-Steinberg)' }
];

function PasscodeGate({ onUnlock }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (code === ACCESS_CODE) {
      localStorage.setItem(STORAGE_KEY, '1');
      onUnlock();
    } else {
      setError('Nesprávny kód.');
    }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-xs space-y-4 text-center">
        <Lock className="h-8 w-8 text-indigo-400 mx-auto" />
        <h1 className="text-white font-bold">DTF/DTG Separátor</h1>
        <p className="text-xs text-slate-500">Interný nástroj — zadaj prístupový kód.</p>
        <input
          type="password"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          autoFocus
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-center tracking-widest"
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-sm">Vstúpiť</button>
      </form>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [sourceCanvas, setSourceCanvas] = useState(null); // full-res
  const [previewSourceCanvas, setPreviewSourceCanvas] = useState(null); // downscaled for live preview
  const [fileName, setFileName] = useState('');
  const [viewMode, setViewMode] = useState('split'); // 'original' | 'separation' | 'split'
  const [splitPos, setSplitPos] = useState(50);

  const [lpi, setLpi] = useState(35);
  const [angleDeg, setAngleDeg] = useState(22.5);
  const [dotShape, setDotShape] = useState('circle');
  const [algorithm, setAlgorithm] = useState('am');
  const [inkColor, setInkColor] = useState('#000000');
  const [outputDpi, setOutputDpi] = useState(300);
  const [blackPoint, setBlackPoint] = useState(0);
  const [whitePoint, setWhitePoint] = useState(255);
  const [invert, setInvert] = useState(false);

  const [previewResultCanvas, setPreviewResultCanvas] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const canvasWrapRef = useRef(null);
  const fileInputRef = useRef(null);

  const params = { lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi: Math.round(outputDpi * (previewSourceCanvas ? previewSourceCanvas._scale || 1 : 1)), blackPoint, whitePoint, invert };

  const handleFile = (file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const full = document.createElement('canvas');
      full.width = img.width;
      full.height = img.height;
      full.getContext('2d').drawImage(img, 0, 0);
      setSourceCanvas(full);

      const scale = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
      const prev = document.createElement('canvas');
      prev.width = Math.max(1, Math.round(img.width * scale));
      prev.height = Math.max(1, Math.round(img.height * scale));
      prev.getContext('2d').drawImage(img, 0, 0, prev.width, prev.height);
      prev._scale = scale;
      setPreviewSourceCanvas(prev);
      setFileName(file.name);
    };
    img.src = URL.createObjectURL(file);
  };

  // Live nahlad — prepocita sa (debounced) pri kazdej zmene parametra, na znizenom rozliseni kvoli rychlosti.
  useEffect(() => {
    if (!previewSourceCanvas) return;
    setIsRendering(true);
    const t = setTimeout(() => {
      const scaledOutputDpi = Math.max(20, Math.round(outputDpi * (previewSourceCanvas._scale || 1)));
      const result = renderHalftone(previewSourceCanvas, { lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi: scaledOutputDpi, blackPoint, whitePoint, invert });
      setPreviewResultCanvas(result);
      setIsRendering(false);
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSourceCanvas, lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi, blackPoint, whitePoint, invert]);

  const drawCanvasRef = useCallback((node) => {
    if (!node || !previewSourceCanvas) return;
    const ctx = node.getContext('2d');
    node.width = previewSourceCanvas.width;
    node.height = previewSourceCanvas.height;
    ctx.clearRect(0, 0, node.width, node.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, node.width, node.height);
    if (viewMode === 'original' || !previewResultCanvas) {
      ctx.drawImage(previewSourceCanvas, 0, 0);
    } else if (viewMode === 'separation') {
      ctx.drawImage(previewResultCanvas, 0, 0);
    } else {
      const splitX = Math.round((splitPos / 100) * node.width);
      ctx.drawImage(previewSourceCanvas, 0, 0, splitX, node.height, 0, 0, splitX, node.height);
      ctx.drawImage(previewResultCanvas, splitX, 0, node.width - splitX, node.height, splitX, 0, node.width - splitX, node.height);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, node.height); ctx.stroke();
    }
  }, [previewSourceCanvas, previewResultCanvas, viewMode, splitPos]);

  useEffect(() => {
    if (canvasWrapRef.current) drawCanvasRef(canvasWrapRef.current);
  }, [drawCanvasRef]);

  const handleDownloadPng = () => {
    if (!sourceCanvas) return;
    const result = renderHalftone(sourceCanvas, { lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi, blackPoint, whitePoint, invert });
    const a = document.createElement('a');
    a.href = result.toDataURL('image/png');
    a.download = `${(fileName || 'separacia').replace(/\.[^.]+$/, '')}_halftone_${lpi}lpi_${Math.round(angleDeg)}deg.png`;
    a.click();
  };

  const handleDownloadTestSheet = () => {
    const sheet = generateLpiTestSheet({ dotShape, inkColor, outputDpi });
    const a = document.createElement('a');
    a.href = sheet.toDataURL('image/png');
    a.download = 'lpi_test_sheet.png';
    a.click();
  };

  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5 text-indigo-400" /> DTF/DTG Separátor <span className="text-xs text-slate-500 font-normal">— Fáza 1: spot-color halftone</span></h1>
        <button onClick={handleDownloadTestSheet} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-2 rounded-lg">Stiahnuť LPI test sheet</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-6">
        <div className="space-y-3">
          {!previewSourceCanvas ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-2xl py-24 cursor-pointer hover:border-indigo-500 transition-colors">
              <Upload className="h-8 w-8 text-slate-500" />
              <span className="text-sm text-slate-400">Klikni a nahraj obrázok (PNG/JPG)</span>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                {[['original', 'Original'], ['separation', 'Separácia'], ['split', 'Split View']].map(([v, label]) => (
                  <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                ))}
                {viewMode === 'split' && (
                  <div className="flex-1 flex items-center gap-2 px-2">
                    <SplitSquareHorizontal className="h-4 w-4 text-slate-500" />
                    <input type="range" min="0" max="100" value={splitPos} onChange={(e) => setSplitPos(Number(e.target.value))} className="flex-1" />
                  </div>
                )}
                {isRendering && <span className="text-[10px] text-indigo-400 flex items-center gap-1 ml-auto pr-2"><RefreshCw className="h-3 w-3 animate-spin" /> počítam...</span>}
              </div>
              <div className="bg-white rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <canvas ref={(node) => { canvasWrapRef.current = node; drawCanvasRef(node); }} className="max-w-full h-auto" />
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-slate-500 hover:text-slate-300 underline">Nahrať iný obrázok</button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </>
          )}
        </div>

        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 h-fit">
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>LPI (veľkosť rastra)</span><span className="text-white font-mono">{lpi}</span></label>
            <input type="range" min="15" max="55" value={lpi} onChange={(e) => setLpi(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Uhol rastra</span><span className="text-white font-mono">{angleDeg}°</span></label>
            <input type="range" min="0" max="90" step="0.5" value={angleDeg} onChange={(e) => setAngleDeg(Number(e.target.value))} disabled={algorithm === 'floyd'} className="w-full disabled:opacity-40" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Algoritmus</label>
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
              {ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tvar bodu</label>
            <select value={dotShape} onChange={(e) => setDotShape(e.target.value)} disabled={algorithm === 'bayer' || algorithm === 'floyd'} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-40">
              {DOT_SHAPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Farba atramentu</label>
              <input type="color" value={inkColor} onChange={(e) => setInkColor(e.target.value)} className="w-full h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Output DPI</label>
              <input type="number" min="72" max="600" step="1" value={outputDpi} onChange={(e) => setOutputDpi(Number(e.target.value) || 300)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white" />
            </div>
          </div>
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Levels (čierny/biely bod)</span>
            <div>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Čierny bod</span><span className="text-white font-mono">{blackPoint}</span></label>
              <input type="range" min="0" max="254" value={blackPoint} onChange={(e) => setBlackPoint(Math.min(Number(e.target.value), whitePoint - 1))} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Biely bod</span><span className="text-white font-mono">{whitePoint}</span></label>
              <input type="range" min="1" max="255" value={whitePoint} onChange={(e) => setWhitePoint(Math.max(Number(e.target.value), blackPoint + 1))} className="w-full" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="accent-indigo-600" /> Invertovať (svetlé = viac atramentu)
            </label>
          </div>
          <button onClick={handleDownloadPng} disabled={!sourceCanvas} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> Stiahnuť PNG (plné rozlíšenie)
          </button>
        </div>
      </div>
    </div>
  );
}
