import React, { useState } from 'react';
import {
  FileText,
  RotateCcw,
  Search,
  CheckCircle,
  FileCheck,
  Calendar,
  Layers,
} from 'lucide-react';

export default function PolicyViewer({ activePolicy, onResetToDefault }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!activePolicy) {
    return (
      <div className="bg-white rounded-xl border border-amber-200 p-8 shadow-sm text-center">
        <FileText className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <h2 className="font-bold text-slate-900 text-lg">No policy loaded</h2>
        <p className="text-sm text-slate-600 mt-2">
          Upload a policy document to this workspace before asking grounded questions.
        </p>
      </div>
    );
  }

  const isDefault = activePolicy.isDefault;
  const filename = activePolicy?.filename || 'Acme_Innovations_Policy_v2026.1.md';
  const fullText = activePolicy?.text || '';
  const charCount = activePolicy?.charCount || fullText.length;
  const wordCount = activePolicy?.wordCount || fullText.split(/\s+/).filter(Boolean).length;
  const uploadedAt = activePolicy?.uploadedAt
    ? new Date(activePolicy.uploadedAt).toLocaleString()
    : 'Default system policy';

  // Simple paragraph-based renderer with keyword highlighting
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const filteredParagraphs = searchTerm.trim()
    ? paragraphs.filter((p) =>
        p.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : paragraphs;

  function highlightMatch(text, query) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Policy Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Grounding Document:
              </span>
              {isDefault ? (
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                  Default Acme Policy
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Custom Uploaded Policy
                </span>
              )}
            </div>
            <h2 className="font-bold text-slate-900 text-lg mt-0.5">{filename}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                {charCount.toLocaleString()} chars • {wordCount.toLocaleString()} words
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Uploaded: {uploadedAt}
              </span>
            </div>
          </div>
        </div>

        {!isDefault && onResetToDefault && (
          <button
            onClick={onResetToDefault}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Acme Default
          </button>
        )}
      </div>

      {/* In-Document Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search within this policy document..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredParagraphs.length} of {paragraphs.length} sections
        </span>
      </div>

      {/* Render Document Text */}
      <div className="space-y-3 pt-1">
        {filteredParagraphs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
            No sections match "{searchTerm}".
          </div>
        ) : (
          filteredParagraphs.map((para, idx) => {
            const isHeading = para.startsWith('#');
            const cleanPara = para.replace(/^#+\s*/, '');

            if (isHeading) {
              return (
                <div
                  key={idx}
                  className="pt-3 pb-1 border-b border-slate-200 font-bold text-slate-900 text-base"
                >
                  {highlightMatch(cleanPara, searchTerm)}
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap transition-colors"
              >
                {highlightMatch(para, searchTerm)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
