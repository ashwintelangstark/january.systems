import React from 'react';
import { ActiveTool } from '../types';
import { AppWindow, Code2, MessageSquare, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';

interface ToolActivityPanelProps {
  activeTools: ActiveTool[];
  onQuickAction: (text: string) => void;
}

export const ToolActivityPanel: React.FC<ToolActivityPanelProps> = ({
  activeTools,
  onQuickAction,
}) => {
  return (
    <div className="w-80 h-full flex flex-col glass-panel rounded-2xl border border-white/10 p-5 space-y-5 select-none overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
            System & Tools
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/20">
          Ready
        </span>
      </div>

      {/* Available Tools Card */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-mono text-slate-400 font-semibold tracking-wide">
          CONNECTED CAPABILITIES
        </span>

        <div className="space-y-2">
          {/* Tool 1 */}
          <div className="p-3 rounded-xl glass-card border border-white/5 hover:border-cyan-500/30 transition-all flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/50 text-cyan-400 border border-cyan-500/20">
              <AppWindow className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Local App Launcher</div>
              <div className="text-[11px] text-slate-400 font-mono">macOS Native Process Exec</div>
            </div>
          </div>

          {/* Tool 2 */}
          <div className="p-3 rounded-xl glass-card border border-white/5 hover:border-purple-500/30 transition-all flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-500/20">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Claude 3.7 Sonnet</div>
              <div className="text-[11px] text-slate-400 font-mono">Deep Coding & Architecture</div>
            </div>
          </div>

          {/* Tool 3 */}
          <div className="p-3 rounded-xl glass-card border border-white/5 hover:border-emerald-500/30 transition-all flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">WhatsApp Automation</div>
              <div className="text-[11px] text-slate-400 font-mono">Direct OS Messaging URI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Presets */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono text-slate-400 font-semibold tracking-wide">
          QUICK PROMPT PRESETS
        </span>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onQuickAction('Launch Notes and Calculator')}
            className="text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 font-mono transition-colors border border-white/5"
          >
            ⚡ Open Notes & Calculator
          </button>
          <button
            onClick={() => onQuickAction('Use Claude 3.7 to write an asynchronous rate limiter in TypeScript')}
            className="text-left px-3 py-2 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 text-xs text-purple-200 font-mono transition-colors border border-purple-500/20"
          >
            🧠 Delegate TS Rate Limiter to Claude
          </button>
          <button
            onClick={() => onQuickAction('Draft a WhatsApp message to +14155552671 saying Meeting rescheduled to 4 PM')}
            className="text-left px-3 py-2 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 text-xs text-emerald-200 font-mono transition-colors border border-emerald-500/20"
          >
            💬 Draft WhatsApp Update
          </button>
        </div>
      </div>

      {/* Recent Tool History */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-2 border-t border-white/10">
        <span className="text-[11px] font-mono text-slate-400 font-semibold tracking-wide">
          ACTIVE SESSIONS ({activeTools.length})
        </span>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {activeTools.length === 0 ? (
            <div className="text-[11px] text-slate-500 font-mono italic py-2 text-center">
              No recent tool executions.
            </div>
          ) : (
            activeTools.map((t) => (
              <div
                key={t.id}
                className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {t.status === 'running' ? (
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0" />
                  ) : t.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="truncate text-slate-300">{t.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">
                  {new Date(t.startedAt).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
