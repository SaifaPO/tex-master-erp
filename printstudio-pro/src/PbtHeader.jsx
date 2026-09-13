import React from 'react';
import pbtLogo from './assets/pbt-logo-white.png';

export default function PbtHeader({ title, subtitle, right }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-1.5 rounded-lg"><img src={pbtLogo} alt="PBT" className="w-7 h-7 object-contain" /></div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}
