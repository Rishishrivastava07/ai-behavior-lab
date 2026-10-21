import React from 'react';
import { Play, Sparkles, AlertCircle, FileCheck, Upload } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  health,
  activePolicy,
  onRunBenchmark,
  isRunningBenchmark,
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl shadow-md shadow-blue-500/20 font-bold">
            🧪
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">AI Behavior Lab</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                Client-Policy Assistant
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Active Policy: <strong className="text-slate-800">{activePolicy?.filename || 'Acme Policy v2026.1'}</strong>
            </p>
          </div>
        </div>

        {/* Status Indicators & Action */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {health?.alive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ollama: 127.0.0.1:11434
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Ollama Disconnected
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              Model: {health?.model || 'qwen2.5:1.5b'}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              Budget: ₹0.00
            </span>
          </div>

          <button
            onClick={() => setActiveTab('upload')}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Policy
          </button>

          <button
            onClick={onRunBenchmark}
            disabled={isRunningBenchmark}
            className={`text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
              isRunningBenchmark
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunningBenchmark ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Benchmark
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8 text-sm overflow-x-auto">
        {[
          { id: 'playground', label: '💬 Policy AI Assistant' },
          { id: 'upload', label: '📁 Upload & Manage Policy' },
          { id: 'overview', label: '📊 Benchmark Overview' },
          { id: 'explorer', label: '🔍 Response Explorer' },
          { id: 'policy', label: '📜 Acme Policy Reference' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-1 font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
