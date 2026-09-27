import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Camera,
  Activity,
  Code2,
  BarChart3,
  FileText,
  Monitor,
  Target,
  Palette,
  Database,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { BrainSession, ChatMessage, ActiveTool } from '../../types';

interface LiquidGlassDrawerProps {
  sessions: BrainSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onNewChat: () => void;
  messages: ChatMessage[];
  activeTools: ActiveTool[];
  isOpen: boolean;
  onToggleOpen: () => void;
  isChatExpanded?: boolean;
  onToggleChatExpanded?: () => void;
  onCloseChatExpanded?: () => void;
}

export const LiquidGlassDrawer: React.FC<LiquidGlassDrawerProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  messages,
  activeTools,
  isOpen,
  onToggleOpen,
  isChatExpanded: controlledChatExpanded,
  onToggleChatExpanded,
  onCloseChatExpanded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalChatExpanded, setInternalChatExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isChatExpanded =
    controlledChatExpanded !== undefined ? controlledChatExpanded : internalChatExpanded;

  const toggleChatExpanded = () => {
    if (onToggleChatExpanded) {
      onToggleChatExpanded();
    } else {
      setInternalChatExpanded((prev) => !prev);
    }
  };

  const closeChat = () => {
    if (onCloseChatExpanded) {
      onCloseChatExpanded();
    } else {
      setInternalChatExpanded(false);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isChatExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatExpanded]);

  // Global Keyboard shortcuts: ⌘K for search, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isChatExpanded) {
        closeChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatExpanded]);

  const getSessionIcon = (iconName?: string) => {
    switch (iconName) {
      case 'camera':
        return <Camera className="w-4 h-4 text-cyan-400" />;
      case 'activity':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'code':
        return <Code2 className="w-4 h-4 text-blue-400" />;
      case 'chart':
        return <BarChart3 className="w-4 h-4 text-purple-400" />;
      case 'file':
        return <FileText className="w-4 h-4 text-slate-300" />;
      case 'monitor':
        return <Monitor className="w-4 h-4 text-cyan-300" />;
      case 'target':
        return <Target className="w-4 h-4 text-rose-400" />;
      case 'palette':
        return <Palette className="w-4 h-4 text-amber-400" />;
      case 'database':
        return <Database className="w-4 h-4 text-indigo-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
    }
  };

  // Filter sessions by search query
  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.summary && s.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const todaySessions = filteredSessions.filter((s) => s.category === 'Today');
  const yesterdaySessions = filteredSessions.filter((s) => s.category === 'Yesterday');
  const previousSessions = filteredSessions.filter((s) => s.category === 'Previous 7 Days');

  return (
    <div
      className={`fixed top-6 bottom-24 left-6 z-30 flex transition-all duration-500 ease-out select-none ${
        isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-20px)]'
      }`}
    >
      {/* Main Drawer Glass Panel */}
      <div
        className={`relative flex ${
          isChatExpanded ? 'w-[780px]' : 'w-[340px]'
        } h-full rounded-[28px] liquid-glass-drawer liquid-glass-glow-border transition-all duration-500 overflow-hidden shadow-2xl backdrop-blur-2xl flex-row`}
      >
        {/* Left Column: Session History (Reference Image Match) */}
        <div className="w-[340px] flex-shrink-0 flex flex-col h-full p-4 border-r border-white/[0.08]">
          {/* Top Brand Header */}
          <div className="flex items-center justify-between pb-3.5 pt-1 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-glow-cyan">
                <img
                  src="/jan_logo.png"
                  alt="January AI Logo"
                  className="w-full h-full object-contain rounded-full bg-black/40"
                />
              </div>
              <span className="font-extrabold tracking-[0.2em] text-sm text-white font-display">
                JANUARY
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleChatExpanded}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  isChatExpanded
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-glow-cyan'
                    : 'bg-white/[0.06] text-slate-300 hover:text-white border-white/10 hover:bg-white/[0.14]'
                }`}
                title={isChatExpanded ? 'Hide Chat Stream' : 'Expand Chat Stream'}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onNewChat}
                className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                title="Compose New Chat (⌘ N)"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative my-2.5">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-black/30 text-xs font-sans text-slate-200 placeholder-slate-400 rounded-xl pl-9 pr-10 py-2 border border-white/10 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all"
            />
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-400 border border-white/10">
                ⌘ K
              </kbd>
            </div>
          </div>

          {/* Session Timeline Lists */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 pt-1">
            {/* Today */}
            {todaySessions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium tracking-wider text-slate-400 uppercase px-2 mb-1.5 font-sans">
                  Today
                </p>
                <div className="space-y-1">
                  {todaySessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      icon={getSessionIcon(session.icon)}
                      onClick={() => {
                        onSelectSession(session.id);
                        if (!isChatExpanded) toggleChatExpanded();
                      }}
                      onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Yesterday */}
            {yesterdaySessions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium tracking-wider text-slate-400 uppercase px-2 mb-1.5 font-sans">
                  Yesterday
                </p>
                <div className="space-y-1">
                  {yesterdaySessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      icon={getSessionIcon(session.icon)}
                      onClick={() => {
                        onSelectSession(session.id);
                        if (!isChatExpanded) toggleChatExpanded();
                      }}
                      onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Previous 7 Days */}
            {previousSessions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium tracking-wider text-slate-400 uppercase px-2 mb-1.5 font-sans">
                  Previous 7 Days
                </p>
                <div className="space-y-1">
                  {previousSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      icon={getSessionIcon(session.icon)}
                      onClick={() => {
                        onSelectSession(session.id);
                        if (!isChatExpanded) toggleChatExpanded();
                      }}
                      onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Extended Column: Active Chat Stream (Slide Extension) */}
        {isChatExpanded && (
          <div className="w-[440px] flex-shrink-0 flex flex-col h-full bg-black/40 backdrop-blur-xl animate-in fade-in duration-300">
            {/* Chat Stream Header */}
            <div className="h-14 border-b border-white/[0.08] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
                <h3 className="text-xs font-semibold text-white tracking-wide truncate">
                  {sessions.find((s) => s.id === activeSessionId)?.title || 'Current Discussion'}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onDeleteSession && (
                  <button
                    onClick={() => onDeleteSession(activeSessionId)}
                    className="flex items-center gap-1 text-[11px] font-sans text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/15 border border-white/5 hover:border-rose-500/30 transition-all cursor-pointer"
                    title="Delete this conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  onClick={closeChat}
                  className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  title="Collapse Chat View"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                  <Sparkles className="w-8 h-8 text-cyan-400 mb-2 opacity-60" />
                  <p className="font-semibold text-slate-200">Session Initialized</p>
                  <p className="text-[11px] mt-1 text-slate-400">
                    Ask January anything, request code generation, or build 3D scenes in Blender.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600/80 text-white rounded-tr-sm shadow-glow-blue'
                          : 'bg-white/[0.06] text-slate-200 border border-white/10 rounded-tl-sm backdrop-blur-md shadow-lg'
                      }`}
                    >
                      <ChatMessageFormatter content={msg.text} isUser={msg.role === 'user'} />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}

              {/* Active Tools Execution Box */}
              {activeTools.length > 0 && (
                <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs font-mono text-cyan-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    <span>Executing Tool: {activeTools[0].name}</span>
                  </div>
                  <pre className="text-[10px] text-slate-400 overflow-x-auto bg-black/40 p-2 rounded">
                    {JSON.stringify(activeTools[0].args, null, 2)}
                  </pre>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Floating Drawer Collapse / Expand Handle */}
      <button
        onClick={onToggleOpen}
        className="self-center -ml-3 w-7 h-12 rounded-r-xl bg-black/60 hover:bg-black/80 backdrop-blur-xl border-y border-r border-white/20 flex items-center justify-center text-slate-300 hover:text-cyan-300 transition-all shadow-xl z-40"
        title={isOpen ? 'Collapse Drawer' : 'Expand Drawer'}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

// --- Single Session Card (Pixel-Perfect Match to Reference Image) ---
interface SessionCardProps {
  session: BrainSession;
  isActive: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  onDelete?: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, isActive, icon, onClick, onDelete }) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all duration-200 select-none ${
        isActive
          ? 'liquid-glass-pill-active'
          : 'liquid-glass-item hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* Session Icon Badge */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
            isActive
              ? 'bg-blue-500/30 text-white border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
              : 'bg-white/[0.05] border border-white/[0.08]'
          }`}
        >
          {icon}
        </div>

        {/* Title and Subtext */}
        <div className="min-w-0">
          <h4
            className={`text-xs font-semibold font-sans truncate tracking-tight ${
              isActive ? 'text-white' : 'text-slate-200'
            }`}
          >
            {session.title}
          </h4>
          {session.summary && (
            <p className="text-[10px] font-sans text-slate-400 truncate mt-0.5">
              {session.summary}
            </p>
          )}
        </div>
      </div>

      {/* Timestamp & Delete Action */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-mono text-slate-400 font-medium group-hover:hidden">
          {new Date(session.updatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
            title="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Formats message text, code blocks, and copy actions ---
interface ChatMessageFormatterProps {
  content: string;
  isUser: boolean;
}

const ChatMessageFormatter: React.FC<ChatMessageFormatterProps> = ({ content, isUser }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (isUser) {
    return <p className="whitespace-pre-wrap font-sans">{content}</p>;
  }

  // Split content by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text' as const,
        value: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code' as const,
      lang: match[1] || 'plaintext',
      code: match[2].trim(),
      index: blockIndex++,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text' as const,
      value: content.slice(lastIndex),
    });
  }

  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap font-sans">{content}</p>;
  }

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-2 font-sans">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <p key={i} className="whitespace-pre-wrap leading-relaxed">
              {part.value}
            </p>
          );
        }

        return (
          <div
            key={i}
            className="my-2 rounded-xl bg-black/60 border border-white/10 overflow-hidden shadow-inner text-xs font-mono"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.08] text-[10px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-cyan-400">
                {part.lang}
              </span>
              <button
                onClick={() => handleCopy(part.code, part.index)}
                className="flex items-center gap-1 hover:text-white transition-colors"
                title="Copy code"
              >
                {copiedIndex === part.index ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-[11px] text-slate-200 leading-normal font-mono">
              <code>{part.code}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
};
