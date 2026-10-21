import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  FileCheck,
  Shield,
  Info,
} from 'lucide-react';

export default function PolicyUploader({
  activePolicy,
  onPolicyActivated,
  workspaceId = 'default',
}) {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    validateAndPreview(selected);
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    validateAndPreview(dropped);
  }

  async function validateAndPreview(selectedFile) {
    setError(null);
    setSuccessMessage(null);
    setPreview(null);
    setFile(selectedFile);

    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.txt', '.md'].includes(ext)) {
      setError(`Unsupported file format '${ext}'. Please upload a PDF (.pdf), plain text (.txt), or markdown (.md) document.`);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError(`File size (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`);
      return;
    }

    setIsParsing(true);

    try {
      // Read file as Base64 for safe binary transmission to local backend
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const res = await fetch('/api/upload-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            base64Data,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to extract text from document.');
        } else {
          setPreview(data.preview);
        }
        setIsParsing(false);
      };

      reader.onerror = () => {
        setError('Error reading local file.');
        setIsParsing(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      setError(`Document upload failed: ${err.message}`);
      setIsParsing(false);
    }
  }

  async function handleActivatePolicy() {
    if (!preview) return;
    setIsActivating(true);
    setError(null);

    try {
      const res = await fetch('/api/workspace/activate-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          filename: preview.filename,
          text: preview.text,
          charCount: preview.charCount,
          wordCount: preview.wordCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to activate policy.');
      }

      setSuccessMessage(`Successfully activated "${preview.filename}" for this workspace.`);
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onPolicyActivated) onPolicyActivated(data.policy);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActivating(false);
    }
  }

  async function handleResetToDefault() {
    setIsActivating(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/reset-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.success && onPolicyActivated) {
        setSuccessMessage('Reset workspace to default Acme Innovations policy.');
        onPolicyActivated(data.policy);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Active Policy Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Grounding Policy:
              </span>
              {activePolicy?.isDefault ? (
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                  Default Acme Policy
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Custom Client Policy
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-base mt-0.5">
              {activePolicy?.filename || 'Acme_Innovations_Policy_v2026.1.md'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activePolicy?.charCount?.toLocaleString() || '1,878'} characters •{' '}
              {activePolicy?.wordCount?.toLocaleString() || '265'} words • Local Workspace Storage
            </p>
          </div>
        </div>

        {!activePolicy?.isDefault && (
          <button
            onClick={handleResetToDefault}
            disabled={isActivating}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Acme Default
          </button>
        )}
      </div>

      {/* Upload Drop Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-bold text-slate-900 text-base">Upload Client Policy Document</h2>
          <p className="text-xs text-slate-500">
            Upload your company handbook, compliance guidelines, or IT security rules in PDF or TXT format.
          </p>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/20 rounded-xl p-8 text-center cursor-pointer transition-colors space-y-3"
        >
          <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center mx-auto text-blue-600">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Click to select or drag and drop your policy file
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports <strong>PDF (.pdf)</strong>, <strong>Plain Text (.txt)</strong>, and <strong>Markdown (.md)</strong> (Max 5 MB)
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.txt,.md"
            className="hidden"
          />
        </div>

        {isParsing && (
          <div className="p-4 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Safely parsing and extracting document text locally on your Mac...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Safe Text Preview Modal / Section */}
      {preview && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Document Extraction Preview: {preview.filename}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>{preview.charCount.toLocaleString()} chars</span>
              <span>•</span>
              <span>{preview.wordCount.toLocaleString()} words</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 font-mono text-xs text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
            {preview.preview}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Review before activating:</strong> Verify that the extracted text matches your expectations.
              Once accepted, this document will be indexed into numbered passages for local BM25 passage retrieval.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setPreview(null);
                setFile(null);
              }}
              className="text-xs font-semibold px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleActivatePolicy}
              disabled={isActivating}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
            >
              {isActivating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Activating Policy...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Accept & Activate Policy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Security & Workspace Disclaimer Card */}
      <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Local Workspace Isolation Notice</span>
        </div>
        <p className="leading-relaxed">
          Uploaded documents are stored in the local workspace directory (<code>workspaces/default/</code>) on your Mac.
          Data is processed 100% locally through your Ollama instance with zero outbound internet traffic.
          <em> Multi-tenant RBAC and authenticated session isolation will be added when moving beyond prototyping.</em>
        </p>
      </div>
    </div>
  );
}
