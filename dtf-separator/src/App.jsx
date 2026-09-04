import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Lock, RefreshCw, SplitSquareHorizontal, Image as ImageIcon } from 'lucide-react';
import { renderHalftone } from './lib/halftone.js';
import { generateLpiTestSheet } from './lib/testSheet.js';
import { renderSeparation, DEFAULT_CHANNEL_ANGLES, CHANNEL_LABELS } from './lib/separation.js';

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
const CHANNEL_VIEWS = ['composite', 'c', 'm', 'y', 'k', 'white'];
const SHIRT_SWATCHES = ['#ffffff', '#0f172a', '#1e293b', '#7f1d1d', '#14532d', '#78350f'];

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
  const [viewMode, setViewMode] = useState('split'); // 'original' | 'separation' | 'split' (rezim 'spot')
  const [splitPos, setSplitPos] = useState(50);

  const [mode, setMode] = useState('spot'); // 'spot' | 'cmyk'
  const [lpi, setLpi] = useState(35);
  const [angleDeg, setAngleDeg] = useState(22.5);
  const [dotShape, setDotShape] = useState('circle');
  const [algorithm, setAlgorithm] = useState('am');
  const [inkColor, setInkColor] = useState('#000000');
  const [outputDpi, setOutputDpi] = useState(300);
  const [blackPoint, setBlackPoint] = useState(0);
  const [whitePoint, setWhitePoint] = useState(255);
  const [invert, setInvert] = useState(false);

  const [channelAngles, setChannelAngles] = useState(DEFAULT_CHANNEL_ANGLES);
  const [whiteBaseEnabled, setWhiteBaseEnabled] = useState(true);
  const [chokePx, setChokePx] = useState(1);
  const [whiteThreshold, setWhiteThreshold] = useState(0.04);
  const [previewBg, setPreviewBg] = useState('#1e293b');
  const [channelView, setChannelView] = useState('composite');

  const [previewResultCanvas, setPreviewResultCanvas] = useState(null); // rezim 'spot'
  const [separationResult, setSeparationResult] = useState(null); // rezim 'cmyk' — { channels, white, composite }
  const [isRendering, setIsRendering] = useState(false);
  const canvasWrapRef = useRef(null);
  const fileInputRef = useRef(null);

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
      if (mode === 'cmyk') {
        const result = renderSeparation(previewSourceCanvas, {
          lpi, outputDpi: scaledOutputDpi, dotShape, algorithm, blackPoint, whitePoint, channelAngles,
          whiteBase: { enabled: whiteBaseEnabled, chokePx, threshold: whiteThreshold, previewBackground: previewBg }
        });
        setSeparationResult(result);
      } else {
        const result = renderHalftone(previewSourceCanvas, { lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi: scaledOutputDpi, blackPoint, whitePoint, invert });
        setPreviewResultCanvas(result);
      }
      setIsRendering(false);
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSourceCanvas, mode, lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi, blackPoint, whitePoint, invert, channelAngles, whiteBaseEnabled, chokePx, whiteThreshold, previewBg]);

  const drawCanvasRef = useCallback((node) => {
    if (!node || !previewSourceCanvas) return;
    const ctx = node.getContext('2d');
    node.width = previewSourceCanvas.width;
    node.height = previewSourceCanvas.height;
    ctx.clearRect(0, 0, node.width, node.height);

    if (mode === 'cmyk') {
      ctx.fillStyle = previewBg;
      ctx.fillRect(0, 0, node.width, node.height);
      if (!separationResult) { ctx.drawImage(previewSourceCanvas, 0, 0); return; }
      const layer = channelView === 'composite' ? separationResult.composite
        : channelView === 'white' ? separationResult.white
        : separationResult.channels[channelView];
      if (layer) ctx.drawImage(layer, 0, 0);
      return;
    }

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
  }, [previewSourceCanvas, previewResultCanvas, separationResult, viewMode, splitPos, mode, channelView, previewBg]);

  useEffect(() => {
    if (canvasWrapRef.current) drawCanvasRef(canvasWrapRef.current);
  }, [drawCanvasRef]);

  const downloadCanvas = (canvas, suffix) => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${(fileName || 'separacia').replace(/\.[^.]+$/, '')}_${suffix}.png`;
    a.click();
  };

  const handleDownloadPng = () => {
    if (!sourceCanvas) return;
    if (mode === 'cmyk') {
      const full = renderSeparation(sourceCanvas, {
        lpi, outputDpi, dotShape, algorithm, blackPoint, whitePoint, channelAngles,
        whiteBase: { enabled: whiteBaseEnabled, chokePx, threshold: whiteThreshold, previewBackground: previewBg }
      });
      downloadCanvas(full.channels.c, 'C');
      downloadCanvas(full.channels.m, 'M');
      downloadCanvas(full.channels.y, 'Y');
      downloadCanvas(full.channels.k, 'K');
      if (full.white) downloadCanvas(full.white, 'White-underbase');
      return;
    }
    const result = renderHalftone(sourceCanvas, { lpi, angleDeg, dotShape, algorithm, inkColor, outputDpi, blackPoint, whitePoint, invert });
    downloadCanvas(result, `halftone_${lpi}lpi_${Math.round(angleDeg)}deg`);
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
        <h1 className="font-bold text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5 text-indigo-400" /> DTF/DTG Separátor <span className="text-xs text-slate-500 font-normal">— Fáza 2: viacfarebná separácia + biely podklad</span></h1>
        <button onClick={handleDownloadTestSheet} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-2 rounded-lg">Stiahnuť LPI test sheet</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6">
        <div className="space-y-3">
          {!previewSourceCanvas ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 rounded-2xl py-24 cursor-pointer hover:border-indigo-500 transition-colors">
              <Upload className="h-8 w-8 text-slate-500" />
              <span className="text-sm text-slate-400">Klikni a nahraj obrázok (PNG/JPG)</span>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
                {mode === 'spot' ? (
                  <>
                    {[['original', 'Original'], ['separation', 'Separácia'], ['split', 'Split View']].map(([v, label]) => (
                      <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                    ))}
                    {viewMode === 'split' && (
                      <div className="flex-1 flex items-center gap-2 px-2">
                        <SplitSquareHorizontal className="h-4 w-4 text-slate-500" />
                        <input type="range" min="0" max="100" value={splitPos} onChange={(e) => setSplitPos(Number(e.target.value))} className="flex-1" />
                      </div>
                    )}
                  </>
                ) : (
                  CHANNEL_VIEWS.map(v => (
                    <button key={v} onClick={() => setChannelView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${channelView === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {v === 'composite' ? 'Kompozit' : v === 'white' ? 'Biely podklad' : CHANNEL_LABELS[v]}
                    </button>
                  ))
                )}
                {isRendering && <span className="text-[10px] text-indigo-400 flex items-center gap-1 ml-auto pr-2"><RefreshCw className="h-3 w-3 animate-spin" /> počítam...</span>}
              </div>
              {mode === 'cmyk' && (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-400">
                  <span>Náhľad na farbe textílie:</span>
                  {SHIRT_SWATCHES.map(c => (
                    <button key={c} onClick={() => setPreviewBg(c)} style={{ backgroundColor: c }} className={`h-6 w-6 rounded-full border-2 ${previewBg === c ? 'border-indigo-400' : 'border-slate-700'}`} />
                  ))}
                  <input type="color" value={previewBg} onChange={(e) => setPreviewBg(e.target.value)} className="h-6 w-8 bg-transparent border border-slate-700 rounded cursor-pointer" />
                </div>
              )}
              <div className="rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center" style={{ backgroundColor: mode === 'cmyk' ? previewBg : '#ffffff' }}>
                <canvas ref={(node) => { canvasWrapRef.current = node; drawCanvasRef(node); }} className="max-w-full h-auto" />
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-slate-500 hover:text-slate-300 underline">Nahrať iný obrázok</button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </>
          )}
        </div>

        <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 h-fit max-h-[calc(100vh-3rem)] overflow-y-auto">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Režim separácie</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setMode('spot')} className={`py-1.5 rounded text-xs font-bold ${mode === 'spot' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Spot color (1 farba)</button>
              <button onClick={() => setMode('cmyk')} className={`py-1.5 rounded text-xs font-bold ${mode === 'cmyk' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>CMYK proces (4 farby)</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1"><span>LPI (veľkosť rastra)</span><span className="text-white font-mono">{lpi}</span></label>
            <input type="range" min="15" max="55" value={lpi} onChange={(e) => setLpi(Number(e.target.value))} className="w-full" />
          </div>

          {mode === 'spot' ? (
            <div>
              <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Uhol rastra</span><span className="text-white font-mono">{angleDeg}°</span></label>
              <input type="range" min="0" max="90" step="0.5" value={angleDeg} onChange={(e) => setAngleDeg(Number(e.target.value))} disabled={algorithm === 'floyd'} className="w-full disabled:opacity-40" />
            </div>
          ) : (
            <div className="space-y-2 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Uhol rastra na kanál (prevencia moiré)</span>
              {['c', 'm', 'y', 'k'].map(ch => (
                <div key={ch}>
                  <label className="text-xs text-slate-400 flex justify-between mb-0.5"><span>{CHANNEL_LABELS[ch]}</span><span className="text-white font-mono">{channelAngles[ch]}°</span></label>
                  <input type="range" min="0" max="90" step="0.5" value={channelAngles[ch]} onChange={(e) => setChannelAngles(prev => ({ ...prev, [ch]: Number(e.target.value) }))} disabled={algorithm === 'floyd'} className="w-full disabled:opacity-40" />
                </div>
              ))}
            </div>
          )}

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
            {mode === 'spot' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Farba atramentu</label>
                <input type="color" value={inkColor} onChange={(e) => setInkColor(e.target.value)} className="w-full h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer" />
              </div>
            )}
            <div className={mode === 'cmyk' ? 'col-span-2' : ''}>
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
            {mode === 'spot' && (
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} className="accent-indigo-600" /> Invertovať (svetlé = viac atramentu)
              </label>
            )}
          </div>

          {mode === 'cmyk' && (
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
                <input type="checkbox" checked={whiteBaseEnabled} onChange={(e) => setWhiteBaseEnabled(e.target.checked)} className="accent-indigo-600" /> Generovať bielu podkladovú vrstvu (underbase)
              </label>
              {whiteBaseEnabled && (
                <>
                  <div>
                    <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Choke (zmenšenie okraja)</span><span className="text-white font-mono">{chokePx}px</span></label>
                    <input type="range" min="0" max="2" step="0.25" value={chokePx} onChange={(e) => setChokePx(Number(e.target.value))} className="w-full" />
                    <p className="text-[9px] text-slate-600 mt-0.5">Zabraňuje bielemu opáru presvitajúcemu okolo halftone bodov (anti-haze).</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 flex justify-between mb-1"><span>Prah citlivosti</span><span className="text-white font-mono">{whiteThreshold.toFixed(2)}</span></label>
                    <input type="range" min="0.01" max="0.3" step="0.01" value={whiteThreshold} onChange={(e) => setWhiteThreshold(Number(e.target.value))} className="w-full" />
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={handleDownloadPng} disabled={!sourceCanvas} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> {mode === 'cmyk' ? 'Stiahnuť vrstvy (C, M, Y, K, White)' : 'Stiahnuť PNG (plné rozlíšenie)'}
          </button>
        </div>
      </div>
    </div>
  );
}
