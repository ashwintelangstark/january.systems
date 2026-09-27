import React, { useState, useEffect } from 'react';
import { useAgentSocket } from './hooks/useAgentSocket';
import { JanuaryCosmicOrb } from './components/orb/JanuaryCosmicOrb';
import { LiquidGlassDrawer } from './components/drawer/LiquidGlassDrawer';
import { FloatingPromptBar } from './components/input/FloatingPromptBar';
import { TopStatusBar } from './components/hud/TopStatusBar';
import { GreetingHeader } from './components/hud/GreetingHeader';
import {
  fetchSessions,
  createSession,
  deleteSessionApi,
  fetchSessionMessages,
  uploadAttachment,
} from './utils/api';
import { BrainSession } from './types';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  const {
    agentState,
    emotionState,
    messages,
    setMessages,
    activeTools,
    inputLevel,
    outputLevel,
    isMicMuted,
    isAudioMuted,
    isEyesOpen,
    sendTextMessage,
    triggerWake,
    toggleListening,
    toggleEyes,
    interrupt,
    toggleMuteMic,
    toggleMuteAudio,
  } = useAgentSocket(activeSessionId);

  // Load Brain Sessions on Mount
  useEffect(() => {
    fetchSessions().then(async (loadedSessions) => {
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) {
        const initialId = loadedSessions[0].id;
        setActiveSessionId(initialId);
        try {
          const msgs = await fetchSessionMessages(initialId);
          if (msgs.length > 0) {
            setMessages(msgs);
          }
        } catch {}
      } else {
        setActiveSessionId('');
        setMessages([]);
      }
    });
  }, []);

  // Handle Switching Sessions
  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsChatExpanded(true);
    const sessionMsgs = await fetchSessionMessages(sessionId);
    setMessages(sessionMsgs || []);
  };

  // Handle Creating New Chat Session
  const handleNewChat = async () => {
    const newSession = await createSession(
      `Discussion ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setIsChatExpanded(true);
  };

  // Handle Deleting Chat Session (Deletes from DB + Local State)
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionApi(sessionId);
    } catch (err) {
      console.warn('[Session] Failed to delete session on server:', err);
    }

    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          const nextId = remaining[0].id;
          setActiveSessionId(nextId);
          fetchSessionMessages(nextId).then((msgs) => setMessages(msgs));
        } else {
          setActiveSessionId('');
          setMessages([]);
        }
      }
      return remaining;
    });
  };

  // Handle Camera Eyes Toggle
  const handleToggleEyes = () => {
    toggleEyes();
  };

  // Handle Sending Text Message
  const handleSendText = async (text: string) => {
    setIsDrawerOpen(true);
    setIsChatExpanded(true);
    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const title = text.length > 30 ? `${text.substring(0, 30)}...` : text;
      const newSession = await createSession(title);
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      targetSessionId = newSession.id;
    }
    sendTextMessage(text, targetSessionId);
  };

  // Handle File Upload Attachment
  const handleFileUpload = async (file: File) => {
    try {
      setIsDrawerOpen(true);
      setIsChatExpanded(true);
      sendTextMessage(`[Attached File: ${file.name}]`);
      await uploadAttachment(file, activeSessionId);
    } catch (err) {
      console.warn('[Upload] Failed to upload file:', err);
    }
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none font-sans bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/january_bg.png')`, backgroundColor: '#B4C5D4' }}
    >
      {/* 1. Dynamic Greeting Header (SF Pro Display) */}
      <GreetingHeader
        isDrawerOpen={isDrawerOpen}
        isChatExpanded={isChatExpanded}
      />

      {/* 2. Interactive Three.js 20,000 Particle Cosmic Orb with Dual Energy Vortex */}
      <JanuaryCosmicOrb
        agentState={agentState}
        emotionState={emotionState}
        inputLevel={inputLevel}
        outputLevel={outputLevel}
        isDrawerOpen={isDrawerOpen}
        isChatExpanded={isChatExpanded}
        onActivate={() => triggerWake('manual')}
        className="z-10"
      />

      {/* 3. Top Status HUD Bar */}
      <TopStatusBar
        agentState={agentState}
        emotionState={emotionState}
        onToggleListening={toggleListening}
      />

      {/* 4. Left Floating Liquid Glass Drawer (Sessions & Extended Chat) */}
      <LiquidGlassDrawer
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        messages={messages}
        activeTools={activeTools}
        agentState={agentState}
        emotionState={emotionState}
        isEyesOpen={isEyesOpen}
        isOpen={isDrawerOpen}
        onToggleOpen={() => setIsDrawerOpen(!isDrawerOpen)}
        isChatExpanded={isChatExpanded}
        onToggleChatExpanded={() => setIsChatExpanded(!isChatExpanded)}
        onCloseChatExpanded={() => setIsChatExpanded(false)}
      />

      {/* 5. Bottom Floating Glass Prompt Dock */}
      <FloatingPromptBar
        agentState={agentState}
        isMicMuted={isMicMuted}
        isAudioMuted={isAudioMuted}
        isEyesOpen={isEyesOpen}
        onSendText={handleSendText}
        onInterrupt={interrupt}
        onToggleMic={toggleMuteMic}
        onToggleAudio={toggleMuteAudio}
        onToggleEyes={handleToggleEyes}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
};

export default App;
