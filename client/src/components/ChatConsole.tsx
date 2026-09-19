import React, { useEffect, useRef } from 'react';
import { ChatMessage, ActiveTool } from '../types';
import { Bot, User, Code, Terminal } from 'lucide-react';
import { CodeArtifactViewer } from './CodeArtifactViewer';

interface ChatConsoleProps {
  messages: ChatMessage[];
  activeTools: ActiveTool[];
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({ messages, activeTools }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTools]);

  // Helper to render text with embedded code blocks rendered via CodeArtifactViewer
  const renderMessageContent = (text: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(
          <div key={`text-${lastIndex}`} className="whitespace-pre-wrap mb-2">
            {text.substring(lastIndex, matchIndex).trim()}
          </div>
        );
      }

      const lang = match[1] || '';
      const codeContent = match[2];
      parts.push(
        <CodeArtifactViewer
          key={`code-${matchIndex}`}
          code={codeContent}
          language={lang}
          title="Generated Application"
        />
      );

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex).trim();
      if (remaining) {
        parts.push(
          <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {remaining}
          </div>
        );
      }
    }

    if (parts.length === 0) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    return <div>{parts}</div>;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden glass-panel rounded-2xl border border-white/10 shadow-2xl">
      {/* Console Header */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold tracking-wider uppercase text-slate-300">
            Live Stream & Tool Log
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            {messages.length} interactions
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && activeTools.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-cyan-400">
              <Bot className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-1">
              January is Ready
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              Say <span className="text-amber-300 font-mono font-bold">"Rise"</span> or type a command below. January can launch applications, coordinate your system, or build full web applications with interactive previews.
            </p>

            {/* Quick action suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left w-full max-w-md">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300">
                <span className="text-cyan-400 font-mono block mb-1">Web Application Creation</span>
                "Create a stopwatch web application with lap recorder."
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-300">
                <span className="text-purple-400 font-mono block mb-1">Claude 3.7 Engineering</span>
                "Write a high-performance LRU cache in TypeScript."
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex-shrink-0 flex items-center justify-center text-cyan-400">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-glow-cyan'
                      : 'glass-card border border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] font-mono">
                    <span>{msg.role === 'user' ? 'YOU' : 'JANUARY'}</span>
                    <span>•</span>
                    <span>{msg.source.toUpperCase()}</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div className="font-sans">
                    {renderMessageContent(msg.text)}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-500/30 flex-shrink-0 flex items-center justify-center text-indigo-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Render Tool Invocations & Claude Coding Results */}
            {activeTools.map((tool) => (
              <div
                key={tool.id}
                className="my-3 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-purple-300 font-mono">
                    <Code className="w-4 h-4 text-purple-400" />
                    <span className="font-bold">TOOL EXECUTION:</span>
                    <span className="px-2 py-0.5 rounded bg-purple-900/50 border border-purple-500/20">
                      {tool.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                      tool.status === 'running'
                        ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                        : tool.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {tool.status}
                  </span>
                </div>

                {/* Claude 3.7 Sonnet Specific Result Presentation with Interactive Live Preview */}
                {tool.name === 'delegate_coding' && tool.result && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Anthropic Claude 3.7 Sonnet Output:</span>
                    </div>

                    <CodeArtifactViewer
                      code={tool.result.htmlPreview || tool.result.codeSnippet || tool.result.response || ''}
                      title="Claude 3.7 Synthesized Application"
                    />
                  </div>
                )}

                {/* Local App Launch Result */}
                {tool.name === 'launch_app' && tool.result && (
                  <div className="text-xs font-mono text-emerald-300 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20">
                    {tool.result.message}
                  </div>
                )}

                {/* WhatsApp Message Result */}
                {tool.name === 'manage_whatsapp_message' && tool.result && (
                  <div className="text-xs font-mono text-cyan-300 bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-500/20">
                    {tool.result.message}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

