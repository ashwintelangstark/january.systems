import React, { useState, useMemo } from 'react';
import { Play, Code, Copy, Check, ExternalLink, RefreshCw, Smartphone, Tablet, Monitor, Download, Maximize2, Minimize2 } from 'lucide-react';

interface CodeArtifactViewerProps {
  code: string;
  language?: string;
  title?: string;
  defaultTab?: 'preview' | 'code';
}

export const CodeArtifactViewer: React.FC<CodeArtifactViewerProps> = ({
  code,
  language,
  title = 'Application Output',
  defaultTab,
}) => {
  // Extract clean code if enclosed in markdown fences
  const { cleanCode, detectedLang, isHtmlRunnable } = useMemo(() => {
    let extracted = code.trim();
    let lang = (language || '').toLowerCase();

    const match = extracted.match(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
    if (match) {
      if (match[1]) lang = match[1].toLowerCase();
      extracted = match[2].trim();
    }

    const isHtml =
      lang === 'html' ||
      lang === 'htm' ||
      extracted.includes('<!DOCTYPE') ||
      extracted.includes('<html') ||
      extracted.includes('<body') ||
      (extracted.includes('<div') && extracted.includes('<script')) ||
      (extracted.includes('<style') && extracted.includes('<button')) ||
      (extracted.includes('<canvas') && extracted.includes('<script'));

    return {
      cleanCode: extracted,
      detectedLang: lang || (isHtml ? 'html' : 'typescript'),
      isHtmlRunnable: isHtml,
    };
  }, [code, language]);

  const [activeTab, setActiveTab] = useState<'preview' | 'code'>(
    defaultTab || (isHtmlRunnable ? 'preview' : 'code')
  );
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewWindow = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(cleanCode);
      win.document.close();
    }
  };

  const handleDownload = () => {
    const ext = detectedLang === 'html' ? 'html' : detectedLang === 'python' ? 'py' : detectedLang === 'javascript' ? 'js' : 'ts';
    const blob = new Blob([cleanCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `january_app_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const codeLines = useMemo(() => cleanCode.split('\n'), [cleanCode]);

  return (
    <div
      className={`rounded-2xl border border-cyan-500/30 bg-slate-950/80 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 flex flex-col bg-[#07090e] border-cyan-500/60 shadow-[0_0_50px_rgba(6,182,212,0.3)]'
          : 'my-3 w-full'
      }`}
    >
      {/* Top Controls Bar */}
      <div className="px-4 py-2.5 bg-black/40 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Tabs */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
          {isHtmlRunnable && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
                activeTab === 'preview'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Live Preview</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>
          )}

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition-all ${
              activeTab === 'code'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/10 text-cyan-300">
              {detectedLang}
            </span>
          </button>
        </div>

        {/* Center: Device Switcher (only in preview mode) */}
        {activeTab === 'preview' && isHtmlRunnable && (
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setDeviceMode('desktop')}
              title="Desktop View"
              className={`p-1.5 rounded-lg transition-colors ${
                deviceMode === 'desktop' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              title="Tablet View (768px)"
              className={`p-1.5 rounded-lg transition-colors ${
                deviceMode === 'tablet' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              title="Mobile View (375px)"
              className={`p-1.5 rounded-lg transition-colors ${
                deviceMode === 'mobile' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reload Preview"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-colors ml-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isHtmlRunnable && (
            <button
              onClick={handleOpenNewWindow}
              title="Open Live Preview in New Window"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-cyan-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleDownload}
            title="Download source file"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-cyan-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-purple-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`relative ${isFullscreen ? 'flex-1 overflow-hidden' : 'h-[380px]'}`}>
        {/* Tab 1: Live Interactive Iframe Preview */}
        {activeTab === 'preview' && isHtmlRunnable && (
          <div className="w-full h-full bg-[#07090e] flex items-center justify-center p-3 overflow-auto">
            <div
              className={`h-full bg-slate-900 rounded-xl overflow-hidden border border-white/15 shadow-2xl transition-all duration-300 flex flex-col ${
                deviceMode === 'mobile'
                  ? 'w-[375px] max-w-full'
                  : deviceMode === 'tablet'
                  ? 'w-[768px] max-w-full'
                  : 'w-full'
              }`}
            >
              {/* Mock Browser Header Bar */}
              <div className="px-3 py-2 bg-slate-950/80 border-b border-white/10 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-cyan-400/80 max-w-[280px] truncate">
                    preview://january-sandbox.app
                  </div>
                </div>
              </div>

              {/* Sandboxed Interactive App Iframe */}
              <iframe
                key={iframeKey}
                title={title}
                srcDoc={cleanCode}
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                className="w-full flex-1 border-none bg-black"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Formatted Code View with Line Numbers */}
        {(activeTab === 'code' || !isHtmlRunnable) && (
          <div className="w-full h-full bg-slate-950 overflow-auto p-4 font-mono text-xs text-slate-200">
            <div className="flex min-w-full">
              {/* Line Numbers */}
              <div className="select-none pr-4 text-right text-slate-600 font-mono flex flex-col border-r border-white/5 mr-4">
                {codeLines.map((_, i) => (
                  <span key={i} className="leading-relaxed text-[11px]">
                    {i + 1}
                  </span>
                ))}
              </div>

              {/* Code Content */}
              <pre className="flex-1 leading-relaxed text-[12px] font-mono text-cyan-100 whitespace-pre overflow-x-auto">
                <code>{cleanCode}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
